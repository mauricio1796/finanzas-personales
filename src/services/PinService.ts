import * as SecureStore from 'expo-secure-store';

const PIN_KEY     = 'financyai_pin_v1';
const USER_ID_KEY = 'financyai_pin_uid_v1';

export async function savePin(pin: string, userId: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_KEY,     pin);
  await SecureStore.setItemAsync(USER_ID_KEY, userId);
}

export async function getStoredPin(): Promise<string | null> {
  return SecureStore.getItemAsync(PIN_KEY);
}

export async function getPinUserId(): Promise<string | null> {
  return SecureStore.getItemAsync(USER_ID_KEY);
}

export async function verifyPin(input: string): Promise<boolean> {
  const stored = await getStoredPin();
  return stored !== null && stored === input;
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(USER_ID_KEY).catch(() => {});
}

export async function hasPin(): Promise<boolean> {
  const pin = await getStoredPin();
  return pin !== null && pin.length === 4;
}
