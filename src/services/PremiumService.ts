/**
 * PremiumService — estado Premium con el SERVIDOR como fuente de verdad (BUG-07).
 *
 * Antes: `activarPremium()` escribía `{isPremium:true}` en AsyncStorage y
 * `verificarPremium()` leía ese mismo valor local. Cualquiera que pudiera editar
 * el almacenamiento del dispositivo se otorgaba Premium gratis.
 *
 * Ahora: el entitlement vive en la tabla `premium_entitlements` de Supabase, que
 * el cliente solo puede LEER (RLS sin políticas de escritura). Únicamente el
 * Worker la escribe, tras verificar el pago contra Wompi. Aquí el
 * almacenamiento local es solo un CACHÉ de lo que el servidor ya dijo, con un
 * período de gracia para uso sin conexión — nunca una autoridad.
 *
 * Límite conocido y aceptado: las funciones Premium que se calculan 100% en el
 * dispositivo (PDF, simulador) no pueden volverse imposibles de forzar en un
 * dispositivo rooteado; ninguna app móvil puede garantizar eso. Lo que sí se
 * garantiza es que el entitlement no se puede falsificar contra el servidor y
 * que se corrige en cuanto el dispositivo vuelve a tener conexión.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseReady } from '../lib/supabase';
import type { PremiumState } from '../state/FinanceContext';
import {
  decidirDesdeCache,
  entitlementVigente,
  PREMIUM_LIBRE as POLITICA_LIBRE,
  type CachePremium,
} from '../utils/premiumPolicy';

const CACHE_KEY = '@financy_premium';

export const PLANES_PREMIUM = {
  mensual: {
    precio: 12900,
    etiqueta: '$12.900/mes',
    descripcion: 'Cancela cuando quieras',
    ahorro: null as string | null,
    destacado: false,
  },
  anual: {
    precio: 89900,
    etiqueta: '$89.900/año',
    descripcion: 'Equivale a $7.491/mes',
    ahorro: 'Ahorras $64.900 vs mensual',
    destacado: true,
  },
};

export const FEATURES_GRATIS = [
  'Dashboard con donut interactivo',
  'Registro ilimitado de gastos e ingresos',
  '3 lecciones de Academia (basicas)',
  'Calendario financiero',
  'AI Insight diario',
  'Sistema de gamificacion basico',
  'Estadisticas del mes actual',
];

export const FEATURES_PREMIUM = [
  'Academia completa (8+ lecciones)',
  'Proyecciones y simulador financiero',
  'AI Insights ilimitados y personalizados',
  'Analisis de anomalias avanzado',
  'Exportar reportes en PDF',
  'Estadisticas historicas (12 meses)',
  'Retos comunidad con ranking real',
  'Soporte prioritario',
];

export const PREMIUM_LIBRE: PremiumState = POLITICA_LIBRE;

function vigente(state: PremiumState): boolean {
  return entitlementVigente(state);
}

async function leerCache(): Promise<CachePremium | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachePremium) : null;
  } catch {
    return null;
  }
}

async function guardarCache(state: PremiumState, verificadoEn: string | null): Promise<void> {
  try {
    const cache: CachePremium = { ...state, verificadoEn };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // El caché es un extra; si falla, el servidor sigue siendo la verdad.
  }
}

/**
 * Consulta el entitlement real en Supabase. Devuelve `null` si no se pudo
 * confirmar (sin sesión, sin red, Supabase no configurado) — `null` significa
 * "no sé", que es distinto de "no es premium".
 */
export async function consultarEntitlementServidor(): Promise<PremiumState | null> {
  if (!isSupabaseReady || !supabase) return null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('premium_entitlements')
      .select('is_premium, plan, starts_at, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return null;
    if (!data) return PREMIUM_LIBRE;

    return {
      isPremium: data.is_premium === true,
      plan: (data.plan ?? null) as PremiumState['plan'],
      fechaInicio: data.starts_at ?? null,
      fechaVencimiento: data.expires_at ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Sincroniza el estado Premium con el servidor y actualiza el caché.
 *
 * - Si el servidor responde, su respuesta manda (incluso si revoca Premium).
 * - Si no se pudo confirmar, se respeta el caché solo dentro del período de
 *   gracia y solo si la suscripción no venció.
 */
export async function sincronizarPremium(): Promise<PremiumState> {
  const servidor = await consultarEntitlementServidor();

  if (servidor) {
    const estado = vigente(servidor) ? servidor : PREMIUM_LIBRE;
    await guardarCache(estado, new Date().toISOString());
    return estado;
  }

  // Sin confirmación del servidor, la política decide si el caché aún vale.
  return decidirDesdeCache(await leerCache());
}

/** `true` solo si el entitlement está confirmado y vigente. */
export async function verificarPremium(): Promise<boolean> {
  const estado = await sincronizarPremium();
  return estado.isPremium;
}

/**
 * Tras un pago aprobado, el Worker ya escribió el entitlement en Supabase.
 * Esta función NO otorga nada: solo vuelve a preguntarle al servidor, con
 * reintentos, porque la escritura puede tardar un instante en propagarse.
 */
export async function refrescarPremiumTrasPago(
  intentos = 4,
  intervaloMs = 1500,
): Promise<PremiumState> {
  let estado = PREMIUM_LIBRE;
  for (let i = 0; i < intentos; i++) {
    estado = await sincronizarPremium();
    if (estado.isPremium) return estado;
    if (i < intentos - 1) await new Promise(res => setTimeout(res, intervaloMs));
  }
  return estado;
}

/** Limpia el caché local (cierre de sesión / reset). */
export async function limpiarCachePremium(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // sin efecto: el servidor sigue siendo la fuente de verdad
  }
}
