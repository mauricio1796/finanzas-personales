import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform, SafeAreaView, StyleSheet,
  Text,
  TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { ProgressIndicator } from '../../components/onboarding';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';

export const OnboardingWelcome: React.FC = () => {
  const { updateOnboardingStep, setProfile } = useFinance();
  const { colors } = useTheme();
  const [nombre, setNombre] = useState('');
  const [focused, setFocused] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.14, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1800, useNativeDriver: true }),
      ])
    ).start();
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, delay: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleContinue = () => {
    Keyboard.dismiss();
    setProfile({
      id: Date.now().toString(),
      userId: '1',
      employmentType: 'employed',
      incomeType: 'fixed',
      monthlySalary: 0,
      hasDebts: false,
      mainFinancialConcern: nombre.trim(),
      currencyPreference: 'COP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    updateOnboardingStep(1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressIndicator currentStep={0} totalSteps={5} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <View style={styles.inner}>
          <View style={styles.orbArea}>
            <Animated.View style={[styles.orbRing, { borderColor: colors.primary, transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.orb, { backgroundColor: colors.primary, transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.orbSymbol}>{String.fromCharCode(9672)}</Text>
            </Animated.View>
          </View>
          <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={[styles.brand, { color: colors.primary }]}>FinancyAI</Text>
            <Text style={[styles.headline, { color: colors.text_primary }]}>{'Nunca mas olvides un pago'}</Text>
            <Text style={[styles.subtitle, { color: colors.text_secondary }]}>
              {'Soy Finn, tu asistente de pagos. Te ayudo a organizar todos tus compromisos financieros.'}
            </Text>
            <View style={styles.inputBlock}>
              <Text style={[styles.inputLabel, { color: colors.text_secondary }]}>Hola, como te llamas?</Text>
              <TextInput
                style={[styles.input, { color: colors.text_primary, borderColor: focused ? colors.primary : '#E5E7EB', backgroundColor: '#FFFFFF', borderWidth: focused ? 2 : 1 }]}
                placeholder='Tu nombre...'
                placeholderTextColor='#9CA3AF'
                value={nombre}
                onChangeText={setNombre}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                returnKeyType='done'
                onSubmitEditing={nombre.trim().length > 0 ? handleContinue : undefined}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: colors.primary }, !nombre.trim() && styles.ctaDisabled]}
              onPress={handleContinue}
              disabled={!nombre.trim()}
              activeOpacity={0.82}
            >
              <Text style={styles.ctaText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  kav: { flex: 1 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 28 },
  orbArea: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  orbRing: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1.5, opacity: 0.35 },
  orb: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  orbSymbol: { fontSize: 32, color: '#fff', fontWeight: '700' },
  content: { width: '100%', gap: 14, alignItems: 'stretch' },
  brand: { fontSize: 12, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', textAlign: 'center' },
  headline: { fontSize: 34, fontWeight: '800', lineHeight: 42, textAlign: 'center', letterSpacing: -0.8 },
  subtitle: { fontSize: 14, lineHeight: 22, textAlign: 'center', fontWeight: '400' },
  inputBlock: { gap: 8, marginTop: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600' },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontWeight: '500' },
  cta: { paddingVertical: 17, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 17, fontWeight: '700', letterSpacing: 0.2, color: '#FFFFFF' },
});