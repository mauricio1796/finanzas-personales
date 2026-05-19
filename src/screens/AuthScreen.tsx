import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Animated,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../state/ThemeContext';

const { width: W } = Dimensions.get('window');

// ── Feature chips ─────────────────────────────────────────────────────────────
const FEATURES: { icon: React.ComponentProps<typeof Feather>['name']; label: string }[] = [
  { icon: 'zap',         label: 'IA personal'  },
  { icon: 'bar-chart-2', label: 'Estadísticas' },
  { icon: 'award',       label: 'Logros'       },
  { icon: 'clock',       label: 'Historial'    },
];

// ── Finn avatar animado ───────────────────────────────────────────────────────
function FinnHero({ primary }: { primary: string }) {
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1.4, duration: 1400, useNativeDriver: true }),
          Animated.timing(val, { toValue: 1,   duration: 1400, useNativeDriver: true }),
        ]),
      );
    const a1 = pulse(ring1, 0);
    const a2 = pulse(ring2, 700);
    a1.start(); a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={st.heroWrap}>
      <Animated.View style={[st.ring, st.ring2, { borderColor: `${primary}20`, transform: [{ scale: ring2 }] }]} />
      <Animated.View style={[st.ring, st.ring1, { borderColor: `${primary}35`, transform: [{ scale: ring1 }] }]} />
      <LinearGradient
        colors={[primary + 'EE', primary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={st.heroAvatar}
      >
        <Text style={st.heroAvatarText}>FI</Text>
      </LinearGradient>
    </View>
  );
}

// ── Step dots ─────────────────────────────────────────────────────────────────
function StepDots({ step, primary }: { step: 'email' | 'register' | 'code'; primary: string }) {
  const active = ['email', 'register', 'code'].indexOf(step);
  if (step === 'email') return null;
  return (
    <View style={st.dotsWrap}>
      {[0, 1, 2].map(i => (
        <View
          key={i}
          style={[
            st.dot,
            { backgroundColor: i <= active ? primary : `${primary}30` },
            i <= active && { width: 16 },
          ]}
        />
      ))}
    </View>
  );
}

