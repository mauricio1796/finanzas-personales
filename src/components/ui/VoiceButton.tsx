import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Animated,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../state/ThemeContext';
import { THEME } from '../../constants/theme';
import { Icon } from './Icon';
import {
  iniciarGrabacion,
  detenerGrabacion,
  transcribirAudio,
  parsearTextoATransaccion,
  iniciarSpeechRecognitionWeb,
  type ParsedTransaction,
  type CategoriaVoz,
} from '../../services/VoiceService';

// ── Types ─────────────────────────────────────────────────────────────────────

type VoiceState = 'idle' | 'recording' | 'processing' | 'confirming';

export interface VoiceButtonProps {
  onParsed:   (tx: ParsedTransaction) => void;
  size?:      'normal' | 'small';
  categorias?: CategoriaVoz[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export const VoiceButton: React.FC<VoiceButtonProps> = ({ onParsed, size = 'normal', categorias }) => {
  const { colors } = useTheme();

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);

  const pulseOuter  = useRef(new Animated.Value(1)).current;
  const pulseInner  = useRef(new Animated.Value(1)).current;
  const stopWebRef  = useRef<(() => void) | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dim = size === 'small' ? 40 : 52;

  // ── Pulse animation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (voiceState !== 'recording') {
      pulseOuter.setValue(1);
      pulseInner.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseInner, { toValue: 1.35, duration: 650, useNativeDriver: true }),
          Animated.timing(pulseOuter, { toValue: 1.75, duration: 850, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseInner, { toValue: 1, duration: 650, useNativeDriver: true }),
          Animated.timing(pulseOuter, { toValue: 1, duration: 850, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [voiceState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clear auto-stop timer ────────────────────────────────────────────────
  const clearAutoStop = () => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  };

  // ── Detener, transcribir y pasar a confirmación ──────────────────────────
  const detenerYConfirmar = useCallback(async () => {
    clearAutoStop();
    if (stopWebRef.current) {
      stopWebRef.current();
      stopWebRef.current = null;
      return; // Web STT resuelve por callbacks
    }
    const uri = await detenerGrabacion();
    setVoiceState('processing');
    if (uri) {
      try {
        const texto = await transcribirAudio(uri);
        setTranscript(texto);
      } catch (e) {
        console.warn('[VoiceButton] transcribir:', e);
        setErrorMsg(
          __DEV__
            ? `No pude procesar el audio: ${e instanceof Error ? e.message : String(e)}`
            : 'No pude procesar el audio. Verifica tu conexión e intenta de nuevo.',
        );
      }
    } else {
      setErrorMsg('No se pudo capturar el audio. Intenta de nuevo.');
    }
    setVoiceState('confirming');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  // ── Comenzar grabación ───────────────────────────────────────────────────
  const comenzar = useCallback(async () => {
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    if (Platform.OS === 'web') {
      setVoiceState('recording');
      const stop = iniciarSpeechRecognitionWeb(
        (text) => {
          setTranscript(text);
          setVoiceState('confirming');
        },
        () => setVoiceState(prev => prev === 'recording' ? 'confirming' : prev),
        () => {
          setErrorMsg('No se pudo escuchar. Intenta de nuevo.');
          setVoiceState('idle');
        },
      );
      stopWebRef.current = stop;
    } else {
      const ok = await iniciarGrabacion();
      if (!ok) {
        setErrorMsg('Se necesita permiso de micrófono. Actívalo en Configuración.');
        return;
      }
      setTranscript('');
      setVoiceState('recording');
      // Auto-stop after 8s
      autoStopRef.current = setTimeout(detenerYConfirmar, 8_000);
    }
  }, [detenerYConfirmar]);

  // ── Cancelar ─────────────────────────────────────────────────────────────
  const cancelar = useCallback(async () => {
    clearAutoStop();
    if (stopWebRef.current) { stopWebRef.current(); stopWebRef.current = null; }
    const uri = await detenerGrabacion();
    // Limpiar archivo temporal si quedó alguno (solo nativo)
    if (uri && Platform.OS !== 'web') {
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
    setVoiceState('idle');
    setTranscript('');
    setErrorMsg(null);
  }, []);

  // ── Parsear texto → transacción ──────────────────────────────────────────
  const parsear = useCallback(async () => {
    const txt = transcript.trim();
    if (!txt) return;
    setVoiceState('processing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const tx = await parsearTextoATransaccion(txt, categorias);
      setVoiceState('idle');
      setTranscript('');
      onParsed(tx);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setErrorMsg('No pude procesar. Verifica tu conexión.');
      setVoiceState('confirming');
    }
  }, [transcript, onParsed, categorias]);

  // ── Button appearance ────────────────────────────────────────────────────
  const isRecording = voiceState === 'recording';
  const btnColor    = isRecording ? colors.expense : colors.primary;
  const btnBg       = isRecording ? '#FEE2E250' : colors.primaryLight;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Mic button */}
      <Pressable
        onPress={isRecording ? detenerYConfirmar : comenzar}
        disabled={voiceState === 'processing'}
        style={{ width: dim, height: dim, alignItems: 'center', justifyContent: 'center' }}
      >
        {isRecording && (
          <>
            <Animated.View style={[
              StyleSheet.absoluteFill,
              { borderRadius: dim / 2, backgroundColor: `${colors.expense}25`, transform: [{ scale: pulseOuter }] },
            ]} />
            <Animated.View style={[
              StyleSheet.absoluteFill,
              { borderRadius: dim / 2, backgroundColor: `${colors.expense}38`, transform: [{ scale: pulseInner }] },
            ]} />
          </>
        )}
        <View style={[st.btnCircle, { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: btnBg }]}>
          {voiceState === 'processing'
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Icon name="mic" size={size === 'small' ? 16 : 20} color={btnColor} />
          }
        </View>
      </Pressable>

      {/* Confirmation bottom sheet */}
      <Modal
        transparent
        animationType="slide"
        visible={voiceState === 'confirming' || voiceState === 'processing'}
        onRequestClose={cancelar}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={st.overlay} onPress={cancelar}>
          <Pressable style={[st.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[st.handle, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={st.headerRow}>
              <View style={[st.micBadge, { backgroundColor: colors.primaryLight }]}>
                <Icon name="mic" size={14} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.title, { color: colors.textPrimary }]}>
                  {Platform.OS === 'web' ? 'Finn escuchó…' : '¿Qué dijiste?'}
                </Text>
                <Text style={[st.hint, { color: colors.textTertiary }]}>
                  Edita y confirma lo que quieres registrar
                </Text>
              </View>
            </View>

            {/* Transcript input */}
            <TextInput
              style={[st.input, {
                backgroundColor: colors.cardSecondary,
                borderColor:     colors.border,
                color:           colors.textPrimary,
              }]}
              value={transcript}
              onChangeText={setTranscript}
              placeholder='Ej: "gasté treinta mil en el almuerzo"'
              placeholderTextColor={colors.textTertiary}
              multiline
              editable={voiceState === 'confirming'}
            />

            {errorMsg && (
              <Text style={[st.error, { color: colors.expense }]}>{errorMsg}</Text>
            )}

            {/* Buttons */}
            <View style={st.btnsRow}>
              <TouchableOpacity
                style={[st.btn, { borderColor: colors.border, borderWidth: 1 }]}
                onPress={cancelar}
              >
                <Text style={[st.btnTxt, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.btn, { backgroundColor: transcript.trim() ? colors.primary : colors.border }]}
                onPress={parsear}
                disabled={!transcript.trim() || voiceState === 'processing'}
              >
                {voiceState === 'processing'
                  ? <ActivityIndicator size="small" color={'#fff'} />
                  : <Text style={[st.btnTxt, { color: '#fff' }]}>Registrar →</Text>
                }
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  btnCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
    } : {}),
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
  },
  micBadge: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  title: { fontSize: 16, fontWeight: '700' },
  hint:  { fontSize: 12, marginTop: 2 },
  input: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  error: { fontSize: 12, marginBottom: 10 },
  btnsRow: {
    flexDirection: 'row', gap: 12,
  },
  btn: {
    flex: 1, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  btnTxt: { fontSize: 15, fontWeight: '700' },
});
