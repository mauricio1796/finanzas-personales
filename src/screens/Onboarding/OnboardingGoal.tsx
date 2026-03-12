
import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useFinance } from '../../state';
import { COLORS, SPACING } from '../../constants';
import { useTheme } from '../../state/ThemeContext';
import { ChatBubble, OptionButton, ProgressIndicator } from '../../components/onboarding';

const GOALS = [
  {
    id: 'emergency',
    label: 'Fondo de Emergencia',
    description: 'Construir un colchón de 3-6 meses de gastos',
    icon: '🛡️',
  },
  {
    id: 'debt',
    label: 'Pagar Deudas',
    description: 'Eliminar créditos y préstamos',
    icon: '💳',
  },
  {
    id: 'savings',
    label: 'Ahorrar e Invertir',
    description: 'Construir riqueza a largo plazo',
    icon: '📈',
  },
  {
    id: 'purchase',
    label: 'Compra Mayor',
    description: 'Casa, auto o vacaciones',
    icon: '🏠',
  },
  {
    id: 'education',
    label: 'Educación',
    description: 'Cursos, certificaciones o universidad',
    icon: '🎓',
  },
];


export const OnboardingGoal: React.FC = () => {
  const { updateOnboardingStep, setGoal } = useFinance();
  const { colors } = useTheme();

  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    Keyboard.dismiss();
  }, []);

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
  }, [step, fadeAnim, slideAnim]);

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

  const handleSelectGoal = (goalId: string) => {
    if (selectedGoal !== null) return;
    setSelectedGoal(goalId);
    setTimeout(nextStep, 350);
  };

  const handleContinue = () => {
    if (selectedGoal) {
      const goalObj = GOALS.find(g => g.id === selectedGoal);
      setGoal({
        id: Date.now().toString(),
        userId: '1',
        type:
          selectedGoal === 'savings'
            ? 'savings'
            : selectedGoal === 'debt'
            ? 'debt_elimination'
            : selectedGoal === 'emergency'
            ? 'expense_control'
            : selectedGoal === 'purchase'
            ? 'organization'
            : 'investment',
        title: goalObj?.label || '',
        description: goalObj?.description,
        targetAmount: undefined,
        currentAmount: 0,
        deadline: undefined,
        priority: 'medium',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      updateOnboardingStep(3);
    }
  };

  // Secuencia de "burbujas" animadas
  const steps = [
    {
      key: 'goal',
      render: () => (
        <>
          <ChatBubble
            message="¡Excelente! Ahora, ¿cuál es tu objetivo financiero principal?"
            isUser={false}
          />
          <View style={styles.optionsContainer}>
            {GOALS.map(goal => (
              <OptionButton
                key={goal.id}
                label={`${goal.icon}  ${goal.label}`}
                isSelected={selectedGoal === goal.id}
                onPress={() => handleSelectGoal(goal.id)}
                variant="outline"
              />
            ))}
          </View>
        </>
      ),
      canContinue: !!selectedGoal,
    },
    {
      key: 'ai-message',
      render: () => (
        <ChatBubble
          message="Mi IA analizará tu situación actual y crearemos un plan adaptado a tu objetivo."
          isUser={false}
        />
      ),
      canContinue: true,
    },
  ];

  const current = steps[step];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.progressContainer}>
        <ProgressIndicator
          currentStep={2}
          totalSteps={7}
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
        style={{ flex: 1 }}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            marginTop: 40,
          }}
        >
          {current.render()}
          {/* Botón continuar solo si no es la selección de objetivo */}
          {step === steps.length - 1 && (
            <View style={styles.buttonContainer}>
              <OptionButton
                label="Continuar"
                onPress={handleContinue}
                isSelected={false}
                variant="primary"
              />
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
  optionsContainer: {
    marginVertical: SPACING.md,
    gap: SPACING.sm,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  progressContainer: {
    marginBottom: SPACING.lg,
  },
  goalsContainer: {
    marginVertical: SPACING.md,
    gap: SPACING.md,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background_secondary,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.gray,
    gap: SPACING.md,
  },
  goalCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  goalIcon: {
    fontSize: 28,
  },
  goalContent: {
    flex: 1,
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text_primary,
    marginBottom: SPACING.xs,
  },
  goalDescription: {
    fontSize: 12,
    color: COLORS.text_secondary,
    lineHeight: 16,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkIcon: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
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
    backgroundColor: COLORS.gray,
    opacity: 0.5,
  },
  continueButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
