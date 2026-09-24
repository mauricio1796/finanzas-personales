/**
 * Cabeceras para llamar al Worker con la identidad del usuario.
 *
 * El Worker exige `Authorization: Bearer <access token de Supabase>` en sus
 * rutas (AUTH_MODE=required): así nadie puede usarlo como proxy anónimo hacia
 * la IA ni iniciar pagos a nombre de otra cuenta. `getSession()` renueva el
 * token automáticamente si está por vencer.
 */
import { supabase } from '../lib/supabase';
import { WORKER_HEADERS } from '../constants/config';

export async function getWorkerHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...WORKER_HEADERS };
  try {
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch { /* sin sesión: el Worker responderá 401 y la app usará su modo local */ }
  return headers;
}

/** Mensaje uniforme cuando una función de IA se usa sin autorización del titular. */
export const AI_CONSENT_REQUIRED_MSG =
  'Esta función usa inteligencia artificial de un proveedor externo. Actívala en Perfil › Privacidad y mis datos › Procesamiento con IA.';

export class AIConsentRequiredError extends Error {
  constructor() {
    super(AI_CONSENT_REQUIRED_MSG);
    this.name = 'AIConsentRequiredError';
  }
}
