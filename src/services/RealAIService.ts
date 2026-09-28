import { type Transaction, type Category } from '../types';
import type { Meta, Deuda, GastoRecurrente, UserLevel } from '../types';
import {
  calcularMetricasFinancieras,
  buildContextoIA,
  type MetricasFinancieras,
} from '../utils/ingresoUtils';
import { procesarMensajeUsuario } from './ai/AIService';
import { finnMemoryService } from './FinnMemoryService';
import { CONFIG } from '../constants/config';
import { getWorkerHeaders, AIConsentRequiredError } from './workerAuth';
import { consentService } from './ConsentService';
import { minimizarParaIA } from '../utils/aiPrivacy';
import type { SharedSpaceSummary } from '../features/shared-finances/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MensajeChat {
  role:    'user' | 'assistant';
  content: string;
}

export interface RespuestaIA {
  texto:   string;
  exito:   boolean;
  error?:  string;
  tokens?: number;
}

// Contexto extra personalizado por usuario
export interface ContextoPersonalizado {
  metas?: Meta[];
  deudas?: Deuda[];
  recurrentes?: GastoRecurrente[];
  userLevel?: UserLevel | null;
  userId?: string;
  /** When true, Finn gives shorter, conversational responses optimised for TTS */
  vozMode?: boolean;
  /** Contexto del espacio compartido — solo datos del espacio, NUNCA finanzas personales del otro miembro */
  espacioCompartido?: SharedSpaceSummary | null;
  /**
   * Descripción de la pantalla que el usuario está viendo (p. ej. las gráficas
   * de Estadísticas, ver utils/statsCoach). Se añade al final del contexto para
   * que Finn pueda explicar "esta gráfica" con los mismos números.
   */
  contextoPantalla?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

/**
 * System prompt de Finn. Minimización: NO incluye el nombre, correo ni
 * identificadores del usuario (no son necesarios para responder). El Worker
 * antepone además sus propias reglas de identidad y transparencia.
 */
function buildSystemPrompt(contexto: string, vozMode = false): string {
  const vozInstructions = vozMode ? `
MODO VOZ ACTIVO:
- El usuario te está hablando por voz — responde EXACTAMENTE como si hablaras.
- Respuestas MUY cortas: máximo 2 oraciones. Nunca más de 40 palabras.
- PROHIBIDO: viñetas, listas, asteriscos, markdown, emojis, símbolos especiales.
- Usa lenguaje oral natural: "Claro," "Mira," "Pues," "Oye," etc.
- Pronuncia números de forma hablada: "un millón doscientos" no "$1.200.000".
` : '';
  return `Eres Finn, el asistente de educación y organización financiera basado en inteligencia artificial de la app FinancyAI.${vozInstructions}

PERSONALIDAD:
- Eres amigable, directo y empático
- Hablas en español colombiano natural (sin formalidades exageradas)
- Usas el formato de moneda colombiano ($1.250.000 con puntos)
- Explicas conceptos de finanzas personales de forma simple
- Das ideas concretas y educativas, no genéricas
- Máximo 3 oraciones por respuesta salvo que el usuario pida más detalle
- Nunca inventas datos — solo usas los que aparecen en el contexto
- Si conoces patrones del usuario, úsalos para personalizar tus explicaciones
- Trata al usuario de "tú"; no conoces ni necesitas su nombre

CONTEXTO FINANCIERO ACTUAL DEL USUARIO:
${contexto}

LÍMITES ESTRICTOS — MUY IMPORTANTE:
- Solo respondes preguntas sobre finanzas personales, presupuesto, gastos, ingresos, metas de ahorro, categorías y funciones de la app FinancyAI.
- Si el usuario pregunta algo que NO está relacionado con finanzas o la app (recetas, deportes, política, entretenimiento, relaciones personales, tecnología general, etc.), responde EXACTAMENTE así: "Soy Finn, tu asistente de finanzas personales 💰 Solo puedo ayudarte con temas de finanzas personales y la app. ¿Hay algo de tu dinero en lo que te pueda ayudar?"
- No hagas excepciones aunque el usuario insista, reformule la pregunta o diga que es "solo curiosidad".
- No actúes como ChatGPT, asistente general ni ningún otro rol diferente al de asistente de educación financiera de FinancyAI.

TRANSPARENCIA — OBLIGATORIO:
- No eres una entidad financiera ni un asesor financiero, legal o tributario profesional; nunca te presentes como tal.
- Tus respuestas son informativas y educativas; no constituyen asesoría profesional.
- No garantices resultados (ahorro, reducción de deudas, rentabilidad).
- Ante decisiones importantes (inversiones, créditos, impuestos, temas legales), sugiere consultar a un profesional.

REGLAS FINANCIERAS:
- Si el usuario pregunta algo que no está en el contexto, dilo honestamente
- Nunca sugieras productos financieros específicos (bancos, inversiones concretas)
- Si detectas una situación financiera crítica, sé directo pero constructivo
- Si el usuario saluda, responde brevemente y ofrece ayuda concreta basada en su situación actual
- Cuando mencionas números, siempre usa el formato colombiano ($1.250.000)`;
}

/**
 * Copia del perfil sin identificadores. OJO: `mainFinancialConcern` guarda en
 * realidad el NOMBRE que el usuario escribió en el onboarding (nombre histórico
 * del campo), así que también se elimina.
 */
function perfilParaIA(profile: any): any {
  if (!profile) return profile;
  const { name: _n, mainFinancialConcern: _m, email: _e, id: _i, ...resto } = profile;
  return resto;
}

/** Nombre del usuario, solo para quitarlo de textos libres antes del envío. */
function nombreDe(profile: any): string {
  return String(profile?.mainFinancialConcern || profile?.name || '');
}

/** Transacciones con descripciones minimizadas (sin correos, teléfonos, documentos ni nombre). */
function transaccionesParaIA(transactions: Transaction[], nombre: string): Transaction[] {
  return transactions.map(t => (t.description
    ? { ...t, description: minimizarParaIA(t.description, nombre) }
    : t));
}

// ── Construcción del contexto enriquecido ─────────────────────────────────────

async function buildContextoEnriquecido(
  transactions: Transaction[],
  categories: Category[],
  profile: any,
  extra: ContextoPersonalizado,
): Promise<{ contexto: string; metricas: MetricasFinancieras }> {
  const now = new Date();
  const metricas = calcularMetricasFinancieras(
    transactions, categories as any,
    profile?.monthlySalary ?? 0,
    now.getMonth(), now.getFullYear(),
  );
  const nombre = nombreDe(profile);

  // Cargar memoria persistente de Finn si hay userId
  let memoriaFinn = '';
  if (extra.userId) {
    try {
      const memory = await finnMemoryService.getMemory(extra.userId);
      memoriaFinn = finnMemoryService.buildContextoMemoria(memory);
    } catch { /* silencioso — la memoria es opcional */ }
  }

  const contexto = buildContextoIA(
    metricas, categories as any, transaccionesParaIA(transactions, nombre), perfilParaIA(profile),
    now.getMonth(), now.getFullYear(),
    {
      metas: extra.metas?.map(m => ({
        nombre: minimizarParaIA(m.nombre, nombre),
        objetivo: m.montoObjetivo,
        actual: m.montoActual,
        completada: m.completada,
      })),
      deudas: extra.deudas?.map(d => ({
        nombre: minimizarParaIA(d.nombre, nombre),
        saldo: d.saldo,
        cuota: d.cuotaMensual,
      })),
      recurrentes: extra.recurrentes?.map(r => ({
        nombre: minimizarParaIA(r.nombre, nombre),
        monto: r.monto,
        activo: r.activo,
      })),
      nivel: extra.userLevel ? {
        level: extra.userLevel.level,
        experience: extra.userLevel.experience,
        title: extra.userLevel.title,
      } : undefined,
      memoriaFinn,
    },
  );

  // Contexto del espacio compartido — se añade al final, separado del contexto personal
  let contextoFinal = contexto;
  if (extra.espacioCompartido) {
    const ec = extra.espacioCompartido;
    // Sin nombres de terceros: la IA no necesita saber quién es quién.
    const deudaTxt = ec.deudaNeta
      ? `Hay un saldo pendiente de $${Math.round(ec.deudaNeta.monto).toLocaleString('es-CO')} entre los miembros`
      : 'Están a mano, sin deudas pendientes';
    const catTxt = ec.gastosPorCategoria
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 3)
      .map(c => `${c.categoria}: $${Math.round(c.monto).toLocaleString('es-CO')}`)
      .join(', ');
    contextoFinal += `

ESPACIO COMPARTIDO — "${ec.spaceName}":
- Miembros: ${ec.members.length} personas (sus nombres no se comparten con la IA)
- Gasto total del espacio este mes: $${Math.round(ec.totalGastosMes).toLocaleString('es-CO')}
- Principales categorías compartidas: ${catTxt || 'Sin gastos aún'}
- Balance: ${deudaTxt}
IMPORTANTE: Solo usa datos del espacio compartido para responder preguntas sobre el espacio. No reveles ni compares las finanzas personales de ningún miembro.`;
  }

