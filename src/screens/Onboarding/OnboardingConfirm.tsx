import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFinance } from '../../state';
import { COLORS, SPACING } from '../../constants';
import { ChatBubble, ProgressIndicator, OptionButton } from '../../components/onboarding';


export const OnboardingConfirm: React.FC = () => {
  const navigation = useNavigation();
  const { updateOnboardingStep, profile, goal, budgets } = useFinance();

  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

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

  const handleComplete = () => {
    updateOnboardingStep(5);
  };

  // Secuencia de "burbujas" animadas
  const steps = [
    {
      key: 'intro',
      render: () => (
        <ChatBubble
          message="¡Perfecto! Aquí está el resumen de tu perfil financiero:"
          isUser={false}
        />
      ),
      canContinue: true,
    },
    {
      key: 'summary',
      render: () => (
        <View style={styles.summaryCard}>
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Perfil Personal</Text>
            <SummaryItem
              label="Tipo de Empleo"
              value={profile?.employmentType || 'No especificado'}
            />
            <SummaryItem
              label="Tipo de Ingreso"
              value={profile?.incomeType || 'No especificado'}
            />
            <SummaryItem
              label="Salario Mensual"
              value={profile ? `$${profile.monthlySalary}` : 'No especificado'}
            />
            <SummaryItem
              label="Preocupación Principal"
              value={profile?.mainFinancialConcern || 'No especificado'}
            />
            <SummaryItem
              label="Moneda"
              value={profile?.currencyPreference || 'No especificado'}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Objetivo Financiero</Text>
            <SummaryItem
              label="Meta Principal"
              value={goal?.title || 'No especificado'}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Presupuesto</Text>
            {budgets && (
              <>
                {Object.entries(budgets).map(([key, value]: any) => (
                  <SummaryItem
                    key={key}
                    label={capitalizeFirst(key)}
                    value={`$${value.limit?.toFixed(2) || 0} (${value.percentage}%)`}
                  />
                ))}
              </>
            )}
          </View>
        </View>
      ),
      canContinue: true,
    },
    {
      key: 'final',
      render: () => (
        <>
          <ChatBubble
            message="Estoy listo para ayudarte a alcanzar tus objetivos financieros. ¡Vamos a empezar!"
            isUser={false}
          />
          <View style={styles.buttonContainer}>
            <OptionButton
              label="Ir al Dashboard"
              onPress={handleComplete}
              variant="primary"
              isSelected={false}
            />
          </View>
          <Text style={styles.noteText}>
            Recuerda: Siempre puedes actualizar tu perfil desde la pantalla de usuario.
          </Text>
        </>
      ),
      canContinue: true,
    },
  ];

  const current = steps[step];

  // Avanzar automáticamente entre intro y resumen
  React.useEffect(() => {
    if (step === 0 || step === 1) {
      const timeout = setTimeout(nextStep, 1200);
      return () => clearTimeout(timeout);
    }
  }, [step]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressContainer}>
        <ProgressIndicator
          currentStep={4}
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
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

interface SummaryItemProps {
  label: string;
  value: string;
}

const SummaryItem: React.FC<SummaryItemProps> = ({ label, value }) => (
  <View style={styles.summaryItem}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
  </View>
);

function getIncomeLabel(level?: string): string {
  const labels: Record<string, string> = {
    bajo: 'Menos de $1000',
    medio: '$1000 - $2500',
    'medio-alto': '$2500 - $5000',
    alto: 'Más de $5000',
  };
  return labels[level || ''] || 'No especificado';
}

function getOccupationLabel(occupation?: string): string {
  const labels: Record<string, string> = {
    empleado: 'Empleado',
    freelancer: 'Freelancer',
    empresario: 'Empresario',
    estudiante: 'Estudiante',
    otro: 'Otro',
  };
  return labels[occupation || ''] || 'No especificado';
}

function getGoalLabel(goal?: string): string {
  const labels: Record<string, string> = {
    emergency: 'Fondo de Emergencia',
    debt: 'Pagar Deudas',
    savings: 'Ahorrar e Invertir',
    purchase: 'Compra Mayor',
    education: 'Educación',
  };
  return labels[goal || ''] || 'No especificado';
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  progressContainer: {
    marginBottom: SPACING.lg,
  },
  summaryCard: {
    backgroundColor: COLORS.background_secondary,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: SPACING.md,
  },
  summarySection: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.gray,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.text_secondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text_primary,
  },
  buttonContainer: {
    marginTop: SPACING.xl,
  },
  completeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
  noteText: {
    fontSize: 12,
    color: COLORS.text_secondary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    fontStyle: 'italic',
  },
});
