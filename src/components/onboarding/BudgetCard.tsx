import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { SPACING } from '../../constants';
import { THEME } from '../../constants/theme';

interface BudgetItem {
  category: string;
  percentage: number;
  amount: number;
  color: string;
}

interface BudgetCardProps {
  items: BudgetItem[];
  totalBudget: number;
  title?: string;
}

export const BudgetCard: React.FC<BudgetCardProps> = ({
  items,
  totalBudget,
  title = 'Distribución Presupuestaria',
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.distributionRow}>
        {items.map((item, index) => (
          <View
            key={index}
            style={[
              styles.distributionBar,
              { flex: item.percentage, backgroundColor: item.color },
              index === 0 && styles.barFirst,
              index === items.length - 1 && styles.barLast,
            ]}
          />
        ))}
      </View>

      <View style={styles.legend}>
        {items.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: item.color }]} />
            <View style={styles.legendContent}>
              <Text style={styles.categoryName}>{item.category}</Text>
              <Text style={styles.categoryAmount}>
                ${item.amount.toFixed(2)} ({item.percentage}%)
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Presupuesto Total</Text>
        <Text style={styles.totalAmount}>${totalBudget.toFixed(2)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: THEME.radius.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    ...THEME.shadow.card,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2E1F',
    letterSpacing: 0.3,
  },
  distributionRow: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 2,
  },
  distributionBar: {
    height: '100%',
  },
  barFirst: {
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
  },
  barLast: {
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  legend: {
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A2E1F',
  },
  categoryAmount: {
    fontSize: 12,
    color: '#4A6B52',
    fontWeight: '600',
  },
  totalContainer: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26,46,31,0.12)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    color: '#4A6B52',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F5A623',
  },
});
