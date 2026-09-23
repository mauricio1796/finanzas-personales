/**
 * Política de entitlement Premium (BUG-07) — lógica pura y verificable.
 *
 * Aquí se decide lo único que importa desde el punto de vista de seguridad:
 * cuándo un caché LOCAL puede seguir otorgando Premium sin haber podido
 * confirmarlo contra el servidor. Vive fuera de `PremiumService` porque ese
 * módulo importa AsyncStorage y Supabase, y esta decisión debe poder auditarse
 * con pruebas.
 */

export interface EstadoPremium {
  isPremium: boolean;
  plan: 'mensual' | 'anual' | null;
  fechaInicio: string | null;
  fechaVencimiento: string | null;
}

export interface CachePremium extends EstadoPremium {
  /** ISO de la última confirmación real contra el servidor. */
  verificadoEn?: string | null;
}

export const PREMIUM_LIBRE: EstadoPremium = {
  isPremium: false,
  plan: null,
  fechaInicio: null,
  fechaVencimiento: null,
};

/** Días que se respeta el caché sin poder confirmar contra el servidor. */
export const DIAS_GRACIA_SIN_CONEXION = 7;

/** Una suscripción vale solo si está marcada y no ha vencido. */
export function entitlementVigente(estado: EstadoPremium, ahora: number = Date.now()): boolean {
  if (!estado.isPremium || !estado.fechaVencimiento) return false;
  const vence = new Date(estado.fechaVencimiento).getTime();
  return Number.isFinite(vence) && vence > ahora;
}

/**
 * Decide qué estado aplicar cuando NO se pudo consultar al servidor.
 *
 * Reglas, en orden:
 *  1. Sin caché, o con la suscripción vencida → sin Premium.
 *  2. Caché sin marca de verificación → sin Premium. Esto es lo que impide que
 *     un archivo escrito a mano en el dispositivo otorgue Premium: un caché
 *     legítimo SIEMPRE lleva la fecha en que el servidor lo confirmó.
 *  3. Verificación demasiado antigua → sin Premium (se exige reconectar).
 *  4. En cualquier otro caso se respeta el caché, para no castigar a quien pagó
 *     y está sin conexión.
 */
export function decidirDesdeCache(
  cache: CachePremium | null,
  ahora: number = Date.now(),
): EstadoPremium {
  if (!cache || !entitlementVigente(cache, ahora)) return PREMIUM_LIBRE;
  if (!cache.verificadoEn) return PREMIUM_LIBRE;

  const verificado = new Date(cache.verificadoEn).getTime();
  if (!Number.isFinite(verificado)) return PREMIUM_LIBRE;

  const dias = (ahora - verificado) / 86_400_000;
  if (dias > DIAS_GRACIA_SIN_CONEXION) return PREMIUM_LIBRE;

  return {
    isPremium: cache.isPremium,
    plan: cache.plan,
    fechaInicio: cache.fechaInicio,
    fechaVencimiento: cache.fechaVencimiento,
  };
}
