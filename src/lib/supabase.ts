import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';

export const isSupabaseReady: boolean =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('TU_PROJECT_ID') &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes('TU_ANON_KEY');

// Almacenamiento seguro para sesiones en dispositivos nativos.
// Usa SecureStore (Keychain/Keystore) en iOS/Android; cae a AsyncStorage en web.
const SecureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // Si SecureStore falla (emulador sin soporte), degradar a AsyncStorage
      return AsyncStorage.getItem(key);
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') { await AsyncStorage.removeItem(key); return; }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      await AsyncStorage.removeItem(key);
    }
  },
};

export const supabase: SupabaseClient | null = isSupabaseReady
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: SecureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
