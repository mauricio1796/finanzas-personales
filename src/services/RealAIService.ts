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
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(contexto: string, nombreUsuario: string): string {
  return `Eres Finn, el asistente financiero personal de ${nombreUsuario} en la app FinancyAI.

PERSONALIDAD:
- Eres amigable, directo y empático
- Hablas en español colombiano natural (sin formalidades exageradas)
- Usas el formato de moneda colombiano ($1.250.000 con puntos)
- Eres experto en finanzas personales pero hablas de forma simple
- Das consejos concretos y accionables, no genéricos
- Máximo 3 oraciones por respuesta salvo que el usuario pida más detalle
- Nunca inventas datos — solo usas los que aparecen en el contexto
- Si conoces patrones del usuario, úsalos para dar consejos más personalizados

CONTEXTO FINANCIERO ACTUAL DEL USUARIO:
${contexto}

REGLAS:
- Si el usuario pregunta algo que no está en el contexto, dilo honestamente
- Nunca sugieras productos financieros específicos (bancos, inversiones concretas)
- Si detectas una situación financiera crítica, sé directo pero constructivo
- Si el usuario saluda, responde brevemente y ofrece ayuda concreta basada en su situación actual
- Cuando mencionas números, siempre usa el formato colombiano ($1.250.000)`;
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

  // Cargar memoria persistente de Finn si hay userId
  let memoriaFinn = '';
  if (extra.userId) {
    try {
      const memory = await finnMemoryService.getMemory(extra.userId);
      memoriaFinn = finnMemoryService.buildContextoMemoria(memory);
    } catch { /* silencioso — la memoria es opcional */ }
  }

  const contexto = buildContextoIA(
    metricas, categories as any, transactions, profile,
    now.getMonth(), now.getFullYear(),
    {
      metas: extra.metas?.map(m => ({
        nombre: m.nombre,
        objetivo: m.montoObjetivo,
        actual: m.montoActual,
        completada: m.completada,
      })),
      deudas: extra.deudas?.map(d => ({
        nombre: d.nombre,
        saldo: d.saldo,
        cuota: d.cuotaMensual,
      })),
      recurrentes: extra.recurrentes?.map(r => ({
        nombre: r.nombre,
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

  return { contexto, metricas };
}

// ── Llamada al Worker ─────────────────────────────────────────────────────────

async function llamarWorker(
  mensajes:  MensajeChat[],
  system:    string,
  maxTokens: number,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), CONFIG.AI_TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG.WORKER_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-App-Version': CONFIG.APP_VERSION,
      },
      body: JSON.stringify({ system, messages: mensajes, max_tokens: maxTokens }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as any;
      throw new Error(err.error ?? `HTTP ${response.status}`);
    }

    const data = await response.json() as any;
    const texto = data?.content?.[0]?.text ?? '';
    if (!texto) throw new Error('Respuesta vacía');
    return texto;
  } finally {
    clearTimeout(timeoutId);
  }
}

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
  try {
    const { contexto } = await buildContextoEnriquecido(transactions, categories, profile, extra);
    const system   = buildSystemPrompt(contexto, profile?.name ?? 'Usuario');
    const mensajes: MensajeChat[] = [
      ...historial.slice(-(CONFIG.MAX_HISTORIAL_MENSAJES - 1)),
      { role: 'user', content: mensajeUsuario },
    ];

    const texto = await llamarWorker(mensajes, system, CONFIG.MAX_TOKENS_RESPUESTA);

    // Actualizar patrones en background (sin bloquear la respuesta)
    if (extra.userId) {
      finnMemoryService.analizarPatrones(
        extra.userId, transactions, categories, profile?.monthlySalary ?? 0,
      ).catch(() => {});
    }

    return { texto, exito: true };

  } catch (e: any) {
    console.warn('[RealAIService] error:', e?.message);

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
  nombreUsuario: string,
  transactions: Transaction[],
  categories: Category[],
): string {
  const recientes = transactions.slice(0, 20).map(t => {
    const fecha = new Date(t.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const tipo  = t.type === 'income' ? 'INGRESO' : 'GASTO';
    const monto = '$' + Math.round(t.amount).toLocaleString('es-CO').replace(/,/g, '.');
    return `[ID:${t.id}] ${tipo} ${monto} en ${t.category} (${fecha})`;
  }).join('\n') || 'Sin transacciones';

  const catsList = categories.map(c =>
    `[ID:${c.id}] ${c.name} presupuesto:$${c.budget ?? 0}`,
  ).join('\n') || 'Sin categorías';

  return `${buildSystemPrompt(contexto, nombreUsuario)}

CAPACIDADES DE ACCIÓN:
Puedes ejecutar acciones directas usando las herramientas disponibles. Úsalas solo cuando el usuario pida explícitamente:
- Registrar ingreso/gasto → registrar_transaccion
- Eliminar una transacción → eliminar_transaccion (usa el ID exacto de la lista)
- Actualizar datos de una transacción → actualizar_transaccion
- Cambiar presupuesto de categoría → actualizar_presupuesto
- Crear categoría nueva → crear_categoria
- Actualizar meta financiera → actualizar_meta

TRANSACCIONES RECIENTES:
${recientes}

CATEGORÍAS:
${catsList}

Para preguntas o análisis, responde con texto normal. Solo usa herramientas cuando la intención del usuario sea claramente ejecutar una acción.`;
}

async function llamarWorkerAgente(
  mensajes:  MensajeChat[],
  system:    string,
  maxTokens: number,
): Promise<RespuestaAgente> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), CONFIG.AI_TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG.WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Version': CONFIG.APP_VERSION },
      body:    JSON.stringify({ system, messages: mensajes, max_tokens: maxTokens, use_tools: true }),
      signal:  controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as any;
      throw new Error(err.error ?? `HTTP ${response.status}`);
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
  try {
    const { contexto } = await buildContextoEnriquecido(transactions, categories, profile, extra);
    const system  = buildSystemPromptAgente(contexto, profile?.name ?? 'Usuario', transactions, categories);
    const mensajes: MensajeChat[] = [
      ...historial.slice(-(CONFIG.MAX_HISTORIAL_MENSAJES - 1)),
      { role: 'user', content: mensajeUsuario },
    ];

    return await llamarWorkerAgente(mensajes, system, CONFIG.MAX_TOKENS_RESPUESTA);
  } catch (e: any) {
    console.warn('[RealAIService] agente error:', e?.message);
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
  try {
    const response = await fetch(CONFIG.WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
      signal:  AbortSignal.timeout(CONFIG.PING_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
