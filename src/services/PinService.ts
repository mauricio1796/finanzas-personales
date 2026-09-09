import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const PIN_KEY      = 'financyai_pin_v1';
const USER_ID_KEY  = 'financyai_pin_uid_v1';
const BIOMETRIC_KEY = 'financyai_biometric_v1';
const REMEMBERED_KEY = 'financyai_remembered_user_v1';

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

// ── API pública (idéntica para native y web) ──────────────────────────────────

export async function savePin(pin: string, userId: string): Promise<void> {
  await setItem(PIN_KEY,     pin);
  await setItem(USER_ID_KEY, userId);
}

export async function getStoredPin(): Promise<string | null> {
  return getItem(PIN_KEY);
}

export async function getPinUserId(): Promise<string | null> {
  return getItem(USER_ID_KEY);
}

export async function verifyPin(input: string): Promise<boolean> {
  const stored = await getStoredPin();
  return stored !== null && stored === input;
}

export async function clearPin(): Promise<void> {
  await removeItem(PIN_KEY);
  await removeItem(USER_ID_KEY);
  await removeItem(BIOMETRIC_KEY);
}

export async function hasPin(): Promise<boolean> {
  const pin = await getStoredPin();
  return pin !== null && pin.length === 4;
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

/** Lanza el prompt biométrico del sistema. Devuelve true si autenticó. */
export async function authenticateBiometric(
  prompt = 'Desbloquea FinancyAI',
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage:       prompt,
      cancelLabel:         'Usar PIN',
      disableDeviceFallback: true,
    });
    return res.success;
  } catch {
    return false;
  }
}
