import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  useWindowDimensions,
  FlatList,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFinance } from '@/src/state';
import { Transaction } from '@/src/types';
import FinanceDonutChart from '@/src/components/charts/FinanceDonutChart';

interface DashboardProps {
  transactions: Transaction[];
  monthlySalary: number;
  onNavigateToSection: (section: string) => void;
}

export function Dashboard({ transactions, monthlySalary, onNavigateToSection }: DashboardProps) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const { user, categories } = useFinance();

  const selectedCategories = categories.filter(c => c.isSelected);

  const stats = useMemo(() => {
    const salary = user?.monthlySalary || monthlySalary;
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((total, t) => total + t.amount, 0);
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((total, t) => total + t.amount, 0);
    const balance = income - expenses;
    const savingsPercentage = salary > 0 ? (balance / salary) * 100 : 0;

    return {
      income,
      expenses,
      balance,
      savingsPercentage,
      salary,
    };
  }, [transactions, user?.monthlySalary, monthlySalary]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, { spent: number; budget: number | undefined }> = {};
    
    selectedCategories.forEach(cat => {
      stats[cat.id] = {
        spent: 0,
        budget: cat.budget,
      };
    });

    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const cat = selectedCategories.find(c => c.name === t.category);
        if (cat && stats[cat.id]) {
          stats[cat.id].spent += t.amount;
        }
      });

    return stats;
  }, [transactions, selectedCategories]);

  const chartData = useMemo(() => {
    const categoryExpenses: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + t.amount;
      });

    const total = Object.values(categoryExpenses).reduce((sum, val) => sum + val, 0);
    
    return Object.entries(categoryExpenses).map(([_, amount]) => ({
      value: (amount / (total || 1)) * 100,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    }));
  }, [transactions]);

  const StatCard = ({ label, value, color, subtext }: { label: string; value: string; color: string; subtext?: string }) => (
    <ThemedView style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
      <ThemedText style={[styles.statValue, { color }]}>{value}</ThemedText>
      {subtext && <ThemedText style={styles.statSubtext}>{subtext}</ThemedText>}
    </ThemedView>
  );

  const QuickAccessButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable
      style={styles.quickAccessButton}
      onPress={onPress}
    >
      <ThemedText style={styles.quickAccessButtonText}>{label}</ThemedText>
    </Pressable>
  );

  const BudgetCard = ({ category, stats }: { category: any; stats: any }) => {
    const spent = stats.spent || 0;
    const budget = stats.budget || 0;
    const percentage = budget > 0 ? (spent / budget) * 100 : 0;
    const isOverBudget = spent > budget;

    return (
      <ThemedView style={[
        styles.budgetCard,
        isOverBudget && styles.budgetCardOverflow,
        { borderLeftColor: category.color, borderLeftWidth: 4 }
      ]}>
        <View style={styles.budgetHeader}>
          <ThemedText style={styles.budgetIcon}>{category.icon}</ThemedText>
          <View style={styles.budgetInfo}>
            <ThemedText style={styles.budgetName}>{category.name}</ThemedText>
            <ThemedText style={styles.budgetAmount}>
              ${spent.toFixed(2)} / ${budget ? budget.toFixed(2) : '∞'}
            </ThemedText>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: isOverBudget ? '#ef4444' : '#22c55e',
              },
            ]}
          />
        </View>
        {isOverBudget && (
          <ThemedText style={styles.overBudgetText}>
            ⚠️ Excedido por ${(spent - budget).toFixed(2)}
          </ThemedText>
        )}
      </ThemedView>
    );
  };

  return (
    <FlatList
      data={selectedCategories}
      keyExtractor={item => item.id}
      contentContainerStyle={[styles.container, { paddingHorizontal: isSmallScreen ? 16 : 24 }]}
      renderItem={({ item }) => {
        const catStats = categoryStats[item.id];
        return <BudgetCard category={item} stats={catStats || { spent: 0, budget: item.budget }} />;
      }}
      ListHeaderComponent={
        <View style={styles.headerSection}>
          <ThemedText style={styles.title}>Dashboard</ThemedText>
          <View style={styles.stats}>
            <StatCard
              label="Saldo"
              value={`$${stats.balance.toFixed(2)}`}
              color={stats.balance >= 0 ? '#22c55e' : '#ef4444'}
              subtext={`${stats.savingsPercentage.toFixed(1)}% del salario`}
            />
            <StatCard
              label="Ingresos"
              value={`$${stats.income.toFixed(2)}`}
              color="#3b82f6"
            />
            <StatCard
              label="Gastos"
              value={`$${stats.expenses.toFixed(2)}`}
              color="#f59e0b"
            />
          </View>
          {chartData.length > 0 && (
            <View style={styles.chartSection}>
              <ThemedText style={styles.chartTitle}>Distribución de Gastos</ThemedText>
              <FinanceDonutChart data={chartData} />
            </View>
          )}
          <View style={styles.quickAccessSection}>
            <QuickAccessButton
              label="+ Ingreso"
              onPress={() => onNavigateToSection('ingresos')}
            />
            <QuickAccessButton
              label="- Gasto"
              onPress={() => onNavigateToSection('gastos')}
            />
          </View>
          <ThemedText style={styles.budgetsTitle}>Presupuestos por Categoría</ThemedText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  headerSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  stats: {
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statSubtext: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  chartSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  quickAccessSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickAccessButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickAccessButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  budgetsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  budgetCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  budgetCardOverflow: {
    opacity: 0.7,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  budgetInfo: {
    flex: 1,
  },
  budgetName: {
    fontSize: 14,
    fontWeight: '600',
  },
  budgetAmount: {
    fontSize: 12,
    opacity: 0.6,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  overBudgetText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    fontWeight: '600',
  },
});
