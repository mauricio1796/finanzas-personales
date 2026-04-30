import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BudgetCard, ChatBubble, OptionButton, ProgressIndicator } from '../../components/onboarding';
import { COLORS, SPACING } from '../../constants';
import { THEME } from '../../constants/theme';
import { useTheme } from '../../state/ThemeContext';
import { useFinance } from '../../state';

interface BudgetItem {
  category: string;
  percentage: number;
  amount: number;
  color: string;
}


export const OnboardingBudget: React.FC = () => {
  const { updateOnboardingStep } = useFinance();
  const { colors } = useTheme();

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [monthlyIncome] = useState(2500); // TODO: obtener del perfil si está disponible
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadBudget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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

  const loadBudget = async () => {
    try {
      setIsLoading(true);
      // Generar presupuesto automático usando la regla 50-30-20
      const needs = monthlyIncome * 0.5;
      const wants = monthlyIncome * 0.3;
      const savings = monthlyIncome * 0.2;

      const items: BudgetItem[] = [
        {
          category: 'Necesidades',
          percentage: 50,
          amount: needs,
          color: '#FF6B6B',
        },
        {
          category: 'Deseos',
          percentage: 30,
          amount: wants,
          color: '#4ECDC4',
        },
        {
          category: 'Ahorros',
          percentage: 20,
          amount: savings,
          color: '#95E1D3',
        },
      ];

      setBudgetItems(items);
    } catch (error) {
      console.error('Error loading budget:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = () => {
    updateOnboardingStep(4);
  };

  const handleAdjust = () => {
    // Navegar a pantalla de ajuste (futuro)
  };

  const nextStep = useCallback(() => {
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
  }, [fadeAnim, slideAnim]);

  // Avanzar automáticamente entre intro y presupuesto
  useEffect(() => {
    const shouldAutoAdvance = step === 0 || step === 1;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (shouldAutoAdvance) {
      timeout = setTimeout(nextStep, 1200);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [step, nextStep]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
            Calculando presupuesto...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Secuencia de "burbujas" animadas
  const steps = [
    {
      key: 'intro',
      render: () => (
        <ChatBubble
          message={`Basándome en tu perfil, he creado un presupuesto inicial usando la regla 50-30-20: 50% para necesidades, 30% para deseos y 20% para ahorros.`}
          isUser={false}
        />
      ),
      canContinue: true,
    },
    {
      key: 'budget',
      render: () => (
        <View style={styles.budgetContainer}>
          <BudgetCard
            items={budgetItems}
            totalBudget={monthlyIncome}
            title="Presupuesto Mensual Recomendado"
          />
        </View>
      ),
      canContinue: true,
    },
    {
      key: 'actions',
      render: () => (
        <>
          <ChatBubble
            message="¿Quieres aceptar este presupuesto o ajustarlo según tus necesidades?"
            isUser={false}
          />
          <View style={styles.buttonContainer}>
            <OptionButton
              label="Ajustar"
              onPress={handleAdjust}
              variant="outline"
              isSelected={false}
            />
            <OptionButton
              label="Aceptar"
              onPress={handleAccept}
              variant="primary"
              isSelected={false}
            />
          </View>
        </>
      ),
      canContinue: true,
    },
  ];

  const current = steps[step];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.progressContainer}>
        <ProgressIndicator
          currentStep={3}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  budgetContainer: {
    marginVertical: SPACING.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustButton: {
    flex: 1,
    backgroundColor: COLORS.cardSecondary,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  adjustButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