// ── Feature chips ─────────────────────────────────────────────────────────────
function FeatureChips({ primary, primaryLight }: { primary: string; primaryLight: string }) {
  return (
    <View style={st.chipsRow}>
      {FEATURES.map(f => (
        <View key={f.label} style={[st.chip, { backgroundColor: primaryLight, borderColor: `${primary}30` }]}>
          <Feather name={f.icon} size={12} color={primary} />
          <Text style={[st.chipLabel, { color: primary }]}>{f.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
interface FieldProps {
  icon:            string;
  placeholder:     string;
  value:           string;
  onChange:        (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?:   any;
  autoCapitalize?: any;
  autoCorrect?:    boolean;
  returnKeyType?:  any;
  onSubmit?:       () => void;
  autoFocus?:      boolean;
  inputRef?:       React.RefObject<TextInput | null>;
  suffix?:         React.ReactNode;
  editable?:       boolean;
  inputBg:         string;
  border:          string;
  primary:         string;
  textPrimary:     string;
  textTertiary:    string;
}

function Field({
  icon, placeholder, value, onChange, secureTextEntry, keyboardType,
  autoCapitalize = 'none', autoCorrect = false, returnKeyType = 'next',
  onSubmit, autoFocus, inputRef, suffix, editable = true,
  inputBg, border, primary, textPrimary, textTertiary,
}: FieldProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const handleFocus = () => Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  const handleBlur  = () => Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: [border, primary] });

  return (
    <Animated.View style={[st.fieldWrap, { backgroundColor: inputBg, borderColor }]}>
      <Text style={st.fieldIcon}>{icon}</Text>
      <TextInput
        ref={inputRef as any}
        style={[st.fieldInput, { color: textPrimary }]}
        placeholder={placeholder}
        placeholderTextColor={textTertiary}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        editable={editable}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {suffix}
    </Animated.View>
  );
}

// ── CTA button ────────────────────────────────────────────────────────────────
function CTAButton({ label, onPress, loading, disabled, primary, primaryDark }: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean;
  primary: string; primaryDark: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    if (disabled || loading) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 70,  useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 110, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale }], marginTop: 16 }}>
      <Pressable onPress={press} disabled={disabled || loading} style={{ opacity: disabled ? 0.45 : 1 }}>
        <LinearGradient
          colors={[primary, primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={st.cta}
        >
          {loading
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={st.ctaText}>{label}</Text>
          }
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface AuthScreenProps {
  otpStep:        'email' | 'register' | 'code';
  setOtpStep:     (s: 'email' | 'register' | 'code') => void;
  otpEmail:       string;
  setOtpEmail:    (s: string) => void;
  otpPassword:    string;
  setOtpPassword: (s: string) => void;
  otpConfirm:     string;
  setOtpConfirm:  (s: string) => void;
  otpShowPwd:     boolean;
  setOtpShowPwd:  (v: boolean | ((b: boolean) => boolean)) => void;
  otpCode:           string[];
  handleOtpDigit:    (text: string, idx: number) => void;
  handleOtpKeyPress: (key: string, idx: number) => void;
  otpResendSecs:     number;
  authLoading: boolean;
  authError:   string;
  handleSendOtp:     () => void;
  handleRegisterOtp: () => void;
  handleVerifyOtp:   (code?: string[]) => void;
  otpRefs:   React.MutableRefObject<(TextInput | null)[]>;
  otpPwdRef: React.RefObject<TextInput | null>;
  otpCfmRef: React.RefObject<TextInput | null>;
  profileName?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AuthScreen({
  otpStep, setOtpStep,
  otpEmail, setOtpEmail,
  otpPassword, setOtpPassword,
  otpConfirm, setOtpConfirm,
  otpShowPwd, setOtpShowPwd,
  otpCode, handleOtpDigit, handleOtpKeyPress, otpResendSecs,
  authLoading, authError,
  handleSendOtp, handleRegisterOtp, handleVerifyOtp,
  otpRefs, otpPwdRef, otpCfmRef,
  profileName,
}: AuthScreenProps) {
  const insets   = useSafeAreaInsets();
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideAnim.setValue(24);
    Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }).start();
  }, [otpStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstName = profileName?.trim().split(' ')[0] || otpEmail.split('@')[0];

  const fieldProps = {
    inputBg:      colors.inputBg,
    border:       colors.border,
    primary:      colors.primary,
    textPrimary:  colors.textPrimary,
    textTertiary: colors.textTertiary,
  };

  return (
    <View style={[st.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Blobs decorativos con los colores del app */}
      <View style={[st.blobTR, { backgroundColor: colors.primaryLight }]} />
      <View style={[st.blobBL, { backgroundColor: colors.primaryLight }]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={[st.scroll, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Hero section ── */}
            {otpStep === 'email' && (
              <View style={st.heroSection}>
                <FinnHero primary={colors.primary} />
                <Text style={[st.brandName, { color: colors.textPrimary }]}>FinancyAI</Text>
                <Text style={[st.brandTagline, { color: colors.textSecondary }]}>
                  Tu asistente financiero con IA
                </Text>
                <FeatureChips primary={colors.primary} primaryLight={colors.primaryLight} />
              </View>
            )}

            {otpStep !== 'email' && (
              <View style={[st.heroSection, { paddingTop: 20, paddingBottom: 16 }]}>
                <View style={st.miniLogoWrap}>
                  <LinearGradient
                    colors={[colors.primary + 'EE', colors.primary]}
                    style={st.miniLogo}
                  >
                    <Text style={st.miniLogoText}>FI</Text>
                  </LinearGradient>
                  <Text style={[st.miniBrand, { color: colors.textPrimary }]}>FinancyAI</Text>
                </View>
                <StepDots step={otpStep} primary={colors.primary} />
              </View>
            )}

            {/* ── Card ── */}
            <Animated.View
              style={[
                st.card,
                { backgroundColor: colors.card, borderColor: colors.border, transform: [{ translateY: slideAnim }] },
              ]}
            >
              {/* ── Email ── */}
              {otpStep === 'email' && (
                <>
                  <Text style={[st.cardTitle, { color: colors.textPrimary }]}>¡Bienvenido!</Text>
                  <Text style={[st.cardSub, { color: colors.textSecondary }]}>
                    Ingresa tu correo para continuar.{'\n'}Si eres nuevo, te registramos al instante.
                  </Text>

                  <Field
                    icon="✉️" placeholder="tucorreo@ejemplo.com"
                    value={otpEmail} onChange={setOtpEmail}
                    keyboardType="email-address" returnKeyType="send"
                    onSubmit={handleSendOtp}
                    {...fieldProps}
                  />

                  {authError ? (
                    <View style={[st.errorBox, { backgroundColor: colors.expenseLight, borderColor: colors.expense }]}>
                      <Text style={[st.errorText, { color: colors.expense }]}>⚠ {authError}</Text>
                    </View>
                  ) : null}

                  <CTAButton
                    label="Continuar →" onPress={handleSendOtp}
                    loading={authLoading} disabled={!otpEmail.includes('@')}
                    primary={colors.primary} primaryDark={colors.primaryDark}
                  />

                  <Text style={[st.disclaimer, { color: colors.textTertiary }]}>
                    Al continuar aceptas nuestros términos de uso y política de privacidad
                  </Text>
                </>
              )}

              {/* ── Register ── */}
              {otpStep === 'register' && (
                <>
                  <Text style={[st.cardTitle, { color: colors.textPrimary }]}>Hola, {firstName} 👋</Text>
                  <View style={[st.emailBadge, { backgroundColor: colors.primaryLight, borderColor: `${colors.primary}30` }]}>
                    <Text style={[st.emailBadgeText, { color: colors.primary }]}>✉ {otpEmail}</Text>
                  </View>
                  <Text style={[st.cardSub, { color: colors.textSecondary }]}>
                    Crea una contraseña para proteger tu cuenta
                  </Text>

                  <View style={[st.tipBox, { backgroundColor: colors.primaryLight, borderColor: `${colors.primary}25` }]}>
                    <Text style={[st.tipTitle, { color: colors.primary }]}>Contraseña segura</Text>
                    {['Mínimo 6 caracteres', 'Combina letras y números', 'Evita fechas de nacimiento'].map(t => (
                      <Text key={t} style={[st.tipItem, { color: colors.textSecondary }]}>• {t}</Text>
                    ))}
                  </View>

                  <Field
                    icon="🔒" placeholder="Contraseña (mín. 6 caracteres)"
                    value={otpPassword} onChange={setOtpPassword}
                    secureTextEntry={!otpShowPwd} returnKeyType="next"
                    onSubmit={() => (otpCfmRef.current as any)?.focus()}
                    autoFocus inputRef={otpPwdRef}
                    suffix={
                      <Pressable onPress={() => setOtpShowPwd(v => !v)} style={st.showPwdBtn}>
                        <Text style={[st.showPwdText, { color: colors.primary }]}>
                          {otpShowPwd ? 'Ocultar' : 'Ver'}
                        </Text>
                      </Pressable>
                    }
                    {...fieldProps}
                  />

                  <View style={{ height: 10 }} />

                  <Field
                    icon="🔐" placeholder="Confirmar contraseña"
                    value={otpConfirm} onChange={setOtpConfirm}
                    secureTextEntry={!otpShowPwd} returnKeyType="send"
                    onSubmit={handleRegisterOtp} inputRef={otpCfmRef}
                    {...fieldProps}
                  />

                  {authError ? (
                    <View style={[st.errorBox, { backgroundColor: colors.expenseLight, borderColor: colors.expense }]}>
                      <Text style={[st.errorText, { color: colors.expense }]}>⚠ {authError}</Text>
                    </View>
                  ) : null}

                  <CTAButton
                    label="Crear cuenta →" onPress={handleRegisterOtp}
                    loading={authLoading}
                    disabled={otpPassword.length < 6 || otpPassword !== otpConfirm}
                    primary={colors.primary} primaryDark={colors.primaryDark}
                  />

                  <Pressable
                    onPress={() => { setOtpStep('email'); setOtpPassword(''); setOtpConfirm(''); }}
                    style={st.backLink}
                  >
                    <Text style={[st.backLinkText, { color: colors.textTertiary }]}>← Cambiar correo</Text>
                  </Pressable>
                </>
              )}

              {/* ── OTP Code ── */}
              {otpStep === 'code' && (
                <>
                  <View style={st.codeIconWrap}>
                    <View style={[st.codeIconBg, { backgroundColor: colors.primaryLight }]}>
                      <Text style={{ fontSize: 30 }}>📬</Text>
                    </View>
                  </View>
                  <Text style={[st.cardTitle, { color: colors.textPrimary }]}>Revisa tu correo</Text>
                  <Text style={[st.cardSub, { color: colors.textSecondary }]}>
                    Enviamos un código de 8 dígitos a{'\n'}
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>{otpEmail}</Text>
                  </Text>

                  {/* 8 cajas OTP — 2 filas de 4 */}
                  <View style={st.otpGrid}>
                    {[0, 1, 2, 3].map(idx => (
                      <TextInput
                        key={idx}
                        ref={r => { otpRefs.current[idx] = r; }}
                        style={[
                          st.otpBox,
                          { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.textPrimary },
                          otpCode[idx] && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                          authLoading && { opacity: 0.45 },
                        ]}
                        value={otpCode[idx]}
                        onChangeText={t => handleOtpDigit(t, idx)}
                        onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, idx)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                        editable={!authLoading}
                      />
                    ))}
                  </View>
                  <View style={[st.otpGrid, { marginTop: 8 }]}>
                    {[4, 5, 6, 7].map(idx => (
                      <TextInput
                        key={idx}
                        ref={r => { otpRefs.current[idx] = r; }}
                        style={[
                          st.otpBox,
                          { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.textPrimary },
                          otpCode[idx] && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                          authLoading && { opacity: 0.45 },
                        ]}
                        value={otpCode[idx]}
                        onChangeText={t => handleOtpDigit(t, idx)}
                        onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, idx)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                        editable={!authLoading}
                      />
                    ))}
                  </View>

                  {authLoading && (
                    <View style={st.verifyingRow}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[st.verifyingText, { color: colors.primary }]}>Verificando código…</Text>
                    </View>
                  )}

                  {authError ? (
                    <View style={[st.errorBox, { backgroundColor: colors.expenseLight, borderColor: colors.expense }]}>
                      <Text style={[st.errorText, { color: colors.expense }]}>⚠ {authError}</Text>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={otpResendSecs === 0 ? handleSendOtp : undefined}
                    disabled={otpResendSecs > 0 || authLoading}
                    style={[
                      st.resendBtn,
                      { backgroundColor: colors.primaryLight, borderColor: `${colors.primary}30` },
                      otpResendSecs > 0 && { opacity: 0.45 },
                    ]}
                  >
                    <Text style={[st.resendText, { color: colors.primary }]}>
                      {otpResendSecs > 0 ? `Reenviar código en ${otpResendSecs}s` : '✉ Reenviar código'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => { setOtpStep('email'); setOtpPassword(''); setOtpConfirm(''); }}
                    style={st.backLink}
                  >
                    <Text style={[st.backLinkText, { color: colors.textTertiary }]}>← Cambiar correo</Text>
                  </Pressable>
                </>
              )}
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1 },

  blobTR: {
    position: 'absolute',
    width: 260, height: 260, borderRadius: 130,
    top: -100, right: -80, opacity: 0.6,
  },
  blobBL: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    bottom: 60, left: -70, opacity: 0.5,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  heroSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
  },
  heroWrap: {
    width: 96, height: 96,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  ring1: { width: 80, height: 80 },
  ring2: { width: 96, height: 96 },
  heroAvatar: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  heroAvatarText: {
    fontSize: 24, fontWeight: '900', color: '#FFF', letterSpacing: 1,
  },
  brandName: {
    fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 5,
  },
  brandTagline: {
    fontSize: 14, fontWeight: '500', marginBottom: 18, textAlign: 'center',
  },

  chipsRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 8,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  chipLabel: { fontSize: 12, fontWeight: '600' },

  miniLogoWrap: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 12,
  },
  miniLogo: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  miniLogoText: { fontSize: 14, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  miniBrand:    { fontSize: 18, fontWeight: '800' },

  dotsWrap: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  card: {
    borderWidth: 1, borderRadius: 24,
    padding: 22,
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 6,
    } : {}),
  },
  cardTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginBottom: 6 },
  cardSub:   { fontSize: 14, lineHeight: 21, marginBottom: 18 },

  emailBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10,
  },
  emailBadgeText: { fontSize: 12, fontWeight: '600' },

  tipBox: {
    borderWidth: 1, borderRadius: 14,
    padding: 14, marginBottom: 16, gap: 4,
  },
  tipTitle: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  tipItem:  { fontSize: 12, lineHeight: 18 },

  fieldWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    gap: 10,
  },
  fieldIcon:  { fontSize: 16 },
  fieldInput: { flex: 1, fontSize: 15, padding: 0 },
  showPwdBtn: { paddingHorizontal: 4 },
  showPwdText:{ fontSize: 12, fontWeight: '600' },

  cta: {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },

  errorBox: {
    borderWidth: 1, borderRadius: 12,
    padding: 12, marginTop: 12,
  },
  errorText: { fontSize: 13, fontWeight: '500' },

  disclaimer: {
    fontSize: 11, textAlign: 'center',
    marginTop: 14, lineHeight: 16,
  },

  backLink: { alignSelf: 'center', marginTop: 14, paddingVertical: 6 },
  backLinkText: { fontSize: 13, fontWeight: '500' },

  codeIconWrap: { alignItems: 'center', marginBottom: 14 },
  codeIconBg: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },

  otpGrid: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  otpBox: {
    width: (W - 48 - 48 - 30) / 4,
    height: 54,
    borderRadius: 12, borderWidth: 1.5,
    textAlign: 'center', fontSize: 20, fontWeight: '800',
  },

  verifyingRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, marginTop: 14,
  },
  verifyingText: { fontSize: 14, fontWeight: '500' },

  resendBtn: {
    alignSelf: 'center', marginTop: 18,
    paddingVertical: 8, paddingHorizontal: 20,
    borderRadius: 100, borderWidth: 1,
  },
  resendText: { fontSize: 13, fontWeight: '600' },
});
