import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { MAX_INTENTOS, calcularEsperaMs } from '../utils/pinPolicy';

const PIN_KEY        = 'financyai_pin_v1';        // legado: PIN en texto plano
const PIN_HASH_KEY   = 'financyai_pin_hash_v2';   // { salt, hash, iteraciones }
const USER_ID_KEY    = 'financyai_pin_uid_v1';
const BIOMETRIC_KEY  = 'financyai_biometric_v1';
const REMEMBERED_KEY = 'financyai_remembered_user_v1';
const LOCKOUT_KEY    = 'financyai_pin_lockout_v1'; // { fallos, bloqueadoHasta }

/**
 * Estiramiento de clave. Un PIN de 4 dígitos solo tiene 10.000 combinaciones,
 * así que el hash por sí solo no detiene a quien extraiga el archivo y pruebe
 * offline; lo que sí logra es que el PIN deje de estar legible en claro y
 * encarecer cada intento. La defensa real contra fuerza bruta es el bloqueo
 * persistente de más abajo.
 */
const ITERACIONES = 6_000;

// ── Storage abstraction (SecureStore en native, localStorage en web) ──────────

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key).catch(() => {});
  }
}

// ── Hashing del PIN (BUG-17) ─────────────────────────────────────────────────

interface PinGuardado {
  salt: string;
  hash: string;
  iteraciones: number;
}

function generarSalt(): string {
  const bytes = Crypto.getRandomBytes(16);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 iterado sobre `salt:pin`. Determinista y disponible en native y web. */
async function derivarHash(pin: string, salt: string, iteraciones: number): Promise<string> {
  let acumulado = `${salt}:${pin}`;
  for (let i = 0; i < iteraciones; i++) {
    acumulado = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      acumulado,
    );
  }
  return acumulado;
}

