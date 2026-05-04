import { supabase, isSupabaseReady } from '../../lib/supabase';
import type { User } from '../../types';

export interface AuthResult {
  user: User | null;
  error: string | null;
}

class AuthService {
  readonly isReady = isSupabaseReady;

  // ─── Sign In ──────────────────────────────────────────────────────────────
  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!supabase) return { user: null, error: 'Supabase no configurado' };

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      const msg = error?.message ?? 'Error al iniciar sesión';
      // Traducir mensajes comunes
      if (msg.includes('Invalid login credentials')) return { user: null, error: 'Correo o contraseña incorrectos' };
      if (msg.includes('Email not confirmed')) return { user: null, error: 'Confirma tu correo antes de continuar' };
      return { user: null, error: msg };
    }

    // Obtener nombre desde la tabla profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, monthly_salary')
      .eq('id', data.user.id)
      .single();

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
        name: profile?.name || data.user.email!.split('@')[0],
        monthlySalary: (profile?.monthly_salary as number) || undefined,
        createdAt: data.user.created_at,
      },
      error: null,
    };
  }

  // ─── Sign Up ──────────────────────────────────────────────────────────────
  async signUp(email: string, password: string, name: string): Promise<AuthResult> {
    if (!supabase) return { user: null, error: 'Supabase no configurado' };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }, // el trigger handle_new_user lee esto para crear el profile
      },
    });

    if (error || !data.user) {
      const msg = error?.message ?? 'Error al crear cuenta';
      if (msg.includes('already registered')) return { user: null, error: 'Este correo ya tiene una cuenta' };
      if (msg.includes('Password should be')) return { user: null, error: 'La contraseña debe tener al menos 6 caracteres' };
      return { user: null, error: msg };
    }

    // Si hay sesión activa (email confirmation deshabilitado en Supabase):
    // actualizar el nombre en profiles como refuerzo (el trigger ya lo hace)
    if (data.session) {
      await new Promise(r => setTimeout(r, 400));
      await supabase
        .from('profiles')
        .update({ name })
        .eq('id', data.user.id);
    }
    // Si NO hay sesión (email confirmation habilitado):
    // el trigger ya insertó el nombre desde raw_user_meta_data → no hace falta nada más.

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
        name,
        createdAt: data.user.created_at,
      },
      error: null,
    };
  }

  // ─── OTP: enviar código (solo usuarios existentes) ───────────────────────
  async sendOtp(email: string): Promise<{ error: string | null; userNotFound?: boolean }> {
    if (!supabase) return { error: 'Supabase no configurado' };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      if (error.message.includes('rate limit')) return { error: 'Demasiados intentos. Espera un momento.' };
      if (
        error.message.includes('Signups not allowed') ||
        error.message.includes('not found') ||
        error.message.includes('No user found') ||
        error.status === 422
      ) return { error: null, userNotFound: true };
      return { error: 'No se pudo enviar el código. Verifica el correo.' };
    }
    return { error: null };
  }

  // ─── OTP: registrar nuevo usuario y enviar código ────────────────────────
  async sendOtpNewUser(email: string, name: string, password: string): Promise<{ error: string | null }> {
    if (!supabase) return { error: 'Supabase no configurado' };
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (signUpError && !signUpError.message.includes('already registered')) {
      return { error: signUpError.message };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      if (error.message.includes('rate limit')) return { error: 'Demasiados intentos. Espera un momento.' };
      return { error: 'No se pudo enviar el código.' };
    }
    return { error: null };
  }

  // ─── OTP: verificar código ────────────────────────────────────────────────
  async verifyOtp(email: string, token: string): Promise<AuthResult> {
    if (!supabase) return { user: null, error: 'Supabase no configurado' };
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error || !data.user) {
      if (error?.message.includes('expired')) return { user: null, error: 'El código expiró. Solicita uno nuevo.' };
      return { user: null, error: 'Código incorrecto. Intenta de nuevo.' };
    }
    // Esperar trigger si es usuario nuevo
    await new Promise(r => setTimeout(r, 400));
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, monthly_salary')
      .eq('id', data.user.id)
      .single();
    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
        name: profile?.name || data.user.email!.split('@')[0],
        monthlySalary: (profile?.monthly_salary as number) || undefined,
        createdAt: data.user.created_at,
      },
      error: null,
    };
  }

  // ─── Sign Out ─────────────────────────────────────────────────────────────
  async signOut(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  // ─── Recuperar sesión activa ──────────────────────────────────────────────
  // Útil para restaurar la sesión en reinicios de app sin pedir login de nuevo
  async getSession(): Promise<User | null> {
    if (!supabase) return null;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, monthly_salary')
      .eq('id', session.user.id)
      .single();

    return {
      id: session.user.id,
      email: session.user.email!,
      name: profile?.name || session.user.email!.split('@')[0],
      monthlySalary: (profile?.monthly_salary as number) || undefined,
      createdAt: session.user.created_at,
    };
  }
}

export const authService = new AuthService();
