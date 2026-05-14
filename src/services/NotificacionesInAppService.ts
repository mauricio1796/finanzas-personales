import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotifTipo } from './NotificacionesService';

// ─── Model ────────────────────────────────────────────────────────────────────

export interface NotificacionInApp {
  id:     string;
  tipo:   NotifTipo;
  titulo: string;
  cuerpo: string;
  fecha:  string; // ISO
  leida:  boolean;
  screen: string;
}

const STORAGE_KEY = '@financy_notificaciones_inapp';
const MAX_ITEMS   = 50;
const MAX_DIAS    = 30;

// ─── Read / Write helpers ─────────────────────────────────────────────────────

async function leer(): Promise<NotificacionInApp[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotificacionInApp[]) : [];
  } catch {
    return [];
  }
}

async function guardar(items: NotificacionInApp[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function agregarNotificacionInApp(
  notif: Omit<NotificacionInApp, 'id' | 'fecha' | 'leida'>,
): Promise<void> {
  const items = await leer();

  // Dedup: evita guardar la misma notificación dos veces en < 30 s
  const ahora = Date.now();
  const duplicada = items.some(
    n =>
      n.tipo === notif.tipo &&
      n.titulo === notif.titulo &&
      ahora - new Date(n.fecha).getTime() < 30_000,
  );
  if (duplicada) return;

  const nueva: NotificacionInApp = {
    id:     `${ahora}_${Math.random().toString(36).slice(2, 7)}`,
    fecha:  new Date().toISOString(),
    leida:  false,
    ...notif,
  };

  // Prepend y limitar a MAX_ITEMS
  const actualizadas = [nueva, ...items].slice(0, MAX_ITEMS);
  await guardar(actualizadas);
}

export async function obtenerNotificacionesInApp(): Promise<NotificacionInApp[]> {
  const items = await leer();

  // Descartar las de más de MAX_DIAS días
  const limite = Date.now() - MAX_DIAS * 86_400_000;
  return items.filter(n => new Date(n.fecha).getTime() > limite);
}

export async function marcarTodasLeidas(): Promise<void> {
  const items = await leer();
  await guardar(items.map(n => ({ ...n, leida: true })));
}

export async function eliminarNotificacion(id: string): Promise<void> {
  const items = await leer();
  await guardar(items.filter(n => n.id !== id));
}

export async function limpiarTodasNotificaciones(): Promise<void> {
  await guardar([]);
}

export function contarNoLeidas(items: NotificacionInApp[]): number {
  return items.filter(n => !n.leida).length;
}
