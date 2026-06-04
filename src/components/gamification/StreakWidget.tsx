import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SPACING } from '../../constants';
import { THEME } from '../../constants/theme';
import { useTheme } from '../../state/ThemeContext';

interface StreakWidgetProps {
  currentStreak:     number;
  bestStreak:        number;
  lastActivityDate?: string;
  onStreakRisk?:     () => void;
}

export const StreakWidget: React.FC<StreakWidgetProps> = ({
  currentStreak, bestStreak, lastActivityDate, onStreakRisk,
}) => {
  const { colors } = useTheme();
  const [isAtRisk, setIsAtRisk] = useState(false);
  const scaleAnim = new Animated.Value(1);

  useEffect(() => { checkStreakRisk(); }, [lastActivityDate]);

  const checkStreakRisk = () => {
    if (!lastActivityDate) return;
    const diffDays = Math.ceil((new Date().getTime() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 1) { setIsAtRisk(true); onStreakRisk?.(); }
  };

  const getDaysUntilBreak = () => {
    if (!lastActivityDate) return 'Inicia hoy';
    const diffDays = Math.ceil((new Date().getTime() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24));
    return `${24 - (diffDays % 24)}h para completar`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.cardSecondary }]}>
      <View style={styles.mainStreak}>
        <Animated.View style={[
          styles.streakBadge,
          {
            transform: [{ scale: scaleAnim }],
            backgroundColor: isAtRisk ? colors.expenseLight : '#FFF7E6',
            borderColor: isAtRisk ? colors.expense : '#F59E0B',
          },
        ]}>
          <Text style={[styles.fireIcon, isAtRisk && { opacity: 0.6 }]}>🔥</Text>
          <Text style={[styles.streakCount, { color: isAtRisk ? colors.expense : '#F59E0B' }]}>{currentStreak}</Text>
        </Animated.View>

        <View style={styles.streakInfo}>
          <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Racha Actual</Text>
          <Text style={[styles.streakDays, { color: isAtRisk ? colors.expense : '#F59E0B' }]}>
            {currentStreak} día{currentStreak !== 1 ? 's' : ''}
          </Text>
          <Text style={[styles.timeRemaining, { color: colors.textSecondary }]}>{getDaysUntilBreak()}</Text>
        </View>

        {isAtRisk && (
          <View style={[styles.warningBadge, { backgroundColor: colors.expenseLight, borderColor: colors.expense }]}>
            <Text style={[styles.warningText, { color: colors.expense }]}>⚠️ RIESGO</Text>
          </View>
        )}
      </View>

      <View style={[styles.bestStreakContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.bestStreakIcon, { backgroundColor: colors.cardSecondary }]}>
          <Text style={styles.trophyIcon}>🏆</Text>
        </View>
        <View>
          <Text style={[styles.bestStreakLabel, { color: colors.textSecondary }]}>Tu Mejor Racha</Text>
          <Text style={styles.bestStreakValue}>{bestStreak} día{bestStreak !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={[
        styles.motivationContainer,
        { backgroundColor: colors.primary + '10', borderLeftColor: colors.primary },
        isAtRisk && { backgroundColor: colors.expenseLight, borderLeftColor: colors.expense },
      ]}>
        <Text style={[styles.motivationText, { color: colors.textPrimary }]}>
          {isAtRisk
            ? '⏰ ¡No pierdas tu racha! Aún hay tiempo hoy para mantenerla.'
            : '💪 ¡Sigue así! Cada día cuenta para tus objetivos.'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container:            { borderRadius: THEME.radius.md, padding: SPACING.lg, gap: SPACING.md },
  mainStreak:           { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  streakBadge:          { width: 80, height: 80, borderRadius: 40, borderWidth: 3, justifyContent: 'center', alignItems: 'center', gap: SPACING.xs },
  fireIcon:             { fontSize: 32 },
  streakCount:          { fontSize: 20, fontWeight: '700' },
  streakInfo:           { flex: 1, gap: SPACING.xs },
  streakLabel:          { fontSize: 12, fontWeight: '500' },
  streakDays:           { fontSize: 16, fontWeight: '700' },
  timeRemaining:        { fontSize: 11, fontStyle: 'italic' },
  warningBadge:         { borderWidth: 1, borderRadius: THEME.radius.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  warningText:          { fontSize: 10, fontWeight: '700' },
  bestStreakContainer:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderRadius: THEME.radius.sm, padding: SPACING.md },
  bestStreakIcon:       { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  trophyIcon:           { fontSize: 20 },
  bestStreakLabel:      { fontSize: 11, fontWeight: '500' },
  bestStreakValue:      { fontSize: 14, fontWeight: '700', color: '#F59E0B', marginTop: 2 },
  motivationContainer:  { borderRadius: THEME.radius.sm, padding: SPACING.md, borderLeftWidth: 4 },
  motivationText:       { fontSize: 12, fontWeight: '500', lineHeight: 18 },
});
