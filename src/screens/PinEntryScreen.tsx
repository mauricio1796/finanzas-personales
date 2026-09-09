import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  Vibration,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import {
  getBiometricAvailability,
  isBiometricEnabled,
  authenticateBiometric,
  type BiometricKind,
} from '../services/PinService';

const { width: W } = Dimensions.get('window');
const KEY_SIZE = Math.min((W - 48 - 40) / 3, 78);
const MAX_ATTEMPTS = 5;

// ── PinDots ───────────────────────────────────────────────────────────────────
function PinDots({ pin, reveal, shake, hasError, primary, error, border, textPrimary }: {
  pin: string; reveal: boolean; shake: Animated.Value; hasError: boolean;
  primary: string; error: string; border: string; textPrimary: string;
}) {
  return (
    <Animated.View style={[st.dotsRow, { transform: [{ translateX: shake }] }]}>
      {[0, 1, 2, 3].map(i => {
        const filled = i < pin.length;
        if (reveal && filled) {
          return (
            <Text key={i} style={[st.revealDigit, { color: hasError ? error : textPrimary }]}>
              {pin[i]}
            </Text>
          );
        }
        return (
          <View
            key={i}
            style={[
              st.pinDot,
              { borderColor: border },
              filled && !hasError && { backgroundColor: primary, borderColor: primary },
              filled && hasError  && { backgroundColor: error,   borderColor: error   },
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

// ── NumPad ────────────────────────────────────────────────────────────────────
const PAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['bio', '0', 'del'],
];

function NumPad({ onPress, showBio, bioIcon, keyBg, keyText, subText }: {
  onPress: (k: string) => void;
  showBio: boolean; bioIcon: React.ComponentProps<typeof Icon>['name'];
  keyBg: string; keyText: string; subText: string;
}) {
  return (
    <View style={st.pad}>
      {PAD.map((row, r) => (
        <View key={r} style={st.padRow}>
          {row.map((key, c) => {
            if (key === 'bio') {
              return showBio ? (
                <Pressable key={c} style={st.padGhost} onPress={() => onPress('bio')} hitSlop={8}>
                  <Icon name={bioIcon} size={26} color={keyText} />
                </Pressable>
              ) : <View key={c} style={st.padGhost} />;
            }
            if (key === 'del') {
              return (
                <Pressable key={c} style={st.padGhost} onPress={() => onPress('del')} hitSlop={8}>
                  <Icon name="delete" size={24} color={subText} />
                </Pressable>
              );
            }
            return (
              <Pressable
                key={c}
                style={({ pressed }) => [st.padKey, { backgroundColor: keyBg }, pressed && st.padKeyPressed]}
                onPress={() => onPress(key)}
              >
                <Text style={[st.padText, { color: keyText }]}>{key}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface PinEntryScreenProps {
  userName?:    string;
  userEmail?:   string;
  userLevel?:   number;
  userTitle?:   string;
  streakDays?:  number;
  finnNews?:    string;
  onSuccess:    () => void;
  onForgotPin:  () => void;
  onSwitchUser: () => void;
  verifyPin:    (pin: string) => Promise<boolean>;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PinEntryScreen({
  userName, userEmail, userLevel, userTitle, streakDays, finnNews,
  onSuccess, onForgotPin, onSwitchUser, verifyPin,
}: PinEntryScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [pin,      setPin]      = useState('');
  const [attempts, setAttempts] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [reveal,   setReveal]   = useState(false);

  const [bioKind,    setBioKind]    = useState<BiometricKind>('none');
  const [bioEnabled, setBioEnabled] = useState(false);
  const bioTried = useRef(false);

  const shake = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;

  const firstName = userName?.trim().split(' ')[0];
  const initials  = (userName ?? 'U').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('');

  const bioLabel = bioKind === 'face' ? 'Face ID'
    : bioKind === 'iris' ? 'reconocimiento de iris'
    : 'huella';
  const bioIcon: React.ComponentProps<typeof Icon>['name'] =
    bioKind === 'face' ? 'smile' : 'unlock';

  const tryBiometric = useCallback(async () => {
    const ok = await authenticateBiometric(`Desbloquea FinancyAI, ${firstName ?? ''}`.trim());
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSuccess();
    }
  }, [firstName, onSuccess]);

  // Entrada + disponibilidad biométrica + auto-prompt
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, tension: 55, friction: 10, useNativeDriver: true }).start();

    (async () => {
      const [{ available, kind }, enabled] = await Promise.all([
        getBiometricAvailability(),
        isBiometricEnabled(),
      ]);
      setBioKind(available ? kind : 'none');
      setBioEnabled(available && enabled);
      if (available && enabled && !bioTried.current) {
        bioTried.current = true;
        setTimeout(tryBiometric, 350);
      }
    })();
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

    if (key === 'bio') { tryBiometric(); return; }
    if (key === 'del') {
      setPin(p => p.slice(0, -1));
      setHasError(false); setErrorMsg('');
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
        const n = attempts + 1;
        setAttempts(n);
        setHasError(true);
        doShake();
        const remaining = MAX_ATTEMPTS - n;
        if (remaining <= 0) {
          setErrorMsg('Demasiados intentos. Ingresa con tu correo.');
          setTimeout(onForgotPin, 1500);
        } else {
          setErrorMsg(`PIN incorrecto · ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}`);
          setTimeout(() => { setPin(''); setHasError(false); setErrorMsg(''); }, 900);
        }
      }
    }
  };

  const fadeUp = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  return (
    <View style={[st.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[st.scroll, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 22 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero oscuro ── */}
        <Animated.View style={fadeUp}>
          <LinearGradient
            colors={[colors.heroGradientFrom, colors.heroGradientTo]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={st.hero}
          >
            <View style={st.heroTop}>
              <View style={st.logoTile}>
                <Text style={st.logoText}>Fi</Text>
              </View>
              <View style={st.brandPill}>
                <Icon name="zap" size={11} color="#fff" />
                <Text style={st.brandPillText}>Copiloto Financiero</Text>
              </View>
            </View>

            <Text style={st.heroTitle}>
              ¡Hola de nuevo{firstName ? `, ${firstName}` : ''}! 🚀
            </Text>
            <Text style={st.heroSub}>Tu plata bajo control, tus metas en modo cohete.</Text>

            {!!streakDays && streakDays > 0 && (
              <View style={st.streakChip}>
                <Text style={st.streakText}>🔥 Racha activa: {streakDays} día{streakDays !== 1 ? 's' : ''} de ahorro</Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* ── Usuario recordado ── */}
        <Animated.View style={[fadeUp, st.userCard, { backgroundColor: colors.card }]}>
          <View style={[st.userAvatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[st.userInitials, { color: colors.primary }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={st.userNameRow}>
              <Text style={[st.userName, { color: colors.textPrimary }]} numberOfLines={1}>
                {userName ?? 'Tu cuenta'}
              </Text>
              <Icon name="check-circle" size={15} color={colors.income} />
            </View>
            <Text style={[st.userLevel, { color: colors.textSecondary }]} numberOfLines={1}>
              {userLevel ? `Nivel ${userLevel}` : 'Nivel 1'}{userTitle ? `: ${userTitle}` : ''}
            </Text>
          </View>
          <Pressable onPress={onSwitchUser} style={[st.switchBtn, { borderColor: colors.border }]} hitSlop={8}>
            <Text style={[st.switchText, { color: colors.textSecondary }]}>Cambiar</Text>
          </Pressable>
        </Animated.View>

        {/* ── Botón biométrico ── */}
        {bioKind !== 'none' && bioEnabled && (
          <Animated.View style={fadeUp}>
            <Pressable
              onPress={tryBiometric}
              style={({ pressed }) => [
                st.bioBtn,
                { borderColor: colors.primary, backgroundColor: pressed ? colors.primaryLight : 'transparent' },
              ]}
            >
              <Icon name={bioIcon} size={20} color={colors.primary} />
              <Text style={[st.bioText, { color: colors.primary }]}>
                Ingresar con {bioLabel === 'Face ID' ? 'Face ID' : `tu ${bioLabel}`}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Noticia de Finn ── */}
        {!!finnNews && (
          <Animated.View style={[fadeUp, st.finnCard, { backgroundColor: colors.primaryLight }]}>
            <View style={[st.finnAvatar, { backgroundColor: colors.primary }]}>
              <Icon name="zap" size={13} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.finnLabel, { color: colors.primary }]}>FINN IA · NOTICIA FRESCA</Text>
              <Text style={[st.finnText, { color: colors.primaryText }]}>{finnNews}</Text>
            </View>
          </Animated.View>
        )}

        {/* ── Tarjeta de PIN ── */}
        <Animated.View style={[fadeUp, st.pinCard, { backgroundColor: colors.card }]}>
          <View style={st.pinHeaderRow}>
            <Text style={[st.pinTitle, { color: colors.textPrimary }]}>PIN de seguridad</Text>
            <Pressable onPress={() => setReveal(r => !r)} hitSlop={8} style={st.revealBtn}>
              <Icon name={reveal ? 'eye-off' : 'eye'} size={15} color={colors.primary} />
              <Text style={[st.revealText, { color: colors.primary }]}>{reveal ? 'Ocultar' : 'Ver PIN'}</Text>
            </Pressable>
          </View>

          <PinDots
            pin={pin}
            reveal={reveal}
            shake={shake}
            hasError={hasError}
            primary={colors.primary}
            error={colors.expense}
            border={colors.border}
            textPrimary={colors.textPrimary}
          />

          {errorMsg ? (
            <View style={[st.errorBox, { backgroundColor: colors.expenseLight }]}>
              <Icon name="alert-triangle" size={13} color={colors.expense} />
              <Text style={[st.errorText, { color: colors.expense }]}>{errorMsg}</Text>
            </View>
          ) : (
            <View style={{ height: 38 }} />
          )}

          <NumPad
            onPress={handleKey}
            showBio={bioKind !== 'none' && bioEnabled}
            bioIcon={bioIcon}
            keyBg={colors.inputBg}
            keyText={colors.textPrimary}
            subText={colors.textTertiary}
          />

          <Pressable onPress={onForgotPin} style={st.forgotBtn} hitSlop={8}>
            <Text style={[st.forgotText, { color: colors.primary }]}>¿Olvidaste tu PIN?</Text>
            <Text style={[st.forgotHint, { color: colors.textTertiary }]}> (tranqui, en 1 min)</Text>
          </Pressable>
        </Animated.View>

        {/* ── Footer ── */}
        <View style={st.footer}>
          <Icon name="shield" size={12} color={colors.textTertiary} />
          <Text style={[st.footerText, { color: colors.textTertiary }]}>
            Cifrado de 256 bits · Tu información está protegida
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 14 },

  // Hero
  hero: { borderRadius: 26, padding: 22, gap: 6 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  logoTile: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  brandPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5,
  },
  brandPillText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  heroTitle: { color: '#fff', fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.68)', fontSize: 13 },
  streakChip: {
    alignSelf: 'flex-start', marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6,
  },
  streakText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Remembered user
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 20, padding: 14,
    shadowColor: '#0B1220', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05, shadowRadius: 24, elevation: 3,
  },
  userAvatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  userInitials: { fontSize: 16, fontWeight: '800' },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  userName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  userLevel: { fontSize: 12, marginTop: 1 },
  switchBtn: { borderWidth: 1, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  switchText: { fontSize: 12, fontWeight: '600' },

  // Biometric
  bioBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    borderWidth: 1.5, borderRadius: 16, paddingVertical: 15,
  },
  bioText: { fontSize: 14, fontWeight: '700' },

  // Finn news
  finnCard: { flexDirection: 'row', gap: 11, borderRadius: 18, padding: 14 },
  finnAvatar: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  finnLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  finnText: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },

  // PIN card
  pinCard: {
    borderRadius: 24, padding: 20, alignItems: 'center',
    shadowColor: '#0B1220', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05, shadowRadius: 24, elevation: 3,
  },
  pinHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 18 },
  pinTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  revealBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  revealText: { fontSize: 12.5, fontWeight: '600' },

  dotsRow: { flexDirection: 'row', gap: 20, marginBottom: 6, alignItems: 'center', height: 34 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, backgroundColor: 'transparent' },
  revealDigit: { fontSize: 26, fontWeight: '800', width: 16, textAlign: 'center' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginTop: 2,
  },
  errorText: { fontSize: 12.5, fontWeight: '500', textAlign: 'center' },

  pad: { marginTop: 8, gap: 14 },
  padRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  padKey: {
    width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  padKeyPressed: { opacity: 0.55 },
  padGhost: { width: KEY_SIZE, height: KEY_SIZE, alignItems: 'center', justifyContent: 'center' },
  padText: { fontSize: 26, fontWeight: '600' },

  forgotBtn: { marginTop: 18, flexDirection: 'row', alignItems: 'center' },
  forgotText: { fontSize: 13, fontWeight: '600' },
  forgotHint: { fontSize: 12 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  footerText: { fontSize: 11 },
});

export default PinEntryScreen;
