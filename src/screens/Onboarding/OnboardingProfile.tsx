import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFinance } from '../../state';
import { COLORS, SPACING } from '../../constants';
import { ChatBubble, OptionButton, ProgressIndicator } from '../../components/onboarding';

export const OnboardingProfile: React.FC = () => {
  const navigation = useNavigation();
  const { updateOnboardingStep, setProfile } = useFinance();

  // Estados para cada respuesta
  const [answers, setAnswers] = useState({
    employmentType: null as 'employed' | 'student' | 'freelance' | 'business' | 'other' | null,
    incomeType: null as 'fixed' | 'variable' | 'mixed' | null,
    monthlySalary: '',
    mainFinancialConcern: '',
    currencyPreference: 'MXN',
  });
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [isFocused, setIsFocused] = useState(false);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step]);

  const nextStep = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -30,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(s => s + 1);
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
    });
  };

  // Guardar y avanzar al final
  const handleFinish = () => {
    setProfile({
      id: Date.now().toString(),
      userId: '1',
      employmentType: answers.employmentType!,
      incomeType: answers.incomeType!,
      monthlySalary: Number(answers.monthlySalary),
      hasDebts: false,
      mainFinancialConcern: answers.mainFinancialConcern,
      currencyPreference: answers.currencyPreference,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    updateOnboardingStep(2);
    navigation.navigate('OnboardingGoal' as never);
  };

  // Preguntas secuenciales
  const questions = [
    {
      key: 'employmentType',
      render: () => (
        <ChatBubble
          message="¿Cuál es tu situación laboral?"
          isUser={false}
        />
      ),
      options: [
        { label: 'Empleado', value: 'employed' },
        { label: 'Estudiante', value: 'student' },
        { label: 'Freelancer', value: 'freelance' },
        { label: 'Empresario', value: 'business' },
        { label: 'Otro', value: 'other' },
      ],
      onSelect: (val: any) => setAnswers(a => ({ ...a, employmentType: val })),
      selected: answers.employmentType,
    },
    {
      key: 'incomeType',
      render: () => (
        <ChatBubble
          message="¿Tus ingresos son fijos, variables o mixtos?"
          isUser={false}
        />
      ),
      options: [
        { label: 'Fijo', value: 'fixed' },
        { label: 'Variable', value: 'variable' },
        { label: 'Mixto', value: 'mixed' },
      ],
      onSelect: (val: any) => setAnswers(a => ({ ...a, incomeType: val })),
      selected: answers.incomeType,
    },
    {
      key: 'monthlySalary',
      render: () => (
        <ChatBubble
          message="¿Cuánto ganas al mes aproximadamente?"
          isUser={false}
        />
      ),
      input: true,
      value: answers.monthlySalary,
      onChange: (val: string) => setAnswers(a => ({ ...a, monthlySalary: val })),
      placeholder: 'Ej: 2500',
      keyboardType: 'numeric',
    },
    {
      key: 'mainFinancialConcern',
      render: () => (
        <ChatBubble
          message="¿Cuál es tu mayor preocupación financiera?"
          isUser={false}
        />
      ),
      input: true,
      value: answers.mainFinancialConcern,
      onChange: (val: string) => setAnswers(a => ({ ...a, mainFinancialConcern: val })),
      placeholder: 'Ej: Ahorrar para emergencias',
    },
    {
      key: 'currencyPreference',
      render: () => (
        <ChatBubble
          message="¿Con qué moneda prefieres trabajar? (Ej: MXN, USD, EUR)"
          isUser={false}
        />
      ),
      input: true,
      value: answers.currencyPreference,
      onChange: (val: string) => setAnswers(a => ({ ...a, currencyPreference: val })),
      placeholder: 'Ej: MXN',
    },
  ];

  const current = questions[step];
  const canContinue =
    (current?.input && current.value && current.value.length > 0) ||
    (current?.options && current.selected);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressContainer}>
        <ProgressIndicator
          currentStep={1}
          totalSteps={6}
          stepLabels={[
            'Bienvenida',
            'Perfil',
            'Objetivo',
            'Presupuesto',
            'Confirmación',
            'Dashboard',
          ]}
        />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            marginTop: 40,
          }}
        >
          {current.render()}
          {current.options && (
            <View style={styles.optionsContainer}>
              {current.options.map(opt => (
                <OptionButton
                  key={opt.value}
                  label={opt.label}
                  isSelected={current.selected === opt.value}
                  onPress={() => {
                    current.onSelect(opt.value);
                    setTimeout(nextStep, 350);
                  }}
                />
              ))}
            </View>
          )}
          {current.input && (
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  isFocused && styles.inputFocused,
                ]}
                placeholder={current.placeholder}
                placeholderTextColor={COLORS.text_secondary}
                value={current.value}
                onChangeText={current.onChange}
                keyboardType={current.keyboardType as any || 'default'}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoFocus
              />
              <TouchableOpacity
                onPress={nextStep}
                disabled={!canContinue}
                style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
                activeOpacity={0.7}
              >
                <Text style={styles.continueButtonText}>Siguiente</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Último paso: botón finalizar */}
          {step === questions.length - 1 && !current.options && !current.input && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={handleFinish}
                style={styles.continueButton}
                activeOpacity={0.7}
              >
                <Text style={styles.continueButtonText}>Finalizar</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  progressContainer: {
    marginBottom: SPACING.lg,
  },
  inputContainer: {
    marginVertical: SPACING.md,
    gap: SPACING.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text_primary,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.text_primary,
    fontSize: 14,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  optionsContainer: {
    marginVertical: SPACING.md,
    gap: SPACING.sm,
  },
  buttonContainer: {
    marginTop: SPACING.xl,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: COLORS.primary,
    opacity: 0.5,
  },
  continueButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
