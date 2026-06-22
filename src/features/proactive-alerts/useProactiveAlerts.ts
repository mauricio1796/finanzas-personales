/**
 * useProactiveAlerts — hook principal.
 *
 * - Se ejecuta una vez al montar (cuando el usuario tiene datos cargados).
 * - Evita re-ejecutar el análisis más de una vez por sesión.
 * - Devuelve alertas de hoy, insight diario, y helpers para la UI.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform }       from 'react-native';
import { useFinance }     from '../../state';
import { detectarAlertas } from './AlertasDetector';
import {
  cargarPreferencias,
  procesarAlertas,
  obtenerAlertasHoy,
  obtenerAlertasNoLeidas,
  marcarAlertaLeida,
  marcarTodasLeidas,
  guardarPushToken,
} from './AlertasService';
import type { FinnAlerta, AlertPreferences } from './types';
import { DEFAULT_PREFS } from './types';

interface UseProactiveAlertsResult {
  alertasHoy:      FinnAlerta[];
  insightDiario:   FinnAlerta | null;
  noLeidas:        number;
  isRunning:       boolean;
  prefs:           AlertPreferences;
  marcarLeida:     (id: string) => Promise<void>;
  marcarTodasLeidas: () => Promise<void>;
  recargar:        () => Promise<void>;
}

export function useProactiveAlerts(): UseProactiveAlertsResult {
  const { user, transactions, categories, profile, goal, premium, isLoading } = useFinance();

  const [alertasHoy,  setAlertasHoy]  = useState<FinnAlerta[]>([]);
  const [prefs,       setPrefs]       = useState<AlertPreferences>(DEFAULT_PREFS);
  const [isRunning,   setIsRunning]   = useState(false);

  const yaEjecutado   = useRef(false);
  const userId        = user?.id ?? '';

  // ── Registrar push token una sola vez ─────────────────────────────────────

  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    Notifications.getExpoPushTokenAsync()
      .then(t => guardarPushToken(userId, t.data))
      .catch(() => {});
  }, [userId]);

  // ── Análisis al cargar datos ───────────────────────────────────────────────

  const ejecutarAnalisis = useCallback(async () => {
    if (!userId || isLoading || yaEjecutado.current) return;
    yaEjecutado.current = true;
    setIsRunning(true);

    try {
      const userPrefs = await cargarPreferencias(userId);
      setPrefs(userPrefs);

      if (!userPrefs.alertas_activas) {
        const hoy = await obtenerAlertasHoy(userId);
        setAlertasHoy(hoy);
        return;
      }

      const candidatos = detectarAlertas({
        transactions,
        categories,
        profile,
        goal,
        isPremium: premium?.isPremium ?? false,
        prefs:     userPrefs,
      });

      const alertas = await procesarAlertas(userId, candidatos, userPrefs.max_alertas_dia);
      setAlertasHoy(alertas);
    } catch {
      // análisis fallido — cargar solo lo que ya está en DB
      try {
        const hoy = await obtenerAlertasHoy(userId);
        setAlertasHoy(hoy);
      } catch { /* silencioso */ }
    } finally {
      setIsRunning(false);
    }
  }, [userId, isLoading, transactions, categories, profile, goal, premium]);

  useEffect(() => {
    if (!isLoading && userId && transactions.length >= 0) {
      ejecutarAnalisis();
    }
  }, [isLoading, userId]); // solo cuando termina de cargar, no en cada render

  // ── Helpers públicos ──────────────────────────────────────────────────────

  const handleMarcarLeida = useCallback(async (id: string) => {
    await marcarAlertaLeida(id, userId);
    setAlertasHoy(prev => prev.map(a => a.id === id ? { ...a, leido: true } : a));
  }, [userId]);

  const handleMarcarTodasLeidas = useCallback(async () => {
    await marcarTodasLeidas(userId);
    setAlertasHoy(prev => prev.map(a => ({ ...a, leido: true })));
  }, [userId]);

  const recargar = useCallback(async () => {
    yaEjecutado.current = false;
    await ejecutarAnalisis();
  }, [ejecutarAnalisis]);

  // ── Derivados ─────────────────────────────────────────────────────────────

  const insightDiario = alertasHoy.find(a => a.tipo_alerta === 'insight_diario') ?? null;
  const noLeidas      = alertasHoy.filter(a => !a.leido).length;

  return {
    alertasHoy,
    insightDiario,
    noLeidas,
    isRunning,
    prefs,
    marcarLeida:      handleMarcarLeida,
    marcarTodasLeidas: handleMarcarTodasLeidas,
    recargar,
  };
}
