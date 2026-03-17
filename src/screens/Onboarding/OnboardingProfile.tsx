import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Keyboard, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon, FeatherName } from '../../components/ui/Icon';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';

interface Props { onNext: () => void; onBack: () => void; }

type EmpType = 'employed' | 'freelance' | 'business' | 'student';
const EMP_OPTIONS: { key: EmpType; label: string; icon: FeatherName }[] = [
  { key: 'employed',  label: 'Empleado',   icon: 'briefcase'   },
  { key: 'freelance', label: 'Freelancer', icon: 'code'        },
  { key: 'business',  label: 'Empresario', icon: 'trending-up' },
  { key: 'student',   label: 'Estudiante', icon: 'book-open'   },
];

export const OnboardingProfile: React.FC<Props> = ({ onNext, onBack }) => {
  const { setProfile, profile } = useFinance();
  const { colors } = useTheme();
  const [nombre, setNombre] = useState(profile?.mainFinancialConcern ?? '');
  const [empType, setEmpType] = useState<EmpType | null>(
    (profile?.employmentType as EmpType) ?? null
  );
  const [focused, setFocused] = useState(false);
  const [showSecond, setShowSecond] = useState(
    !!(profile?.mainFinancialConcern && profile.mainFinancialConcern.length >= 2)
  );

  const bubble1  = useRef(new Animated.Value(0)).current;
  const bubble2  = useRef(new Animated.Value(0)).current;
  const optAnims = useRef(EMP_OPTIONS.map(() => new Animated.Value(0))).current;
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSecondBubble = () => {
    Animated.sequence([
      Animated.spring(bubble2, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.stagger(60, optAnims.map(a =>
        Animated.spring(a, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true })
      )),
    ]).start();
  };

  useEffect(() => {
    Animated.spring(bubble1, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    if (showSecond) runSecondBubble();
  }, []);

  const handleNameChange = (text: string) => {
    setNombre(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length >= 2 && !showSecond) {
      debounce.current = setTimeout(() => { setShowSecond(true); runSecondBubble(); }, 800);
    }
  };

  const handleSelectEmp = (key: EmpType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEmpType(key);
  };

  const canContinue = nombre.trim().length >= 2 && empType !== null;

  const handleNext = () => {
    if (!canContinue) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProfile({
      id: profile?.id ?? Date.now().toString(),
      userId: '1',
      employmentType: empType!,
      incomeType: 'fixed',
      monthlySalary: profile?.monthlySalary ?? 0,
      hasDebts: profile?.hasDebts ?? false,
      mainFinancialConcern: nombre.trim(),
      currencyPreference: 'COP',
      createdAt: profile?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onNext();
  };

  const bubbleSlide = (a: Animated.Value) => ({
    opacity: a,
    transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
  });

  return (
    <OnboardingShell step={1} totalSteps={5} onBack={onBack}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.inner, { paddingHorizontal: 24 }]}>
          <View style={s.finnRow}>
            <View style={[s.finnAvatar, { backgroundColor: colors.primary }]}>
              <Text style={s.finnLetter}>F</Text>
            </View>
            <Animated.View style={[s.bubble, { backgroundColor: colors.card, borderColor: colors.border }, bubbleSlide(bubble1)]}>
              <Text style={[s.bubbleText, { color: colors.textPrimary }]}>
                Como te llamas? Asi puedo personalizarte mejor
              </Text>
            </Animated.View>
          </View>

          <TextInput
            style={[
              s.nameInput,
              {
                color: colors.textPrimary,
                borderBottomColor: focused ? colors.primary : colors.border,
                borderBottomWidth: focused ? 2 : 1,
              },
            ]}
            placeholder="Tu nombre..."
            placeholderTextColor={colors.textTertiary}
            value={nombre}
            onChangeText={handleNameChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
            returnKeyType="next"
          />

          {showSecond && (
            <>
              <View style={[s.finnRow, { marginTop: 20 }]}>
                <View style={[s.finnAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={s.finnLetter}>F</Text>
                </View>
                <Animated.View style={[s.bubble, { backgroundColor: colors.card, borderColor: colors.border }, bubbleSlide(bubble2)]}>
                  <Text style={[s.bubbleText, { color: colors.textPrimary }]}>
                    {nombre.trim()
                      ? 'Hola ' + nombre.trim().split(' ')[0] + '! A que te dedicas?'
                      : 'A que te dedicas?'}
                  </Text>
                </Animated.View>
              </View>

              <View style={s.empGrid}>
                {EMP_OPTIONS.map((opt, i) => {
                  const sel = empType === opt.key;
                  return (
                    <Animated.View
                      key={opt.key}
                      style={{
                        width: '48%',
                        opacity: optAnims[i],
                        transform: [{ scale: optAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
                      }}
                    >
                      <TouchableOpacity
                        style={[
                          s.empCard,
                          {
                            backgroundColor: sel ? colors.primaryLight : colors.card,
                            borderColor: sel ? colors.primary : colors.border,
                            borderWidth: sel ? 1.5 : 0.5,
                          },
                        ]}
                        onPress={() => handleSelectEmp(opt.key)}
                        activeOpacity={0.8}
                      >
                        <Icon name={opt.icon} size={24} color={sel ? colors.primary : colors.textSecondary} />
                        <Text style={[s.empLabel, { color: sel ? colors.primary : colors.textPrimary }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </>
          )}

          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={[s.btn, { backgroundColor: colors.primary, opacity: canContinue ? 1 : 0.4 }]}
            onPress={handleNext}
            disabled={!canContinue}
            activeOpacity={0.85}
          >
            <Text style={s.btnText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </OnboardingShell>
  );
};

const s = StyleSheet.create({
  inner:      { flex: 1, paddingTop: 8, paddingBottom: 24, gap: 8 },
  finnRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  finnAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  finnLetter: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  bubble:     { flex: 1, borderRadius: 14, borderTopLeftRadius: 4, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  nameInput:  { fontSize: 24, fontWeight: '500', paddingVertical: 12, marginTop: 8 },
  empGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  empCard:    { borderRadius: 14, padding: 14, alignItems: 'center', gap: 8 },
  empLabel:   { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  btn:        { borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText:    { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
});
