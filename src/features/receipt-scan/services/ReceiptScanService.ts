import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { CONFIG } from '../../../constants/config';
import type { ReceiptScanResult } from '../types';

// ─── Configuración de compresión ──────────────────────────────────────────────
// Máximo ~800px de ancho — suficiente para que Claude lea el texto del recibo.
// Calidad 0.7 reduce el tamaño ~70% sin perder legibilidad.
const MAX_WIDTH    = 800;
const JPEG_QUALITY = 0.7;

// ─── Permisos ─────────────────────────────────────────────────────────────────

export async function pedirPermisosCamara(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

export async function pedirPermisosGaleria(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

// ─── Captura de imagen ────────────────────────────────────────────────────────

export interface ImagenCapturada {
  uri:       string;
  base64:    string;
  mediaType: 'image/jpeg';
}

export async function tomarFotoConCamara(): Promise<ImagenCapturada | null> {
  const permiso = await pedirPermisosCamara();
  if (!permiso) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1, // Capturamos en máxima calidad y comprimimos nosotros
  });

  if (result.canceled || !result.assets[0]) return null;
  return comprimirImagen(result.assets[0].uri);
}

export async function elegirDesdGaleria(): Promise<ImagenCapturada | null> {
  const permiso = await pedirPermisosGaleria();
  if (!permiso) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return null;
  return comprimirImagen(result.assets[0].uri);
}

// ─── Compresión ───────────────────────────────────────────────────────────────

async function comprimirImagen(uri: string): Promise<ImagenCapturada> {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );

  if (!manipResult.base64) {
    // Fallback: leer el archivo directamente
    const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri: manipResult.uri, base64, mediaType: 'image/jpeg' };
  }

  return { uri: manipResult.uri, base64: manipResult.base64, mediaType: 'image/jpeg' };
}

// ─── Llamada al Worker ────────────────────────────────────────────────────────

export interface EscanearReciboOpts {
  imagen:     ImagenCapturada;
  categorias: string[]; // nombres de las categorías del usuario
}

export async function escanearRecibo(
  opts: EscanearReciboOpts,
): Promise<ReceiptScanResult> {
  if (!CONFIG.WORKER_URL) {
    throw new Error('El Worker no está configurado. Verifica EXPO_PUBLIC_WORKER_URL en tu .env.local');
  }

  const controller = new AbortController();
  // 45s — visión puede tardar más que chat
  const timeoutId = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(`${CONFIG.WORKER_URL}/scan-receipt`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'X-App-Version': CONFIG.APP_VERSION,
        'X-App-Token':   CONFIG.WORKER_TOKEN,
      },
      body: JSON.stringify({
        imagen_base64: opts.imagen.base64,
        media_type:    opts.imagen.mediaType,
        categorias:    opts.categorias,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as any;
      const msg = err?.error?.message ?? `Error del servidor (${response.status})`;
      throw new Error(msg);
    }

    const data = await response.json() as ReceiptScanResult;
    return data;

  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Verifica tu conexión e inténtalo de nuevo.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}
