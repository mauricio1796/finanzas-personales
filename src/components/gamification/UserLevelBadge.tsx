import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants';
import { THEME } from '../../constants/theme';

interface UserLevelBadgeProps {
  level: number;
  experience: number;
  maxExperience: number;
  userName?: string;
}

const LEVEL_TITLES = [
  'Novato',
  'Aprendiz',
  'Especialista',
  'Maestro',
  'Gurú Financiero',
];

const LEVEL_COLORS = [
  '#8B5CF6',
  '#3B82F6',
  THEME.colors.income,
  '#F59E0B',
  THEME.colors.expense,
];

export const UserLevelBadge: React.FC<UserLevelBadgeProps> = ({
  level,
  experience,
  maxExperience,
  userName = 'Usuario',
}) => {
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    const progress = (experience / maxExperience) * 100;
    setProgressPercent(Math.min(progress, 100));
  }, [experience, maxExperience]);

  const levelTitle = LEVEL_TITLES[Math.min(level - 1, 4)];
  const levelColor = LEVEL_COLORS[Math.min(level - 1, 4)];
  const experienceToNextLevel = maxExperience - experience;

  return (
    <View style={styles.container}>
      {/* Level Badge */}
      <View style={styles.badgeContainer}>
        <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
          <Text style={styles.levelNumber}>{level}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.levelTitle}>{levelTitle}</Text>
        </View>
      </View>

      {/* Experience Bar */}
      <View style={styles.experienceContainer}>
        <View style={styles.experienceBar}>
          <View
            style={[
              styles.experienceFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: levelColor,
              },
            ]}
          />
        </View>
        <View style={styles.experienceText}>
          <Text style={styles.experienceLabel}>
            {experience} / {maxExperience} XP
          </Text>
          <Text style={styles.experienceToNext}>
            {experienceToNextLevel} XP para siguiente nivel
          </Text>
        </View>
      </View>

      {/* Milestone Info */}
      <View style={styles.milestoneContainer}>
        <View style={styles.milestoneItem}>
          <Text style={styles.milestoneIcon}>⭐</Text>
          <View>
            <Text style={styles.milestoneLabel}>Nivel Actual</Text>
            <Text style={styles.milestoneValue}>{level}</Text>
          </View>
        </View>
        <View style={styles.milestoneItem}>
          <Text style={styles.milestoneIcon}>🏆</Text>
          <View>
            <Text style={styles.milestoneLabel}>Progreso</Text>
            <Text style={styles.milestoneValue}>
              {progressPercent.toFixed(0)}%
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardSecondary,
    borderRadius: THEME.radius.md,
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  levelBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadow.card,
  },
  levelNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.background,
  },
  info: {
    flex: 1,
    gap: SPACING.xs,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  levelTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  experienceContainer: {
    gap: SPACING.md,
  },
  experienceBar: {
    height: 12,
    backgroundColor: COLORS.background,
    borderRadius: 6,
    overflow: 'hidden',
  },
  experienceFill: {
    height: '100%',
    borderRadius: 6,
  },
  experienceText: {
    gap: SPACING.xs,
  },
  experienceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  experienceToNext: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  milestoneContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  milestoneItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: THEME.radius.sm,
    padding: SPACING.md,
  },
  milestoneIcon: {
    fontSize: 20,
  },
  milestoneLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  milestoneValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
});
