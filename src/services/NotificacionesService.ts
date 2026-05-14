import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Transaction, Category } from '../types';
import { calcularMetricasFinancieras, MetricasFinancieras } from '../utils/ingresoUtils';

// ── Configuración global ───────────────────────────────────────────────────────

export async function configurarNotificaciones(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  false,
      shouldShowBanner: true,
      shouldShowList:   true,
    }),
  });

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return status === 'granted';
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type NotifTipo =
  | 'pago_proximo'
  | 'pago_vencido'
  | 'presupuesto_limite'
  | 'resumen_semanal'
  | 'cierre_mes'
  | 'racha_riesgo'
  | 'meta_alcanzada'
  | 'ingreso_no_registrado'
  | 'gasto_inusual'
  | 'dia_sin_gastar';

export interface NotifData {
  tipo:         NotifTipo;
  screen:       string;
  categoriaId?: string;
  extra?:       Record<string, any>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
}

async function cancelarPorTipo(tipo: NotifTipo): Promise<void> {
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync()) ?? [];
  const targets = scheduled.filter((n: any) => n.content.data?.tipo === tipo);
  await Promise.all(
    targets.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

async function cancelarPorTipoYCategoria(tipo: NotifTipo, categoriaId: string): Promise<void> {
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync()) ?? [];
  const targets = scheduled.filter(
    (n: any) => n.content.data?.tipo === tipo && n.content.data?.categoriaId === categoriaId,
  );
  await Promise.all(
    targets.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// ── 1. Pagos próximos ─────────────────────────────────────────────────────────

export async function programarPagosProximos(categories: Category[]): Promise<void> {
  await cancelarPorTipo('pago_proximo');

  const now = new Date();
  const hoy = now.getDate();
  const mes = now.getMonth();
  const año = now.getFullYear();

  for (const cat of categories) {
    if (!cat.diaPago || cat.pagado || !cat.isSelected || cat.tipo !== 'gasto') continue;

    // 3 días antes a las 8am
    const dia3 = cat.diaPago - 3;
    if (dia3 >= hoy && dia3 >= 1) {
      const f = new Date(año, mes, dia3, 8, 0, 0);
      if (f > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Recordatorio: ${cat.name} vence en 3 dias`,
            body:  `Tienes ${fmt(cat.budget ?? 0)} pendiente. Vence el dia ${cat.diaPago}.`,
            sound: true,
            data: {
              tipo: 'pago_proximo', screen: 'categorias',
              categoriaId: cat.id, extra: { diasRestantes: 3 },
            } as NotifData,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: f } as any,
        });
      }
    }

    // Día exacto a las 9am
    if (cat.diaPago >= hoy) {
      const f = new Date(año, mes, cat.diaPago, 9, 0, 0);
      if (f > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Hoy vence: ${cat.name}`,
            body:  `${fmt(cat.budget ?? 0)} por pagar hoy. Toca para registrar el pago.`,
            sound: true,
            data: {
              tipo: 'pago_proximo', screen: 'categorias',
              categoriaId: cat.id, extra: { diasRestantes: 0 },
            } as NotifData,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: f } as any,
        });
      }
    }
  }
}

// ── 2. Pagos vencidos ─────────────────────────────────────────────────────────

