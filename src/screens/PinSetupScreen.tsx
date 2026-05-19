import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  Vibration,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../state/ThemeContext';

const { width: W } = Dimensions.get('window');
const DIGIT_SIZE = (W - 48 - 48) / 4;

// ── PinDots ───────────────────────────────────────────────────────────────────
function PinDots({ count, shake, primary, border }: {
  count: number; shake: Animated.Value; primary: string; border: string;
}) {
  return (
    <Animated.View style={[st.dotsRow, { transform: [{ translateX: shake }] }]}>
      {[0, 1, 2, 3].map(i => (
        <View
          key={i}
          style={[
            st.pinDot,
            { borderColor: border },
            i < count && { backgroundColor: primary, borderColor: primary },
          ]}
        />
      ))}
    </Animated.View>
  );
}

// ── NumPad ────────────────────────────────────────────────────────────────────
const PAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];

function NumPad({ onPress, keyBg, keyBorder, keyText, subText }: {
  onPress: (key: string) => void;
  keyBg: string; keyBorder: string; keyText: string; subText: string;
}) {
  return (
    <View style={st.pad}>
      {PAD.map((row, r) => (
        <View key={r} style={st.padRow}>
          {row.map((key, c) => (
            key === '' ? (
              <View key={c} style={st.padEmpty} />
            ) : (
              <Pressable
                key={c}
                style={({ pressed }) => [
                  st.padKey,
                  { backgroundColor: keyBg, borderColor: keyBorder },
                  pressed && st.padKeyPressed,
                ]}
                onPress={() => onPress(key)}
              >
                <Text style={[
                  key === '⌫' ? st.padKeyBackspace : st.padKeyText,
                  { color: key === '⌫' ? subText : keyText },
                ]}>
                  {key}
                </Text>
              </Pressable>
            )
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface PinSetupScreenProps {
  userName?: string;
  onDone: (pin: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PinSetupScreen({ userName, onDone }: PinSetupScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  type Phase = 'enter' | 'confirm';
  const [phase,    setPhase]    = useState<Phase>('enter');
  const [first,    setFirst]    = useState('');
  const [current,  setCurrent]  = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const shake = useRef(new Animated.Value(0)).current;
  const fade  = useRef(new Animated.Value(1)).current;

  const doShake = () => {
    Vibration.vibrate(80);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    Animated.sequence([
      Animated.timing(shake, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6,   duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -6,  duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0,   duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const transitionPhase = (next: Phase) => {
    Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setPhase(next);
      setCurrent('');
      setErrorMsg('');
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  const handleKey = (key: string) => {
    if (key === '⌫') {
      setCurrent(p => p.slice(0, -1));
      setErrorMsg('');
      return;
    }
    if (current.length >= 4) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const next = current + key;
    setCurrent(next);

    if (next.length === 4) {
      if (phase === 'enter') {
        setFirst(next);
        transitionPhase('confirm');
      } else {
        if (next === first) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          onDone(next);
        } else {
          doShake();
          setErrorMsg('Los PINs no coinciden. Intenta de nuevo.');
          setTimeout(() => {
            setCurrent('');
            setErrorMsg('');
          }, 900);
        }
      }
    }
  };

  const firstName = userName?.trim().split(' ')[0] || 'allí';

  return (
    <View style={[st.root, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      {/* Blob decorativo */}
      <View style={[st.blobTL, { backgroundColor: colors.primaryLight }]} />
      <View style={[st.blobBR, { backgroundColor: colors.primaryLight }]} />

      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={[st.content, { opacity: fade }]}>

          {/* Ícono */}
          <View style={[st.logo, { backgroundColor: colors.primaryLight }]}>
            <Text style={[st.logoEmoji]}>🔑</Text>
          </View>

          {/* Card */}
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

            <Text style={[st.title, { color: colors.textPrimary }]}>
              {phase === 'enter' ? `Hola, ${firstName} 👋` : 'Confirma tu PIN'}
            </Text>
            <Text style={[st.subtitle, { color: colors.textSecondary }]}>
              {phase === 'enter'
                ? 'Crea un PIN de 4 dígitos para\nacceder rápido a tu cuenta'
                : 'Ingresa de nuevo los 4 dígitos\npara confirmar'}
            </Text>

            {/* Dots */}
            <PinDots
              count={current.length}
              shake={shake}
              primary={colors.primary}
              border={colors.border}
            />

            {/* Error */}
            {errorMsg ? (
              <View style={[st.errorBox, { backgroundColor: colors.expenseLight, borderColor: colors.expense }]}>
                <Text style={[st.errorText, { color: colors.expense }]}>⚠ {errorMsg}</Text>
              </View>
            ) : (
              <View style={{ height: 40 }} />
            )}

            {/* Teclado numérico */}
            <NumPad
              onPress={handleKey}
              keyBg={colors.inputBg}
              keyBorder={colors.border}
              keyText={colors.textPrimary}
              subText={colors.textTertiary}
            />

            {/* Paso atrás */}
            {phase === 'confirm' && (
              <Pressable onPress={() => transitionPhase('enter')} style={st.backBtn}>
                <Text style={[st.backText, { color: colors.primary }]}>← Cambiar PIN</Text>
              </Pressable>
            )}

          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1 },

  blobTL: {
    position: 'absolute', width: 260, height: 260, borderRadius: 130,
    opacity: 0.5, top: -80, left: -80,
  },
  blobBR: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    opacity: 0.4, bottom: 20, right: -60,
  },

  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24 },

  content: { width: '100%', alignItems: 'center' },

  logo: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  logoEmoji: { fontSize: 30 },

  card: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 0,
  },

  title: {
    fontSize: 22, fontWeight: '800',
    letterSpacing: -0.5, textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, textAlign: 'center',
    lineHeight: 21, marginBottom: 28,
  },

  dotsRow: { flexDirection: 'row', gap: 18, marginBottom: 12 },
  pinDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, backgroundColor: 'transparent',
  },

  errorBox: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    marginBottom: 8, width: '100%',
  },
  errorText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },

  pad: { width: W - 96, gap: 12, marginTop: 8 },
  padRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  padEmpty: { width: DIGIT_SIZE, height: DIGIT_SIZE },
  padKey: {
    width: DIGIT_SIZE, height: DIGIT_SIZE, borderRadius: DIGIT_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  padKeyPressed: { opacity: 0.6 },
  padKeyText:      { fontSize: 24, fontWeight: '600' },
  padKeyBackspace: { fontSize: 20 },

  backBtn: { marginTop: 20, paddingVertical: 8 },
  backText: { fontSize: 13, fontWeight: '500' },
});
