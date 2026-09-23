/**
 * Política de PIN: fortaleza mínima y curva de bloqueo por intentos fallidos.
 *
 * Vive aparte de `PinService` a propósito: aquí no se importa nada de React
 * Native ni de Expo, así que es lógica pura, verificable con pruebas y sin
 * depender de un dispositivo. `PinService` la consume y le añade el
 * almacenamiento seguro.
 */

/** Intentos permitidos antes de empezar a bloquear. */
export const MAX_INTENTOS = 5;

const PINS_TRIVIALES = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '4321', '0123', '3210', '1212', '2121', '1010', '2020', '6969', '1004',
  '2000', '2001', '1122', '1313', '2580', '0852', '1230', '1928', '0987',
]);

export interface ValidacionPin {
  valido: boolean;
  motivo?: string;
}

/** Rechaza PINs que un atacante probaría en sus primeros intentos (BUG-24). */
export function validarFortalezaPin(pin: string): ValidacionPin {
  if (!/^\d{4}$/.test(pin)) {
    return { valido: false, motivo: 'El PIN debe tener exactamente 4 dígitos.' };
  }
  if (PINS_TRIVIALES.has(pin)) {
    return { valido: false, motivo: 'Ese PIN es demasiado común. Elige uno menos predecible.' };
  }

  const d = pin.split('').map(Number);
  if (new Set(d).size === 1) {
    return { valido: false, motivo: 'No uses el mismo dígito cuatro veces.' };
  }
  const ascendente  = d.every((n, i) => i === 0 || n === d[i - 1] + 1);
  const descendente = d.every((n, i) => i === 0 || n === d[i - 1] - 1);
  if (ascendente || descendente) {
    return { valido: false, motivo: 'Evita secuencias como 1234 o 9876.' };
  }
  return { valido: true };
}

/**
 * Espera creciente tras superar el máximo de intentos (BUG-16).
 *
 * Como el contador se persiste, esta espera sobrevive a que el usuario mate y
 * reabra la app — que era exactamente la forma de evadir el límite y dejar un
 * PIN de 4 dígitos (10.000 combinaciones) expuesto a fuerza bruta.
 */
export function calcularEsperaMs(fallos: number): number {
  if (fallos < MAX_INTENTOS) return 0;
  const excedente = fallos - MAX_INTENTOS;              // 0, 1, 2...
  const minutos = Math.min(60, Math.pow(2, excedente)); // 1, 2, 4... tope 60
  return minutos * 60_000;
}
