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
import { THEME } from '@/src/constants/theme';

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
    <ThemedView style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3, backgroundColor: '#23272f' }]}> 
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
        { borderLeftColor: '#444', borderLeftWidth: 3, backgroundColor: '#23272f' }
      ]}>
        <View style={styles.budgetHeader}>
          {/* Sin icono, solo nombre y valores */}
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
                backgroundColor: isOverBudget ? THEME.colors.expense : THEME.colors.primary,
              },
            ]}
          />
        </View>
        {isOverBudget && (
          <ThemedText style={styles.overBudgetText}>
            Excedido por ${(spent - budget).toFixed(2)}
          </ThemedText>
        )}
      </ThemedView>
    );
  };

  return (
    <FlatList
      data={selectedCategories}
      keyExtractor={item => item.id}
      contentContainerStyle={[styles.container, { paddingHorizontal: isSmallScreen ? 16 : 24, backgroundColor: '#181a20' }]}
      renderItem={({ item }) => {
        const catStats = categoryStats[item.id];
        return <BudgetCard category={item} stats={catStats || { spent: 0, budget: item.budget }} />;
      }}
      ListHeaderComponent={
        <View style={styles.headerSection}>
          <ThemedText style={[styles.title, { color: '#e5e7eb', fontFamily: 'System', fontWeight: '700' }]}>Resumen Financiero</ThemedText>
          <View style={styles.stats}>
            <StatCard
              label="Saldo"
              value={`$${stats.balance.toFixed(2)}`}
              color={stats.balance >= 0 ? THEME.colors.primary : THEME.colors.expense}
              subtext={`${stats.savingsPercentage.toFixed(1)}% del salario`}
            />
            <StatCard
              label="Ingresos"
              value={`$${stats.income.toFixed(2)}`}
              color={THEME.colors.primary}
            />
            <StatCard
              label="Gastos"
              value={`$${stats.expenses.toFixed(2)}`}
              color={THEME.colors.expense}
            />
          </View>
          {chartData.length > 0 && (
            <View style={styles.chartSection}>
              <ThemedText style={[styles.chartTitle, { color: '#e5e7eb' }]}>Distribución de Gastos</ThemedText>
              <FinanceDonutChart data={chartData} />
            </View>
          )}
          <View style={styles.quickAccessSection}>
            <QuickAccessButton
              label="Agregar Ingreso"
              onPress={() => onNavigateToSection('ingresos')}
            />
            <QuickAccessButton
              label="Agregar Gasto"
              onPress={() => onNavigateToSection('gastos')}
            />
          </View>
          <ThemedText style={[styles.budgetsTitle, { color: '#e5e7eb' }]}>Presupuestos por Categoría</ThemedText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    backgroundColor: '#181a20',
  },
  headerSection: {
    marginBottom: 24,
    backgroundColor: '#181a20',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#e5e7eb',
    fontFamily: 'System',
  },
  stats: {
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    padding: 16,
    borderRadius: THEME.radius.md,
    marginBottom: 8,
    backgroundColor: '#23272f',
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
    ...THEME.shadow.card,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
    color: THEME.colors.textTertiary,
    fontFamily: 'System',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME.colors.border,
    fontFamily: 'System',
  },
  statSubtext: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
    color: THEME.colors.textTertiary,
    fontFamily: 'System',
  },
  chartSection: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#181a20',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#e5e7eb',
    fontFamily: 'System',
  },
  quickAccessSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    backgroundColor: '#181a20',
  },
  quickAccessButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#23272f',
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  quickAccessButtonText: {
    color: THEME.colors.border,
    fontWeight: '600',
    fontFamily: 'System',
  },
  budgetsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: THEME.colors.border,
    fontFamily: 'System',
  },
  budgetCard: {
    padding: 12,
    borderRadius: THEME.radius.sm,
    marginBottom: 12,
    backgroundColor: '#23272f',
    borderLeftWidth: 3,
    borderLeftColor: '#444',
    ...THEME.shadow.card,
  },
  budgetCardOverflow: {
    opacity: 0.7,
    borderColor: THEME.colors.expense,
    borderWidth: 1,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetIcon: {
    display: 'none',
  },
  budgetInfo: {
    flex: 1,
  },
  budgetName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.border,
    fontFamily: 'System',
  },
  budgetAmount: {
    fontSize: 12,
    opacity: 0.6,
    color: THEME.colors.textTertiary,
    fontFamily: 'System',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#353945',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  overBudgetText: {
    fontSize: 12,
    color: THEME.colors.expense,
    marginTop: 6,
    fontWeight: '600',
    fontFamily: 'System',
  },
});
