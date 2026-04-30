import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
  ScrollView,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { THEME } from '../constants/theme';

const { height } = Dimensions.get('window');

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  position: 'top' | 'center' | 'bottom';
}

const TUTORIAL_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: '¡Bienvenido a FinancyAi! 🎉',
    description:
      'Te guiaremos a través de los pasos para comenzar a organizar tus finanzas personales de forma inteligente.',
    icon: '💰',
    position: 'center',
  },
  {
    id: 'categories',
    title: '📂 Selecciona tus Categorías',
    description:
      'Elige las categorías que mejor se adapten a tus gastos e ingresos. Puedes usar las predeterminadas o agregar las tuyas propias.',
    icon: '🏷️',
    position: 'top',
  },
  {
    id: 'budget',
    title: '💵 Establece tu Presupuesto',
    description:
      'Asigna un presupuesto mensual a cada categoría. Esto te ayudará a controlar tus gastos y mantener el equilibrio financiero.',
    icon: '📊',
    position: 'top',
  },
  {
    id: 'dashboard',
    title: '📈 Visualiza tu Dashboard',
    description:
      'En el dashboard podrás ver un resumen de tus ingresos, gastos y cómo vas con respecto a tu presupuesto.',
    icon: '🎯',
    position: 'center',
  },
  {
    id: 'track',
    title: '📝 Registra tus Movimientos',
    description:
      'Agrega tus ingresos y gastos diarios. El app los clasificará automáticamente en tus categorías.',
    icon: '✍️',
    position: 'top',
  },
  {
    id: 'ready',
    title: '¡Listo para Comenzar! 🚀',
    description:
      'Ya estás configurado. presiona el botón de abajo para ir a tu dashboard y comenzar a monitorear tus finanzas.',
    icon: '✨',
    position: 'center',
  },
];

interface Props {
  visible: boolean;
  onComplete: () => void;
}

export default function OnboardingTutorial({ visible, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const step = TUTORIAL_STEPS[currentStep];
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(currentStep + 1);
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Pressable style={styles.overlay} onPress={handleSkip} />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.stepCounter}>
            Paso {currentStep + 1} de {TUTORIAL_STEPS.length}
          </ThemedText>
          <Pressable onPress={handleSkip}>
            <ThemedText style={styles.skipButton}>Saltar →</ThemedText>
          </Pressable>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>

        {/* Main Content */}
        <ScrollView contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{step.icon}</Text>
          </View>

          <ThemedText style={styles.title}>{step.title}</ThemedText>
          <ThemedText style={styles.description}>{step.description}</ThemedText>

          {/* Visual Hints */}
          {step.id === 'categories' && (
            <View style={styles.visualHint}>
              <View style={styles.hintBox}>
                <Text style={styles.hintIcon}>✅</Text>
                <ThemedText style={styles.hintText}>Selecciona múltiples categorías</ThemedText>
              </View>
            </View>
          )}

          {step.id === 'budget' && (
            <View style={styles.visualHint}>
              <View style={styles.hintBox}>
                <Text style={styles.hintIcon}>💡</Text>
                <ThemedText style={styles.hintText}>
                  Asigna presupuestos realistas para cada categoría
                </ThemedText>
              </View>
            </View>
          )}

          {step.id === 'dashboard' && (
            <View style={styles.visualHint}>
              <View style={styles.hintBox}>
                <Text style={styles.hintIcon}>📊</Text>
                <ThemedText style={styles.hintText}>
                  Visualiza gráficos y métricas en tiempo real
                </ThemedText>
              </View>
            </View>
          )}

          {step.id === 'track' && (
            <View style={styles.visualHint}>
              <View style={styles.hintBox}>
                <Text style={styles.hintIcon}>🤖</Text>
                <ThemedText style={styles.hintText}>
                  Usa el asistente IA para obtener recomendaciones
                </ThemedText>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => {
              if (currentStep > 0) {
                Animated.timing(fadeAnim, {
                  toValue: 0,
                  duration: 300,
                  useNativeDriver: true,
                }).start(() => {
                  setCurrentStep(currentStep - 1);
                  fadeAnim.setValue(0);
                  Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                  }).start();
                });
              }
            }}
            disabled={currentStep === 0}
          >
            <ThemedText style={styles.buttonSecondaryText}>
              {currentStep === 0 ? '' : '← Atrás'}
            </ThemedText>
          </Pressable>

          <Pressable style={[styles.button, styles.buttonPrimary]} onPress={handleNext}>
            <ThemedText style={styles.buttonPrimaryText}>
              {currentStep === TUTORIAL_STEPS.length - 1 ? '¡Empezar! 🚀' : 'Siguiente →'}
            </ThemedText>
          </Pressable>
        </View>

        {/* Step Indicators */}
        <View style={styles.indicators}>
          {TUTORIAL_STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentStep && styles.indicatorActive,
                index < currentStep && styles.indicatorCompleted,
              ]}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: height * 0.85,
    elevation: 10,
    shadowColor: THEME.colors.textPrimary,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  stepCounter: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  skipButton: {
    fontSize: 14,
    color: THEME.colors.primary,
    fontWeight: '600',
  },
  progressContainer: {
    height: 6,
    backgroundColor: THEME.colors.border,
    marginHorizontal: 0,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: THEME.colors.income,
  },
  mainContent: {
    paddingHorizontal: 24,
    paddingVertical: 30,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: THEME.colors.textSecondary,
    marginBottom: 24,
  },
  visualHint: {
    width: '100%',
    marginTop: 16,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primaryLight,
    borderLeftWidth: 4,
    borderLeftColor: THEME.colors.primary,
    borderRadius: THEME.radius.sm,
    padding: 12,
    gap: 12,
  },
  hintIcon: {
    fontSize: 20,
  },
  hintText: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.textPrimary,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: THEME.colors.income,
  },
  buttonPrimaryText: {
    color: THEME.colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonSecondary: {
    backgroundColor: THEME.colors.surfaceSecondary,
  },
  buttonSecondaryText: {
    color: THEME.colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.border,
  },
  indicatorActive: {
    backgroundColor: THEME.colors.income,
    width: 24,
  },
  indicatorCompleted: {
    backgroundColor: THEME.colors.income,
  },
});
