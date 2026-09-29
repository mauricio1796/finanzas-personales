import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { MAX_INTENTOS, calcularEsperaMs } from '../utils/pinPolicy';
import { traducirErrorBiometria, type ResultadoBiometria } from '../utils/biometriaPolicy';
import { conSalidaPermitida } from './AppLockService';

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

// ── Biometría (Face ID / Touch ID / huella) ─────────────────────────────────

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'none';

/**
 * - disponible:     se puede usar ya.
 * - sin_permiso:    (iOS) el teléfono tiene Face ID pero el usuario le negó el
 *                   permiso a FinancyAI; solo se reactiva en Ajustes.
 * - no_configurado: el hardware existe pero no hay rostro/huella registrados.
 * - sin_hardware:   el dispositivo no tiene biometría (o es web).
 */
export type EstadoBiometria = 'disponible' | 'sin_permiso' | 'no_configurado' | 'sin_hardware';

/** Nombre correcto para mostrar: "Face ID" solo existe en iPhone. */
export function etiquetaBiometria(kind: BiometricKind): string {
  if (Platform.OS === 'ios') return kind === 'face' ? 'Face ID' : 'Touch ID';
  if (kind === 'face') return 'reconocimiento facial';
  if (kind === 'iris') return 'reconocimiento de iris';
  return 'huella';
}

export async function getBiometricAvailability(): Promise<{
  available: boolean; kind: BiometricKind; estado: EstadoBiometria;
}> {
  if (Platform.OS === 'web') return { available: false, kind: 'none', estado: 'sin_hardware' };
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const T = LocalAuthentication.AuthenticationType;
    const kind: BiometricKind =
      types.includes(T.FACIAL_RECOGNITION) ? 'face'
        : types.includes(T.IRIS) ? 'iris'
          : types.includes(T.FINGERPRINT) ? 'fingerprint'
            : 'none';

    if (!hasHardware) {
      // iOS reporta "no disponible" cuando el usuario negó el permiso de Face ID
      // a la app, pero sigue informando el tipo de sensor: así se distingue.
      if (Platform.OS === 'ios' && kind !== 'none') return { available: false, kind, estado: 'sin_permiso' };
      return { available: false, kind: 'none', estado: 'sin_hardware' };
    }
    if (!enrolled) return { available: false, kind, estado: 'no_configurado' };
    return { available: true, kind: kind === 'none' ? 'fingerprint' : kind, estado: 'disponible' };
  } catch {
    return { available: false, kind: 'none', estado: 'sin_hardware' };
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

export type { MotivoFalloBiometria, ResultadoBiometria } from '../utils/biometriaPolicy';

/**
 * Lanza el diálogo biométrico del sistema y traduce cada error a un mensaje
 * accionable (antes se devolvía un booleano y los fallos pasaban en silencio).
 * El bloqueo por intentos del PIN también aplica aquí: la biometría no puede
 * usarse como vía para saltárselo.
 */
export async function authenticateBiometric(
  prompt = 'Desbloquea FinancyAI',
  kind: BiometricKind = 'face',
): Promise<ResultadoBiometria> {
  if (Platform.OS === 'web') return { ok: false, motivo: 'no_soportado', mensaje: null };

  const estado = await getEstadoIntentos();
  if (estado.bloqueado) {
    return { ok: false, motivo: 'bloqueado_pin', mensaje: 'El acceso está bloqueado temporalmente por intentos fallidos.' };
  }

  const nombre = etiquetaBiometria(kind);
  let error = '';
  try {
    // El diálogo del sistema pone la app en "inactive": no es una salida real.
    const res = await conSalidaPermitida(() => LocalAuthentication.authenticateAsync({
      promptMessage:         prompt,
      cancelLabel:           'Cancelar',
      fallbackLabel:         'Usar PIN',     // iOS: botón tras un intento fallido
      disableDeviceFallback: true,           // el respaldo es el PIN de la app, no el código del teléfono
      requireConfirmation:   false,          // Android: rostro sin tocar "Confirmar"
    }));
    if (res.success) {
      await limpiarFallos();
      return { ok: true };
    }
    error = String((res as { error?: string }).error ?? '');
  } catch {
    error = 'unknown';
  }

  return traducirErrorBiometria(error, Platform.OS, nombre);
}
