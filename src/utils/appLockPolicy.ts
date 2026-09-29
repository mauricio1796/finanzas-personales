/**
 * Bloqueo por inactividad: ¿hay que pedir PIN/Face ID al volver a la app?
 * Módulo puro (sin React Native): cubierto por tests/appLockPolicy.test.ts.
 */

export type OpcionBloqueo = 'inmediato' | '1min' | '5min' | 'al_abrir';

export const OPCION_BLOQUEO_DEFAULT: OpcionBloqueo = '1min';

export const OPCIONES_BLOQUEO: { valor: OpcionBloqueo; etiqueta: string }[] = [
  { valor: 'inmediato', etiqueta: 'Al salir' },
  { valor: '1min',      etiqueta: '1 min' },
  { valor: '5min',      etiqueta: '5 min' },
  { valor: 'al_abrir',  etiqueta: 'Al abrir' },
];

/** Tiempo de gracia en segundo plano; null = nunca bloquea al volver (solo al abrir la app). */
export function graciaMs(opcion: OpcionBloqueo): number | null {
  switch (opcion) {
    case 'inmediato': return 0;
    case '1min':      return 60_000;
    case '5min':      return 5 * 60_000;
    case 'al_abrir':  return null;
  }
}

export function esOpcionBloqueo(v: unknown): v is OpcionBloqueo {
  return v === 'inmediato' || v === '1min' || v === '5min' || v === 'al_abrir';
}

/**
 * @param salidaEn    momento en que la app pasó a segundo plano (ms)
 * @param ahora       momento en que volvió al frente (ms)
 * @param opcion      preferencia del usuario
 * @param salidaPermitida  la app salió a propósito (cámara, compartir…) y el usuario volvió a tiempo
 */
export function debeBloquear(
  salidaEn: number, ahora: number, opcion: OpcionBloqueo, salidaPermitida = false,
): boolean {
  const gracia = graciaMs(opcion);
  if (gracia === null || salidaPermitida) return false;
  const fuera = ahora - salidaEn;
  // Reloj del sistema movido hacia atrás: no se puede medir, se bloquea por seguridad.
  if (fuera < 0) return true;
  return fuera >= gracia;
}
