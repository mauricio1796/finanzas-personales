import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Transaction, Category } from '../types';
import { MetricasFinancieras } from '../utils/ingresoUtils';

/**
 * Notificaciones locales de Finn.
 *
 * Reglas:
 * - El permiso del sistema SOLO se pide desde un gesto explícito del usuario
 *   (pantalla de permisos o Configuración) con `solicitarPermisoNotificaciones`.
 *   Todo lo demás verifica el permiso y, si no está concedido, no hace nada.
 * - Toda notificación sale por `notificar()`: identidad de Finn (subtítulo,
 *   color, canal de Android) y respeto de las preferencias de Configuración.
 * - En Android cada tipo va a un canal propio ("Finn · Pagos", …) que el
 *   usuario puede ajustar desde los ajustes del sistema.
 */

// ── Identidad ─────────────────────────────────────────────────────────────────

/** Color de marca de Finn (tinte del ícono y del nombre de la app en Android). */
export const FINN_COLOR = '#36ACFF';

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
  | 'dia_sin_gastar'
  | 'finn_alerta'
  | 'finn_general';

export interface NotifData {
  tipo:         NotifTipo;
  screen:       string;
  categoriaId?: string;
  extra?:       Record<string, any>;
  [key: string]: unknown;
}

// ── Canales de Android ────────────────────────────────────────────────────────

type CanalId = 'finn-pagos' | 'finn-alertas' | 'finn-resumenes' | 'finn-habitos' | 'finn-general';

const CANALES: Record<CanalId, { name: string; description: string; importance: Notifications.AndroidImportance }> = {
  'finn-pagos': {
    name: 'Finn · Pagos y vencimientos',
    description: 'Finn te avisa antes de que venza un pago y el mismo día.',
    importance: Notifications.AndroidImportance.HIGH,
  },
  'finn-alertas': {
    name: 'Finn · Alertas de presupuesto',
    description: 'Cuando una categoría se acerca a su límite o hay un gasto inusual.',
    importance: Notifications.AndroidImportance.HIGH,
  },
  'finn-resumenes': {
    name: 'Finn · Resúmenes',
    description: 'Tu resumen semanal y el cierre de mes.',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  'finn-habitos': {
    name: 'Finn · Rachas y hábitos',
    description: 'Recordatorios para mantener tu racha y celebrar los días sin gastos.',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  'finn-general': {
    name: 'Finn · Avisos y logros',
    description: 'Logros, consejos y avisos generales de Finn.',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
};

// ── Preferencias (Configuración › Notificaciones) ─────────────────────────────

export type NotifPrefKey = 'pagos' | 'presupuesto' | 'racha' | 'semanal' | 'inusual' | 'finn';
export type NotifPrefs = Record<NotifPrefKey, boolean>;

export const NOTIF_PREFS_STORAGE_KEY = '@financy_notif_config';
export const NOTIF_PREFS_DEFAULT: NotifPrefs = {
  pagos: true, presupuesto: true, racha: true, semanal: true, inusual: true, finn: true,
};

const TIPO_META: Record<NotifTipo, { canal: CanalId; grupo: string; pref: NotifPrefKey; urgente?: boolean }> = {
  pago_proximo:          { canal: 'finn-pagos',     grupo: 'Finn · Pagos',        pref: 'pagos', urgente: true },
  pago_vencido:          { canal: 'finn-pagos',     grupo: 'Finn · Pagos',        pref: 'pagos', urgente: true },
  presupuesto_limite:    { canal: 'finn-alertas',   grupo: 'Finn · Presupuesto',  pref: 'presupuesto', urgente: true },
  gasto_inusual:         { canal: 'finn-alertas',   grupo: 'Finn · Alerta',       pref: 'inusual', urgente: true },
  resumen_semanal:       { canal: 'finn-resumenes', grupo: 'Finn · Resumen',      pref: 'semanal' },
  cierre_mes:            { canal: 'finn-resumenes', grupo: 'Finn · Cierre de mes', pref: 'semanal' },
  racha_riesgo:          { canal: 'finn-habitos',   grupo: 'Finn · Racha',        pref: 'racha' },
  dia_sin_gastar:        { canal: 'finn-habitos',   grupo: 'Finn · Hábitos',      pref: 'racha' },
  meta_alcanzada:        { canal: 'finn-general',   grupo: 'Finn · Logro',        pref: 'finn' },
  ingreso_no_registrado: { canal: 'finn-general',   grupo: 'Finn · Recordatorio', pref: 'finn' },
  finn_alerta:           { canal: 'finn-alertas',   grupo: 'Finn · Consejo',      pref: 'finn' },
  finn_general:          { canal: 'finn-general',   grupo: 'Finn',                pref: 'finn' },
};

let prefsCache: NotifPrefs | null = null;

export async function obtenerPreferenciasNotif(): Promise<NotifPrefs> {
  if (prefsCache) return prefsCache;
  try {
    const raw = await AsyncStorage.getItem(NOTIF_PREFS_STORAGE_KEY);
    prefsCache = { ...NOTIF_PREFS_DEFAULT, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    prefsCache = { ...NOTIF_PREFS_DEFAULT };
  }
  return prefsCache!;
}

/**
 * Borrado de datos (reiniciar / eliminar cuenta): cancela TODO lo programado,
 * quita las notificaciones del centro de notificaciones y olvida la caché de
 * preferencias. Sin esto, alguien que eliminó su cuenta seguiría recibiendo
 * "Arriendo vence en 3 días" porque las alarmas viven en el sistema operativo.
 */
export async function borrarTodasLasNotificaciones(): Promise<void> {
  prefsCache = null;
  if (Platform.OS === 'web') return;
  await Promise.all([
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => {}),
    Notifications.dismissAllNotificationsAsync().catch(() => {}),
    Notifications.setBadgeCountAsync(0).catch(() => {}),
  ]);
}

/** Guarda preferencias y cancela lo ya programado de los tipos desactivados. */
export async function guardarPreferenciasNotif(prefs: NotifPrefs): Promise<void> {
  prefsCache = { ...prefs };
  await AsyncStorage.setItem(NOTIF_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  const apagados = (Object.keys(TIPO_META) as NotifTipo[]).filter(t => !prefs[TIPO_META[t].pref]);
  await Promise.all(apagados.map(t => cancelarPorTipo(t).catch(() => {})));
}

// ── Inicialización y permisos ─────────────────────────────────────────────────

let inicializado = false;

/**
 * Configura cómo se muestran las notificaciones con la app abierta y crea los
 * canales de Android. No pide permisos. Idempotente.
 */
export async function inicializarNotificaciones(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!inicializado) {
    inicializado = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:  true,
        shouldPlaySound:  true,
        shouldSetBadge:   false,
        shouldShowBanner: true,
        shouldShowList:   true,
      }),
    });
  }
  await asegurarCanales();
}

