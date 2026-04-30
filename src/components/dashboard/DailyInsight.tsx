import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { aiService } from '../../services/ai/AIService';
import { COLORS, SPACING } from '../../constants';
import { THEME } from '../../constants/theme';

interface DailyInsightProps {
  isDarkMode?: boolean;
}

export const DailyInsight: React.FC<DailyInsightProps> = ({
  isDarkMode = false,
}) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('low');

  useEffect(() => {
    loadInsight();
  }, []);

  const loadInsight = async () => {
    try {
      setLoading(true);
      // Call AI service to get daily insight
      // TODO: pasar los argumentos reales necesarios
      const dummyProfile = {
        id: '1',
        userId: '1',
        employmentType: 'employed' as 'employed',
        incomeType: 'fixed' as 'fixed',
        monthlySalary: 0,
        hasDebts: false,
        mainFinancialConcern: '',
        currencyPreference: 'MXN',
        createdAt: '',
        updatedAt: '',
      };
      const dailyInsight = aiService.generateDailyInsight([], dummyProfile, 0);
      setInsight(dailyInsight.message);

      // Determine urgency based on insight (simple logic)
      if (
        dailyInsight.message.toLowerCase().includes('urgente') ||
        dailyInsight.message.toLowerCase().includes('importante')
      ) {
        setUrgency('high');
      } else if (
        dailyInsight.message.toLowerCase().includes('considera') ||
        dailyInsight.message.toLowerCase().includes('recomendación')
      ) {
        setUrgency('medium');
      } else {
        setUrgency('low');
      }
    } catch (error) {
      console.error('Error loading daily insight:', error);
      setInsight(
        'Continúa monitoreando tus gastos para mantener tus finanzas en buen estado.'
      );
    } finally {
      setLoading(false);
    }
  };

  const urgencyConfig = {
    low: {
      bgColor: '#ECFDF5',
      borderColor: THEME.colors.income,
      icon: '💡',
    },
    medium: {
      bgColor: '#FFFBEB',
      borderColor: '#F59E0B',
      icon: '⚠️',
    },
    high: {
      bgColor: '#FEF2F2',
      borderColor: THEME.colors.expense,
      icon: '🚨',
    },
  };

  const config = urgencyConfig[urgency];

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: config.bgColor }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>{config.icon}</Text>
        <Text style={styles.title}>Consejo del Día</Text>
      </View>

      <Text style={styles.insightText}>{insight}</Text>

      <View style={styles.timestamp}>
        <Text style={styles.timestampText}>
          {new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  insightText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
    fontWeight: '500',
  },
  timestamp: {
    marginTop: SPACING.sm,
  },
  timestampText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
});
