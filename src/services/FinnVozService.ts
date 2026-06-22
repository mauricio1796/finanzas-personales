/**
 * FinnVozService — Orchestrates voice conversation with Finn.
 *
 * Flow per turn:
 *   1. Record audio (expo-av, reuses VoiceService)
 *   2. Transcribe → Worker /transcribe  (Whisper)
 *   3. Send text   → enviarMensajeAFinn (Claude)
 *   4. Synthesize  → Worker /tts        (OpenAI TTS)
 *   5. Play back   → expo-av Audio.Sound
 *
 * Worker /tts contract (must be deployed on Cloudflare Worker):
 *   POST /tts
 *   Body: { text: string }
 *   Headers: { "X-App-Token": "<token>", "X-App-Version": "<version>" }
 *   Response: { audio: string }  ← base64 MP3
 *
 * API keys (OpenAI) live ONLY in the Worker — never in the client bundle.
 */

import { Audio }       from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { CONFIG }      from '../constants/config';
import {
  pedirPermisosAudio,
  iniciarGrabacion,
  detenerGrabacion,
  transcribirAudio,
} from './VoiceService';
import type { MensajeChat }       from './RealAIService';
import type { Transaction, Category } from '../types';
import type { ContextoPersonalizado } from './RealAIService';

// ── Active sound handle (only one at a time) ──────────────────────────────────

let _activeSoundUri: string | null    = null;
let _activeSound:    Audio.Sound | null = null;

// ── TTS ───────────────────────────────────────────────────────────────────────

/**
 * Send text to the Worker /tts endpoint, receive base64 MP3.
 * Returns null when offline, Worker not configured, or on error.
 */
export async function sintetizarTexto(texto: string): Promise<string | null> {
  if (!CONFIG.WORKER_URL) return null;
  if (!texto.trim())      return null;

  // Strip markdown that doesn't translate well to speech
  const limpio = texto
    .replace(/\*\*(.*?)\*\*/g, '$1')   // bold
    .replace(/\*(.*?)\*/g, '$1')       // italic
    .replace(/`(.*?)`/g, '$1')         // inline code
    .replace(/#{1,6}\s/g, '')          // headings
    .replace(/\n{2,}/g, '. ')          // double newlines → pause
    .replace(/\n/g, ' ')
    .trim();

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${CONFIG.WORKER_URL}/tts`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-App-Version': CONFIG.APP_VERSION,
        'X-App-Token':   CONFIG.WORKER_TOKEN,
      },
      body:   JSON.stringify({ text: limpio }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = await response.json() as any;
    return typeof data.audio === 'string' ? data.audio : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Write base64 audio to a temp file and play it with expo-av.
 * Returns a cleanup function that stops + unloads the sound.
 */
export async function reproducirAudioBase64(
  base64: string,
  onFinish?: () => void,
): Promise<() => Promise<void>> {
  const noop = async () => {};

  try {
    // Stop any currently playing sound first
    await detenerAudioActual();

    // Write to temp file (expo-av needs a URI on native)
    const uri = `${FileSystem.cacheDirectory}finn_voz_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    _activeSoundUri = uri;

    // Set audio mode for playback (no mic allowed simultaneously)
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:   false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume: 1.0 },
      (status) => {
        if (status.isLoaded && status.didJustFinish) {
          onFinish?.();
          sound.unloadAsync().catch(() => {});
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
          if (_activeSoundUri === uri) {
            _activeSoundUri = null;
            _activeSound    = null;
          }
        }
      },
    );

    _activeSound = sound;

    return async () => {
      try { await sound.stopAsync(); } catch { /* ignore */ }
      try { await sound.unloadAsync(); } catch { /* ignore */ }
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      if (_activeSoundUri === uri) {
        _activeSoundUri = null;
        _activeSound    = null;
      }
    };
  } catch {
    return noop;
  }
}

export async function detenerAudioActual(): Promise<void> {
  const sound = _activeSound;
  const uri   = _activeSoundUri;
  _activeSound    = null;
  _activeSoundUri = null;

  if (sound) {
    try { await sound.stopAsync(); }    catch { /* ignore */ }
    try { await sound.unloadAsync(); }  catch { /* ignore */ }
  }
  if (uri) {
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}

// ── Convenience re-exports for the modal ─────────────────────────────────────

export {
  pedirPermisosAudio,
  iniciarGrabacion,
  detenerGrabacion,
  transcribirAudio,
};

// ── Full voice-turn orchestrator ──────────────────────────────────────────────

export interface VozTurnoParams {
  historial:    MensajeChat[];
  transactions: Transaction[];
  categories:   Category[];
  profile:      any;
  goal:         any;
  extra:        ContextoPersonalizado;
  /** Called with the transcript once available */
  onTranscript?: (texto: string) => void;
  /** Called with Finn's text response before TTS starts */
  onRespuesta?:  (texto: string) => void;
}

export interface VozTurnoResult {
  transcript: string;
  respuesta:  string;
  /** Cleanup function — call when the user starts the next turn */
  detenerAudio: () => Promise<void>;
}

/**
 * Full voice turn:
 *   grabar → transcribir → Finn → TTS → reproducir
 *
 * The recording must already be started (iniciarGrabacion called externally
 * by the modal so it can animate while recording). This function:
 *   1. Stops the recording
 *   2. Transcribes
 *   3. Sends to Finn (vozMode = true → shorter responses)
 *   4. TTS + plays audio
 */
export async function ejecutarTurnoVoz(
  params: VozTurnoParams,
): Promise<VozTurnoResult> {
  // 1. Stop recording
  const uri = await detenerGrabacion();
  if (!uri) throw new Error('No se pudo obtener el audio grabado');

  // 2. Transcribe
  const transcript = await transcribirAudio(uri);
  if (!transcript.trim()) throw new Error('No se entendió lo que dijiste. Intenta de nuevo.');
  params.onTranscript?.(transcript);

  // 3. Send to Finn with voice mode flag
  const { enviarMensajeAFinn } = await import('./RealAIService');
  const resp = await enviarMensajeAFinn(
    transcript,
    params.historial,
    params.transactions,
    params.categories,
    params.profile,
    params.goal,
    { ...params.extra, vozMode: true },
  );

  const respuesta = resp.texto;
  params.onRespuesta?.(respuesta);

  // 4. TTS + play
  const audioBase64 = await sintetizarTexto(respuesta);
  let cleanupFn     = async () => {};

  if (audioBase64) {
    cleanupFn = await reproducirAudioBase64(audioBase64);
  }

  return { transcript, respuesta, detenerAudio: cleanupFn };
}
