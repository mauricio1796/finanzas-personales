import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useFinance } from '../state/FinanceContext';
import { calcularWidgetData, actualizarWidget } from '../services/WidgetService';

/**
 * Sincroniza datos financieros al widget de pantalla de inicio.
 * Montar UNA sola vez en el root de la app (app/(tabs)/index.tsx).
 */
export function useWidgetSync() {
  const { transactions, categories, profile, userLevel, user } = useFinance();
  if (Platform.OS === 'web') return; // widgets no disponibles en web
  const lastSyncRef = useRef<string>('');

  const sync = () => {
    try {
      const data    = calcularWidgetData(transactions, categories as any, profile, userLevel, user);
      const dataStr = JSON.stringify(data);
      if (dataStr === lastSyncRef.current) return; // sin cambios
      lastSyncRef.current = dataStr;
      actualizarWidget(data).catch(() => {});
    } catch {
      // falla silenciosamente
    }
  };

  // Al cambiar transacciones o categorías
  useEffect(() => { sync(); }, [transactions.length, categories.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al volver a foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, [transactions, categories]); // eslint-disable-line react-hooks/exhaustive-deps
}
