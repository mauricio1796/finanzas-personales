/**
 * PrivacyService — derechos del titular (Ley 1581 de 2012, art. 8):
 * acceso/portabilidad (exportación JSON), solicitudes de consulta y reclamo,
 * y supresión (eliminación de cuenta).
 */
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { consentService } from './ConsentService';
import { limpiarDispositivo } from './LocalWipeService';
import { conSalidaPermitida } from './AppLockService';
import { syncQueue } from './SyncQueueService';
import { CONFIG } from '../constants/config';

export type PrivacyRequestType =
  | 'consulta' | 'actualizacion' | 'rectificacion' | 'supresion' | 'revocatoria' | 'reclamo' | 'otro';

export interface PrivacyRequest {
  id: string;
  request_type: PrivacyRequestType;
  status: 'recibida' | 'en_tramite' | 'respondida' | 'cerrada';
  legal_deadline_days: number;
  created_at: string;
  responded_at: string | null;
}

export const REQUEST_TYPE_LABEL: Record<PrivacyRequestType, string> = {
  consulta:      'Consultar mis datos',
  actualizacion: 'Actualizar datos',
  rectificacion: 'Corregir datos',
  supresion:     'Suprimir datos',
  revocatoria:   'Revocar autorización',
  reclamo:       'Presentar un reclamo',
  otro:          'Otra solicitud',
};

export const REQUEST_STATUS_LABEL: Record<PrivacyRequest['status'], string> = {
  recibida:   'Recibida',
  en_tramite: 'En trámite',
  respondida: 'Respondida',
  cerrada:    'Cerrada',
};

/** Arma el JSON de exportación: datos del servidor + copia local del dispositivo. */
export async function exportarMisDatos(local: Record<string, unknown>): Promise<string> {
  let servidor: unknown = null;
  let errorServidor: string | null = null;
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('export_my_data');
      if (error) errorServidor = 'No se pudieron leer los datos del servidor.';
      else servidor = data;
    } catch {
      errorServidor = 'Sin conexión: se exportan solo los datos del dispositivo.';
    }
  }
  const paquete = {
    formato: 'FinancyAI — exportación de datos personales',
    version_formato: 1,
    generado_en: new Date().toISOString(),
    app_version: CONFIG.APP_VERSION,
    nota: 'Incluye los datos guardados en nuestros servidores y la copia local de este dispositivo.',
    servidor,
    ...(errorServidor ? { aviso: errorServidor } : {}),
    dispositivo: local,
    consentimientos_locales: await consentService.getLocal(),
  };
  return JSON.stringify(paquete, null, 2);
}

/** Guarda y comparte (nativo) o descarga (web) el archivo JSON. */
export async function compartirArchivoJSON(json: string, nombre = 'financyai-mis-datos.json'): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const path = `${FileSystem.cacheDirectory}${nombre}`;
  await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
  await conSalidaPermitida(() => Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Descargar mis datos' }));
  // El archivo queda en caché solo lo necesario para compartirlo.
  setTimeout(() => { FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {}); }, 60_000);
}

export async function enviarSolicitud(
  userId: string,
  tipo: PrivacyRequestType,
  detalle: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'El servicio no está disponible. Escríbenos por correo.' };
  try {
    const { error } = await supabase.from('privacy_requests').insert({
      user_id: userId,
      request_type: tipo,
      details: detalle.trim().slice(0, 2000) || null,
    });
    if (error) return { ok: false, error: 'No pudimos registrar la solicitud. Intenta de nuevo o escríbenos por correo.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sin conexión. Intenta de nuevo o escríbenos por correo.' };
  }
}

export async function listarSolicitudes(): Promise<PrivacyRequest[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('privacy_requests')
      .select('id, request_type, status, legal_deadline_days, created_at, responded_at')
      .order('created_at', { ascending: false })
      .limit(20);
    return (data ?? []) as PrivacyRequest[];
  } catch {
    return [];
  }
}

/**
 * Elimina la cuenta en el servidor (RPC `delete_my_account`, que borra el
 * usuario de Auth y en cascada todos sus datos) y limpia el dispositivo.
 * Si el servidor falla, NO se borra nada local: el usuario puede reintentar.
 */
export async function eliminarCuenta(): Promise<{ ok: boolean; error?: string; pagosConservados?: boolean }> {
  if (!supabase) return { ok: false, error: 'El servicio no está disponible. Escríbenos por correo para eliminar tu cuenta.' };
  try {
    // Nada en cola puede escribir mientras (o después de que) se borra la cuenta.
    await syncQueue.clear();
    const { data, error } = await supabase.rpc('delete_my_account');
    if (error) return { ok: false, error: 'No pudimos eliminar la cuenta. Revisa tu conexión e intenta de nuevo.' };
    const pagosConservados = !!(data as any)?.payment_records_retained;

    // Limpieza local: sesión y todo el dispositivo (datos, PIN, notificaciones
    // programadas, widget, consentimientos en caché).
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* la cuenta ya no existe */ }
    await limpiarDispositivo();
    return { ok: true, pagosConservados };
  } catch {
    return { ok: false, error: 'Sin conexión. Intenta de nuevo cuando tengas internet.' };
  }
}
