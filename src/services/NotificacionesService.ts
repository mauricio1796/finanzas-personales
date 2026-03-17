import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

function diaDePago(diaPago: number, hoy: Date): Date {
  const year = hoy.getFullYear();
  const month = hoy.getMonth();
  if (diaPago === 0) {
    // Ultimo dia del mes
    return new Date(year, month + 1, 0);
  }
  const d = new Date(year, month, diaPago);
  if (d < hoy) {
    // Ya paso este mes, programar para el proximo
    if (diaPago === 0) return new Date(year, month + 2, 0);
    return new Date(year, month + 1, diaPago);
  }
  return d;
}

async function programarCompromiso(cat: any): Promise<void> {
  if (!cat.diaPago && cat.diaPago !== 0) return;
  const hoy = new Date();
  const fechaPago = diaDePago(cat.diaPago, hoy);
  const nombre = cat.name || "Compromiso";
  const monto = cat.budget ? "$" + Math.round(cat.budget).toLocaleString("es-CO").replace(/,/g, ".") : "";

  const notifs: Array<{ title: string; body: string; segundosAntes: number }> = [
    { title: "Recordatorio: " + nombre, body: (monto ? monto + " vence" : "Vence") + " en 3 dias. Revisa tu saldo.", segundosAntes: 3 * 24 * 3600 },
    { title: "Manana vence: " + nombre, body: (monto ? monto + " vence" : "Vence") + " manana. No lo olvides!", segundosAntes: 1 * 24 * 3600 },
    { title: "Hoy vence: " + nombre, body: (monto ? "Paga " + monto : "Haz tu pago") + " hoy para mantener tu record.", segundosAntes: 0 },
  ];

  for (var n of notifs) {
    var trigger = new Date(fechaPago.getTime() - n.segundosAntes * 1000);
    if (trigger <= hoy) continue; // ya paso
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body, data: { catId: cat.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
      identifier: "financy_" + cat.id + "_" + n.segundosAntes,
    });
  }
}

export async function cancelarNotificacionesCompromiso(catId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (var n of scheduled) {
    if (n.identifier && n.identifier.startsWith("financy_" + catId + "_")) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function programarResumenSemanal(): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;
  // Cancel any previous weekly summary notification
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (var n of scheduled) {
    if (n.content?.data?.type === 'weekly_summary') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📊 Tu semana en números',
      body: 'Ya está listo tu resumen financiero semanal. ¡Míralo!',
      data: { type: 'weekly_summary' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2, // Monday (1=Sun, 2=Mon, ... in Expo)
      hour: 9,
      minute: 0,
      repeats: true,
    } as any,
  });
}

export async function reprogramarTodasLasNotificaciones(categories: any[]): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;
  // Cancel all existing financy notifications
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (var n of scheduled) {
    if (n.identifier && n.identifier.startsWith("financy_")) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
  // Schedule new ones for each active (unpaid) category
  var activos = categories.filter(function(c) { return (c.tipo || (c.budget ?? 0) > 0) && !c.pagado; });
  for (var cat of activos) {
    try { await programarCompromiso(cat); } catch(e) { /* ignore */ }
  }
}