/** Comparación en tiempo constante: no filtra cuántos caracteres coincidían. */
function igualdadSegura(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Política de PIN (lógica pura, en utils/pinPolicy para poder probarla) ────

export { validarFortalezaPin, MAX_INTENTOS, type ValidacionPin } from '../utils/pinPolicy';

// ── Bloqueo persistente por intentos fallidos (BUG-16) ───────────────────────

interface EstadoBloqueo {
  fallos: number;
  bloqueadoHasta: number; // epoch ms
}

const SIN_BLOQUEO: EstadoBloqueo = { fallos: 0, bloqueadoHasta: 0 };

async function leerBloqueo(): Promise<EstadoBloqueo> {
  try {
    const raw = await getItem(LOCKOUT_KEY);
    if (!raw) return { ...SIN_BLOQUEO };
    const parsed = JSON.parse(raw) as EstadoBloqueo;
    return {
      fallos: Number(parsed.fallos) || 0,
      bloqueadoHasta: Number(parsed.bloqueadoHasta) || 0,
    };
  } catch {
    return { ...SIN_BLOQUEO };
  }
}

async function guardarBloqueo(estado: EstadoBloqueo): Promise<void> {
  try { await setItem(LOCKOUT_KEY, JSON.stringify(estado)); } catch { /* noop */ }
}

export interface EstadoIntentos {
  bloqueado: boolean;
  /** Segundos que faltan para poder reintentar. */
  segundosRestantes: number;
  intentosRestantes: number;
}

export async function getEstadoIntentos(): Promise<EstadoIntentos> {
  const estado = await leerBloqueo();
  const ahora = Date.now();
  const bloqueado = estado.bloqueadoHasta > ahora;
  return {
    bloqueado,
    segundosRestantes: bloqueado ? Math.ceil((estado.bloqueadoHasta - ahora) / 1000) : 0,
    intentosRestantes: Math.max(0, MAX_INTENTOS - estado.fallos),
  };
}

async function registrarFallo(): Promise<EstadoIntentos> {
  const estado = await leerBloqueo();
  const fallos = estado.fallos + 1;
  const espera = calcularEsperaMs(fallos);
  const nuevo: EstadoBloqueo = {
    fallos,
    bloqueadoHasta: espera > 0 ? Date.now() + espera : 0,
  };
  await guardarBloqueo(nuevo);
  return getEstadoIntentos();
}

async function limpiarFallos(): Promise<void> {
  await removeItem(LOCKOUT_KEY);
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function savePin(pin: string, userId: string): Promise<void> {
  const salt = generarSalt();
  const hash = await derivarHash(pin, salt, ITERACIONES);
  const guardado: PinGuardado = { salt, hash, iteraciones: ITERACIONES };

  await setItem(PIN_HASH_KEY, JSON.stringify(guardado));
  await setItem(USER_ID_KEY, userId);
  // El PIN en claro de versiones anteriores deja de existir.
  await removeItem(PIN_KEY);
  await limpiarFallos();
}

export async function getPinUserId(): Promise<string | null> {
  return getItem(USER_ID_KEY);
}

export interface ResultadoVerificacion {
  ok: boolean;
  bloqueado: boolean;
  segundosRestantes: number;
  intentosRestantes: number;
}

/**
 * Verifica el PIN respetando el bloqueo persistente.
 *
 * Migración transparente: si el dispositivo todavía tiene el PIN en claro de la
 * versión anterior, se valida contra él una última vez y, si acierta, se
 * re-guarda hasheado. Así ningún usuario existente queda fuera de su app.
 */
export async function verifyPin(input: string): Promise<ResultadoVerificacion> {
  const estadoPrevio = await getEstadoIntentos();
  if (estadoPrevio.bloqueado) {
    return { ok: false, ...estadoPrevio };
  }

  const userId = (await getPinUserId()) ?? '';
  let correcto = false;

  const rawHash = await getItem(PIN_HASH_KEY);
  if (rawHash) {
    try {
      const guardado = JSON.parse(rawHash) as PinGuardado;
      const calculado = await derivarHash(input, guardado.salt, guardado.iteraciones);
      correcto = igualdadSegura(calculado, guardado.hash);
    } catch {
      correcto = false;
    }
  } else {
    // Camino de migración desde el formato en texto plano.
    const legado = await getItem(PIN_KEY);
    if (legado !== null) {
      correcto = igualdadSegura(legado, input);
      if (correcto) await savePin(input, userId);
    }
  }

  if (correcto) {
    await limpiarFallos();
    return { ok: true, bloqueado: false, segundosRestantes: 0, intentosRestantes: MAX_INTENTOS };
  }

  const tras = await registrarFallo();
  return { ok: false, ...tras };
}

export async function clearPin(): Promise<void> {
  await removeItem(PIN_KEY);
  await removeItem(PIN_HASH_KEY);
  await removeItem(USER_ID_KEY);
  await removeItem(BIOMETRIC_KEY);
  await limpiarFallos();
}

export async function hasPin(): Promise<boolean> {
  const hash = await getItem(PIN_HASH_KEY);
  if (hash) return true;
  const legado = await getItem(PIN_KEY);
  return legado !== null && legado.length === 4;
}

// ── Usuario recordado (para la pantalla de bloqueo) ──────────────────────────
// Datos NO sensibles: nombre, correo, nivel y título de gamificación.

export interface RememberedUser {
  name:   string;
  email?: string;
  level?: number;
  title?: string;
}

export async function saveRememberedUser(u: RememberedUser): Promise<void> {
  try { await setItem(REMEMBERED_KEY, JSON.stringify(u)); } catch { /* noop */ }
}

export async function getRememberedUser(): Promise<RememberedUser | null> {
  try {
    const raw = await getItem(REMEMBERED_KEY);
    return raw ? JSON.parse(raw) as RememberedUser : null;
  } catch {
    return null;
  }
}

export async function clearRememberedUser(): Promise<void> {
  await removeItem(REMEMBERED_KEY);
}

// ── Biometría (Face ID / huella) ────────────────────────────────────────────

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'none';

/** Hardware presente + al menos una biometría registrada en el dispositivo. */
export async function getBiometricAvailability(): Promise<{ available: boolean; kind: BiometricKind }> {
  if (Platform.OS === 'web') return { available: false, kind: 'none' };
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled    = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) return { available: false, kind: 'none' };

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const T = LocalAuthentication.AuthenticationType;
    let kind: BiometricKind = 'fingerprint';
    if (types.includes(T.FACIAL_RECOGNITION)) kind = 'face';
    else if (types.includes(T.IRIS))          kind = 'iris';
    else if (types.includes(T.FINGERPRINT))   kind = 'fingerprint';
    return { available: true, kind };
  } catch {
    return { available: false, kind: 'none' };
  }
}

/** ¿El usuario activó el desbloqueo biométrico en esta app? */
export async function isBiometricEnabled(): Promise<boolean> {
  const v = await getItem(BIOMETRIC_KEY);
  return v === '1';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) await setItem(BIOMETRIC_KEY, '1');
  else         await removeItem(BIOMETRIC_KEY);
}

/**
 * Lanza el prompt biométrico del sistema. Devuelve true si autenticó.
 * El bloqueo por intentos también aplica aquí: si el PIN está bloqueado, la
 * biometría no puede usarse como vía para saltárselo.
 */
export async function authenticateBiometric(
  prompt = 'Desbloquea FinancyAI',
): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const estado = await getEstadoIntentos();
  if (estado.bloqueado) return false;

  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage:       prompt,
      cancelLabel:         'Usar PIN',
      disableDeviceFallback: true,
    });
    if (res.success) await limpiarFallos();
    return res.success;
  } catch {
    return false;
  }
}
