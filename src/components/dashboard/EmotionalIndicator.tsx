import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SPACING } from '../../constants';
import { THEME } from '../../constants/theme';
import { useTheme } from '../../state/ThemeContext';

interface EmotionalIndicatorProps {
  status: 'healthy' | 'warning' | 'critical';
  message?: string;
}

export const EmotionalIndicator: React.FC<EmotionalIndicatorProps> = ({ status, message }) => {
  const { colors } = useTheme();

  const STATUS_CONFIG = {
    healthy: {
      icon: '🟢',
      label: 'Saludable',
      color: colors.income,
      bgColor: colors.incomeLight,
      message: 'Vas muy bien con tus finanzas',
    },
    warning: {
      icon: '🟡',
      label: 'Atención',
      color: colors.warning,
      bgColor: colors.warning + '20',
      message: 'Necesitas revisar algunos gastos',
    },
    critical: {
      icon: '🔴',
      label: 'Crítico',
      color: colors.expense,
      bgColor: colors.expenseLight,
      message: 'Necesitas actuar pronto',
    },
  };

  const config = STATUS_CONFIG[status];

  return (
    <View style={[styles.container, { backgroundColor: config.bgColor }]}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{config.icon}</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message || config.message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flexDirection: 'row', alignItems: 'center', borderRadius: THEME.radius.md, padding: SPACING.md, gap: SPACING.md },
  iconContainer:{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  icon:         { fontSize: 28 },
  content:      { flex: 1, gap: SPACING.xs },
  label:        { fontSize: 14, fontWeight: '700' },
  message:      { fontSize: 12, lineHeight: 16 },
});
