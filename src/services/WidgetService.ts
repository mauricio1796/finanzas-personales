import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { type Transaction, type Category } from '../types';
import { calcularMetricasFinancieras } from '../utils/ingresoUtils';
import { calcularRachaActual } from '../services/GamificacionService';
import { updateWidgetNative } from '../../modules/widget-bridge';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WidgetData {
  balanceDisponible:    number;
  ingresoMes:           number;
  gastadoHoy:           number;
  gastadoMes:           number;
  presupuestoTotal:     number;
  porcentajeGastado:    number;
  proximoPago:          { nombre: string; monto: number; diasRestantes: number } | null;
  rachaActual:          number;
  nivelUsuario:         number;
  tituloNivel:          string;
  nombreUsuario:        string;
  mesLabel:             string;
  ultimaActualizacion:  string;
}

const WIDGET_KEY = 'financy_widget_data';

// ── Calcular datos del widget ─────────────────────────────────────────────────

export function calcularWidgetData(
  transactions: Transaction[],
  categories:   Category[],
  profile:      any,
  userLevel:    any,
  user:         any,
): WidgetData {
  const now    = new Date();
  const mes    = now.getMonth();
  const año    = now.getFullYear();
  const hoyStr = now.toDateString();

  const salary   = profile?.monthlySalary ?? 0;
  const metricas = calcularMetricasFinancieras(
    transactions, categories as any, salary, mes, año,
  );

  const gastadoHoy = transactions
    .filter(t => t.type === 'expense' && new Date(t.date).toDateString() === hoyStr)
    .reduce((s, t) => s + t.amount, 0);

  const hoyDia     = now.getDate();
  const pendientes = categories
    .filter(c => (c as any).isSelected && (c as any).diaPago && !(c as any).pagado && (c as any).budget > 0)
    .map(c => ({
      nombre:        c.name,
      monto:         (c as any).budget as number,
      diasRestantes: ((c as any).diaPago as number) - hoyDia,
    }))
    .filter(p => p.diasRestantes >= 0)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);

  const rachaActual = calcularRachaActual(transactions);
  const mesLabel    = now.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });

  return {
    balanceDisponible:   metricas.balanceDisponible ?? (metricas.ingresoEfectivo - metricas.totalGastado),
    ingresoMes:          metricas.ingresoEfectivo,
    gastadoHoy,
    gastadoMes:          metricas.totalGastado,
    presupuestoTotal:    salary,
    porcentajeGastado:   Math.round(metricas.porcentajeGastado ?? 0),
    proximoPago:         pendientes[0] ?? null,
    rachaActual,
    nivelUsuario:        userLevel?.level ?? 1,
    tituloNivel:         userLevel?.title ?? 'Principiante',
    nombreUsuario:       user?.name ?? 'Usuario',
    mesLabel,
    ultimaActualizacion: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
  };
}

// ── Escribir datos al almacenamiento compartido ───────────────────────────────

export async function actualizarWidget(data: WidgetData): Promise<void> {
  try {
    const json = JSON.stringify(data);

    // Guardar en AsyncStorage como fallback legible en desarrollo
    await AsyncStorage.setItem(WIDGET_KEY, json);

    // Escribir al App Group compartido y recargar el timeline de WidgetKit (iOS)
    if (Platform.OS === 'ios') {
      await updateWidgetNative(json);
    }
  } catch (e) {
    // Falla silenciosamente — nunca crashear la app
    console.warn('[WidgetService] Error actualizando widget:', e);
  }
}

// ── Leer datos del widget (para UI de configuración) ─────────────────────────

export async function leerDatosWidget(): Promise<WidgetData | null> {
  try {
    const json = await AsyncStorage.getItem(WIDGET_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}
