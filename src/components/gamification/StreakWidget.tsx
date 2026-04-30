import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { COLORS, SPACING } from '../../constants';
import { THEME } from '../../constants/theme';

interface StreakWidgetProps {
  currentStreak: number;
  bestStreak: number;
  lastActivityDate?: string;
  onStreakRisk?: () => void;
}

export const StreakWidget: React.FC<StreakWidgetProps> = ({
  currentStreak,
  bestStreak,
  lastActivityDate,
  onStreakRisk,
}) => {
  const [isAtRisk, setIsAtRisk] = useState(false);
  const scaleAnim = new Animated.Value(1);

  useEffect(() => {
    checkStreakRisk();
  }, [lastActivityDate]);

  const checkStreakRisk = () => {
    if (!lastActivityDate) return;

    const lastDate = new Date(lastActivityDate);
    const today = new Date();
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 1) {
      setIsAtRisk(true);
      onStreakRisk?.();
    }
  };

  const animateStreak = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getDaysUntilBreak = () => {
    if (!lastActivityDate) return 'Inicia hoy';
    const lastDate = new Date(lastActivityDate);
    const today = new Date();
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const hoursLeft = 24 - (diffDays % 24);
    return `${hoursLeft}h para completar`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.mainStreak}>
        <Animated.View
          style={[
            styles.streakBadge,
            {
              transform: [{ scale: scaleAnim }],
              backgroundColor: isAtRisk ? '#FEF2F2' : '#FFF7E6',
              borderColor: isAtRisk ? THEME.colors.expense : '#F59E0B',
            },
          ]}
        >
          <Text
            style={[
              styles.fireIcon,
              isAtRisk && { opacity: 0.6 },
            ]}
          >
            🔥
          </Text>
          <Text
            style={[
              styles.streakCount,
              isAtRisk && styles.streakAtRisk,
            ]}
          >
            {currentStreak}
          </Text>
        </Animated.View>

        <View style={styles.streakInfo}>
          <Text style={styles.streakLabel}>Racha Actual</Text>
          <Text
            style={[
              styles.streakDays,
              { color: isAtRisk ? THEME.colors.expense : '#F59E0B' },
            ]}
          >
            {currentStreak} día{currentStreak !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.timeRemaining}>
            {getDaysUntilBreak()}
          </Text>
        </View>

        {isAtRisk && (
          <View style={styles.warningBadge}>
            <Text style={styles.warningText}>⚠️ RIESGO</Text>
          </View>
        )}
      </View>

      {/* Best Streak */}
      <View style={styles.bestStreakContainer}>
        <View style={styles.bestStreakIcon}>
          <Text style={styles.trophyIcon}>🏆</Text>
        </View>
        <View>
          <Text style={styles.bestStreakLabel}>Tu Mejor Racha</Text>
          <Text style={styles.bestStreakValue}>
            {bestStreak} día{bestStreak !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Motivation */}
      <View
        style={[
          styles.motivationContainer,
          isAtRisk && styles.motivationRisk,
        ]}
      >
        <Text style={styles.motivationText}>
          {isAtRisk
            ? '⏰ ¡No pierdas tu racha! Aún hay tiempo hoy para mantenerla.'
            : '💪 ¡Sigue así! Cada día cuenta para tus objetivos.'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardSecondary,
    borderRadius: THEME.radius.md,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  mainStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  streakBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  fireIcon: {
    fontSize: 32,
  },
  streakCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F59E0B',
  },
  streakAtRisk: {
    color: THEME.colors.expense,
  },
  streakInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  streakLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  streakDays: {
    fontSize: 16,
    fontWeight: '700',
  },
  timeRemaining: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  warningBadge: {
    backgroundColor: '#FEF2F2',
    borderColor: THEME.colors.expense,
    borderWidth: 1,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  warningText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.expense,
  },
  bestStreakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: THEME.radius.sm,
    padding: SPACING.md,
  },
  bestStreakIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trophyIcon: {
    fontSize: 20,
  },
  bestStreakLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  bestStreakValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
    marginTop: SPACING.xs,
  },
  motivationContainer: {
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: THEME.radius.sm,
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  motivationRisk: {
    backgroundColor: '#FEF2F2',
    borderLeftColor: THEME.colors.expense,
  },
  motivationText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '500',
    lineHeight: 18,
  },
});
