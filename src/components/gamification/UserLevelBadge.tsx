import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SPACING } from '../../constants';
import { THEME } from '../../constants/theme';
import { useTheme } from '../../state/ThemeContext';

interface UserLevelBadgeProps {
  level:         number;
  experience:    number;
  maxExperience: number;
  userName?:     string;
}

const LEVEL_TITLES = ['Novato', 'Aprendiz', 'Especialista', 'Maestro', 'Gurú Financiero'];
const LEVEL_STATIC_COLORS = ['#8B5CF6', '#3B82F6', '#1D9E75', '#F59E0B', '#F55B5B'];

export const UserLevelBadge: React.FC<UserLevelBadgeProps> = ({
  level, experience, maxExperience, userName = 'Usuario',
}) => {
  const { colors } = useTheme();
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    setProgressPercent(Math.min((experience / maxExperience) * 100, 100));
  }, [experience, maxExperience]);

  const levelTitle = LEVEL_TITLES[Math.min(level - 1, 4)];
  const levelColor = LEVEL_STATIC_COLORS[Math.min(level - 1, 4)];
  const experienceToNextLevel = maxExperience - experience;

  return (
    <View style={[styles.container, { backgroundColor: colors.cardSecondary }]}>
      <View style={styles.badgeContainer}>
        <View style={[styles.levelBadge, { backgroundColor: levelColor }, THEME.shadow.card as any]}>
          <Text style={[styles.levelNumber, { color: '#fff' }]}>{level}</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{userName}</Text>
          <Text style={[styles.levelTitle, { color: colors.textSecondary }]}>{levelTitle}</Text>
        </View>
      </View>

      <View style={styles.experienceContainer}>
        <View style={[styles.experienceBar, { backgroundColor: colors.background }]}>
          <View style={[styles.experienceFill, { width: `${progressPercent}%`, backgroundColor: levelColor }]} />
        </View>
        <View style={styles.experienceText}>
          <Text style={[styles.experienceLabel, { color: colors.textPrimary }]}>{experience} / {maxExperience} XP</Text>
          <Text style={[styles.experienceToNext, { color: colors.textSecondary }]}>{experienceToNextLevel} XP para siguiente nivel</Text>
        </View>
      </View>

      <View style={styles.milestoneContainer}>
        <View style={[styles.milestoneItem, { backgroundColor: colors.background }]}>
          <Text style={styles.milestoneIcon}>⭐</Text>
          <View>
            <Text style={[styles.milestoneLabel, { color: colors.textSecondary }]}>Nivel Actual</Text>
            <Text style={[styles.milestoneValue, { color: colors.textPrimary }]}>{level}</Text>
          </View>
        </View>
        <View style={[styles.milestoneItem, { backgroundColor: colors.background }]}>
          <Text style={styles.milestoneIcon}>🏆</Text>
          <View>
            <Text style={[styles.milestoneLabel, { color: colors.textSecondary }]}>Progreso</Text>
            <Text style={[styles.milestoneValue, { color: colors.textPrimary }]}>{progressPercent.toFixed(0)}%</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container:         { borderRadius: THEME.radius.md, padding: SPACING.lg, gap: SPACING.lg },
  badgeContainer:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  levelBadge:        { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  levelNumber:       { fontSize: 28, fontWeight: '700' },
  info:              { flex: 1, gap: SPACING.xs },
  userName:          { fontSize: 14, fontWeight: '700' },
  levelTitle:        { fontSize: 12, fontWeight: '500' },
  experienceContainer:{ gap: SPACING.md },
  experienceBar:     { height: 12, borderRadius: 6, overflow: 'hidden' },
  experienceFill:    { height: '100%', borderRadius: 6 },
  experienceText:    { gap: SPACING.xs },
  experienceLabel:   { fontSize: 12, fontWeight: '600' },
  experienceToNext:  { fontSize: 11 },
  milestoneContainer:{ flexDirection: 'row', gap: SPACING.md },
  milestoneItem:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderRadius: THEME.radius.sm, padding: SPACING.md },
  milestoneIcon:     { fontSize: 20 },
  milestoneLabel:    { fontSize: 11, fontWeight: '500' },
  milestoneValue:    { fontSize: 16, fontWeight: '700', marginTop: 2 },
});