/**
 * En Android 13+ el diálogo de permiso solo aparece si ya existe al menos un
 * canal, así que los canales se crean ANTES de pedir el permiso.
 */
async function asegurarCanales(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Promise.all((Object.keys(CANALES) as CanalId[]).map(id =>
    Notifications.setNotificationChannelAsync(id, {
      ...CANALES[id],
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: FINN_COLOR,
      showBadge: true,
      // Montos financieros: en pantalla de bloqueo segura solo se ve "FinancyAI".
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    }).catch(() => null),
  ));
  // El canal genérico que Expo crea por defecto ("Miscellaneous") ya no se usa.
  Notifications.deleteNotificationChannelAsync('default').catch(() => {});
}

export type EstadoPermisoNotif = 'concedido' | 'sin_preguntar' | 'denegado' | 'bloqueado' | 'no_disponible';

/** Estado del permiso sin mostrar ningún diálogo. `bloqueado` = solo se cambia en Ajustes. */
export async function estadoPermisoNotificaciones(): Promise<EstadoPermisoNotif> {
  if (Platform.OS === 'web') return 'no_disponible';
  const p = await Notifications.getPermissionsAsync();
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'concedido';
  if (p.status === 'undetermined') return 'sin_preguntar';
  return p.canAskAgain ? 'denegado' : 'bloqueado';
}

async function tienePermiso(): Promise<boolean> {
  return (await estadoPermisoNotificaciones()) === 'concedido';
}

type ListenerPermiso = () => void;
const listenersPermiso = new Set<ListenerPermiso>();

/** Avisa cuando el usuario concede el permiso (para programar todo de inmediato). */
export function onPermisoNotificacionesConcedido(cb: ListenerPermiso): () => void {
  listenersPermiso.add(cb);
  return () => { listenersPermiso.delete(cb); };
}

/**
 * Muestra el diálogo del sistema. Llamar SOLO desde un gesto del usuario.
 * Devuelve el estado final.
 */
