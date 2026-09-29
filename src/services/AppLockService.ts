/**
 * Preferencia de bloqueo por inactividad y salidas intencionales de la app.
 *
 * Abrir la cámara, la galería o el menú de compartir manda la app a segundo
 * plano (sobre todo en Android). Esas salidas las inicia el propio usuario, así
 * que no deben pedirle el PIN al volver: se envuelven en `conSalidaPermitida`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OPCION_BLOQUEO_DEFAULT, esOpcionBloqueo, type OpcionBloqueo,
} from '../utils/appLockPolicy';

const KEY = '@financy_autolock_v1';

let opcion: OpcionBloqueo = OPCION_BLOQUEO_DEFAULT;
let cargada = false;

export async function cargarOpcionBloqueo(): Promise<OpcionBloqueo> {
  if (cargada) return opcion;
  try {
    const v = await AsyncStorage.getItem(KEY);
    opcion = esOpcionBloqueo(v) ? v : OPCION_BLOQUEO_DEFAULT;
  } catch {
    opcion = OPCION_BLOQUEO_DEFAULT;
  }
  cargada = true;
  return opcion;
}

/** Valor en memoria (síncrono): lo usa el listener de AppState al volver al frente. */
export function opcionBloqueoActual(): OpcionBloqueo {
  return opcion;
}

export async function guardarOpcionBloqueo(o: OpcionBloqueo): Promise<void> {
  opcion = o;
  cargada = true;
  try { await AsyncStorage.setItem(KEY, o); } catch { /* noop */ }
}

/** Tras borrar los datos: vuelve al valor por defecto. */
export function olvidarOpcionBloqueo(): void {
  opcion = OPCION_BLOQUEO_DEFAULT;
  cargada = false;
}

let salidasEnCurso = 0;

/** Ejecuta algo que saca al usuario de la app (cámara, compartir…) sin que se bloquee al volver. */
export async function conSalidaPermitida<T>(fn: () => Promise<T>): Promise<T> {
  salidasEnCurso++;
  try {
    return await fn();
  } finally {
    salidasEnCurso = Math.max(0, salidasEnCurso - 1);
  }
}

/** Se consulta en el momento de pasar a segundo plano. */
export function haySalidaPermitida(): boolean {
  return salidasEnCurso > 0;
}
