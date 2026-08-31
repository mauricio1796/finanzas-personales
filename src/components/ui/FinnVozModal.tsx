/**
 * FinnVozModal — Conversational voice interface with Finn.
 *
 * States:
 *   idle        → tap mic to start
 *   grabando    → recording audio, waveform animated
 *   procesando  → transcribing + calling Finn + TTS
 *   respondiendo → playing Finn's audio response
 *   error       → shows error, auto-recovers after 3 s
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }           from '../../state/ThemeContext';
import { Icon }               from './Icon';
import {
  pedirPermisosAudio,
  iniciarGrabacion,
  ejecutarTurnoVoz,
  detenerGrabacion,
  detenerAudioActual,
} from '../../services/FinnVozService';
import type { MensajeChat }         from '../../services/RealAIService';
import type { Transaction, Category } from '../../types';
import type { ContextoPersonalizado } from '../../services/RealAIService';

const { width: W } = Dimensions.get('window');
const PRIMARY      = '#6156E8';
const PRIMARY_SOFT = 'rgba(97,86,232,0.15)';

// ── Types ─────────────────────────────────────────────────────────────────────

type VozEstado = 'idle' | 'grabando' | 'procesando' | 'respondiendo' | 'error';

interface Props {
  visible:      boolean;
  onClose:      () => void;
  /** Called when a voice turn completes — adds user+Finn messages to BotIA */
  onTurnComplete: (transcript: string, respuesta: string) => void;
  historial:    MensajeChat[];
  transactions: Transaction[];
  categories:   Category[];
  profile:      any;
  goal:         any;
  extra:        ContextoPersonalizado;
}

// ── Animated wave bar ─────────────────────────────────────────────────────────

interface WaveBarProps {
  delay:  number;
  active: boolean;
  color?: string;
}