export async function solicitarPermisoNotificaciones(): Promise<EstadoPermisoNotif> {
  if (Platform.OS === 'web') return 'no_disponible';
  await inicializarNotificaciones();
  const previo = await estadoPermisoNotificaciones();
  if (previo === 'concedido' || previo === 'bloqueado') return previo;

  await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  const estado = await estadoPermisoNotificaciones();
  if (estado === 'concedido') listenersPermiso.forEach(cb => { try { cb(); } catch { /* noop */ } });
  return estado;
}

/**
 * Compatibilidad: antes esta función pedía el permiso desde cualquier pantalla.
 * Ahora solo inicializa y verifica — nunca muestra el diálogo.
 */
export async function configurarNotificaciones(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await inicializarNotificaciones();
  return tienePermiso();
}

// ── Envío central ─────────────────────────────────────────────────────────────

type Disparo =
  | { tipo: 'ahora' }
  | { tipo: 'segundos'; segundos: number }
  | { tipo: 'fecha'; fecha: Date }
  | { tipo: 'diario'; hora: number; minuto: number }
  | { tipo: 'semanal'; diaSemana: number; hora: number; minuto: number };

interface NotificarOpts {
  titulo:       string;
  cuerpo:       string;
  screen:       string;
  disparo?:     Disparo;
  categoriaId?: string;
  extra?:       Record<string, any>;
  sonido?:      boolean;
  /** Ignora las preferencias (bienvenida y prueba). */
  forzar?:      boolean;
}

function construirTrigger(d: Disparo, canal: CanalId): Notifications.NotificationTriggerInput {
  const T = Notifications.SchedulableTriggerInputTypes;
  switch (d.tipo) {
    case 'ahora':    return Platform.OS === 'android' ? { channelId: canal } : null;
    case 'segundos': return { type: T.TIME_INTERVAL, seconds: Math.max(1, d.segundos), channelId: canal };
    case 'fecha':    return { type: T.DATE, date: d.fecha, channelId: canal };
    case 'diario':   return { type: T.DAILY, hour: d.hora, minute: d.minuto, channelId: canal };
    case 'semanal':  return { type: T.WEEKLY, weekday: d.diaSemana, hour: d.hora, minute: d.minuto, channelId: canal };
  }
}

