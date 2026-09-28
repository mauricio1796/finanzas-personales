/**
 * Limpieza completa del dispositivo tras «Eliminar cuenta» o «Reiniciar app».
 *
 * Deja la app como recién instalada: lo que viva fuera de AsyncStorage (alarmas
 * del sistema, SecureStore, widget, cola de sync en memoria) también se borra.
 * Lo único que sobrevive son los permisos del sistema operativo (notificaciones,
 * micrófono…), que solo el usuario puede cambiar desde Ajustes.
 *
 * NO toca el servidor ni cierra la sesión: eso lo decide quien llama.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncQueue } from './SyncQueueService';
import { borrarTodasLasNotificaciones } from './NotificacionesService';
import { consentService } from './ConsentService';
import { clearPin, clearRememberedUser } from './PinService';
import { actualizarWidget, calcularWidgetData } from './WidgetService';

export async function limpiarDispositivo(): Promise<void> {
  // 1. Nada pendiente puede volver a escribir en el servidor.
  await syncQueue.clear().catch(() => {});

  // 2. Alarmas y notificaciones del sistema operativo.
  await borrarTodasLasNotificaciones();

  // 3. Widget de inicio (vive en el App Group, fuera de AsyncStorage).
  await actualizarWidget(calcularWidgetData([], [], null, null, null)).catch(() => {});

  // 4. SecureStore: PIN, biometría y usuario recordado en la pantalla de bloqueo.
  await clearPin().catch(() => {});
  await clearRememberedUser().catch(() => {});

  // 5. Consentimientos en caché (y avisa a sus suscriptores en memoria).
  await consentService.clearLocal().catch(() => {});

  // 6. Todo lo demás: datos, onboarding, pantalla de permisos, historial in-app…
  try { await AsyncStorage.clear(); } catch { /* noop */ }
}
