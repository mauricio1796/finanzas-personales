import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Captura automática desde las notificaciones del banco (solo Android).
 *
 * En iOS, en web y en Expo Go el módulo nativo no existe: `capturaDisponible`
 * es false y todas las funciones son no-op.
 */

export type FuenteCaptura = 'sms' | 'bancos' | 'correo' | 'wallet';

export interface EntradaCaptura {
  id: string;
  paquete: string;
  fuente: FuenteCaptura;
  texto: string;
  /** epoch ms */
  recibidoEn: number;
}

export interface ConfiguracionCaptura {
  habilitado: boolean;
  fuentes: FuenteCaptura[];
}

interface ModuloNativo {
  tienePermiso(): boolean;
  abrirAjustesPermiso(): void;
  obtenerConfiguracion(): ConfiguracionCaptura;
  configurar(habilitado: boolean, fuentes: string[]): void;
  obtenerPendientes(): string;
  confirmarProcesadas(ids: string[]): void;
  mostrarAviso(titulo: string, cuerpo: string): void;
  addListener(evento: 'onCaptura', cb: (e: { id: string }) => void): { remove(): void };
}

const Nativo = Platform.OS === 'android' ? requireOptionalNativeModule<ModuloNativo>('FinnCaptura') : null;

export const capturaDisponible = !!Nativo;

export function tienePermiso(): boolean {
  try { return Nativo?.tienePermiso() ?? false; } catch { return false; }
}

export function abrirAjustesPermiso(): void {
  Nativo?.abrirAjustesPermiso();
}

export function obtenerConfiguracion(): ConfiguracionCaptura {
  try {
    return Nativo?.obtenerConfiguracion() ?? { habilitado: false, fuentes: [] };
  } catch {
    return { habilitado: false, fuentes: [] };
  }
}

export function configurar(habilitado: boolean, fuentes: FuenteCaptura[]): void {
  Nativo?.configurar(habilitado, fuentes);
}

export function obtenerPendientes(): EntradaCaptura[] {
  if (!Nativo) return [];
  try {
    const lista = JSON.parse(Nativo.obtenerPendientes()) as EntradaCaptura[];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function confirmarProcesadas(ids: string[]): void {
  if (ids.length > 0) Nativo?.confirmarProcesadas(ids);
}

export function mostrarAviso(titulo: string, cuerpo: string): void {
  try { Nativo?.mostrarAviso(titulo, cuerpo); } catch { /* sin permiso de notificaciones */ }
}

/** Se llama cuando llega una notificación financiera con la app viva. */
export function suscribirCapturas(cb: (id: string) => void): { remove(): void } | null {
  return Nativo ? Nativo.addListener('onCaptura', e => cb(e.id)) : null;
}
