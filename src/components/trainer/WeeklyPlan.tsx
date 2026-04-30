import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { THEME } from '../../constants/theme';

interface Challenge {
  id: string;
  title: string;
  description: string;
  rewardXP: number;
  completed: boolean;
  icon: string;
}

interface WeeklyPlanProps {
  challenges: Challenge[];
  weekNumber: number;
  totalXP?: number;
}

export const WeeklyPlan: React.FC<WeeklyPlanProps> = ({
  challenges,
  weekNumber,
  totalXP = 0,
}) => {
  const [completedCount, setCompletedCount] = useState(0);
  const [totalRewardXP, setTotalRewardXP] = useState(0);

  useEffect(() => {
    const completed = challenges.filter((c) => c.completed).length;
    setCompletedCount(completed);

    const totalXP = challenges.reduce((sum, c) => sum + c.rewardXP, 0);
    setTotalRewardXP(totalXP);
  }, [challenges]);

  const completionPercent = (completedCount / challenges.length) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Plan Semanal</Text>
          <Text style={styles.weekLabel}>Semana {weekNumber}</Text>
        </View>
        <View style={styles.xpBadge}>
          <Text style={styles.xpLabel}>XP</Text>
          <Text style={styles.xpValue}>{totalXP + totalRewardXP}</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressLabel}>Completadas</Text>
          <Text style={styles.progressCount}>
            {completedCount} de {challenges.length}
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${completionPercent}%` },
            ]}
          />
        </View>
      </View>

      {/* Challenges */}
      <ScrollView style={styles.challengesScroll}>
        {challenges.map((challenge) => (
          <View
            key={challenge.id}
            style={[
              styles.challengeCard,
              challenge.completed && styles.challengeCompleted,
            ]}
          >
            <View style={styles.challengeIcon}>
              <Text style={styles.icon}>{challenge.icon}</Text>
            </View>

            <View style={styles.challengeContent}>
              <Text
                style={[
                  styles.challengeTitle,
                  challenge.completed && styles.challengeCompletedText,
                ]}
              >
                {challenge.title}
              </Text>
              <Text style={styles.challengeDescription}>
                {challenge.description}
              </Text>
            </View>

            <View style={styles.challengeReward}>
              {challenge.completed ? (
                <Text style={styles.completedCheckmark}>✓</Text>
              ) : (
                <View style={styles.xpReward}>
                  <Text style={styles.xpRewardText}>
                    +{challenge.rewardXP}
                  </Text>
                  <Text style={styles.xpLabel}>XP</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Motivation */}
      <View style={styles.motivationContainer}>
        <Text style={styles.motivationText}>
          {completedCount === challenges.length
            ? '🎉 ¡Completaste la semana! Sigue así, eres increíble.'
            : `💪 Completa ${challenges.length - completedCount} desafío${
                challenges.length - completedCount > 1 ? 's' : ''
              } más esta semana.`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: THEME.radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  weekLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  xpBadge: {
    backgroundColor: Colors.primary,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  xpLabel: {
    fontSize: 10,
    color: Colors.background,
    fontWeight: '600',
  },
  xpValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  progressContainer: {
    gap: Spacing.sm,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  progressCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  challengesScroll: {
    maxHeight: 300,
  },
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: THEME.radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  challengeCompleted: {
    backgroundColor: `${THEME.colors.income}10`,
    borderColor: THEME.colors.income,
  },
  challengeIcon: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.sm,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
  challengeContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  challengeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  challengeCompletedText: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
  },
  challengeDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  challengeReward: {
    alignItems: 'center',
  },
  completedCheckmark: {
    fontSize: 24,
    color: THEME.colors.income,
    fontWeight: '700',
  },
  xpReward: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  xpRewardText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  motivationContainer: {
    backgroundColor: `${Colors.primary}10`,
    borderRadius: THEME.radius.sm,
    padding: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  motivationText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
    lineHeight: 18,
  },
});
