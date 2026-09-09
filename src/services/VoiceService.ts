import { AudioModule, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { CONFIG, WORKER_HEADERS } from '../constants/config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedTransaction {
  monto:        number;
  categoria:    string;
  subcategoria?: string;
  descripcion:  string;
  tipo:         'income' | 'expense';
}

export interface CategoriaVoz {
  nombre: string;
  esSub:  boolean;
  padre?: string;
}

// ── Recording state ───────────────────────────────────────────────────────────

let activeRecorder: InstanceType<typeof AudioModule.AudioRecorder> | null = null;

export async function pedirPermisosAudio(): Promise<boolean> {
  try {
    const { granted } = await requestRecordingPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

export async function iniciarGrabacion(): Promise<boolean> {
  try {
    const granted = await pedirPermisosAudio();
    if (!granted) return false;

    // Limpiar cualquier grabación colgada antes de iniciar
    if (activeRecorder) {
      try { await activeRecorder.stop(); } catch { /* ignore */ }
      activeRecorder = null;
    }

    // Desactivar primero para resetear la sesión iOS limpiamente
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false });
    } catch { /* ignore */ }

    // Pequeña pausa para que iOS libere la sesión anterior
    await new Promise<void>(res => setTimeout(res, 100));

    await setAudioModeAsync({
      allowsRecording:   true,
      playsInSilentMode: true,
    });

    const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
    await recorder.prepareToRecordAsync();
    recorder.record();
    activeRecorder = recorder;
    return true;
  } catch (e) {
    console.warn('[VoiceService] iniciarGrabacion:', e);
    // Intentar resetear el modo de audio si falló
    try { await setAudioModeAsync({ allowsRecording: false }); } catch { /* ignore */ }
    activeRecorder = null;
    return false;
  }
}

export async function detenerGrabacion(): Promise<string | null> {
  const rec = activeRecorder;
  activeRecorder = null;
  if (!rec) return null;
  try {
    await rec.stop();
    const uri = rec.uri ?? null;
    try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false }); } catch { /* ignore */ }
    return uri;
  } catch {
    try { await setAudioModeAsync({ allowsRecording: false }); } catch { /* ignore */ }
    return null;
  }
}

export async function transcribirAudio(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });

  // Limpiar el archivo temporal
  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${CONFIG.WORKER_URL}/transcribe`, {
      method:  'POST',
      headers: WORKER_HEADERS,
      body:    JSON.stringify({ audio: base64 }),
      signal:  controller.signal,
    });
    if (!response.ok) {
      const detalle = await response.text().catch(() => '');
      console.warn('[VoiceService] /transcribe fallo:', response.status, detalle);
      throw new Error(`HTTP ${response.status} ${detalle}`.trim());
    }
    const data = await response.json() as any;
    return typeof data.transcript === 'string' ? data.transcript : '';
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Parse via Worker ──────────────────────────────────────────────────────────

export async function parsearTextoATransaccion(
  texto:      string,
  categorias?: CategoriaVoz[],
): Promise<ParsedTransaction> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10_000);

  try {
    const body: Record<string, unknown> = { transcript: texto };
    if (categorias && categorias.length > 0) body.categorias = categorias;

    const response = await fetch(`${CONFIG.WORKER_URL}/voice`, {
      method:  'POST',
      headers: WORKER_HEADERS,
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as any;

    return {
      monto:        typeof data.monto        === 'number' ? Math.max(0, data.monto) : 0,
      categoria:    typeof data.categoria    === 'string' ? data.categoria    : 'Otros',
      subcategoria: typeof data.subcategoria === 'string' ? data.subcategoria : undefined,
      descripcion:  typeof data.descripcion  === 'string' ? data.descripcion  : texto,
      tipo:         data.tipo === 'income' ? 'income' : 'expense',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Web Speech Recognition (navegadores con soporte) ─────────────────────────

export function iniciarSpeechRecognitionWeb(
  onResult: (transcript: string) => void,
  onEnd:    () => void,
  onError:  () => void,
): (() => void) | null {
  if (Platform.OS !== 'web') return null;

  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.lang             = 'es-CO';
  rec.interimResults   = false;
  rec.maxAlternatives  = 1;

  rec.onresult = (e: any) => onResult(e.results[0]?.[0]?.transcript ?? '');
  rec.onend    = onEnd;
  rec.onerror  = onError;
  rec.start();

  return () => { try { rec.stop(); } catch { /* ignore */ } };
}