  if (extra.contextoPantalla) {
    // Incluye nombres de categorías escritos por el usuario: misma minimización que el resto.
    contextoFinal += `\n\n${minimizarParaIA(extra.contextoPantalla, nombre)}`;
  }

  return { contexto: contextoFinal, metricas };
}

// ── Llamada al Worker ─────────────────────────────────────────────────────────

async function llamarWorker(
  mensajes:  MensajeChat[],
  system:    string,
  maxTokens: number,
): Promise<string> {
  // Sin autorización de IA no sale ningún dato: el catch del llamador usa el modo local.
  if (!(await consentService.hasAIConsent())) throw new AIConsentRequiredError();

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), CONFIG.AI_TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG.WORKER_URL, {
      method:  'POST',
      headers: await getWorkerHeaders(),
      body: JSON.stringify({ system, messages: mensajes, max_tokens: maxTokens }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as any;
      throw new Error(err?.error?.message ?? err?.error ?? `HTTP ${response.status}`);
    }

    const data = await response.json() as any;
    const texto = data?.content?.[0]?.text ?? '';
    if (!texto) throw new Error('Respuesta vacía');
    return texto;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Guardia off-topic ─────────────────────────────────────────────────────────

const FINANCE_KEYWORDS = [
  'gasto','ingreso','saldo','presupuesto','categor','transacci','dinero','plata','ahorro',
  'deuda','pago','salario','meta','balance','flujo','inversión','inversion','finn','app',
  'financy','cuánto','cuanto','registra','borra','elimina','agrega','crea','actualiza',
  'disponible','mes','semana','diario','reporte','estadística','estadistica','compra',
  'factura','arriendo','servicios','alimentaci','transporte','entreteni','ropa','salud',
  // Finanzas compartidas
  'compartido','espacio','pareja','debe','debo','mitad','dividir','división','roomie',
];

const OFFTOPIC_PATTERNS = [
  /receta|cocina|comida(?! registra)/i,
  /fútbol|futbol|deporte|equipo|partido|gol/i,
  /política|politica|presidente|gobierno|elección/i,
  /película|pelicula|serie|netflix|spotify|música|musica/i,
  /chiste|cuento|historia|poema|canción/i,
  /amor|novio|novia|relaci[oó]n personal|cita/i,
  /clima|tiempo.*hoy|temperatura/i,
  /traducir|translate|translate/i,
  /programar|código|codigo|javascript|python(?! finanz)/i,
  /salud.*médico|doctor|enfermedad|síntoma|sintoma/i,
];

function esOffTopic(mensaje: string): boolean {
  const lower = mensaje.toLowerCase();
  // If message contains any finance keyword, it's on-topic
  if (FINANCE_KEYWORDS.some(kw => lower.includes(kw))) return false;
  // If it matches a clearly off-topic pattern, reject
  return OFFTOPIC_PATTERNS.some(p => p.test(lower));
}

const RESPUESTA_OFFTOPIC: RespuestaIA = {
  texto: 'Soy Finn, tu asistente financiero 💰 Solo puedo ayudarte con temas de finanzas personales y la app FinancyAI. ¿Hay algo de tu dinero en lo que te pueda ayudar?',
  exito: true,
};

// ── Función principal ─────────────────────────────────────────────────────────

export async function enviarMensajeAFinn(
  mensajeUsuario:    string,
  historial:         MensajeChat[],
  transactions:      Transaction[],
  categories:        Category[],
  profile:           any,
  goal:              any,
  extra:             ContextoPersonalizado = {},
): Promise<RespuestaIA> {
  if (esOffTopic(mensajeUsuario)) return RESPUESTA_OFFTOPIC;
  try {
    const { contexto } = await buildContextoEnriquecido(transactions, categories, profile, extra);
    const system   = buildSystemPrompt(contexto, extra.vozMode);
    const maxTokens = extra.vozMode ? 150 : CONFIG.MAX_TOKENS_RESPUESTA;
    const nombre   = nombreDe(profile);
    const mensajes: MensajeChat[] = [
      ...historial.slice(-(CONFIG.MAX_HISTORIAL_MENSAJES - 1)).map(m => ({ ...m, content: minimizarParaIA(m.content, nombre) })),
      { role: 'user', content: minimizarParaIA(mensajeUsuario, nombre) },
    ];

    const texto = await llamarWorker(mensajes, system, maxTokens);

    // Actualizar patrones en background (sin bloquear la respuesta)
    if (extra.userId) {
      finnMemoryService.analizarPatrones(
        extra.userId, transactions, categories, profile?.monthlySalary ?? 0,
      ).catch(() => {});
    }

    return { texto, exito: true };

  } catch (e: any) {
    if (!(e instanceof AIConsentRequiredError)) console.warn('[RealAIService] error:', e?.name ?? 'error');

    // Fallback graceful a lógica local
    try {
      const local = procesarMensajeUsuario(
        mensajeUsuario,
        transactions as any,
        categories as any,
        profile as any,
        goal as any,
      );
      return { texto: local.text, exito: true, error: 'fallback' };
    } catch {
      // Si incluso el fallback falla, retornar mensaje amigable
    }

    let mensajeError = 'No pude conectarme en este momento. Intenta de nuevo.';
    if (e?.name === 'AbortError')             mensajeError = 'La respuesta tardó demasiado. Verifica tu conexión.';
    if (e?.message?.includes('429'))          mensajeError = 'Estoy recibiendo muchas preguntas. Espera un momento.';
    if (e?.message?.includes('NetworkError')) mensajeError = 'Sin conexión a internet. Conéctate e intenta de nuevo.';

    return { texto: mensajeError, exito: false, error: e?.message };
  }
}

// ── Agentic flow ─────────────────────────────────────────────────────────────

export type RespuestaAgente =
  | { tipo: 'texto';     texto: string; exito: boolean; error?: string }
  | { tipo: 'tool_call'; tool: string; input: Record<string, any>; toolUseId: string; assistantMessage: any[] };

function buildSystemPromptAgente(
  contexto: string,
  transactions: Transaction[],
  categories: Category[],
): string {
  const recientes = transactions.slice(0, 20).map(t => {
    const fecha = new Date(t.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const tipo  = t.type === 'income' ? 'INGRESO' : 'GASTO';
    const monto = '$' + Math.round(t.amount).toLocaleString('es-CO').replace(/,/g, '.');
    const sub   = t.subcategory ? categories.find(c => c.id === t.subcategory) : null;
    const subLabel = sub ? ` > ${sub.name}` : '';
    return `[ID:${t.id}] ${tipo} ${monto} en ${t.category}${subLabel} (${fecha})`;
  }).join('\n') || 'Sin transacciones';

  // Construir árbol categoría → subcategorías
  const topCats = categories.filter(c => !c.parentCategoryId);
  const catsList = topCats.map(c => {
    const subs = categories.filter(s => s.parentCategoryId === c.id);
    const presupuesto = `presupuesto:$${c.budget ?? 0}`;
    if (subs.length > 0) {
      const subsStr = subs.map(s => `    - [SUBCAT:${s.id}] ${s.name}`).join('\n');
      return `[ID:${c.id}] ${c.name} ${presupuesto}\n${subsStr}`;
    }
    return `[ID:${c.id}] ${c.name} ${presupuesto}`;
  }).join('\n') || 'Sin categorías';

  return `${buildSystemPrompt(contexto)}

CAPACIDADES DE ACCIÓN:
Puedes ejecutar acciones directas usando las herramientas disponibles. Úsalas solo cuando el usuario pida explícitamente:
- Registrar ingreso/gasto → registrar_transaccion
- Eliminar una transacción → eliminar_transaccion (usa el ID exacto de la lista)
- Actualizar datos de una transacción → actualizar_transaccion
- Cambiar presupuesto de categoría → actualizar_presupuesto
- Crear categoría nueva → crear_categoria
- Actualizar meta financiera → actualizar_meta

REGLAS DE SUBCATEGORÍAS — MUY IMPORTANTE:
- Las categorías con entradas "- [SUBCAT:...]" tienen subcategorías configuradas por el usuario.
- Cuando el usuario mencione algo que corresponda a una subcategoría (ej: "recibo del agua", "luz", "internet", "netflix"), SIEMPRE incluye el campo "subcategoria" con el nombre exacto de la subcategoría.
- Usa el nombre de la subcategoría tal como aparece en la lista (ej: si existe "Agua" y el usuario dice "recibo del agua" → subcategoria="Agua").
- Si no existe una subcategoría que encaje, omite el campo subcategoria.
- El gasto se registra en la categoría PRINCIPAL (ej: "Servicios") pero con la subcategoría indicada.

TRANSACCIONES RECIENTES:
${recientes}

CATEGORÍAS (con subcategorías indentadas):
${catsList}

Para preguntas o análisis, responde con texto normal. Solo usa herramientas cuando la intención del usuario sea claramente ejecutar una acción.

RECUERDA: Si el mensaje del usuario no tiene relación con finanzas o la app, rechaza amablemente sin usar ninguna herramienta.`;
}

async function llamarWorkerAgente(
  mensajes:  MensajeChat[],
  system:    string,
  maxTokens: number,
): Promise<RespuestaAgente> {
  if (!(await consentService.hasAIConsent())) throw new AIConsentRequiredError();

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), CONFIG.AI_TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG.WORKER_URL, {
      method:  'POST',
      headers: await getWorkerHeaders(),
      body:    JSON.stringify({ system, messages: mensajes, max_tokens: maxTokens, use_tools: true }),
      signal:  controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as any;
      throw new Error(err?.error?.message ?? err?.error ?? `HTTP ${response.status}`);
    }

    const data = await response.json() as any;

    if (data?.type === 'tool_call') {
      return {
        tipo:             'tool_call',
        tool:             data.tool,
        input:            data.input,
        toolUseId:        data.toolUseId,
        assistantMessage: data.assistantMessage,
      };
    }

    const texto = data?.content?.[0]?.text ?? '';
    if (!texto) throw new Error('Respuesta vacía');
    return { tipo: 'texto', texto, exito: true };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function enviarMensajeAgenteAFinn(
  mensajeUsuario: string,
  historial:      MensajeChat[],
  transactions:   Transaction[],
  categories:     Category[],
  profile:        any,
  goal:           any,
  extra:          ContextoPersonalizado = {},
): Promise<RespuestaAgente> {
  if (esOffTopic(mensajeUsuario)) return { tipo: 'texto', texto: RESPUESTA_OFFTOPIC.texto, exito: true };
  try {
    const { contexto } = await buildContextoEnriquecido(transactions, categories, profile, extra);
    const nombre  = nombreDe(profile);
    const system  = buildSystemPromptAgente(contexto, transaccionesParaIA(transactions, nombre), categories);
    const mensajes: MensajeChat[] = [
      ...historial.slice(-(CONFIG.MAX_HISTORIAL_MENSAJES - 1)).map(m => ({ ...m, content: minimizarParaIA(m.content, nombre) })),
      { role: 'user', content: minimizarParaIA(mensajeUsuario, nombre) },
    ];

    return await llamarWorkerAgente(mensajes, system, CONFIG.MAX_TOKENS_RESPUESTA);
  } catch (e: any) {
    if (!(e instanceof AIConsentRequiredError)) console.warn('[RealAIService] agente error:', e?.name ?? 'error');
    try {
      const local = procesarMensajeUsuario(mensajeUsuario, transactions as any, categories as any, profile as any, goal as any);
      return { tipo: 'texto', texto: local.text, exito: true, error: 'fallback' };
    } catch {
      // ignore
    }
    let msg = 'No pude conectarme en este momento. Intenta de nuevo.';
    if (e?.name === 'AbortError')             msg = 'La respuesta tardó demasiado. Verifica tu conexión.';
    if (e?.message?.includes('429'))          msg = 'Estoy recibiendo muchas preguntas. Espera un momento.';
    if (e?.message?.includes('NetworkError')) msg = 'Sin conexión a internet. Conéctate e intenta de nuevo.';
    return { tipo: 'texto', texto: msg, exito: false, error: e?.message };
  }
}

// ── Insight diario personalizado ──────────────────────────────────────────────

export async function generarInsightDiario(
  transactions: Transaction[],
  categories:   Category[],
  profile:      any,
  extra:        ContextoPersonalizado = {},
): Promise<string> {
  try {
    const respuesta = await enviarMensajeAFinn(
      'Dame un insight breve y concreto sobre mis finanzas de hoy. Máximo 2 oraciones, sin saludar.',
      [],
      transactions, categories, profile, null, extra,
    );
    if (respuesta.exito && respuesta.error !== 'fallback') return respuesta.texto;
  } catch { /* cae al fallback */ }

  // Fallback local
  const now      = new Date();
  const metricas = calcularMetricasFinancieras(
    transactions, categories as any,
    profile?.monthlySalary ?? 0,
    now.getMonth(), now.getFullYear(),
  );
  return generarInsightFallback(metricas);
}

function generarInsightFallback(m: MetricasFinancieras): string {
  const f = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
  if (m.porcentajeGastado >= 100) return `Los gastos superaron el ingreso este mes. Balance: ${f(m.balanceDisponible)}.`;
  if (m.porcentajeGastado >= 80)  return `Llevas el ${m.porcentajeGastado}% del presupuesto gastado. Cuidado con los gastos restantes.`;
  return `Este mes llevas ${f(m.totalGastado)} gastados. Balance disponible: ${f(m.balanceDisponible)}.`;
}

// ── Verificar conexión al Worker ──────────────────────────────────────────────

export async function verificarConexionWorker(): Promise<boolean> {
  // GET /health: no consume IA ni envía datos del usuario (antes hacía una
  // llamada real al modelo con "ping" cada vez que se abría la pantalla).
  if (!CONFIG.WORKER_URL) return false;
  try {
    const base = CONFIG.WORKER_URL.replace(/\/+$/, '');
    const response = await fetch(`${base}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(CONFIG.PING_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
