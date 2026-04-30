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
import { useFinance, Transaction } from '@/src/core/context/FinanceContext';
import FinanceDonutChart from '@/src/components/FinanceDonutChart';
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
        <View>
          <ThemedText type="title" style={styles.title}>
            Dashboard
          </ThemedText>

          {/* User Info */}
          {user && (
            <ThemedView style={styles.userCard}>
              <ThemedText style={styles.userGreeting}>Hola, {user.name}! 👋</ThemedText>
              {stats.salary > 0 && (
                <ThemedText style={styles.salaryInfo}>
                  Salario mensual: <ThemedText style={styles.salaryValue}>${stats.salary.toFixed(2)}</ThemedText>
                </ThemedText>
              )}
            </ThemedView>
          )}

          {/* Main Stats */}
          <ThemedView style={styles.statsGrid}>
            <StatCard label="Ingresos" value={`$${stats.income.toFixed(2)}`} color="#22c55e" />
            <StatCard label="Gastos" value={`$${stats.expenses.toFixed(2)}`} color="#ef4444" />
            <StatCard label="Balance" value={`$${stats.balance.toFixed(2)}`} color="#0a7ea4" />
            <StatCard label="Ahorro" value={`${stats.savingsPercentage.toFixed(1)}%`} color="#f59e0b" />
          </ThemedView>

          {/* Budget by Category Title */}
          {selectedCategories.length > 0 && (
            <ThemedText style={styles.budgetSectionTitle}>📊 Presupuestos por Categoría</ThemedText>
          )}
        </View>
      }
      ListFooterComponent={
        <View>
          {/* Chart */}
          {chartData.length > 0 && (
            <ThemedView style={styles.chartContainer}>
              <ThemedText style={styles.chartTitle}>Distribución de Gastos</ThemedText>
              <View style={styles.chartWrapper}>
                <FinanceDonutChart data={chartData} size={200} strokeWidth={20} />
              </View>
            </ThemedView>
          )}

          {/* Quick Access */}
          <ThemedView style={styles.quickAccessContainer}>
            <ThemedText style={styles.quickAccessTitle}>Acceso Rápido</ThemedText>
            <View style={styles.quickAccessGrid}>
              <QuickAccessButton label="Añadir Ingreso" onPress={() => onNavigateToSection('ingresos')} />
              <QuickAccessButton label="Registrar Gasto" onPress={() => onNavigateToSection('gastos')} />
              <QuickAccessButton label="Ver Estadísticas" onPress={() => onNavigateToSection('estadisticas')} />
              <QuickAccessButton label="Categorías" onPress={() => onNavigateToSection('categorias')} />
            </View>
          </ThemedView>

          {selectedCategories.length === 0 && (
            <ThemedView style={styles.emptyState}>
              <ThemedText style={styles.emptyStateText}>📝 Selecciona categorías para comenzar a presupuestar</ThemedText>
              <Pressable style={styles.emptyStateButton} onPress={() => onNavigateToSection('categorias')}>
                <ThemedText style={styles.emptyStateButtonText}>Ir a Categorías</ThemedText>
              </Pressable>
            </ThemedView>
          )}
        </View>
      }
    />
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
    color: THEME.colors.textPrimary,
    letterSpacing: 0.3,
  },
  userCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  userGreeting: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  salaryInfo: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  statsGrid: {
    gap: 16,
  },
  statCard: {
    padding: 20,
    borderRadius: THEME.radius.md,
    marginBottom: 8,
    backgroundColor: THEME.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadow.card,
  },
  statLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statSubtext: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    marginTop: 6,
    fontWeight: '500',
  },
  budgetSection: {
    padding: 20,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  budgetSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: THEME.colors.textPrimary,
  },
  budgetCard: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 12,
  },
  budgetCardOverflow: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  budgetIcon: {
    fontSize: 24,
  },
  budgetInfo: {
    flex: 1,
  },
  budgetName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  budgetAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  overBudgetText: {
    fontSize: 12,
    color: THEME.colors.expense,
    fontWeight: '700',
  },
  chartContainer: {
    padding: 20,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadow.card,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    color: THEME.colors.textPrimary,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessContainer: {
    padding: 20,
    borderRadius: THEME.radius.md,
    marginTop: 12,
    backgroundColor: THEME.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadow.card,
  },
  quickAccessTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: THEME.colors.textPrimary,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAccessButton: {
    flex: 1,
    minWidth: 150,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  quickAccessButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyState: {
    padding: 28,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#fcd34d',
    alignItems: 'center',
    gap: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400e',
    textAlign: 'center',
  },
  emptyStateButton: {
    backgroundColor: '#fbbf24',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: THEME.radius.sm,
  },
  emptyStateButtonText: {
    color: THEME.colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  subtext: {
    fontSize: 14,
    textAlign: 'center',
    color: THEME.colors.textSecondary,
    marginTop: 12,
    fontWeight: '500',
  },
  salaryValue: {
    fontWeight: '800',
    color: '#22c55e',
  },
});