export async function programarPagosVencidos(categories: Category[]): Promise<void> {
  await cancelarPorTipo('pago_vencido');

  const now = new Date();
  const hoy = now.getDate();
  const mes = now.getMonth();
  const año = now.getFullYear();

  for (const cat of categories) {
    if (!cat.diaPago || cat.pagado || !cat.isSelected || cat.tipo !== 'gasto') continue;
    if (cat.diaPago >= hoy) continue;

    const key = `@notif_vencido_${cat.id}_${mes}_${año}`;
    const ya  = await AsyncStorage.getItem(key);
    if (ya) continue;

    const f = new Date(now.getTime() + 60 * 1000);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Pago vencido: ${cat.name}`,
        body:  `Vencio el dia ${cat.diaPago}. Tienes ${fmt(cat.budget ?? 0)} pendiente.`,
        sound: true,
        data: { tipo: 'pago_vencido', screen: 'categorias', categoriaId: cat.id } as NotifData,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: f } as any,
    });
    await AsyncStorage.setItem(key, 'true');
  }
}

// ── 3. Presupuesto al límite ──────────────────────────────────────────────────

export async function verificarPresupuestosLimite(
  categories: Category[],
  transactions: Transaction[],
  mes: number,
  año: number,
): Promise<void> {
  const gastosPorCat: Record<string, number> = {};
  transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === mes && d.getFullYear() === año;
    })
    .forEach(t => {
      gastosPorCat[t.category] = (gastosPorCat[t.category] || 0) + t.amount;
    });

  for (const cat of categories) {
    if (!cat.isSelected || (cat.budget ?? 0) <= 0 || cat.tipo !== 'gasto') continue;

    const budget  = cat.budget ?? 0;
    const gastado = gastosPorCat[cat.name] ?? 0;
    const pct     = (gastado / budget) * 100;

    if (pct >= 80 && pct < 100) {
      const key = `@notif_80_${cat.id}_${mes}_${año}`;
      if (!(await AsyncStorage.getItem(key))) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${cat.name} al ${Math.round(pct)}%`,
            body:  `Gastaste ${fmt(gastado)} de ${fmt(budget)}. Solo quedan ${fmt(budget - gastado)}.`,
            sound: true,
            data: {
              tipo: 'presupuesto_limite', screen: 'estadisticas',
              categoriaId: cat.id, extra: { pct: Math.round(pct) },
            } as NotifData,
          },
          trigger: null,
        });
        await AsyncStorage.setItem(key, 'true');
      }
    }

    if (pct >= 100) {
      const key = `@notif_100_${cat.id}_${mes}_${año}`;
      if (!(await AsyncStorage.getItem(key))) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Presupuesto excedido: ${cat.name}`,
            body:  `Gastaste ${fmt(gastado)} de ${fmt(budget)} (${Math.round(pct)}%). Considera ajustar el presupuesto.`,
            sound: true,
            data: {
              tipo: 'presupuesto_limite', screen: 'categorias',
              categoriaId: cat.id, extra: { pct: Math.round(pct) },
            } as NotifData,
          },
          trigger: null,
        });
        await AsyncStorage.setItem(key, 'true');
      }
    }
  }
}

// ── 4. Resumen semanal ────────────────────────────────────────────────────────

export async function programarResumenSemanal(): Promise<void> {
  await cancelarPorTipo('resumen_semanal');

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Tu semana en numeros',
      body:  'Tu resumen semanal esta listo. Como te fue esta semana?',
      sound: true,
      data:  { tipo: 'resumen_semanal', screen: 'resumenSemanal' } as NotifData,
    },
    trigger: {
      type:    Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2,
      hour:    9,
      minute:  0,
    } as any,
  });
}

// ── 5. Cierre de mes ──────────────────────────────────────────────────────────

export async function programarCierreMes(): Promise<void> {
  await cancelarPorTipo('cierre_mes');

  const now       = new Date();
  const ultimoDia = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const penultimo = new Date(now.getFullYear(), now.getMonth(), ultimoDia - 1, 20, 0, 0);

  if (penultimo > now) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Cierre de mes manana',
        body:  'Revisa tu resumen mensual y cierra el mes con estilo.',
        sound: true,
        data:  { tipo: 'cierre_mes', screen: 'resumenMensual' } as NotifData,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: penultimo,
      } as any,
    });
  }
}

// ── 6. Racha en riesgo ────────────────────────────────────────────────────────

export async function verificarRachaEnRiesgo(
  transactions: Transaction[],
  rachaActual: number,
): Promise<void> {
  if (rachaActual < 3) return;
  await cancelarPorTipo('racha_riesgo');

  const hoyStr  = new Date().toDateString();
  const tieneHoy = transactions.some(t => new Date(t.date).toDateString() === hoyStr);
  if (tieneHoy) return;

  const now      = new Date();
  const notifHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0);
  if (notifHoy <= now) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Tu racha de ${rachaActual} dias esta en riesgo`,
      body:  'Registra al menos una transaccion hoy para mantener tu racha activa.',
      sound: true,
      data:  { tipo: 'racha_riesgo', screen: 'dashboard' } as NotifData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notifHoy,
    } as any,
  });
}

// ── 7. Meta de ahorro alcanzada ───────────────────────────────────────────────

export async function verificarMetaAlcanzada(
  _metricas: MetricasFinancieras,
  goalAmount: number,
  ahorroAcumulado: number,
): Promise<void> {
  if (goalAmount <= 0 || ahorroAcumulado < goalAmount) return;

  const key = `@notif_meta_${Math.round(goalAmount)}`;
  if (await AsyncStorage.getItem(key)) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Alcanzaste tu meta de ahorro!',
      body:  `Lograste ahorrar ${fmt(goalAmount)}. Es momento de celebrar y definir una nueva meta!`,
      sound: true,
      data:  { tipo: 'meta_alcanzada', screen: 'gamificacion' } as NotifData,
    },
    trigger: null,
  });
  await AsyncStorage.setItem(key, 'true');
}

// ── 8. Ingreso no registrado ──────────────────────────────────────────────────

