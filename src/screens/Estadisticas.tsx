import React, { useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  useWindowDimensions,
  FlatList,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Transaction, calculateTotalExpenses, expensesByCategory } from '@/src/core/financeEngine';
import { useFinance } from '@/src/core/context/FinanceContext';
import FinanceDonutChart from '@/src/components/FinanceDonutChart';

interface EstadisticasProps {
  transactions: Transaction[];
  monthlySalary: number;
}

export function Estadisticas({ transactions, monthlySalary }: EstadisticasProps) {
  const { width } = useWindowDimensions();
  const { categories } = useFinance();
  const isSmallScreen = width < 768;

  const stats = useMemo(() => {
    const expenseByCategory = expensesByCategory(transactions);
    const totalExpenses = calculateTotalExpenses(transactions);
    const expenses = transactions.filter(t => t.type === 'expense');
    
    const today = new Date();
    const thisMonth = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === today.getMonth() && tDate.getFullYear() === today.getFullYear();
    });

    const thisMonthExpenses = calculateTotalExpenses(thisMonth);
    const spendingPercentage = monthlySalary > 0 ? (thisMonthExpenses / monthlySalary) * 100 : 0;

    return {
      totalExpenses,
      expenseByCategory,
      spendingPercentage,
      thisMonthExpenses,
      averageExpense: expenses.length > 0 ? totalExpenses / expenses.length : 0,
      transactionCount: expenses.length,
    };
  }, [transactions, monthlySalary]);

  const chartData = useMemo(() => {
    const total = Object.values(stats.expenseByCategory).reduce((sum, val) => sum + val, 0);
    if (total === 0) return [];

    return Object.entries(stats.expenseByCategory).map(([catId, amount]) => ({
      categoryId: catId,
      value: (amount / total) * 100,
      amount,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    }));
  }, [stats]);

  const topCategories = useMemo(() => {
    return Object.entries(stats.expenseByCategory)
      .map(([catId, amount]) => ({
        category: categories.find(c => c.id === catId),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [stats, categories]);

  const StatBox = ({ label, value, color, unit }: { label: string; value: string | number; color: string; unit?: string }) => (
    <ThemedView style={[styles.statBox, { borderTopColor: color, borderTopWidth: 4 }]}>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
      <ThemedText style={[styles.statValue, { color }]}>
        {typeof value === 'number' ? value.toFixed(2) : value}
        {unit && ` ${unit}`}
      </ThemedText>
    </ThemedView>
  );

  const renderTopCategoryItem = ({ item }: { item: { category: any; amount: number } }) => (
    <ThemedView style={styles.topCategoryItem}>
      <View style={styles.categoryNameWrapper}>
        <ThemedText style={styles.categoryEmoji}>{item.category?.icon}</ThemedText>
        <ThemedText style={styles.categoryLabel}>{item.category?.name}</ThemedText>
      </View>
      <View style={styles.categoryAmountWrapper}>
        <ThemedText style={styles.categoryAmount}>${item.amount.toFixed(2)}</ThemedText>
        <ThemedText style={styles.categoryPercent}>
          {((item.amount / stats.totalExpenses) * 100).toFixed(1)}%
        </ThemedText>
      </View>
    </ThemedView>
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingHorizontal: isSmallScreen ? 16 : 24 }]}>
      <ThemedText type="title" style={styles.title}>
        Estadísticas Financieras
      </ThemedText>

      <View style={styles.statsGrid}>
        <StatBox
          label="Gastos Totales"
          value={stats.totalExpenses}
          color="#ef4444"
          unit="$"
        />
        <StatBox
          label="Gasto Promedio"
          value={stats.averageExpense}
          color="#f59e0b"
          unit="$"
        />
        <StatBox
          label="Este Mes"
          value={stats.thisMonthExpenses}
          color="#8b5cf6"
          unit="$"
        />
        <StatBox
          label="% Presupuesto"
          value={stats.spendingPercentage}
          color={stats.spendingPercentage > 100 ? '#ef4444' : '#22c55e'}
          unit="%"
        />
      </View>

      {chartData.length > 0 && (
        <ThemedView style={styles.chartContainer}>
          <ThemedText style={styles.chartTitle}>Distribución de Gastos</ThemedText>
          <View style={styles.chartWrapper}>
            <FinanceDonutChart
              data={chartData.map(({ value, color }) => ({ value, color }))}
              size={200}
              strokeWidth={20}
            />
          </View>
        </ThemedView>
      )}

      {topCategories.length > 0 && (
        <ThemedView style={styles.topCategoriesContainer}>
          <ThemedText style={styles.topCategoriesTitle}>Top Categorías</ThemedText>
          <FlatList
            data={topCategories}
            renderItem={renderTopCategoryItem}
            keyExtractor={(item, idx) => `${item.category?.id}-${idx}`}
            scrollEnabled={false}
          />
        </ThemedView>
      )}

      <ThemedView style={styles.insightsContainer}>
        <ThemedText style={styles.insightsTitle}>Insights</ThemedText>
        <ThemedText style={styles.insightText}>
          {stats.spendingPercentage > 100
            ? `⚠️ Has gastado ${(stats.spendingPercentage - 100).toFixed(0)}% más del presupuesto`
            : `✅ Te falta ${(100 - stats.spendingPercentage).toFixed(0)}% del presupuesto`}
        </ThemedText>
        <ThemedText style={styles.insightText}>
          📊 Has registrado {stats.transactionCount} transacciones
        </ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingVertical: 28,
    gap: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 24,
    color: '#1f2937',
    letterSpacing: 0.3,
  },
  statsGrid: {
    gap: 16,
  },
  statBox: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  chartContainer: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    color: '#1f2937',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCategoriesContainer: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  topCategoriesTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1f2937',
  },
  topCategoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryNameWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  categoryAmountWrapper: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2937',
  },
  categoryPercent: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  insightsContainer: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
    color: '#1f2937',
  },
  insightText: {
    fontSize: 14,
    marginBottom: 10,
    paddingLeft: 14,
    color: '#374151',
    fontWeight: '500',
  },
});