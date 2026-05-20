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
const IS_WEB = Platform.OS === 'web';

// ── Feature chips data ────────────────────────────────────────────────────────
const FEATURES: { icon: React.ComponentProps<typeof Feather>['name']; label: string; desc: string }[] = [
  { icon: 'zap',           label: 'Finn IA',       desc: 'Tu asesor financiero personal 24/7'   },
  { icon: 'mic',           label: 'Voz',           desc: 'Registra gastos hablando'             },
  { icon: 'bar-chart-2',   label: 'Estadísticas',  desc: 'Tendencias y proyecciones en tiempo real' },
  { icon: 'award',         label: 'Logros',        desc: 'Gamifica tu salud financiera'         },
];

// ── Finn avatar animado ───────────────────────────────────────────────────────
function FinnHero({ primary, large }: { primary: string; large?: boolean }) {
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const size  = large ? 88 : 64;

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
    <View style={{ width: size + 32, height: size + 32, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[st.ring, { width: size + 28, height: size + 28, borderRadius: (size + 28) / 2, borderColor: `${primary}18`, transform: [{ scale: ring2 }] }]} />
      <Animated.View style={[st.ring, { width: size + 14, height: size + 14, borderRadius: (size + 14) / 2, borderColor: `${primary}30`, transform: [{ scale: ring1 }] }]} />
      <LinearGradient
        colors={[primary + 'EE', primary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: large ? 32 : 22, fontWeight: '900', color: '#FFF', letterSpacing: 1 }}>Fi</Text>
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
          style={[st.dot, { backgroundColor: i <= active ? primary : `${primary}30` }, i <= active && { width: 16 }]}
        />
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
        style={[
          st.fieldInput,
          { color: textPrimary },
          IS_WEB && ({ outline: 'none', height: 22 } as any),
        ]}
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

// ── Branding panel (solo web) ─────────────────────────────────────────────────
function WebBrandingPanel({ primary, primaryLight, textPrimary, textSecondary, textTertiary }: {
  primary: string; primaryLight: string; textPrimary: string; textSecondary: string; textTertiary: string;
}) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[st.brandingPanel, { backgroundColor: primaryLight, opacity: fadeIn }]}>
      {/* Blobs decorativos */}
      <View style={[st.webBlob1, { backgroundColor: `${primary}15` }]} />
      <View style={[st.webBlob2, { backgroundColor: `${primary}10` }]} />

      <View style={st.brandingContent}>
        {/* Logo + nombre */}
        <FinnHero primary={primary} large />
        <Text style={[st.webBrandName, { color: textPrimary }]}>FinancyAI</Text>
        <Text style={[st.webBrandTagline, { color: primary }]}>
          Tu asistente financiero con IA
        </Text>
        <Text style={[st.webBrandDesc, { color: textSecondary }]}>
          Controla tus gastos, habla con Finn y alcanza{'\n'}tus metas financieras — todo desde el navegador.
        </Text>

        {/* Feature list */}
        <View style={st.webFeatureList}>
          {FEATURES.map(f => (
            <View key={f.label} style={st.webFeatureRow}>
              <View style={[st.webFeatureIcon, { backgroundColor: `${primary}18` }]}>
                <Feather name={f.icon} size={16} color={primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.webFeatureLabel, { color: textPrimary }]}>{f.label}</Text>
                <Text style={[st.webFeatureDesc,  { color: textTertiary }]}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Badge */}
        <View style={[st.webBadge, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}>
          <Text style={{ fontSize: 14 }}>✦</Text>
          <Text style={[st.webBadgeText, { color: primary }]}>Finn está listo para ayudarte</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Form content (compartido nativo + web) ─────────────────────────────────────
function FormContent({
  otpStep, setOtpStep,
  otpEmail, setOtpEmail,
  otpPassword, setOtpPassword,
  otpConfirm, setOtpConfirm,
  otpShowPwd, setOtpShowPwd,
  otpCode, handleOtpDigit, handleOtpKeyPress, otpResendSecs,
  authLoading, authError,
  handleSendOtp, handleRegisterOtp,
  otpRefs, otpPwdRef, otpCfmRef,
  firstName, slideAnim, colors,
}: AuthScreenProps & { firstName: string; slideAnim: Animated.Value; colors: any }) {

  const fieldProps = {
    inputBg:      colors.inputBg,
    border:       colors.border,
    primary:      colors.primary,
    textPrimary:  colors.textPrimary,
    textTertiary: colors.textTertiary,
  };

  const otpBoxSize = IS_WEB ? 52 : (W - 48 - 48 - 30) / 4;

  return (
    <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
      {/* Mini logo (pasos 2 y 3) */}
      {otpStep !== 'email' && (
        <View style={[st.miniLogoWrap, { marginBottom: 16 }]}>
          <LinearGradient colors={[colors.primary + 'EE', colors.primary]} style={st.miniLogo}>
            <Text style={st.miniLogoText}>Fi</Text>
          </LinearGradient>
          <Text style={[st.miniBrand, { color: colors.textPrimary }]}>FinancyAI</Text>
          <StepDots step={otpStep} primary={colors.primary} />
        </View>
      )}

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
            onSubmit={handleSendOtp} autoFocus={IS_WEB}
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
          <Pressable onPress={() => { setOtpStep('email'); setOtpPassword(''); setOtpConfirm(''); }} style={st.backLink}>
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

          {/* Fila 1 */}
          <View style={st.otpGrid}>
            {[0, 1, 2, 3].map(idx => (
              <TextInput
                key={idx}
                ref={r => { otpRefs.current[idx] = r; }}
                style={[
                  st.otpBox,
                  { width: otpBoxSize, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.textPrimary },
                  otpCode[idx] && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                  authLoading && { opacity: 0.45 },
                  IS_WEB && ({ outline: 'none', textAlign: 'center' } as any),
                ]}
                value={otpCode[idx]}
                onChangeText={t => handleOtpDigit(t, idx)}
                onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, idx)}
                keyboardType={IS_WEB ? 'default' : 'number-pad'}
                maxLength={1}
                selectTextOnFocus
                editable={!authLoading}
              />
            ))}
          </View>
          {/* Fila 2 */}
          <View style={[st.otpGrid, { marginTop: 8 }]}>
            {[4, 5, 6, 7].map(idx => (
              <TextInput
                key={idx}
                ref={r => { otpRefs.current[idx] = r; }}
                style={[
                  st.otpBox,
                  { width: otpBoxSize, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.textPrimary },
                  otpCode[idx] && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                  authLoading && { opacity: 0.45 },
                  IS_WEB && ({ outline: 'none', textAlign: 'center' } as any),
                ]}
                value={otpCode[idx]}
                onChangeText={t => handleOtpDigit(t, idx)}
                onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, idx)}
                keyboardType={IS_WEB ? 'default' : 'number-pad'}
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
            style={[st.resendBtn, { backgroundColor: colors.primaryLight, borderColor: `${colors.primary}30` }, otpResendSecs > 0 && { opacity: 0.45 }]}
          >
            <Text style={[st.resendText, { color: colors.primary }]}>
              {otpResendSecs > 0 ? `Reenviar código en ${otpResendSecs}s` : '✉ Reenviar código'}
            </Text>
          </Pressable>
          <Pressable onPress={() => { setOtpStep('email'); setOtpPassword(''); setOtpConfirm(''); }} style={st.backLink}>
            <Text style={[st.backLinkText, { color: colors.textTertiary }]}>← Cambiar correo</Text>
          </Pressable>
        </>
      )}
    </Animated.View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function AuthScreen(props: AuthScreenProps) {
  const {
    otpStep, setOtpStep, otpEmail, otpPassword, otpConfirm, profileName,
    setOtpPassword, setOtpConfirm,
  } = props;

  const insets      = useSafeAreaInsets();
  const { colors }  = useTheme();
  const slideAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideAnim.setValue(20);
    Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }).start();
  }, [otpStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstName = profileName?.trim().split(' ')[0] || otpEmail.split('@')[0];

  const formProps = { ...props, firstName, slideAnim, colors };

  // ── WEB LAYOUT: pantalla dividida ─────────────────────────────────────────
  if (IS_WEB) {
    return (
      <View style={[st.webRoot, { backgroundColor: colors.background }]}>

        {/* Panel derecho — Branding (visible en desktop, oculto en mobile web) */}
        <WebBrandingPanel
          primary={colors.primary}
          primaryLight={colors.primaryLight}
          textPrimary={colors.textPrimary}
          textSecondary={colors.textSecondary}
          textTertiary={colors.textTertiary}
        />

        {/* Panel izquierdo — Formulario */}
        <View style={[st.webFormPanel, { backgroundColor: colors.background }]}>
          <ScrollView
            contentContainerStyle={st.webFormScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header móvil (logo pequeño cuando no hay panel branding) */}
            {otpStep === 'email' && (
              <View style={st.webFormHeader}>
                <LinearGradient colors={[colors.primary + 'EE', colors.primary]} style={st.miniLogo}>
                  <Text style={st.miniLogoText}>Fi</Text>
                </LinearGradient>
                <Text style={[st.miniBrand, { color: colors.textPrimary }]}>FinancyAI</Text>
              </View>
            )}

            <View style={[st.webCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <FormContent {...formProps} />
            </View>
          </ScrollView>
        </View>

      </View>
    );
  }

  // ── NATIVE LAYOUT: scroll de una columna ─────────────────────────────────
  return (
    <View style={[st.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[st.blobTR, { backgroundColor: colors.primaryLight }]} />
      <View style={[st.blobBL, { backgroundColor: colors.primaryLight }]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={[st.scroll, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hero nativo */}
            {otpStep === 'email' && (
              <View style={st.heroSection}>
                <FinnHero primary={colors.primary} />
                <Text style={[st.brandName, { color: colors.textPrimary }]}>FinancyAI</Text>
                <Text style={[st.brandTagline, { color: colors.textSecondary }]}>
                  Tu asistente financiero con IA
                </Text>
                <View style={st.chipsRow}>
                  {FEATURES.map(f => (
                    <View key={f.label} style={[st.chip, { backgroundColor: colors.primaryLight, borderColor: `${colors.primary}30` }]}>
                      <Feather name={f.icon} size={12} color={colors.primary} />
                      <Text style={[st.chipLabel, { color: colors.primary }]}>{f.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <FormContent {...formProps} />
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  // ── Native root ──
  root: { flex: 1 },
  blobTR: { position: 'absolute', width: 260, height: 260, borderRadius: 130, top: -100, right: -80, opacity: 0.6 },
  blobBL: { position: 'absolute', width: 180, height: 180, borderRadius: 90, bottom: 60, left: -70, opacity: 0.5 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  heroSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  ring: { position: 'absolute', borderWidth: 1 },
  brandName:    { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 5 },
  brandTagline: { fontSize: 14, fontWeight: '500', marginBottom: 18, textAlign: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  chipLabel: { fontSize: 12, fontWeight: '600' },

  card: { borderWidth: 1, borderRadius: 24, padding: 22 },

  // ── Web root: split layout ──
  webRoot: { flex: 1, flexDirection: 'row-reverse' } as any,

  // Panel branding (derecha en row-reverse = aparece a la derecha)
  brandingPanel: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    minWidth: 320,
  } as any,
  webBlob1: { position: 'absolute', width: 400, height: 400, borderRadius: 200, top: -120, right: -120 } as any,
  webBlob2: { position: 'absolute', width: 300, height: 300, borderRadius: 150, bottom: -80, left: -80  } as any,
  brandingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    gap: 0,
  },
  webBrandName:    { fontSize: 36, fontWeight: '900', letterSpacing: -1, marginTop: 16, marginBottom: 6 },
  webBrandTagline: { fontSize: 15, fontWeight: '700', marginBottom: 10, letterSpacing: 0.2 },
  webBrandDesc:    { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  webFeatureList: { width: '100%', gap: 16, marginBottom: 32 },
  webFeatureRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  webFeatureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  webFeatureLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  webFeatureDesc:  { fontSize: 12, lineHeight: 17 },
  webBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 8 },
  webBadgeText: { fontSize: 13, fontWeight: '600' },

  // Panel formulario (izquierda en row-reverse = aparece a la izquierda)
  webFormPanel: { width: 420, flexShrink: 0 } as any,
  webFormScroll: { flexGrow: 1, justifyContent: 'center', padding: 40, minHeight: '100%' as any },
  webFormHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  webCard: { borderWidth: 1, borderRadius: 20, padding: 28 },

  // ── Shared ──
  miniLogoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniLogo:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  miniLogoText:{ fontSize: 14, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  miniBrand:   { fontSize: 18, fontWeight: '800' },
  dotsWrap: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  cardTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginBottom: 6 },
  cardSub:   { fontSize: 14, lineHeight: 21, marginBottom: 18 },

  emailBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  emailBadgeText: { fontSize: 12, fontWeight: '600' },

  tipBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16, gap: 4 },
  tipTitle: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  tipItem:  { fontSize: 12, lineHeight: 18 },

  fieldWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: IS_WEB ? 14 : (Platform.OS === 'ios' ? 14 : 10), gap: 10, marginBottom: 2 },
  fieldIcon:  { fontSize: 16 },
  fieldInput: { flex: 1, fontSize: 15, padding: 0 },
  showPwdBtn: { paddingHorizontal: 4 },
  showPwdText:{ fontSize: 12, fontWeight: '600' },

  cta: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },

  errorBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  errorText: { fontSize: 13, fontWeight: '500' },

  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 16 },
  backLink: { alignSelf: 'center', marginTop: 14, paddingVertical: 6 },
  backLinkText: { fontSize: 13, fontWeight: '500' },

  codeIconWrap: { alignItems: 'center', marginBottom: 14 },
  codeIconBg: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },

  otpGrid: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  otpBox:  { height: 54, borderRadius: 12, borderWidth: 1.5, textAlign: 'center', fontSize: 20, fontWeight: '800' },

  verifyingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 },
  verifyingText: { fontSize: 14, fontWeight: '500' },

  resendBtn: { alignSelf: 'center', marginTop: 18, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 100, borderWidth: 1 },
  resendText: { fontSize: 13, fontWeight: '600' },
});
