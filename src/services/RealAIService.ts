import { type Transaction, type Category } from '../types';
import {
  calcularMetricasFinancieras,
  buildContextoIA,
  type MetricasFinancieras,
} from '../utils/ingresoUtils';
import { procesarMensajeUsuario } from './ai/AIService';
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

CONTEXTO FINANCIERO ACTUAL DEL USUARIO:
${contexto}

REGLAS:
- Si el usuario pregunta algo que no está en el contexto, dilo honestamente
- Nunca sugieras productos financieros específicos (bancos, inversiones concretas)
- Si detectas una situación financiera crítica, sé directo pero constructivo
- Si el usuario saluda, responde brevemente y ofrece ayuda concreta basada en su situación actual`;
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
): Promise<RespuestaIA> {
  try {
    const now      = new Date();
    const metricas = calcularMetricasFinancieras(
      transactions, categories as any,
      profile?.monthlySalary ?? 0,
      now.getMonth(), now.getFullYear(),
    );

    const contexto = buildContextoIA(
      metricas, categories as any, transactions, profile,
      now.getMonth(), now.getFullYear(),
    );

    const system   = buildSystemPrompt(contexto, profile?.name ?? 'Usuario');
    const mensajes: MensajeChat[] = [
      ...historial.slice(-(CONFIG.MAX_HISTORIAL_MENSAJES - 1)),
      { role: 'user', content: mensajeUsuario },
    ];

    const texto = await llamarWorker(mensajes, system, CONFIG.MAX_TOKENS_RESPUESTA);
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

// ── Insight diario ────────────────────────────────────────────────────────────

export async function generarInsightDiario(
  transactions: Transaction[],
  categories:   Category[],
  profile:      any,
): Promise<string> {
  try {
    const respuesta = await enviarMensajeAFinn(
      'Dame un insight breve y concreto sobre mis finanzas de hoy. Máximo 2 oraciones, sin saludar.',
      [],
      transactions, categories, profile, null,
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
