import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants';

interface EmotionalIndicatorProps {
  status: 'healthy' | 'warning' | 'critical';
  message?: string;
}

const STATUS_CONFIG = {
  healthy: {
    icon: '🟢',
    label: 'Saludable',
    color: '#10B981',
    bgColor: '#ECFDF5',
    message: 'Vas muy bien con tus finanzas',
  },
  warning: {
    icon: '🟡',
    label: 'Atención',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    message: 'Necesitas revisar algunos gastos',
  },
  critical: {
    icon: '🔴',
    label: 'Crítico',
    color: '#EF4444',
    bgColor: '#FEF2F2',
    message: 'Necesitas actuar pronto',
  },
};

export const EmotionalIndicator: React.FC<EmotionalIndicatorProps> = ({
  status,
  message,
}) => {
  const config = STATUS_CONFIG[status];

  return (
    <View style={[styles.container, { backgroundColor: config.bgColor }]}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{config.icon}</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, { color: config.color }]}>
          {config.label}
        </Text>
        <Text style={styles.message}>{message || config.message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 28,
  },
  icon: {
    fontSize: 28,
  },
  content: {
    flex: 1,
    gap: SPACING.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 12,
    color: COLORS.text_secondary,
    lineHeight: 16,
  },
});
