import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
// Acepta tanto el nombre antiguo (ANON_KEY) como el nuevo (KEY) para compatibilidad
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';

// Devuelve true solo si ambas variables están configuradas con valores reales
export const isSupabaseReady: boolean =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('TU_PROJECT_ID') &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes('TU_ANON_KEY');

// Si no está configurado, supabase es null → todos los métodos de servicio
// verifican esto y se vuelven no-op, manteniendo el comportamiento local-only.
export const supabase: SupabaseClient | null = isSupabaseReady
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // En native usamos AsyncStorage para persistir la sesión entre reinicios
        storage: Platform.OS !== 'web' ? (AsyncStorage as any) : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
