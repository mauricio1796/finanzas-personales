import React, { useRef, useState, useEffect } from 'react';
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
const MAX_ATTEMPTS = 5;

// ── PinDots ───────────────────────────────────────────────────────────────────
function PinDots({ count, shake, hasError, primary, error, border }: {
  count: number; shake: Animated.Value; hasError: boolean;
  primary: string; error: string; border: string;
}) {
  return (
    <Animated.View style={[st.dotsRow, { transform: [{ translateX: shake }] }]}>
      {[0, 1, 2, 3].map(i => (
        <View
          key={i}
          style={[
            st.pinDot,
            { borderColor: border },
            i < count && !hasError && { backgroundColor: primary, borderColor: primary },
            i < count && hasError  && { backgroundColor: error,   borderColor: error   },
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
  onPress: (k: string) => void;
  keyBg: string; keyBorder: string; keyText: string; subText: string;
}) {
  return (
    <View style={st.pad}>
      {PAD.map((row, r) => (
        <View key={r} style={st.padRow}>
          {row.map((key, c) =>
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
                  key === '⌫' ? st.padBackspace : st.padText,
                  { color: key === '⌫' ? subText : keyText },
                ]}>
                  {key}
                </Text>
              </Pressable>
            )
          )}
        </View>
      ))}
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface PinEntryScreenProps {
  userName?:   string;
  userEmail?:  string;
  onSuccess:   () => void;
  onForgotPin: () => void;
  verifyPin:   (pin: string) => Promise<boolean>;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PinEntryScreen({ userName, userEmail, onSuccess, onForgotPin, verifyPin }: PinEntryScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [pin,      setPin]      = useState('');
  const [attempts, setAttempts] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [checking, setChecking] = useState(false);

  const shake    = useRef(new Animated.Value(0)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(logoAnim, {
      toValue: 1, tension: 60, friction: 10, useNativeDriver: true,
    }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doShake = () => {
    Vibration.vibrate(80);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    Animated.sequence([
      Animated.timing(shake, { toValue: 12,  duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8,   duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8,  duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0,   duration: 35, useNativeDriver: true }),
    ]).start();
  };

  const handleKey = async (key: string) => {
    if (checking) return;

    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      setHasError(false);
      setErrorMsg('');
      return;
    }
    if (pin.length >= 4) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const next = pin + key;
    setPin(next);

    if (next.length === 4) {
      setChecking(true);
      const ok = await verifyPin(next);
      setChecking(false);

      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onSuccess();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setHasError(true);
        doShake();

        const remaining = MAX_ATTEMPTS - newAttempts;
        if (remaining <= 0) {
          setErrorMsg('Demasiados intentos. Inicia sesión con tu correo.');
          setTimeout(onForgotPin, 1500);
        } else {
          setErrorMsg(`PIN incorrecto. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}`);
          setTimeout(() => {
            setPin('');
            setHasError(false);
            setErrorMsg('');
          }, 900);
        }
      }
    }
  };

  const firstName = userName?.trim().split(' ')[0];

  return (
    <View style={[st.root, { backgroundColor: colors.background, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 16 }]}>
      {/* Blobs */}
      <View style={[st.blobTL, { backgroundColor: colors.primaryLight }]} />
      <View style={[st.blobBR, { backgroundColor: colors.primaryLight }]} />

      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        <View style={st.content}>

          {/* Avatar animado */}
          <Animated.View style={{
            transform: [
              { scale: logoAnim },
              { translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
            ],
            opacity: logoAnim,
          }}>
            <View style={[st.avatar, { backgroundColor: colors.primaryLight }]}>
              <Text style={[st.avatarText, { color: colors.primary }]}>FI</Text>
            </View>
          </Animated.View>

          {/* Card */}
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

            <Text style={[st.brand, { color: colors.textPrimary }]}>FinancyAI</Text>
            {firstName && (
              <Text style={[st.greeting, { color: colors.textSecondary }]}>Bienvenido, {firstName}</Text>
            )}
            <Text style={[st.instruction, { color: colors.textTertiary }]}>Ingresa tu PIN de 4 dígitos</Text>

            {/* Email badge */}
            {userEmail && (
              <View style={[st.emailBadge, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
                <Text style={[st.emailText, { color: colors.primary }]}>✉ {userEmail}</Text>
              </View>
            )}

            {/* PIN dots */}
            <PinDots
              count={pin.length}
              shake={shake}
              hasError={hasError}
              primary={colors.primary}
              error={colors.expense}
              border={colors.border}
            />

            {/* Error */}
            {errorMsg ? (
              <View style={[st.errorBox, { backgroundColor: colors.expenseLight, borderColor: colors.expense }]}>
                <Text style={[st.errorText, { color: colors.expense }]}>⚠ {errorMsg}</Text>
              </View>
            ) : (
              <View style={{ height: 44 }} />
            )}

            {/* Teclado */}
            <NumPad
              onPress={handleKey}
              keyBg={colors.inputBg}
              keyBorder={colors.border}
              keyText={colors.textPrimary}
              subText={colors.textTertiary}
            />

            {/* Olvidé mi PIN */}
            <Pressable onPress={onForgotPin} style={st.forgotBtn}>
              <Text style={[st.forgotText, { color: colors.primary }]}>¿Olvidaste tu PIN? Ingresa con correo</Text>
            </Pressable>

          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1 },

  blobTL: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    opacity: 0.5, top: -90, left: -90,
  },
  blobBR: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    opacity: 0.4, bottom: 0, right: -60,
  },

  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24 },

  content: { width: '100%', alignItems: 'center' },

  avatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  avatarText: { fontSize: 28, fontWeight: '900', letterSpacing: 1 },

  card: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },

  brand:       { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  greeting:    { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  instruction: { fontSize: 14, marginBottom: 14 },

  emailBadge: {
    borderWidth: 1, borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 5, marginBottom: 24,
  },
  emailText: { fontSize: 12, fontWeight: '600' },

  dotsRow: { flexDirection: 'row', gap: 20, marginBottom: 8 },
  pinDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, backgroundColor: 'transparent',
  },

  errorBox: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    marginBottom: 4, maxWidth: W - 96,
  },
  errorText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },

  pad: { width: W - 96, gap: 14, marginTop: 4 },
  padRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  padEmpty: { width: DIGIT_SIZE, height: DIGIT_SIZE },
  padKey: {
    width: DIGIT_SIZE, height: DIGIT_SIZE, borderRadius: DIGIT_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  padKeyPressed: { opacity: 0.6 },
  padText:      { fontSize: 24, fontWeight: '600' },
  padBackspace: { fontSize: 20 },

  forgotBtn: { marginTop: 20, paddingVertical: 8, paddingHorizontal: 16 },
  forgotText: { fontSize: 13, fontWeight: '500', textDecorationLine: 'underline' },
});
