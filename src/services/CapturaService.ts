/**
 * Captura automática de compras (Premium) — orquestación.
 *
 *   texto pegado / notificación → dividirMensajes → parsearMensaje → procesarLote
 *   → (comercios desconocidos) Finn IA vía Worker /categorize → ResultadoLote
 *
 * El texto crudo se procesa en el teléfono y no se guarda. A Finn solo viaja
 * el nombre del comercio, un detalle opcional, el monto y los nombres de las
 * categorías del usuario — y solo con el consentimiento de procesamiento con
 * IA. Nunca transferencias (llevan nombres de personas).
 */
import { CONFIG } from '../constants/config';
import { getWorkerHeaders } from './workerAuth';
import { consentService } from './ConsentService';
import { dividirMensajes, parsearMensaje } from '../utils/capturaParser';
import {
  CONFIANZA_AUTO, procesarLote, promoverPendiente,
  type CapturaPendiente, type ContextoMotor, type ResultadoLote, type SugerenciaCategoria,
} from '../utils/capturaMotor';
import type { Category } from '../types';

/** Máximo de consultas a Finn por análisis (costo y tiempo). */
const MAX_CONSULTAS_FINN = 8;
const TIMEOUT_FINN_MS = 12_000;

export interface OpcionesAnalisis {
  /** Consultar a Finn por los comercios que el diccionario no conoce. */
  usarFinn?: boolean;
  /** Hora de llegada para mensajes sin fecha (solo `analizarMensajes`). */
  recibidoEn?: Date;
}

/** Categorías de gasto de primer nivel del usuario (las que Finn puede elegir). */
export const categoriasDeGasto = (categories: Category[]) =>
  categories.filter(c => !c.parentCategoryId && c.tipo !== 'ingreso');

/**
 * Finn sugiere la categoría de un comercio. Devuelve null si no hay
 * consentimiento, Worker, conexión o certeza — nunca lanza.
 */
export async function sugerirCategoriaConFinn(
  p: Pick<CapturaPendiente, 'movimiento'>,
  categories: Category[],
): Promise<SugerenciaCategoria | null> {
  const m = p.movimiento;
  if (!CONFIG.WORKER_URL || !m.comercio || (m.tipo !== 'compra' && m.tipo !== 'pago')) return null;
  if (!(await consentService.hasAIConsent())) return null;
  const opciones = categoriasDeGasto(categories);
  if (opciones.length === 0) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_FINN_MS);
  try {
    const res = await fetch(`${CONFIG.WORKER_URL}/categorize`, {
      method: 'POST',
      signal: controller.signal,
      headers: await getWorkerHeaders(),
      body: JSON.stringify({
        comercio: m.comercio,
        ...(m.detalle ? { detalle: m.detalle } : {}),
        monto: m.monto,
        categorias: opciones.map(c => c.name),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { categoria: string | null; confianza: number };
    const cat = opciones.find(c => c.name === data.categoria);
    if (!cat || typeof data.confianza !== 'number') return null;
    return { categoryId: cat.id, categoryName: cat.name, confianza: Math.min(1, Math.max(0, data.confianza)), fuente: 'finn' };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface EntradaTexto {
  texto: string;
  /** Cuándo llegó (notificación). Se usa si el texto no trae fecha. */
  recibidoEn?: Date;
}

/**
 * Analiza uno o varios mensajes pegados. No guarda nada: quien llama aplica el
 * resultado con `aplicarLoteCaptura` del FinanceContext.
 */
export function analizarMensajes(
  texto: string,
  ctx: ContextoAnalisis,
  opts: OpcionesAnalisis = {},
): Promise<ResultadoLote> {
  return analizarEntradas(dividirMensajes(texto).map(t => ({ texto: t, ...(opts.recibidoEn ? { recibidoEn: opts.recibidoEn } : {}) })), ctx, opts);
}

type ContextoAnalisis = Omit<ContextoMotor, 'ahora' | 'origen'> & { origen?: ContextoMotor['origen'] };

/** Analiza mensajes ya separados (p. ej. notificaciones, cada una con su hora de llegada). */
export async function analizarEntradas(
  entradas: EntradaTexto[],
  ctx: ContextoAnalisis,
  opts: OpcionesAnalisis = {},
): Promise<ResultadoLote> {
  const ahora = new Date();
  const parseados = entradas.map(e => parsearMensaje(e.texto, { ahora, ...(e.recibidoEn ? { recibidoEn: e.recibidoEn } : {}) }));
  const lote = procesarLote(parseados, { ...ctx, origen: ctx.origen ?? 'texto', ahora });
  if (!opts.usarFinn) return lote;

  // Finn solo para lo nuevo de este análisis, con comercio y sin categoría segura.
  const previos = new Set(ctx.pendientes.map(p => p.id));
  const candidatos = lote.pendientes
    .filter(p => !previos.has(p.id) && !p.sugerirIgnorar && p.movimiento.comercio
      && (p.movimiento.tipo === 'compra' || p.movimiento.tipo === 'pago')
      && (!p.sugerencia || p.sugerencia.confianza < CONFIANZA_AUTO))
    .slice(0, MAX_CONSULTAS_FINN);

  const sugerencias = await Promise.all(candidatos.map(p => sugerirCategoriaConFinn(p, ctx.categories)));

  let pendientes = lote.pendientes;
  const registrar = [...lote.registrar];
  const items = [...lote.items];
  candidatos.forEach((p, i) => {
    const s = sugerencias[i];
    if (!s) return;
    const tx = promoverPendiente(p, s, { ...ctx, ahora }, `cap_${ahora.getTime()}_finn${i}`);
    const iItem = items.findIndex(it => it.pendienteId === p.id);
    if (tx) {
      registrar.push(tx);
      pendientes = pendientes.filter(x => x.id !== p.id);
      if (iItem >= 0) items[iItem] = { ...items[iItem], estado: 'registrado', txId: tx.id, categoria: s.categoryName, motivo: `${s.categoryName} (según Finn)` };
    } else {
      pendientes = pendientes.map(x => (x.id === p.id ? { ...x, sugerencia: s, motivo: `Finn cree que va en ${s.categoryName}.` } : x));
      if (iItem >= 0) items[iItem] = { ...items[iItem], categoria: s.categoryName, motivo: `Finn cree que va en ${s.categoryName}.` };
    }
  });

  return { ...lote, registrar, pendientes, items };
}
