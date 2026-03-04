import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING } from '../../constants';

interface AchievementCardProps {
  icon: string;
  title: string;
  description: string;
  isUnlocked: boolean;
  unlockedDate?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  onUnlock?: () => void;
}

const RARITY_CONFIG = {
  common: {
    color: '#6B7280',
    borderColor: '#D1D5DB',
    bgColor: '#F3F4F6',
  },
  rare: {
    color: '#3B82F6',
    borderColor: '#93C5FD',
    bgColor: '#EFF6FF',
  },
  epic: {
    color: '#8B5CF6',
    borderColor: '#D8B4FE',
    bgColor: '#F5F3FF',
  },
  legendary: {
    color: '#F59E0B',
    borderColor: '#FCD34D',
    bgColor: '#FFFBEB',
  },
};

export const AchievementCard: React.FC<AchievementCardProps> = ({
  icon,
  title,
  description,
  isUnlocked,
  unlockedDate,
  rarity,
  onUnlock,
}) => {
  const config = RARITY_CONFIG[rarity];
  const scaleAnim = new Animated.Value(isUnlocked ? 1 : 0.8);

  useEffect(() => {
    if (isUnlocked && onUnlock) {
      onUnlock();
      // Animate unlock
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [isUnlocked]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: scaleAnim }],
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
        },
      ]}
    >
      <View style={styles.badgeContainer}>
        <View
          style={[
            styles.iconContainer,
            isUnlocked && { backgroundColor: config.color },
          ]}
        >
          <Text style={styles.icon}>{icon}</Text>
        </View>

        {isUnlocked && (
          <View style={styles.unlockBadge}>
            <Text style={styles.unlockIcon}>✓</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              !isUnlocked && styles.lockedText,
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.rarity,
              { color: config.color },
            ]}
          >
            {rarity.toUpperCase()}
          </Text>
        </View>

        <Text
          style={[
            styles.description,
            !isUnlocked && styles.lockedDescription,
          ]}
        >
          {description}
        </Text>

        {!isUnlocked && (
          <Text style={styles.lockedLabel}>Bloqueado</Text>
        )}

        {isUnlocked && unlockedDate && (
          <Text style={styles.unlockedDate}>
            Desbloqueado el {unlockedDate}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 2,
    padding: SPACING.md,
    gap: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  badgeContainer: {
    position: 'relative',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
  },
  unlockBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background_secondary,
  },
  unlockIcon: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    gap: SPACING.sm,
  },
  header: {
    gap: SPACING.xs,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text_primary,
  },
  lockedText: {
    color: COLORS.text_secondary,
  },
  rarity: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  description: {
    fontSize: 12,
    color: COLORS.text_secondary,
    lineHeight: 16,
  },
  lockedDescription: {
    color: COLORS.text_secondary,
    opacity: 0.6,
  },
  lockedLabel: {
    fontSize: 10,
    color: COLORS.text_secondary,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  unlockedDate: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '500',
    marginTop: SPACING.xs,
  },
});
