import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { aiService } from '../../services/ai/AIService';
import { SPACING } from '../../constants';
import { THEME } from '../../constants/theme';
import { useTheme } from '../../state/ThemeContext';

export const DailyInsight: React.FC = () => {
  const { colors } = useTheme();
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('low');

  useEffect(() => {
    loadInsight();
  }, []);

  const loadInsight = async () => {
    try {
      setLoading(true);
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
      setInsight('Continúa monitoreando tus gastos para mantener tus finanzas en buen estado.');
    } finally {
      setLoading(false);
    }
  };

  const urgencyConfig = {
    low:    { bgColor: colors.incomeLight,   borderColor: colors.income,   icon: '💡' },
    medium: { bgColor: colors.warning + '20', borderColor: colors.warning,  icon: '⚠️' },
    high:   { bgColor: colors.expenseLight,  borderColor: colors.expense,  icon: '🚨' },
  };

  const config = urgencyConfig[urgency];

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: config.bgColor, borderColor: config.borderColor }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: config.bgColor, borderColor: config.borderColor }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{config.icon}</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Consejo del Día</Text>
      </View>
      <Text style={[styles.insightText, { color: colors.textPrimary }]}>{insight}</Text>
      <View style={styles.timestamp}>
        <Text style={[styles.timestampText, { color: colors.textSecondary }]}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container:     { borderRadius: THEME.radius.md, borderWidth: 1, padding: SPACING.md, gap: SPACING.md },
  header:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  icon:          { fontSize: 20 },
  title:         { fontSize: 14, fontWeight: '700' },
  insightText:   { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  timestamp:     { marginTop: SPACING.sm },
  timestampText: { fontSize: 11, textTransform: 'capitalize' },
});
