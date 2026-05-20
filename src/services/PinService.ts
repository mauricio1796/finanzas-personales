import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const PIN_KEY     = 'financyai_pin_v1';
const USER_ID_KEY = 'financyai_pin_uid_v1';

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
}

export async function hasPin(): Promise<boolean> {
  const pin = await getStoredPin();
  return pin !== null && pin.length === 4;
}
