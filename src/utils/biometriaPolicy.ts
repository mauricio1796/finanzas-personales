/**
 * Traducción de los errores de expo-local-authentication a motivos y mensajes
 * accionables. Módulo puro (sin React Native): cubierto por
 * tests/biometriaPolicy.test.ts.
 */

export type MotivoFalloBiometria =
  | 'cancelado'          // el usuario eligió el PIN o cerró el diálogo: no se muestra nada
  | 'interrumpido'       // el sistema cerró el diálogo (llamada, app en segundo plano)
  | 'no_reconocido'
  | 'bloqueado_sistema'  // demasiados intentos: el teléfono exige su código
  | 'bloqueado_pin'      // el PIN de la app está bloqueado por intentos
  | 'sin_permiso'
  | 'no_configurado'
  | 'sin_codigo'
  | 'no_soportado'
  | 'error';

export interface FalloBiometria {
  ok: false;
  motivo: MotivoFalloBiometria;
  mensaje: string | null;
  abrirAjustes?: boolean;
}

export type ResultadoBiometria = { ok: true } | FalloBiometria;

/**
 * @param error  valor de `result.error` de authenticateAsync ('' si lanzó)
 * @param plataforma 'ios' | 'android' | …
 * @param nombre etiqueta visible ("Face ID", "huella"…)
 */
export function traducirErrorBiometria(error: string, plataforma: string, nombre: string): FalloBiometria {
  switch (error) {
    case 'user_cancel':
    case 'user_fallback':
      return { ok: false, motivo: 'cancelado', mensaje: null };
    case 'system_cancel':
    case 'app_cancel':
      return { ok: false, motivo: 'interrumpido', mensaje: null };
    case 'authentication_failed':
      return { ok: false, motivo: 'no_reconocido', mensaje: 'No te reconocimos. Intenta otra vez o usa tu PIN.' };
    case 'lockout':
      return {
        ok: false, motivo: 'bloqueado_sistema',
        mensaje: `Demasiados intentos con ${nombre}. Desbloquea tu teléfono con su código y vuelve a intentarlo, o entra con tu PIN.`,
      };
    case 'not_enrolled':
      return { ok: false, motivo: 'no_configurado', mensaje: `No tienes ${nombre} configurado en este teléfono.`, abrirAjustes: true };
    case 'passcode_not_set':
      return { ok: false, motivo: 'sin_codigo', mensaje: `Para usar ${nombre}, primero configura un código de desbloqueo en tu teléfono.`, abrirAjustes: true };
    case 'not_available':
      return plataforma === 'ios'
        ? { ok: false, motivo: 'sin_permiso', mensaje: `FinancyAI no tiene permiso para usar ${nombre}. Actívalo en Ajustes › FinancyAI.`, abrirAjustes: true }
        : { ok: false, motivo: 'no_soportado', mensaje: `${nombre} no está disponible en este momento. Usa tu PIN.` };
    case 'missing_usage_description':
      // Build sin NSFaceIDUsageDescription (p. ej. Expo Go): iOS no permite mostrar Face ID.
      return { ok: false, motivo: 'no_soportado', mensaje: 'Face ID no está disponible en esta versión de la app. Usa tu PIN.' };
    default:
      return { ok: false, motivo: 'error', mensaje: `No pudimos usar ${nombre}. Usa tu PIN.` };
  }
}
