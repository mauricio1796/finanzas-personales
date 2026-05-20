import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useFinance } from '../state/FinanceContext';
import {
  reprogramarTodasLasNotificaciones,
  verificarPresupuestosLimite,
  verificarGastoInusual,
  verificarMetaAlcanzada,
  limpiarNotificacionesCategoria,
  limpiarCacheMensualNotificaciones,
  programarDiaSinGastar,
} from '../services/NotificacionesService';
import { calcularMetricasFinancieras } from '../utils/ingresoUtils';
import { calcularRachaActual } from '../services/GamificacionService';

export function useNotificacionesManager() {
  const { transactions, categories, profile, goal } = useFinance();
  if (Platform.OS === 'web') return; // notificaciones push no disponibles en web

  const prevTxLen       = useRef(transactions.length);
  const prevCatSnapshot = useRef('');
  const appState        = useRef(AppState.currentState);

  // ── Inicializar al montar ────────────────────────────────────────────────
  useEffect(() => {
    const inicializar = async () => {
      // No intentar programar notificaciones si el permiso no está concedido
      const { status } = await import('expo-notifications').then(m => m.getPermissionsAsync());
      if (status !== 'granted') return;

      await limpiarCacheMensualNotificaciones();
      await programarDiaSinGastar();

      const salary     = profile?.monthlySalary ?? 0;
      const racha      = calcularRachaActual(transactions);

      await reprogramarTodasLasNotificaciones(categories, transactions, salary, racha);

      const now = new Date();
      await verificarPresupuestosLimite(
        categories, transactions, now.getMonth(), now.getFullYear(),
      );

      if (goal && goal.amount > 0) {
        const metricas = calcularMetricasFinancieras(
          transactions, categories, salary, now.getMonth(), now.getFullYear(),
        );
        await verificarMetaAlcanzada(metricas, goal.amount, metricas.ahorroProyectado);
      }
    };

    inicializar().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detectar nueva transacción ───────────────────────────────────────────
  useEffect(() => {
    if (transactions.length <= prevTxLen.current) {
      prevTxLen.current = transactions.length;
      return;
    }

    const nuevaTx = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )[0];

    prevTxLen.current = transactions.length;
    if (!nuevaTx) return;

    const now    = new Date();
    const salary = profile?.monthlySalary ?? 0;

    verificarGastoInusual(nuevaTx, transactions).catch(() => {});

    if (nuevaTx.type === 'expense') {
      verificarPresupuestosLimite(
        categories, transactions, now.getMonth(), now.getFullYear(),
      ).catch(() => {});
    }

    if (nuevaTx.type === 'income' && goal && goal.amount > 0) {
      const metricas = calcularMetricasFinancieras(
        transactions, categories, salary, now.getMonth(), now.getFullYear(),
      );
      verificarMetaAlcanzada(metricas, goal.amount, metricas.ahorroProyectado).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions.length]);

  // ── Detectar cambios en categorías ──────────────────────────────────────
  useEffect(() => {
    if (!Array.isArray(categories) || categories.length === 0) return;

    const snapshot = JSON.stringify(
      categories.map(c => ({
        id: c.id, pagado: c.pagado, diaPago: c.diaPago, budget: c.budget,
      })),
    );
    if (snapshot === prevCatSnapshot.current) return;
    prevCatSnapshot.current = snapshot;

    // Limpiar notificaciones de categorías recién marcadas como pagadas
    categories
      .filter(c => c.pagado)
      .forEach(c => limpiarNotificacionesCategoria(c.id).catch(() => {}));

    const salary = profile?.monthlySalary ?? 0;
    const racha  = calcularRachaActual(transactions);
    reprogramarTodasLasNotificaciones(categories, transactions, salary, racha).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // ── App vuelve a foreground ──────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        const racha  = calcularRachaActual(transactions);
        const salary = profile?.monthlySalary ?? 0;
        reprogramarTodasLasNotificaciones(
          categories, transactions, salary, racha,
        ).catch(() => {});
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories, profile?.monthlySalary]);
}
