/**
 * Reglas puras de consentimiento (sin dependencias de React Native, testeables
 * con `node --test`). Ver services/ConsentService.ts.
 */
export type ConsentType = 'privacy' | 'terms' | 'age_confirmation' | 'ai_processing' | 'marketing'
  /** Leer notificaciones del banco para registrar compras (captura automática, Android). */
  | 'capture_notifications';

export interface ConsentRecord {
  granted: boolean;
  version: string;
  at: string;
}

export type ConsentState = Partial<Record<ConsentType, ConsentRecord>>;

/**
 * ¿El estado cubre las autorizaciones obligatorias en su versión vigente?
 * Un cambio de versión de privacidad o términos obliga a aceptar de nuevo.
 */
export function cumpleObligatorios(
  state: ConsentState,
  versions: { privacy: string; terms: string },
): boolean {
  return (
    state.privacy?.granted === true && state.privacy.version === versions.privacy &&
    state.terms?.granted === true && state.terms.version === versions.terms &&
    state.age_confirmation?.granted === true
  );
}

/** Fusiona estado local y del servidor: gana el registro más reciente por tipo. */
export function fusionarConsentimientos(
  local: ConsentState,
  servidor: { consent_type: ConsentType; document_version: string; granted: boolean; created_at: string }[],
): ConsentState {
  const merged: ConsentState = { ...local };
  for (const row of servidor) {
    const prev = merged[row.consent_type];
    if (!prev || new Date(row.created_at).getTime() >= new Date(prev.at).getTime()) {
      merged[row.consent_type] = { granted: row.granted, version: row.document_version, at: row.created_at };
    }
  }
  return merged;
}
