import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Transaction } from '../types';
import { calcularMetricasFinancieras, MetricasFinancieras } from './ingresoUtils';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type CalificacionMes = 'excelente' | 'bueno' | 'regular' | 'critico';

export interface TopCategoria {
  nombre: string;
  monto: number;
  porcentaje: number;
  icono?: string;
  color?: string;
}

export interface ComparativaMes {
  mesActualLabel: string;
  mesAnteriorLabel: string;
  gastadoActual: number;
  gastadoAnterior: number;
  cambioPct: number;          // positivo = gastó más, negativo = gastó menos
  ahorroActual: number;
  ahorroAnterior: number;
}

export interface LogroDesbloqueado {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
  xp: number;
}

export interface ResumenMensual {
  mes: number;
  año: number;
  calificacion: CalificacionMes;
  metricas: MetricasFinancieras;
  comparativa: ComparativaMes;
  topCategorias: TopCategoria[];
  logroDesbloqueado: LogroDesbloqueado | null;
  proyeccion: {
    ahorroMesSiguiente: number;
    metaPropuesta: number;
    consejo: string;
  };
}

// ── Nombres de meses ───────────────────────────────────────────────────────────

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Calificación ──────────────────────────────────────────────────────────────

function calcularCalificacion(metricas: MetricasFinancieras): CalificacionMes {
  const { porcentajeGastado } = metricas;
  if (porcentajeGastado <= 70)  return 'excelente';
  if (porcentajeGastado <= 85)  return 'bueno';
  if (porcentajeGastado <= 100) return 'regular';
  return 'critico';
}

// ── Top 5 categorías ──────────────────────────────────────────────────────────

function calcularTopCategorias(
  transactions: Transaction[],
  categories: any[],
  mes: number,
  año: number,
  ingresoEfectivo: number,
): TopCategoria[] {
  const gastosPorCat: Record<string, number> = {};
  transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === mes && d.getFullYear() === año;
    })
    .forEach(t => {
      gastosPorCat[t.category] = (gastosPorCat[t.category] || 0) + t.amount;
    });

  const catMap: Record<string, { icono?: string; color?: string }> = {};
  categories.forEach((c: any) => { catMap[c.name] = { icono: c.icon, color: c.color }; });

  return Object.entries(gastosPorCat)
    .map(([nombre, monto]) => ({
      nombre,
      monto,
      porcentaje: ingresoEfectivo > 0 ? Math.round((monto / ingresoEfectivo) * 100) : 0,
      icono: catMap[nombre]?.icono,
      color: catMap[nombre]?.color,
    }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);
}

// ── Comparativa mes anterior ───────────────────────────────────────────────────

function calcularComparativa(
  transactions: Transaction[],
  categories: any[],
  monthlySalary: number,
  mes: number,
  año: number,
  metricasActual: MetricasFinancieras,
): ComparativaMes {
  const mesAnterior = mes === 0 ? 11 : mes - 1;
  const añoAnterior = mes === 0 ? año - 1 : año;

  const metricasAnterior = calcularMetricasFinancieras(
    transactions,
    categories,
    monthlySalary,
    mesAnterior,
    añoAnterior,
  );

  const cambioPct = metricasAnterior.totalGastado > 0
    ? Math.round(((metricasActual.totalGastado - metricasAnterior.totalGastado) / metricasAnterior.totalGastado) * 100)
    : 0;

  return {
    mesActualLabel:   MESES[mes],
    mesAnteriorLabel: MESES[mesAnterior],
    gastadoActual:    metricasActual.totalGastado,
    gastadoAnterior:  metricasAnterior.totalGastado,
    cambioPct,
    ahorroActual:     metricasActual.ahorroProyectado,
    ahorroAnterior:   metricasAnterior.ahorroProyectado,
  };
}

// ── Logro desbloqueado ────────────────────────────────────────────────────────

function calcularLogro(
  calificacion: CalificacionMes,
  comparativa: ComparativaMes,
): LogroDesbloqueado | null {
  if (calificacion === 'excelente') {
    return {
      id: 'mes_excelente',
      titulo: '¡Mes Excelente!',
      descripcion: 'Gastaste menos del 70% de tu ingreso este mes',
      icono: 'star',
      xp: 200,
    };
  }
  if (calificacion === 'bueno' && comparativa.cambioPct < 0) {
    return {
      id: 'mejora_continua',
      titulo: 'Mejora Continua',
      descripcion: `Redujiste tus gastos ${Math.abs(comparativa.cambioPct)}% respecto al mes anterior`,
      icono: 'trending-down',
      xp: 100,
    };
  }
  if (calificacion === 'bueno') {
    return {
      id: 'buen_mes',
      titulo: 'Buen Control',
      descripcion: 'Mantuviste tus gastos bajo control este mes',
      icono: 'check-circle',
      xp: 75,
    };
  }
  return null;
}

// ── Proyección mes siguiente ──────────────────────────────────────────────────

