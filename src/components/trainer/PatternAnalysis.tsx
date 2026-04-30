import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { THEME } from '../../constants/theme';

interface CategoryAnalysis {
  category: string;
  amount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  icon: string;
}

interface PatternAnalysisProps {
  categories: CategoryAnalysis[];
  monthComparison?: {
    current: number;
    previous: number;
  };
}

export const PatternAnalysis: React.FC<PatternAnalysisProps> = ({
  categories,
  monthComparison,
}) => {
  const [sortedCategories, setSortedCategories] = useState<CategoryAnalysis[]>(
    []
  );

  useEffect(() => {
    // Sort by amount descending
    const sorted = [...categories].sort((a, b) => b.amount - a.amount);
    setSortedCategories(sorted);
  }, [categories]);

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return '📈';
      case 'down':
        return '📉';
      case 'stable':
        return '➡️';
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return THEME.colors.expense;
      case 'down':
        return THEME.colors.income;
      case 'stable':
        return Colors.textSecondary;
    }
  };

  const monthComparisonPercent = monthComparison
    ? ((monthComparison.current - monthComparison.previous) /
        monthComparison.previous) *
      100
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Análisis de Patrones</Text>
      </View>

      {monthComparison && (
        <View style={styles.comparisonContainer}>
          <Text style={styles.comparisonLabel}>Comparación Mensual</Text>
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonMonth}>Este mes</Text>
              <Text style={styles.comparisonAmount}>
                ${monthComparison.current.toFixed(2)}
              </Text>
            </View>
            <View style={styles.comparisonArrow}>
              <Text
                style={[
                  styles.comparisonTrend,
                  {
                    color: getTrendColor(
                      monthComparisonPercent > 0 ? 'up' : 'down'
                    ),
                  },
                ]}
              >
                {monthComparisonPercent > 0 ? '+' : ''}{monthComparisonPercent.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonMonth}>Mes anterior</Text>
              <Text style={styles.comparisonAmount}>
                ${monthComparison.previous.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      <ScrollView style={styles.categoriesScroll}>
        {sortedCategories.map((category, index) => (
          <View key={index} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryLeft}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <View>
                  <Text style={styles.categoryName}>{category.category}</Text>
                  <Text style={styles.categoryAmount}>
                    ${category.amount.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.categoryRight}>
                <Text style={styles.categoryPercentage}>
                  {category.percentage}%
                </Text>
                <Text
                  style={[
                    styles.trend,
                    { color: getTrendColor(category.trend) },
                  ]}
                >
                  {getTrendIcon(category.trend)} {Math.abs(category.changePercent)}%
                </Text>
              </View>
            </View>

            <View style={styles.categoryBar}>
              <View
                style={[
                  styles.categoryBarFill,
                  {
                    width: `${category.percentage}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </ScrollView>
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
    gap: Spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  comparisonContainer: {
    backgroundColor: Colors.background,
    borderRadius: THEME.radius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  comparisonLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  comparisonItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  comparisonMonth: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  comparisonAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  comparisonArrow: {
    alignItems: 'center',
  },
  comparisonTrend: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoriesScroll: {
    maxHeight: 400,
  },
  categoryCard: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  categoryIcon: {
    fontSize: 24,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryAmount: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  categoryRight: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  categoryPercentage: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  trend: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryBar: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: THEME.radius.sm / 2,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
});
