import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { FinanceContext } from '@/core/context/FinanceContext';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import {
  AchievementCard,
  UserLevelBadge,
} from '@/components/gamification';

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  isUnlocked: boolean;
  unlockedDate?: string;
}

const ALL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_expense',
    icon: '💰',
    title: 'Primer Gasto',
    description: 'Registra tu primer gasto en la aplicación',
    rarity: 'common',
    isUnlocked: true,
    unlockedDate: '2024-01-15',
  },
  {
    id: 'budget_hero',
    icon: '📊',
    title: 'Héroe del Presupuesto',
    description: 'Mantén tu presupuesto bajo control durante un mes completo',
    rarity: 'rare',
    isUnlocked: false,
  },
  {
    id: 'savings_champion',
    icon: '🏆',
    title: 'Campeón de Ahorros',
    description: 'Ahorra 30% de tus ingresos durante 3 meses consecutivos',
    rarity: 'epic',
    isUnlocked: false,
  },
  {
    id: 'financial_genius',
    icon: '🧠',
    title: 'Genio Financiero',
    description: 'Alcanza el nivel máximo en la aplicación',
    rarity: 'legendary',
    isUnlocked: false,
  },
  {
    id: 'early_bird',
    icon: '🌅',
    title: 'Madrugador',
    description: 'Registra un gasto antes de las 8 AM durante 7 días seguidos',
    rarity: 'common',
    isUnlocked: true,
    unlockedDate: '2024-01-20',
  },
  {
    id: 'weekend_warrior',
    icon: '⚔️',
    title: 'Guerrero del Fin de Semana',
    description: 'Completa tu presupuesto sin superar límites un fin de semana completo',
    rarity: 'common',
    isUnlocked: false,
  },
  {
    id: 'debt_slayer',
    icon: '🗡️',
    title: 'Cazador de Deudas',
    description: 'Paga una deuda completamente',
    rarity: 'rare',
    isUnlocked: false,
  },
  {
    id: 'investment_guru',
    icon: '📈',
    title: 'Gurú de Inversiones',
    description: 'Invierte por primera vez a través de la aplicación',
    rarity: 'epic',
    isUnlocked: false,
  },
];

export const MyAchievements: React.FC = () => {
  const { financeState } = useContext(FinanceContext);
  const [achievements, setAchievements] = useState<Achievement[]>(ALL_ACHIEVEMENTS);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;
  const totalCount = achievements.length;
  const completionPercent = (unlockedCount / totalCount) * 100;

  const filteredAchievements = achievements.filter((a) => {
    if (filter === 'unlocked') return a.isUnlocked;
    if (filter === 'locked') return !a.isUnlocked;
    return true;
  });

  const handleUnlock = () => {
    Animated.spring(fadeAnim, {
      toValue: 1.1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Logros</Text>
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Desbloqueados</Text>
              <Text style={styles.statValue}>
                {unlockedCount}/{totalCount}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Progreso</Text>
              <Text style={styles.statValue}>
                {completionPercent.toFixed(0)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${completionPercent}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(totalCount - unlockedCount)} por desbloquear
          </Text>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <FilterButton
            label="Todos"
            isActive={filter === 'all'}
            onPress={() => setFilter('all')}
            emoji="🎯"
          />
          <FilterButton
            label="Desbloqueados"
            isActive={filter === 'unlocked'}
            onPress={() => setFilter('unlocked')}
            emoji="✓"
          />
          <FilterButton
            label="Bloqueados"
            isActive={filter === 'locked'}
            onPress={() => setFilter('locked')}
            emoji="🔒"
          />
        </View>

        {/* Achievements Grid */}
        <View style={styles.achievementsContainer}>
          {filteredAchievements.map((achievement) => (
            <AchievementCard
              key={achievement.id}
              icon={achievement.icon}
              title={achievement.title}
              description={achievement.description}
              isUnlocked={achievement.isUnlocked}
              unlockedDate={achievement.unlockedDate}
              rarity={achievement.rarity}
              onUnlock={handleUnlock}
            />
          ))}
        </View>

        {/* Empty State */}
        {filteredAchievements.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔒</Text>
            <Text style={styles.emptyText}>
              No hay logros {filter !== 'all' ? 'en esta categoría' : 'aún'}
            </Text>
          </View>
        )}

        {/* Rarity Info */}
        <View style={styles.rarityInfoContainer}>
          <Text style={styles.rarityTitle}>Rareza de Logros</Text>
          <RarityBadge
            label="Común"
            color="#6B7280"
            example="Fácil de desbloquear"
          />
          <RarityBadge
            label="Raro"
            color="#3B82F6"
            example="Requiere esfuerzo"
          />
          <RarityBadge
            label="Épico"
            color="#8B5CF6"
            example="Muy desafiante"
          />
          <RarityBadge
            label="Legendario"
            color="#F59E0B"
            example="Extremadamente difícil"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

interface FilterButtonProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  emoji: string;
}

const FilterButton: React.FC<FilterButtonProps> = ({
  label,
  isActive,
  onPress,
  emoji,
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.filterButton,
      isActive && styles.filterButtonActive,
    ]}
    activeOpacity={0.7}
  >
    <Text style={styles.filterEmoji}>{emoji}</Text>
    <Text
      style={[
        styles.filterLabel,
        isActive && styles.filterLabelActive,
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

interface RarityBadgeProps {
  label: string;
  color: string;
  example: string;
}

const RarityBadge: React.FC<RarityBadgeProps> = ({
  label,
  color,
  example,
}) => (
  <View style={styles.rarityItem}>
    <View style={[styles.rarityDot, { backgroundColor: color }]} />
    <View style={styles.rarityContent}>
      <Text style={styles.rarityLabel}>{label}</Text>
      <Text style={styles.rarityExample}>{example}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stat: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  progressContainer: {
    gap: Spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterEmoji: {
    fontSize: 16,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  filterLabelActive: {
    color: Colors.background,
  },
  achievementsContainer: {
    gap: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  rarityInfoContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  rarityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  rarityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rarityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  rarityContent: {
    flex: 1,
  },
  rarityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  rarityExample: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
