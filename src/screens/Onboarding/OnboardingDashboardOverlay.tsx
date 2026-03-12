import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useFinance } from '../../state';
import { COLORS, SPACING } from '../../constants';
import { ChatBubble } from '../../components/onboarding';

interface OnboardingDashboardOverlayProps {
  visible: boolean;
  onComplete: () => void;
}

export const OnboardingDashboardOverlay: React.FC<OnboardingDashboardOverlayProps> = ({
  visible,
  onComplete,
}) => {
  const { width } = useWindowDimensions();
  const { setIsOnboarded, updateOnboardingStep } = useFinance();
  const isSmallScreen = width < 768;

  const handleComplete = () => {
    updateOnboardingStep(6);
    setIsOnboarded(true);
    onComplete();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={[
          styles.container,
          isSmallScreen && styles.containerMobile,
        ]}>
          <View style={styles.content}>
            <ChatBubble
              message="¡Excelente! Tu Dashboard está listo. Aquí podrás ver un resumen completo de tus finanzas, gastos, ingresos y el progreso de tus objetivos."
              isUser={false}
            />

            <View style={styles.featuresList}>
              <FeatureItem
                icon="📊"
                title="Análisis en Tiempo Real"
                description="Visualiza tus gastos e ingresos al momento"
              />
              <FeatureItem
                icon="📈"
                title="Presupuesto Inteligente"
                description="Controla tu distribución 50-30-20"
              />
              <FeatureItem
                icon="🎯"
                title="Seguimiento de Objetivos"
                description="Monitorea el progreso de tus metas"
              />
              <FeatureItem
                icon="🤖"
                title="Asistente IA"
                description="Obtén recomendaciones personalizadas"
              />
            </View>

            <ChatBubble
              message="¡Tu perfil financiero está listo! Ahora crea tu cuenta para guardar todos tus datos y acceder a la app."
              isUser={false}
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={handleComplete}
                style={styles.completeButton}
                activeOpacity={0.7}
              >
                <Text style={styles.completeButtonText}>Crear Cuenta y Empezar →</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.tipsText}>
              🔒 Tu información financiera se guarda de forma segura en tu cuenta.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({
  icon,
  title,
  description,
}) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <View style={styles.featureText}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  containerMobile: {
    borderRadius: 16,
    padding: SPACING.md,
  },
  content: {
    gap: SPACING.lg,
  },
  featuresList: {
    gap: SPACING.md,
    marginVertical: SPACING.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.background_secondary,
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text_primary,
  },
  featureDescription: {
    fontSize: 12,
    color: COLORS.text_secondary,
    lineHeight: 16,
  },
  buttonContainer: {
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  completeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  tipsText: {
    fontSize: 12,
    color: COLORS.text_secondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: SPACING.md,
  },
});
