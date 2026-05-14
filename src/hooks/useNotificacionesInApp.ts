import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import {
  NotificacionInApp,
  agregarNotificacionInApp,
  obtenerNotificacionesInApp,
  marcarTodasLeidas,
  eliminarNotificacion,
  limpiarTodasNotificaciones,
  contarNoLeidas,
} from '../services/NotificacionesInAppService';
import { NotifData, NotifTipo } from '../services/NotificacionesService';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotificacionesInApp() {
  const [items, setItems]       = useState<NotificacionInApp[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const listenerRef             = useRef<Notifications.Subscription | null>(null);

  const recargar = useCallback(async () => {
    const data = await obtenerNotificacionesInApp();
    setItems(data);
    setNoLeidas(contarNoLeidas(data));
  }, []);

  // Cargar al montar
  useEffect(() => {
    recargar();
  }, [recargar]);

  // Escuchar notificaciones recibidas mientras la app está en primer plano
  useEffect(() => {
    listenerRef.current = Notifications.addNotificationReceivedListener(async notification => {
      const content = notification.request.content;
      const data    = content.data as unknown as NotifData | undefined;

      if (!data?.tipo) return;

      await agregarNotificacionInApp({
        tipo:   data.tipo as NotifTipo,
        titulo: content.title ?? 'Notificación',
        cuerpo: content.body  ?? '',
        screen: data.screen   ?? 'dashboard',
      });

      await recargar();
    });

    // También registrar las que el usuario toca desde background/killed
    const tapSub = Notifications.addNotificationResponseReceivedListener(async response => {
      const content = response.notification.request.content;
      const data    = content.data as unknown as NotifData | undefined;

      if (!data?.tipo) return;

      // Solo agregar si no está ya en el historial reciente (dedup lo maneja el servicio)
      await agregarNotificacionInApp({
        tipo:   data.tipo as NotifTipo,
        titulo: content.title ?? 'Notificación',
        cuerpo: content.body  ?? '',
        screen: data.screen   ?? 'dashboard',
      });

      await recargar();
    });

    return () => {
      listenerRef.current?.remove();
      tapSub.remove();
    };
  }, [recargar]);

  const marcarLeidas = useCallback(async () => {
    await marcarTodasLeidas();
    await recargar();
  }, [recargar]);

  const eliminar = useCallback(async (id: string) => {
    await eliminarNotificacion(id);
    await recargar();
  }, [recargar]);

  const limpiarTodo = useCallback(async () => {
    await limpiarTodasNotificaciones();
    await recargar();
  }, [recargar]);

  return { items, noLeidas, recargar, marcarLeidas, eliminar, limpiarTodo };
}