function calcularProyeccion(
  calificacion: CalificacionMes,
  metricas: MetricasFinancieras,
  comparativa: ComparativaMes,
): ResumenMensual['proyeccion'] {
  const ahorro = metricas.ahorroProyectado;
  const metaPropuesta = Math.round(ahorro * 0.3);

  const consejos: Record<CalificacionMes, string> = {
    excelente: `¡Fantástico! Ahorraste ${Math.round(metricas.porcentajeLibre)}% de tu ingreso. Considera invertir el excedente en un fondo o CDT.`,
    bueno:     `Buen trabajo. Intenta reducir ${Math.abs(comparativa.cambioPct) > 5 ? 'los gastos del mes pasado' : 'un 5% más'} el próximo mes para construir un colchón de ahorro.`,
    regular:   `Estuviste ajustado este mes. Identifica las categorías con más gasto y establece un límite estricto para el próximo mes.`,
    critico:   `Este mes los gastos superaron el ingreso. Prioriza eliminar gastos no esenciales y evita nuevas deudas el próximo mes.`,
  };

  return {
    ahorroMesSiguiente: Math.max(0, ahorro),
    metaPropuesta,
    consejo: consejos[calificacion],
  };
}

// ── Función principal ─────────────────────────────────────────────────────────

export function calcularResumenMensual(
  transactions: Transaction[],
  categories: any[],
  monthlySalary: number,
  mes: number,
  año: number,
): ResumenMensual {
  const metricas = calcularMetricasFinancieras(transactions, categories, monthlySalary, mes, año);
  const calificacion = calcularCalificacion(metricas);
  const topCategorias = calcularTopCategorias(transactions, categories, mes, año, metricas.ingresoEfectivo);
  const comparativa = calcularComparativa(transactions, categories, monthlySalary, mes, año, metricas);
  const logroDesbloqueado = calcularLogro(calificacion, comparativa);
  const proyeccion = calcularProyeccion(calificacion, metricas, comparativa);

  return {
    mes,
    año,
    calificacion,
    metricas,
    comparativa,
    topCategorias,
    logroDesbloqueado,
    proyeccion,
  };
}

// ── AsyncStorage helpers ───────────────────────────────────────────────────────

const storageKey = (año: number, mes: number) => `@financy_resumen_visto_${año}_${mes}`;

export async function deberiasMostrarResumen(): Promise<{ mostrar: boolean; mes: number; año: number }> {
  const hoy = new Date();
  const diaActual = hoy.getDate();
  const mesActual = hoy.getMonth();
  const añoActual = hoy.getFullYear();

  // Días restantes en el mes (últimos 3 días)
  const ultimoDia = new Date(añoActual, mesActual + 1, 0).getDate();
  const diasRestantes = ultimoDia - diaActual;

  let mesObjetivo = mesActual;
  let añoObjetivo = añoActual;

  // Primer día del mes → mostrar resumen del mes anterior
  if (diaActual === 1) {
    mesObjetivo = mesActual === 0 ? 11 : mesActual - 1;
    añoObjetivo = mesActual === 0 ? añoActual - 1 : añoActual;
  } else if (diasRestantes >= 3) {
    // No es momento de mostrar
    return { mostrar: false, mes: mesActual, año: añoActual };
  }

  const key = storageKey(añoObjetivo, mesObjetivo);
  const visto = await AsyncStorage.getItem(key);
  if (visto) return { mostrar: false, mes: mesObjetivo, año: añoObjetivo };

  return { mostrar: true, mes: mesObjetivo, año: añoObjetivo };
}

export async function marcarResumenVisto(año: number, mes: number): Promise<void> {
  await AsyncStorage.setItem(storageKey(año, mes), '1');
}

// ── Notificación de cierre de mes ─────────────────────────────────────────────

export async function programarNotificacionCierreMes(): Promise<void> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    // Cancelar notificación anterior del mismo tipo
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.type === 'cierre_mes') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    const hoy = new Date();
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const penultimoDia = ultimoDia - 1;

    // Si ya pasó el penúltimo día de este mes, programar para el siguiente
    let año = hoy.getFullYear();
    let mes = hoy.getMonth();
    if (hoy.getDate() >= penultimoDia) {
      mes = mes === 11 ? 0 : mes + 1;
      año = mes === 0 ? año + 1 : año;
    }

    const fechaDisparo = new Date(año, mes, new Date(año, mes + 1, 0).getDate() - 1, 20, 0, 0);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '¡Cierre de mes!',
        body: 'Revisa tu resumen mensual y descubre cómo te fue este mes.',
        data: { type: 'cierre_mes' },
      },
      trigger: { date: fechaDisparo } as any,
    });
  } catch (_) {
    // Notificaciones opcionales — nunca rompen el flujo
  }
}

// ── Helpers de presentación ───────────────────────────────────────────────────

export function calificacionLabel(c: CalificacionMes): string {
  const map: Record<CalificacionMes, string> = {
    excelente: 'Mes Excelente',
    bueno:     'Buen Mes',
    regular:   'Mes Regular',
    critico:   'Mes Crítico',
  };
  return map[c];
}

export function calificacionEmoji(c: CalificacionMes): string {
  const map: Record<CalificacionMes, string> = {
    excelente: '🌟',
    bueno:     '👍',
    regular:   '📊',
    critico:   '⚠️',
  };
  return map[c];
}

export function calificacionColor(c: CalificacionMes): string {
  const map: Record<CalificacionMes, string> = {
    excelente: '#10B981',
    bueno:     '#6366F1',
    regular:   '#F59E0B',
    critico:   '#EF4444',
  };
  return map[c];
}

export const MESES_LABELS = MESES;
