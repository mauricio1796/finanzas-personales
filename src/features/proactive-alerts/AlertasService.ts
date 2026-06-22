/**
 * AlertasService — orquestación de alertas proactivas.
 *
 * Responsabilidades:
 *   1. Cargar/guardar preferencias (finn_alert_preferences)
 *   2. Ejecutar detector de reglas
 *   3. Insertar con deduplicación (insert_finn_alerta RPC → ON CONFLICT DO NOTHING)
 *   4. Respetar max_alertas_dia
 *   5. Disparar notificación local (expo-notifications) cuando la alerta es nueva
 *   6. Devolver alertas de hoy para el dashboard
 */

import * as Notifications from 'expo-notifications';
import { Platform }       from 'react-native';
import { supabase }       from '../../lib/supabase';
import {
  DEFAULT_PREFS,
  type AlertPreferences,
  type AlertaCandidato,
  type FinnAlerta,
  type TipoAlerta,
} from './types';

const ALERTAS_POSITIVAS: TipoAlerta[] = ['racha_ahorro', 'meta_cerca', 'insight_diario'];

// ── Preferencias ──────────────────────────────────────────────────────────────

export async function cargarPreferencias(userId: string): Promise<AlertPreferences> {
  if (!supabase) return DEFAULT_PREFS;
  try {
    const { data, error } = await supabase
      .rpc('get_or_create_alert_preferences', { p_user_id: userId });
    if (error || !data) return DEFAULT_PREFS;
    return {
      alertas_activas:       data.alertas_activas       ?? true,
      max_alertas_dia:       data.max_alertas_dia       ?? 4,
      insight_diario_activo: data.insight_diario_activo ?? true,
      hora_insight:          data.hora_insight           ?? '08:00',
      alertas_presupuesto:   data.alertas_presupuesto   ?? true,
      alertas_anomalias:     data.alertas_anomalias     ?? true,
      alertas_compromisos:   data.alertas_compromisos   ?? true,
      alertas_ritmo:         data.alertas_ritmo         ?? true,
      alertas_ahorro:        data.alertas_ahorro        ?? true,
      alertas_metas:         data.alertas_metas         ?? true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function guardarPreferencias(
  userId: string,
  prefs: Partial<AlertPreferences>,
): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('finn_alert_preferences')
    .upsert({ user_id: userId, ...prefs }, { onConflict: 'user_id' });
}

// ── Alertas de hoy (para dashboard) ──────────────────────────────────────────

export async function obtenerAlertasHoy(userId: string): Promise<FinnAlerta[]> {
  if (!supabase) return [];
  try {
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('finn_alertas_log')
      .select('*')
      .eq('usuario_id', userId)
      .gte('enviado_at', hoyInicio.toISOString())
      .order('enviado_at', { ascending: false })
      .limit(10);

    if (error) return [];
    return (data ?? []) as FinnAlerta[];
  } catch {
    return [];
  }
}

export async function obtenerAlertasNoLeidas(userId: string): Promise<FinnAlerta[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('finn_alertas_log')
      .select('*')
      .eq('usuario_id', userId)
      .eq('leido', false)
      .order('enviado_at', { ascending: false })
      .limit(20);

    if (error) return [];
    return (data ?? []) as FinnAlerta[];
  } catch {
    return [];
  }
}

export async function marcarAlertaLeida(alertaId: string, userId: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('finn_alertas_log')
    .update({ leido: true })
    .eq('id', alertaId)
    .eq('usuario_id', userId);
}

export async function marcarTodasLeidas(userId: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('finn_alertas_log')
    .update({ leido: true })
    .eq('usuario_id', userId)
    .eq('leido', false);
}

// ── Insertar alerta con deduplicación (RPC) ───────────────────────────────────

async function insertarAlerta(
  userId: string,
  candidato: AlertaCandidato,
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('insert_finn_alerta', {
      p_usuario_id:    userId,
      p_tipo_alerta:   candidato.tipo,
      p_referencia_id: candidato.referencia_id,
      p_mensaje:       candidato.mensaje,
      p_canal:         'inapp',
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

// ── Notificación local ────────────────────────────────────────────────────────

async function notificarLocal(candidato: AlertaCandidato): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const esPositiva = ALERTAS_POSITIVAS.includes(candidato.tipo);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: esPositiva ? 'Finn · Buena noticia' : 'Finn · Alerta financiera',
        body:  candidato.mensaje,
        sound: true,
        data:  { tipo: candidato.tipo, referencia_id: candidato.referencia_id },
      },
      trigger: null, // inmediata
    });
  } catch {
    // notificaciones opcionales — nunca rompen el flujo
  }
}

// ── Guardia de racha (máx 1 por semana) ──────────────────────────────────────

async function rachaYaEsteaSemana(userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const hace7 = new Date();
    hace7.setDate(hace7.getDate() - 7);
    const { count } = await supabase
      .from('finn_alertas_log')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', userId)
      .eq('tipo_alerta', 'racha_ahorro')
      .gte('enviado_at', hace7.toISOString());
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

// ── Conteo de alertas enviadas hoy ───────────────────────────────────────────

async function contarAlertasHoy(userId: string): Promise<number> {
  if (!supabase) return 0;
  try {
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('finn_alertas_log')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', userId)
      .gte('enviado_at', hoyInicio.toISOString());
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ── Procesamiento principal ───────────────────────────────────────────────────

export async function procesarAlertas(
  userId: string,
  candidatos: AlertaCandidato[],
  maxPorDia: number,
): Promise<FinnAlerta[]> {
  if (!supabase || candidatos.length === 0) return [];

  const yaEnviadasHoy = await contarAlertasHoy(userId);
  const cupoRestante  = Math.max(0, maxPorDia - yaEnviadasHoy);
  if (cupoRestante === 0) return obtenerAlertasHoy(userId);

  // Separar insight_diario (siempre primero) y racha_ahorro (filtrar si ya fue esta semana)
  const rachaYa = await rachaYaEsteaSemana(userId);

  const ordenados = [
    ...candidatos.filter(c => c.tipo === 'insight_diario'),
    ...candidatos.filter(c =>
      c.tipo !== 'insight_diario' && !(c.tipo === 'racha_ahorro' && rachaYa)
    ),
  ].slice(0, cupoRestante);

  for (const candidato of ordenados) {
    const insertada = await insertarAlerta(userId, candidato);
    if (insertada) {
      await notificarLocal(candidato);
    }
  }

  return obtenerAlertasHoy(userId);
}

// ── Push token ────────────────────────────────────────────────────────────────

export async function guardarPushToken(userId: string, token: string): Promise<void> {
  if (!supabase || !token) return;
  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);
}
