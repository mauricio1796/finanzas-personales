import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from 'react-native';

import { ChatBubble } from '../../components/onboarding';

export const OnboardingWelcome: React.FC = () => {
  const navigation = useNavigation();
  const { updateOnboardingStep } = useFinance();
  const [showBubble, setShowBubble] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    setShowBubble(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleStart = () => {
    updateOnboardingStep(1);
    navigation.navigate('OnboardingProfile' as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.progressContainer}>
          <ProgressIndicator
            currentStep={0}
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
        {showBubble && (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              marginTop: 60,
            }}
          >
            <ChatBubble
              message={
                '¡Bienvenido a FinancyAI! Soy tu asistente de inteligencia artificial para ayudarte a organizar y mejorar tus finanzas personales. ¿Listo para comenzar?'
              }
              isUser={false}
            />
            <View style={styles.features}>
              <Text style={styles.featureTitle}>¿Qué puedes hacer aquí?</Text>
              <View>
                <Text style={styles.featureItem}>📊 Análisis inteligente de tus gastos</Text>
                <Text style={styles.featureItem}>🎯 Objetivos personalizados</Text>
                <Text style={styles.featureItem}>🌱 Educación financiera diaria</Text>
                <Text style={styles.featureItem}>🏆 Gamificación y logros</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleStart}
              style={styles.startButton}
              activeOpacity={0.7}
            >
              <Text style={styles.startButtonText}>Comenzar</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
    <View style={styles.featureContent}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

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
    marginBottom: SPACING.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text_primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.text_secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 24,
  },
  features: {
    gap: SPACING.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text_primary,
    marginBottom: SPACING.xs,
  },
  featureDescription: {
    fontSize: 13,
    color: COLORS.text_secondary,
    lineHeight: 18,
  },
  buttonContainer: {
    marginTop: SPACING.xl,
  },
  startButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
