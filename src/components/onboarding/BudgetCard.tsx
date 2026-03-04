import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants';

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
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {/* Visual Distribution */}
      <View style={styles.distributionRow}>
        {items.map((item, index) => (
          <View
            key={index}
            style={[
              styles.distributionBar,
              {
                flex: item.percentage,
                backgroundColor: item.color,
              },
            ]}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {items.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: item.color },
              ]}
            />
            <View style={styles.legendContent}>
              <Text style={styles.categoryName}>{item.category}</Text>
              <Text style={styles.categoryAmount}>
                ${item.amount.toFixed(2)} ({item.percentage}%)
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Total */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Presupuesto Total</Text>
        <Text style={styles.totalAmount}>
          ${totalBudget.toFixed(2)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background_secondary,
    borderRadius: 12,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text_primary,
  },
  distributionRow: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    gap: 1,
    backgroundColor: COLORS.gray,
  },
  distributionBar: {
    height: '100%',
  },
  legend: {
    gap: SPACING.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendContent: {
    flex: 1,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text_primary,
  },
  categoryAmount: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginTop: 2,
  },
  totalContainer: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  totalLabel: {
    fontSize: 12,
    color: COLORS.text_secondary,
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