function WaveBar({ delay, active, color = PRIMARY }: WaveBarProps) {
  const h = useSharedValue(6);

  useEffect(() => {
    if (active) {
      h.value = withRepeat(
        withSequence(
          withTiming(6 + Math.random() * 28, { duration: 280 + delay * 40, easing: Easing.inOut(Easing.sin) }),
          withTiming(6,                       { duration: 280 + delay * 40, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(6, { duration: 200 });
    }
  }, [active, delay]);

  const style = useAnimatedStyle(() => ({
    height:          h.value,
    backgroundColor: color,
  }));

  return <Animated.View style={[st.waveBar, style]} />;
}

// ── Main component ────────────────────────────────────────────────────────────

export function FinnVozModal({
  visible,
  onClose,
  onTurnComplete,
  historial,
  transactions,
  categories,
  profile,
  goal,
  extra,
}: Props) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();

  const [estado,     setEstado]     = useState<VozEstado>('idle');
  const [transcript, setTranscript] = useState('');
  const [respuesta,  setRespuesta]  = useState('');
  const [errorMsg,   setErrorMsg]   = useState('');

  const detenerAudioRef = useRef<() => Promise<void>>(async () => {});

  // ── Pulse animation for mic button ───────────────────────────────────────

  const pulse = useSharedValue(1);

  useEffect(() => {
    if (estado === 'grabando') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.18, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(1,    { duration: 700, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [estado]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  // ── Reset on close ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!visible) {
      detenerGrabacion().catch(() => {});
      detenerAudioRef.current().catch(() => {});
      detenerAudioActual().catch(() => {});
      setEstado('idle');
      setTranscript('');
      setRespuesta('');
      setErrorMsg('');
    }
  }, [visible]);

  // ── Error auto-recovery ───────────────────────────────────────────────────

  useEffect(() => {
    if (estado !== 'error') return;
    const t = setTimeout(() => {
      setEstado('idle');
      setErrorMsg('');
    }, 3_000);
    return () => clearTimeout(t);
  }, [estado]);

  // ── Core: mic button press ────────────────────────────────────────────────

  const handleMicPress = useCallback(async () => {
    if (estado === 'procesando' || estado === 'respondiendo') {
      // Interrupt Finn's response
      await detenerAudioRef.current().catch(() => {});
      await detenerAudioActual().catch(() => {});
      setEstado('idle');
      return;
    }

    if (estado === 'grabando') {
      // Stop → process turn
      setEstado('procesando');
      setTranscript('');
      setRespuesta('');

      try {
        const result = await ejecutarTurnoVoz({
          historial,
          transactions,
          categories,
          profile,
          goal,
          extra,
          onTranscript: (t) => setTranscript(t),
          onRespuesta:  (r) => {
            setRespuesta(r);
            setEstado('respondiendo');
          },
        });

        detenerAudioRef.current = result.detenerAudio;
        onTurnComplete(result.transcript, result.respuesta);

        // Auto-reset to idle once audio finishes (already handled in service via onFinish)
        // But we add a safety timeout too
        const wordCount = result.respuesta.split(' ').length;
        const estimatedMs = Math.max(3_000, wordCount * 350);
        setTimeout(() => {
          setEstado(prev => prev === 'respondiendo' ? 'idle' : prev);
        }, estimatedMs + 500);

      } catch (e: any) {
        setErrorMsg(e?.message ?? 'Ocurrió un error. Intenta de nuevo.');
        setEstado('error');
      }
      return;
    }

    // idle or error → start recording
    const granted = await pedirPermisosAudio();
    if (!granted) {
      setErrorMsg('Necesito permiso para el micrófono.');
      setEstado('error');
      return;
    }

    const ok = await iniciarGrabacion();
    if (!ok) {
      setErrorMsg('No se pudo iniciar la grabación.');
      setEstado('error');
      return;
    }

    setEstado('grabando');
    setTranscript('');
    setRespuesta('');
  }, [estado, historial, transactions, categories, profile, goal, extra, onTurnComplete]);

  // ── Labels ────────────────────────────────────────────────────────────────

  const label: Record<VozEstado, string> = {
    idle:        'Toca para hablar',
    grabando:    'Escuchándote…',
    procesando:  transcript ? 'Finn está pensando…' : 'Transcribiendo…',
    respondiendo: 'Finn está respondiendo',
    error:       errorMsg || 'Error',
  };

  const micColor =
    estado === 'grabando'    ? '#EF4444' :
    estado === 'procesando'  ? PRIMARY :
    estado === 'respondiendo'? '#1D9E75' :
    estado === 'error'       ? '#EF4444' :
    PRIMARY;

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={st.backdrop}>
        <View style={[
          st.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: Math.max(insets.bottom, 28),
          },
        ]}>
          {/* Header */}
          <View style={st.header}>
            <View style={st.finnBadge}>
              <Text style={st.finnBadgeText}>FI</Text>
            </View>
            <Text style={[st.titleText, { color: colors.textPrimary }]}>
              Habla con Finn
            </Text>
            <Pressable
              onPress={onClose}
              style={st.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name="x" size={20} color={colors.textSecondary ?? '#6B7280'} />
            </Pressable>
          </View>

          {/* Waveform */}
          <View style={st.waveRow}>
            {Array.from({ length: 9 }).map((_, i) => (
              <WaveBar
                key={i}
                delay={i}
                active={estado === 'grabando' || estado === 'respondiendo'}
                color={estado === 'grabando' ? '#EF4444' : PRIMARY}
              />
            ))}
          </View>

          {/* State label */}
          <Text style={[st.stateLabel, { color: colors.textSecondary }]}>
            {label[estado]}
          </Text>

          {/* Transcript bubble */}
          {!!transcript && (
            <View style={[st.bubble, st.bubbleUser]}>
              <Text style={st.bubbleUserText}>{transcript}</Text>
            </View>
          )}

          {/* Finn response bubble */}
          {!!respuesta && (
            <View style={[st.bubble, st.bubbleFinn, { borderLeftColor: PRIMARY }]}>
              <Text style={[st.bubbleFinnText, { color: colors.textPrimary }]}>
                {respuesta}
              </Text>
            </View>
          )}

          {/* Mic button */}
          <View style={st.micWrap}>
            <Animated.View style={[
              st.micRing,
              { backgroundColor: PRIMARY_SOFT },
              pulseStyle,
            ]} />
            <Pressable
              style={[st.micBtn, { backgroundColor: micColor }]}
              onPress={handleMicPress}
            >
              <Icon
                name={
                  estado === 'grabando'     ? 'square'      :
                  estado === 'procesando'   ? 'loader'      :
                  estado === 'respondiendo' ? 'volume-2'    :
                  'mic'
                }
                size={28}
                color="#FFFFFF"
              />
            </Pressable>
          </View>

          {/* Hint */}
          {(estado === 'procesando' || estado === 'respondiendo') && (
            <Text style={[st.hint, { color: colors.textTertiary }]}>
              {estado === 'respondiendo' ? 'Toca para interrumpir' : ''}
            </Text>
          )}
          {estado === 'grabando' && (
            <Text style={[st.hint, { color: '#EF4444' }]}>
              Toca para detener
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent:  'flex-end',
  },
  sheet: {
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingTop:           20,
    paddingHorizontal:    24,
    alignItems:           'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 20 },
      android: { elevation: 16 },
    }),
  },

  // Header
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    width:          '100%',
    marginBottom:   20,
  },
  finnBadge: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: PRIMARY,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     10,
  },
  finnBadgeText: {
    color:      '#FFF',
    fontWeight: '700',
    fontSize:   13,
  },
  titleText: {
    flex:       1,
    fontSize:   17,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },

  // Waveform
  waveRow: {
    flexDirection:  'row',
    alignItems:     'center',
    height:         48,
    gap:            5,
    marginBottom:   8,
  },
  waveBar: {
    width:        4,
    borderRadius: 2,
    minHeight:    6,
  },

  // State label
  stateLabel: {
    fontSize:     14,
    marginBottom: 16,
  },

  // Transcript / Response bubbles
  bubble: {
    width:        '100%',
    borderRadius: 14,
    padding:      12,
    marginBottom: 10,
  },
  bubbleUser: {
    backgroundColor: '#6156E8',
    alignSelf:       'flex-end',
  },
  bubbleUserText: {
    color:    '#FFF',
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleFinn: {
    backgroundColor: 'rgba(97,86,232,0.06)',
    borderLeftWidth: 3,
  },
  bubbleFinnText: {
    fontSize:   14,
    lineHeight: 20,
  },

  // Mic button
  micWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      16,
    marginBottom:   12,
    width:          88,
    height:         88,
  },
  micRing: {
    position:     'absolute',
    width:        88,
    height:       88,
    borderRadius: 44,
  },
  micBtn: {
    width:          68,
    height:         68,
    borderRadius:   34,
    alignItems:     'center',
    justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#6156E8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },

  // Hint text
  hint: {
    fontSize:    12,
    marginTop:   4,
  },
});
