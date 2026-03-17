import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants';

interface GoalProgressProps {
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  timelineMonths?: number;
  icon?: string;
}

export const GoalProgress: React.FC<GoalProgressProps> = ({
  goalName,
  targetAmount,
  currentAmount,
  timelineMonths = 12,
  icon = '🎯',
}) => {
  const [monthlyTarget, setMonthlyTarget] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const remaining = targetAmount - currentAmount;
    const monthly = remaining / timelineMonths;
    setMonthlyTarget(monthly);

    const progressPercent = (currentAmount / targetAmount) * 100;
    setProgress(Math.min(progressPercent, 100));
  }, [targetAmount, currentAmount, timelineMonths]);

  const remaining = targetAmount - currentAmount;
  const isComplete = remaining <= 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.headerContent}>
          <Text style={styles.goalName}>{goalName}</Text>
          <Text style={styles.progress}>
            {progress.toFixed(0)}% completado
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${progress}%`,
              backgroundColor: isComplete ? '#10B981' : COLORS.primary,
            },
          ]}
        />
      </View>

      {/* Amount Info */}
      <View style={styles.amountContainer}>
        <View>
          <Text style={styles.amountLabel}>Ahorrado</Text>
          <Text style={styles.amountValue}>
            ${currentAmount.toFixed(2)}
          </Text>
        </View>
        <View>
          <Text style={styles.amountLabel}>Meta</Text>
          <Text style={styles.amountValue}>${targetAmount.toFixed(2)}</Text>
        </View>
        <View>
          <Text style={styles.amountLabel}>Falta</Text>
          <Text
            style={[
              styles.amountValue,
              { color: isComplete ? '#10B981' : '#FF6B6B' },
            ]}
          >
            ${Math.max(remaining, 0).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Timeline Info */}
      {!isComplete && (
        <View style={styles.timelineContainer}>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineLabel}>Al mes necesitas</Text>
            <Text style={styles.timelineValue}>
              ${monthlyTarget.toFixed(2)}
            </Text>
          </View>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineLabel}>Meses restantes</Text>
            <Text style={styles.timelineValue}>{timelineMonths}</Text>
          </View>
        </View>
      )}

      {isComplete && (
        <View style={styles.completeContainer}>
          <Text style={styles.completeEmoji}>🎉</Text>
          <Text style={styles.completeText}>¡Objetivo alcanzado!</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardSecondary,
    borderRadius: 12,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  icon: {
    fontSize: 28,
  },
  headerContent: {
    flex: 1,
  },
  goalName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  progress: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  timelineContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  timelineItem: {
    flex: 1,
    gap: SPACING.xs,
  },
  timelineLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  timelineValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  completeContainer: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  completeEmoji: {
    fontSize: 32,
  },
  completeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
});
