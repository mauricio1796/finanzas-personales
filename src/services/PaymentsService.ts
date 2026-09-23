/**
 * PaymentsService — cobro real de FinancyAI Premium con Wompi (pasarela colombiana:
 * Nequi, PSE, tarjeta de crédito/débito, botón Bancolombia), a través del Worker.
 *
 * El Worker firma la transacción con un secreto que nunca toca el bundle móvil.
 * Esta capa solo pide una URL de checkout y luego pregunta el estado — la app
 * nunca ve ni maneja datos de tarjeta.
 */

import { CONFIG, WORKER_HEADERS } from '../constants/config';

export type PlanPago = 'mensual' | 'anual';

export interface CheckoutInfo {
  url:       string;
  reference: string;
  amount:    number;
  currency:  string;
}

export type EstadoPago = 'APPROVED' | 'DECLINED' | 'PENDING' | 'ERROR' | 'VOIDED';

/** Pide al Worker una URL de checkout de Wompi ya firmada para este plan. */
export async function crearCheckout(plan: PlanPago, userId: string | undefined, redirectUrl: string): Promise<CheckoutInfo> {
  if (!CONFIG.WORKER_URL) {
    throw new Error('El Worker no está configurado (EXPO_PUBLIC_WORKER_URL).');
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${CONFIG.WORKER_URL}/payments/checkout`, {
      method:  'POST',
      headers: WORKER_HEADERS,
      body:    JSON.stringify({ plan, userId, redirectUrl }),
      signal:  controller.signal,
    });

    const data = await response.json().catch(() => ({})) as any;
    if (!response.ok) {
      throw new Error(data?.error?.message ?? `No se pudo iniciar el pago (HTTP ${response.status}).`);
    }
    return data as CheckoutInfo;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface RefPago {
  /** id de transacción de Wompi (preferido — Wompi lo agrega solo al volver del checkout) */
  id?: string;
  /** referencia que generamos nosotros (respaldo si no se capturó el id) */
  reference?: string;
}

/** Consulta el estado real de una transacción, por id (preferido) o por referencia. */
export async function consultarEstadoPago(ref: RefPago): Promise<EstadoPago | 'PENDING'> {
  if (!CONFIG.WORKER_URL || (!ref.id && !ref.reference)) return 'ERROR';

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10_000);

  try {
    const qs = ref.id
      ? `id=${encodeURIComponent(ref.id)}`
      : `reference=${encodeURIComponent(ref.reference!)}`;
    const response = await fetch(`${CONFIG.WORKER_URL}/payments/status?${qs}`, {
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as any;
    if (!response.ok) return 'ERROR';
    return (data?.status ?? 'PENDING') as EstadoPago;
  } catch {
    return 'PENDING';
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Reintenta la consulta de estado varias veces (Wompi puede tardar unos segundos
 * en registrar la transacción tras cerrar el checkout). Se detiene apenas hay
 * un resultado definitivo (aprobado, rechazado, anulado o error).
 */
export async function esperarConfirmacionPago(
  ref: RefPago,
  intentos = 6,
  intervaloMs = 2500,
): Promise<EstadoPago | 'PENDING'> {
  for (let i = 0; i < intentos; i++) {
    const estado = await consultarEstadoPago(ref);
    if (estado !== 'PENDING') return estado;
    await new Promise(res => setTimeout(res, intervaloMs));
  }
  return 'PENDING';
}

/** Extrae el "id" de transacción que Wompi agrega a la redirect-url al volver del checkout. */
export function extraerIdDeRedirect(redirectedUrl: string | undefined | null): string | undefined {
  if (!redirectedUrl) return undefined;
  try {
    const match = redirectedUrl.match(/[?&]id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}
