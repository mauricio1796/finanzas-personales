import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, SafeAreaView,
  TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, Keyboard,
} from 'react-native';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { ChatBubble, ProgressIndicator } from '../../components/onboarding';

const fmtCOP = (raw: string) => {
  const num = parseInt(raw.replace(/\./g, ''), 10);
  if (isNaN(num)) return '';
  return num.toLocaleString('es-CO').replace(/,/g, '.');
};

export const OnboardingProfile: React.FC = () => {
  const { updateOnboardingStep, setProfile, profile } = useFinance();
  const { colors } = useTheme();
  const [income, setIncome] = useState('');
  const [focused, setFocused] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const nombre = profile?.mainFinancialConcern ?? 'amigo';

  useEffect(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleContinue = () => {
    Keyboard.dismiss();
    const salario = parseInt(income.replace(/\./g, ''), 10) || 0;
    setProfile({
      ...(profile as any),
      id: profile?.id ?? Date.now().toString(),
      userId: '1',
      employmentType: profile?.employmentType ?? 'employed',
      incomeType: 'fixed',
      monthlySalary: salario,
      hasDebts: false,
      mainFinancialConcern: profile?.mainFinancialConcern ?? '',
      currencyPreference: 'COP',
      createdAt: profile?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    updateOnboardingStep(2);
  };

  const canContinue = income.replace(/\./g, '').length > 0 && parseInt(income.replace(/\./g, ''), 10) > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progress}>
        <ProgressIndicator currentStep={1} totalSteps={5} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <ChatBubble
            message={"Mucho gusto, " + nombre + "! Para ayudarte bien necesito saber con cuanto dinero cuentas cada mes. Cual es tu ingreso mensual aproximado?"}
            isUser={false}
          />
          <View style={styles.inputBlock}>
            <TextInput
              style={[styles.input, { color: colors.text_primary, borderColor: focused ? colors.primary : '#E5E7EB', backgroundColor: '#FFFFFF', borderWidth: focused ? 2 : 1 }]}
              placeholder='Ej: 2.500.000'
              placeholderTextColor='#9CA3AF'
              value={income}
              onChangeText={(txt) => {
                const digits = txt.replace(/\./g, '').replace(/[^0-9]/g, '');
                const num = parseInt(digits, 10);
                setIncome(isNaN(num) ? '' : num.toLocaleString('es-CO').replace(/,/g, '.'));
              }}
              keyboardType='numeric'
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              returnKeyType='done'
              onSubmitEditing={canContinue ? handleContinue : undefined}
              autoFocus
            />
            {income.length > 0 && (
              <Text style={[styles.preview, { color: colors.primary }]}>
                {}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }, !canContinue && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={!canContinue}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>Continuar</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  kav: { flex: 1 },
  progress: { marginBottom: 4 },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 32, gap: 20 },
  inputBlock: { gap: 8 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, fontSize: 22, fontWeight: '700' },
  preview: { fontSize: 13, fontWeight: '600', textAlign: 'right' },
  btn: { paddingVertical: 17, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});