/** Envía o programa una notificación de Finn. Devuelve el id, o null si no se envió. */
export async function notificar(tipo: NotifTipo, o: NotificarOpts): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const meta = TIPO_META[tipo];
  if (!(await tienePermiso())) return null;
  if (!o.forzar && !(await obtenerPreferenciasNotif())[meta.pref]) return null;
  await inicializarNotificaciones();

  const data: NotifData = { tipo, screen: o.screen, categoriaId: o.categoriaId, extra: o.extra };
  return Notifications.scheduleNotificationAsync({
    content: {
      title:    o.titulo,
      subtitle: meta.grupo,
      body:     o.cuerpo,
      sound:    o.sonido === false ? false : 'default',
      color:    FINN_COLOR,
      priority: meta.urgente
        ? Notifications.AndroidNotificationPriority.HIGH
        : Notifications.AndroidNotificationPriority.DEFAULT,
      data,
    },
    trigger: construirTrigger(o.disparo ?? { tipo: 'ahora' }, meta.canal),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
}

async function cancelarPorTipo(tipo: NotifTipo): Promise<void> {
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync()) ?? [];
  const targets = scheduled.filter((n: any) => n.content.data?.tipo === tipo);
  await Promise.all(targets.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

async function cancelarPorTipoYCategoria(tipo: NotifTipo, categoriaId: string): Promise<void> {
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync()) ?? [];
  const targets = scheduled.filter(
    (n: any) => n.content.data?.tipo === tipo && n.content.data?.categoriaId === categoriaId,
  );
  await Promise.all(targets.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

// ── Bienvenida y prueba ───────────────────────────────────────────────────────

/** Primera notificación tras conceder el permiso: el usuario ve cómo le hablará Finn. */
export async function enviarNotificacionBienvenida(): Promise<void> {
  await notificar('finn_general', {
    titulo: '¡Hola! Soy Finn 👋',
    cuerpo: 'Así te llegarán mis avisos: pagos por vencer, alertas de presupuesto y tu resumen de la semana. Los ajustas cuando quieras en Configuración.',
    screen: 'dashboard',
    disparo: { tipo: 'segundos', segundos: 2 },
    forzar: true,
  });
}

export async function enviarNotificacionPrueba(): Promise<boolean> {
  const id = await notificar('finn_general', {
    titulo: 'Notificación de prueba',
    cuerpo: 'Si estás viendo esto, todo funciona. Te avisaré cuando algo importante pase con tu plata.',
    screen: 'configuracion',
    disparo: { tipo: 'segundos', segundos: 2 },
    forzar: true,
  });
  return id !== null;
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
    const monto = fmt(cat.budget ?? 0);

    // 3 días antes a las 8am
    const dia3 = cat.diaPago - 3;
    if (dia3 >= hoy && dia3 >= 1) {
      const f = new Date(año, mes, dia3, 8, 0, 0);
      if (f > now) {
        await notificar('pago_proximo', {
          titulo: `${cat.name} vence en 3 días`,
          cuerpo: `El día ${cat.diaPago} vence ${cat.name} por ${monto}. Si ya lo pagaste, márcalo y dejo de recordártelo.`,
          screen: 'categorias', categoriaId: cat.id, extra: { diasRestantes: 3 },
          disparo: { tipo: 'fecha', fecha: f },
        });
      }
    }

    // Día exacto a las 9am
    if (cat.diaPago >= hoy) {
      const f = new Date(año, mes, cat.diaPago, 9, 0, 0);
      if (f > now) {
        await notificar('pago_proximo', {
          titulo: `Hoy vence ${cat.name}`,
          cuerpo: `Tienes ${monto} por pagar hoy. Toca para marcarlo como pagado.`,
          screen: 'categorias', categoriaId: cat.id, extra: { diasRestantes: 0 },
          disparo: { tipo: 'fecha', fecha: f },
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
    if (await AsyncStorage.getItem(key)) continue;

    const id = await notificar('pago_vencido', {
      titulo: `${cat.name} está vencido`,
      cuerpo: `Venció el día ${cat.diaPago} y sigue pendiente (${fmt(cat.budget ?? 0)}). ¿Ya lo pagaste? Márcalo para mantener tus cuentas al día.`,
      screen: 'categorias', categoriaId: cat.id,
      disparo: { tipo: 'segundos', segundos: 60 },
    });
    if (id) await AsyncStorage.setItem(key, 'true');
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
    .forEach(t => { gastosPorCat[t.category] = (gastosPorCat[t.category] || 0) + t.amount; });

  for (const cat of categories) {
    if (!cat.isSelected || (cat.budget ?? 0) <= 0 || cat.tipo !== 'gasto') continue;

    const budget  = cat.budget ?? 0;
    const gastado = gastosPorCat[cat.name] ?? 0;
    const pct     = Math.round((gastado / budget) * 100);

    if (pct >= 80 && pct < 100) {
      const key = `@notif_80_${cat.id}_${mes}_${año}`;
      if (!(await AsyncStorage.getItem(key))) {
        const id = await notificar('presupuesto_limite', {
          titulo: `${cat.name} va al ${pct}%`,
          cuerpo: `Llevas ${fmt(gastado)} de ${fmt(budget)}. Te quedan ${fmt(budget - gastado)} para el resto del mes.`,
          screen: 'estadisticas', categoriaId: cat.id, extra: { pct },
        });
        if (id) await AsyncStorage.setItem(key, 'true');
      }
    }

    if (pct >= 100) {
      const key = `@notif_100_${cat.id}_${mes}_${año}`;
      if (!(await AsyncStorage.getItem(key))) {
        const id = await notificar('presupuesto_limite', {
          titulo: `Te pasaste en ${cat.name}`,
          cuerpo: `Gastaste ${fmt(gastado)} de ${fmt(budget)} (${pct}%). Miremos juntos si ajustar el presupuesto o recortar en otra categoría.`,
          screen: 'estadisticas', categoriaId: cat.id, extra: { pct },
        });
        if (id) await AsyncStorage.setItem(key, 'true');
      }
    }
  }
}

// ── 4. Resumen semanal ────────────────────────────────────────────────────────

export async function programarResumenSemanal(): Promise<void> {
  await cancelarPorTipo('resumen_semanal');
  await notificar('resumen_semanal', {
    titulo: 'Tu semana en números 📈',
    cuerpo: 'Ya preparé tu resumen semanal: en qué se fue tu plata y cómo vas frente a tu meta.',
    screen: 'resumenSemanal',
    // weekday: 1 = domingo … 2 = lunes
    disparo: { tipo: 'semanal', diaSemana: 2, hora: 9, minuto: 0 },
  });
}

// ── 5. Cierre de mes ──────────────────────────────────────────────────────────

export async function programarCierreMes(): Promise<void> {
  await cancelarPorTipo('cierre_mes');

  const now       = new Date();
  const ultimoDia = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const penultimo = new Date(now.getFullYear(), now.getMonth(), ultimoDia - 1, 20, 0, 0);
  if (penultimo <= now) return;

  await notificar('cierre_mes', {
    titulo: 'Mañana cierra el mes',
    cuerpo: 'Revisa tu resumen mensual antes de que termine y arranca el próximo con todo claro.',
    screen: 'resumenMensual',
    disparo: { tipo: 'fecha', fecha: penultimo },
  });
}

// ── 6. Racha en riesgo ────────────────────────────────────────────────────────

export async function verificarRachaEnRiesgo(
  transactions: Transaction[],
  rachaActual: number,
): Promise<void> {
  await cancelarPorTipo('racha_riesgo');
  if (rachaActual < 3) return;

  const hoyStr = new Date().toDateString();
  if (transactions.some(t => new Date(t.date).toDateString() === hoyStr)) return;

  const now      = new Date();
  const notifHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0);
  if (notifHoy <= now) return;

  await notificar('racha_riesgo', {
    titulo: `Tu racha de ${rachaActual} días está en riesgo 🔥`,
    cuerpo: 'Aún no registras nada hoy. Con un solo movimiento la mantienes viva.',
    screen: 'dashboard',
    disparo: { tipo: 'fecha', fecha: notifHoy },
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

  const id = await notificar('meta_alcanzada', {
    titulo: '¡Alcanzaste tu meta de ahorro! 🎉',
    cuerpo: `Lograste ahorrar ${fmt(goalAmount)}. Celebra y pongámonos una nueva meta.`,
    screen: 'gamificacion',
  });
  if (id) await AsyncStorage.setItem(key, 'true');
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

  const id = await notificar('ingreso_no_registrado', {
    titulo: '¿Ya te llegó el ingreso del mes?',
    cuerpo: `Registra tu salario de ${fmt(monthlySalary)} para que tus reportes y proyecciones sean precisos.`,
    screen: 'dashboard',
  });
  if (id) await AsyncStorage.setItem(key, 'true');
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
    return t.type === 'expense' && t.category === transaccionNueva.category && d >= desde && t.id !== transaccionNueva.id;
  });
  if (historial.length < 3) return;

  const promedio = historial.reduce((s, t) => s + t.amount, 0) / historial.length;
  if (transaccionNueva.amount <= promedio * 2.5) return;

  const key = `@notif_inusual_${transaccionNueva.id}`;
  if (await AsyncStorage.getItem(key)) return;

  const veces = Math.round(transaccionNueva.amount / promedio);
  const id = await notificar('gasto_inusual', {
    titulo: `Gasto inusual en ${transaccionNueva.category}`,
    cuerpo: `${fmt(transaccionNueva.amount)} es ${veces} veces lo que sueles gastar ahí (${fmt(promedio)} en promedio). Si no lo reconoces, revísalo.`,
    screen: 'historial',
  });
  if (id) await AsyncStorage.setItem(key, 'true');
}

// ── 10. Día sin gastar ────────────────────────────────────────────────────────

/**
 * "Día verde" a las 8pm SOLO si hoy no hay gastos registrados. Antes era un
 * disparo diario fijo que felicitaba al usuario aunque hubiera gastado.
 * Se reprograma cada vez que cambian las transacciones o la app vuelve al frente.
 */
export async function programarDiaSinGastar(transactions: Transaction[] = []): Promise<void> {
  await cancelarPorTipo('dia_sin_gastar');

  const now = new Date();
  const hoyStr = now.toDateString();
  if (transactions.some(t => t.type === 'expense' && new Date(t.date).toDateString() === hoyStr)) return;

  const ochoPm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
  if (ochoPm <= now) return;

  await notificar('dia_sin_gastar', {
    titulo: '¡Día verde! 💚',
    cuerpo: 'Hoy no registraste gastos. Así, día a día, se construye el ahorro.',
    screen: 'dashboard',
    sonido: false,
    disparo: { tipo: 'fecha', fecha: ochoPm },
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
    if (transactions !== undefined) {
      tareas.push(programarDiaSinGastar(transactions));
    }
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
