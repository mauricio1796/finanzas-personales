/**
 * ConsentService — autorizaciones del titular (Ley 1581 de 2012, art. 9).
 *
 * - Cada autorización es independiente (privacidad, términos, edad, IA,
 *   comunicaciones comerciales) y se registra con la versión del documento,
 *   la fecha, la plataforma y la versión de la app.
 * - Durante el registro por OTP aún no existe `user_id`: las autorizaciones se
 *   guardan como PENDIENTES en el dispositivo y se envían a `user_consents`
 *   apenas se verifica el código (`flushPending`).
 * - El caché local permite decidir sin red (p. ej. si Finn puede usar IA); la
 *   fuente de verdad es la tabla `user_consents` (append-only, con RLS).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { CONFIG } from '../constants/config';
import { LEGAL_VERSIONS } from '../legal';
import {
  cumpleObligatorios as cumpleObligatoriosPuro,
  fusionarConsentimientos,
  type ConsentState,
  type ConsentType,
} from '../utils/consentPolicy';

export type { ConsentState, ConsentType } from '../utils/consentPolicy';
export type ConsentSource = 'registration' | 'consent_gate' | 'privacy_center' | 'finn' | 'app';

interface PendingConsent {
  type: ConsentType;
  granted: boolean;
  version: string;
  source: ConsentSource;
  at: string;
}

const CACHE_KEY   = '@financy_consents_v1';
const PENDING_KEY = '@financy_consents_pending_v1';
const OWNER_KEY   = '@financy_consents_owner_v1';

/** Versión del documento que respalda cada tipo de autorización. */
export function versionFor(type: ConsentType): string {
  switch (type) {
    case 'privacy':       return LEGAL_VERSIONS.privacy;
    case 'terms':         return LEGAL_VERSIONS.terms;
    case 'ai_processing': return LEGAL_VERSIONS.ai;
    // La lectura de notificaciones se describe en la política de tratamiento.
    case 'capture_notifications': return LEGAL_VERSIONS.privacy;
    default:              return LEGAL_VERSIONS.privacy;
  }
}

/** ¿El estado cubre las autorizaciones obligatorias vigentes? */
export function cumpleObligatorios(state: ConsentState): boolean {
  return cumpleObligatoriosPuro(state, LEGAL_VERSIONS);
}

async function leer<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function escribir(key: string, value: unknown): Promise<void> {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

let memoria: ConsentState | null = null;
const listeners = new Set<(s: ConsentState) => void>();

function notificar(state: ConsentState) {
  memoria = state;
  listeners.forEach(l => l(state));
}

class ConsentService {
  subscribe(fn: (s: ConsentState) => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }

  async getLocal(): Promise<ConsentState> {
    if (memoria) return memoria;
    memoria = await leer<ConsentState>(CACHE_KEY, {});
    return memoria;
  }

  async hasRequiredConsents(): Promise<boolean> {
    return cumpleObligatorios(await this.getLocal());
  }

  /** ¿El usuario autorizó el procesamiento con IA de terceros? */
  async hasCaptureConsent(): Promise<boolean> {
    const s = await this.getLocal();
    return s.capture_notifications?.granted === true;
  }

  async hasAIConsent(): Promise<boolean> {
    const s = await this.getLocal();
    return s.ai_processing?.granted === true;
  }

  private async aplicarLocal(items: { type: ConsentType; granted: boolean; version: string; at: string }[]) {
    const state = { ...(await this.getLocal()) };
    for (const i of items) state[i.type] = { granted: i.granted, version: i.version, at: i.at };
    await escribir(CACHE_KEY, state);
    notificar(state);
  }

  /**
   * Registra autorizaciones. Con `userId` se envían al servidor; sin él quedan
   * pendientes hasta `flushPending`. Siempre actualiza el caché local.
   */
  async record(
    items: { type: ConsentType; granted: boolean }[],
    source: ConsentSource,
    userId?: string | null,
  ): Promise<{ synced: boolean }> {
    const at = new Date().toISOString();
    const full: PendingConsent[] = items.map(i => ({ ...i, version: versionFor(i.type), source, at }));
    await this.aplicarLocal(full);

    if (!userId) {
      const pending = await leer<PendingConsent[]>(PENDING_KEY, []);
      await escribir(PENDING_KEY, [...pending, ...full]);
      return { synced: false };
    }
    const ok = await this.enviar(userId, full);
    if (!ok) {
      const pending = await leer<PendingConsent[]>(PENDING_KEY, []);
      await escribir(PENDING_KEY, [...pending, ...full]);
    }
    return { synced: ok };
  }

  private async enviar(userId: string, items: PendingConsent[]): Promise<boolean> {
    if (!supabase || items.length === 0) return items.length === 0;
    try {
      const { error } = await supabase.from('user_consents').insert(items.map(i => ({
        user_id:          userId,
        consent_type:     i.type,
        document_version: i.version,
        granted:          i.granted,
        source:           i.source,
        app_version:      CONFIG.APP_VERSION,
        platform:         Platform.OS,
        created_at:       i.at,
      })));
      return !error;
    } catch {
      return false;
    }
  }

  /** Envía las autorizaciones pendientes (registro previo al OTP). */
  async flushPending(userId: string): Promise<void> {
    const pending = await leer<PendingConsent[]>(PENDING_KEY, []);
    if (pending.length === 0) return;
    if (await this.enviar(userId, pending)) {
      try { await AsyncStorage.removeItem(PENDING_KEY); } catch { /* noop */ }
    }
  }

  /**
   * Trae del servidor el estado vigente y lo fusiona con el caché (gana el más
   * reciente). Así un usuario que reinstala no tiene que aceptar de nuevo.
   */
  async syncFromServer(): Promise<ConsentState> {
    const local = await this.getLocal();
    if (!supabase) return local;
    try {
      const { data, error } = await supabase.rpc('current_consents');
      if (error || !Array.isArray(data)) return local;
      const merged = fusionarConsentimientos(local, data);
      await escribir(CACHE_KEY, merged);
      notificar(merged);
      return merged;
    } catch {
      return local;
    }
  }

  /**
   * Asocia el caché al usuario que inició sesión. Si el caché pertenecía a
   * otra cuenta (teléfono compartido), se descarta para que las autorizaciones
   * de un usuario nunca cubran a otro. Las pendientes se conservan: son las
   * del registro que acaba de completarse.
   */
  async bindUser(userId: string): Promise<void> {
    try {
      const owner = await AsyncStorage.getItem(OWNER_KEY);
      if (owner && owner !== userId) {
        await AsyncStorage.removeItem(CACHE_KEY);
        memoria = null;
        notificar({});
      }
      await AsyncStorage.setItem(OWNER_KEY, userId);
    } catch { /* noop */ }
  }

  /** Borra el caché local (cierre de sesión / eliminación de cuenta). */
  async clearLocal(): Promise<void> {
    try { await AsyncStorage.multiRemove([CACHE_KEY, PENDING_KEY, OWNER_KEY]); } catch { /* noop */ }
    notificar({});
  }
}

export const consentService = new ConsentService();