export async function verificarIngresoNoRegistrado(
  transactions: Transaction[],
  monthlySalary: number,
): Promise<void> {
  if (monthlySalary <= 0) return;

  const now = new Date();
  if (now.getDate() < 5) return;

  const mes = now.getMonth();
  const año = now.getFullYear();

  const tieneIngreso = transactions.some(t => {
    const d = new Date(t.date);
    return t.type === 'income' && d.getMonth() === mes && d.getFullYear() === año;
  });
  if (tieneIngreso) return;

  const key = `@notif_ingreso_${mes}_${año}`;
  if (await AsyncStorage.getItem(key)) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Ya recibiste tu ingreso de este mes?',
      body:  `Registra tu salario de ${fmt(monthlySalary)} para que Finn pueda darte reportes precisos.`,
      sound: true,
      data:  { tipo: 'ingreso_no_registrado', screen: 'dashboard' } as NotifData,
    },
    trigger: null,
  });
  await AsyncStorage.setItem(key, 'true');
}

// ── 9. Gasto inusual detectado ────────────────────────────────────────────────

export async function verificarGastoInusual(
  transaccionNueva: Transaction,
  transactions: Transaction[],
): Promise<void> {
  if (transaccionNueva.type !== 'expense') return;

  const now   = new Date();
  const desde = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const historial = transactions.filter(t => {
    const d = new Date(t.date);
    return (
      t.type === 'expense' &&
      t.category === transaccionNueva.category &&
      d >= desde &&
      t.id !== transaccionNueva.id
    );
  });
  if (historial.length < 3) return;

  const promedio   = historial.reduce((s, t) => s + t.amount, 0) / historial.length;
  const esInusual  = transaccionNueva.amount > promedio * 2.5;
  if (!esInusual) return;

  const key = `@notif_inusual_${transaccionNueva.id}`;
  if (await AsyncStorage.getItem(key)) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Gasto inusual en ${transaccionNueva.category}`,
      body:  `${fmt(transaccionNueva.amount)} es ${Math.round(transaccionNueva.amount / promedio)}x tu promedio habitual de ${fmt(promedio)}.`,
      sound: true,
      data:  { tipo: 'gasto_inusual', screen: 'historial' } as NotifData,
    },
    trigger: null,
  });
  await AsyncStorage.setItem(key, 'true');
}

// ── 10. Dia sin gastar ────────────────────────────────────────────────────────

export async function programarDiaSinGastar(): Promise<void> {
  await cancelarPorTipo('dia_sin_gastar');

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Dia verde!',
      body:  'Llevas todo el dia sin gastos. Asi se construye el ahorro.',
      sound: false,
      data:  { tipo: 'dia_sin_gastar', screen: 'dashboard' } as NotifData,
    },
    trigger: {
      type:    Notifications.SchedulableTriggerInputTypes.DAILY,
      hour:    20,
      minute:  0,
    } as any,
  });
}

// ── Reprogramar todo ──────────────────────────────────────────────────────────

export async function reprogramarTodasLasNotificaciones(
  categories: Category[],
  transactions?: Transaction[],
  monthlySalary?: number,
  rachaActual?: number,
): Promise<void> {
  try {
    const granted = await configurarNotificaciones();
    if (!granted) return;

    const tareas: Promise<void>[] = [
      programarPagosProximos(categories),
      programarPagosVencidos(categories),
      programarResumenSemanal(),
      programarCierreMes(),
    ];

    if (transactions !== undefined && rachaActual !== undefined) {
      tareas.push(verificarRachaEnRiesgo(transactions, rachaActual));
    }
    if (transactions !== undefined && monthlySalary !== undefined) {
      tareas.push(verificarIngresoNoRegistrado(transactions, monthlySalary));
    }

    await Promise.all(tareas);
  } catch (e) {
    console.warn('[NotificacionesService]', e);
  }
}

// ── Limpiar notificaciones de una categoría ───────────────────────────────────

export async function limpiarNotificacionesCategoria(categoriaId: string): Promise<void> {
  await cancelarPorTipoYCategoria('pago_proximo', categoriaId);
  await cancelarPorTipoYCategoria('pago_vencido', categoriaId);
}

// ── Limpiar cache mensual (llamar al inicio de cada mes) ──────────────────────

export async function limpiarCacheMensualNotificaciones(): Promise<void> {
  try {
    const now = new Date();
    const mes = now.getMonth();
    const año = now.getFullYear();
    const keys = await AsyncStorage.getAllKeys();
    const stale = keys.filter(k => {
      if (!k.startsWith('@notif_')) return false;
      if (!k.includes('_80_') && !k.includes('_100_') &&
          !k.includes('_vencido_') && !k.includes('_ingreso_')) return false;
      return !k.endsWith(`_${mes}_${año}`);
    });
    if (stale.length > 0) await AsyncStorage.multiRemove(stale);
  } catch (e) {
    console.warn('[NotificacionesService] limpiarCache:', e);
  }
}

// ── Cancelar notificaciones de compromiso (legacy compat) ─────────────────────

export async function cancelarNotificacionesCompromiso(catId: string): Promise<void> {
  await limpiarNotificacionesCategoria(catId);
}
