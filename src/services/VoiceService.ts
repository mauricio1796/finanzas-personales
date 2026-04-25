import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { CONFIG } from '../constants/config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedTransaction {
  monto:       number;
  categoria:   string;
  descripcion: string;
  tipo:        'income' | 'expense';
}

// ── Recording state ───────────────────────────────────────────────────────────

let activeRecording: Audio.Recording | null = null;

export async function pedirPermisosAudio(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function iniciarGrabacion(): Promise<boolean> {
  try {
    const granted = await pedirPermisosAudio();
    if (!granted) return false;

    // Limpiar cualquier grabación colgada antes de iniciar
    if (activeRecording) {
      try { await activeRecording.stopAndUnloadAsync(); } catch { /* ignore */ }
      activeRecording = null;
    }

    // Desactivar primero para resetear la sesión iOS limpiamente
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: false });
    } catch { /* ignore */ }

    // Pequeña pausa para que iOS libere la sesión anterior
    await new Promise<void>(res => setTimeout(res, 100));

    await Audio.setAudioModeAsync({
      allowsRecordingIOS:   true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    activeRecording = recording;
    return true;
  } catch (e) {
    console.warn('[VoiceService] iniciarGrabacion:', e);
    // Intentar resetear el modo de audio si falló
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch { /* ignore */ }
    activeRecording = null;
    return false;
  }
}

export async function detenerGrabacion(): Promise<void> {
  const rec = activeRecording;
  activeRecording = null; // limpiar referencia primero para evitar doble-stop
  if (!rec) return;
  try { await rec.stopAndUnloadAsync(); } catch { /* ignore */ }
  try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: false }); } catch { /* ignore */ }
}

// ── Parse via Worker ──────────────────────────────────────────────────────────

export async function parsearTextoATransaccion(texto: string): Promise<ParsedTransaction> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${CONFIG.WORKER_URL}/voice`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ transcript: texto }),
      signal:  controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as any;

    return {
      monto:       typeof data.monto      === 'number' ? Math.max(0, data.monto) : 0,
      categoria:   typeof data.categoria  === 'string' ? data.categoria  : 'Otros',
      descripcion: typeof data.descripcion === 'string' ? data.descripcion : texto,
      tipo:        data.tipo === 'income' ? 'income' : 'expense',
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
