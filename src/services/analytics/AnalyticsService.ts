import { Transaction, Budget, FinancialProfile } from '../../types';

export interface SpendingAnalysis {
  totalSpent: number;
  avgDailySpending: number;
  topCategory: string;
  topCategoryAmount: number;
  projectionEndOfMonth: number;
  budgetHealth: 'good' | 'warning' | 'danger';
  savingsRate: number;
  spendingTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface MonthComparison {
  previousMonthTotal: number;
  currentMonthTotal: number;
  changePercentage: number;
  changeDirection: 'increase' | 'decrease' | 'stable';
  categoryChanges: Record<string, number>;
}

export interface ProjectedBudget {
  projectedSpending: number;
  availableToSpend: number;
  daysRemaining: number;
  dailyBudget: number;
  onTrack: boolean;
}

class AnalyticsService {
  /**
   * Analiza patrones de gasto
   */
  analyzeSpending(
    transactions: Transaction[],
    budget: Budget,
    monthDays: number = 30
  ): SpendingAnalysis {
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    const monthTransactions = transactions.filter(t => {
      const txMonth = t.date.substring(0, 7);
      return txMonth === currentMonth && t.type === 'expense';
    });

    const totalSpent = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
    const daysPassedInMonth = currentDate.getDate();
    const avgDailySpending = daysPassedInMonth > 0 ? totalSpent / daysPassedInMonth : 0;

    // Categoría con más gastos
    const categorySpending: Record<string, number> = {};
    monthTransactions.forEach(t => {
      categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
    });

    const topCategory = Object.entries(categorySpending).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';
    const topCategoryAmount = categorySpending[topCategory] || 0;

    // Proyección a fin de mes
    const projectionEndOfMonth = avgDailySpending * monthDays;

    // Salud del presupuesto
    const budgetHealth = this.calculateBudgetHealth(totalSpent, budget.monthlyLimit);

    // Tasa de ahorro
    const savingsRate = ((budget.monthlyLimit - totalSpent) / budget.monthlyLimit) * 100;

    // Tendencia de gasto
    const spendingTrend = this.calculateSpendingTrend(transactions);

    return {
      totalSpent,
      avgDailySpending,
      topCategory,
      topCategoryAmount,
      projectionEndOfMonth,
      budgetHealth,
      savingsRate,
      spendingTrend,
    };
  }

  /**
   * Compara gasto del mes actual vs mes anterior
   */
  compareMonths(transactions: Transaction[]): MonthComparison {
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const previousMonth = this.getPreviousMonth(currentMonth);

    const currentMonthTx = transactions.filter(
      t => t.date.substring(0, 7) === currentMonth && t.type === 'expense'
    );
    const previousMonthTx = transactions.filter(
      t => t.date.substring(0, 7) === previousMonth && t.type === 'expense'
    );

    const currentMonthTotal = currentMonthTx.reduce((sum, t) => sum + t.amount, 0);
    const previousMonthTotal = previousMonthTx.reduce((sum, t) => sum + t.amount, 0);

    const changePercentage = previousMonthTotal > 0
      ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
      : 0;

    // Por categoría
    const categoryChanges: Record<string, number> = {};
    const categories = new Set([
      ...currentMonthTx.map(t => t.category),
      ...previousMonthTx.map(t => t.category),
    ]);

    categories.forEach(cat => {
      const current = currentMonthTx
        .filter(t => t.category === cat)
        .reduce((sum, t) => sum + t.amount, 0);
      const previous = previousMonthTx
        .filter(t => t.category === cat)
        .reduce((sum, t) => sum + t.amount, 0);

      categoryChanges[cat] = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    });

    return {
      previousMonthTotal,
      currentMonthTotal,
      changePercentage,
      changeDirection: changePercentage > 2 ? 'increase' : changePercentage < -2 ? 'decrease' : 'stable',
      categoryChanges,
    };
  }

  /**
   * Proyecta presupuesto para fin de mes
   */
  projectBudget(
    transactions: Transaction[],
    monthlyLimit: number
  ): ProjectedBudget {
    const currentDate = new Date();
    const monthDays = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const daysRemaining = monthDays - currentDate.getDate();

    const spending = this.analyzeSpending(transactions, { monthlyLimit } as any, monthDays);

    const projectedSpending = spending.projectionEndOfMonth;
    const availableToSpend = monthlyLimit - spending.totalSpent;
    const dailyBudget = daysRemaining > 0 ? availableToSpend / daysRemaining : 0;

    return {
      projectedSpending,
      availableToSpend,
      daysRemaining,
      dailyBudget,
      onTrack: projectedSpending <= monthlyLimit,
    };
  }

  /**
   * Genera recomendación para gasto adicional
   */
  simulateAdditionalSpending(
    monthlyLimit: number,
    currentSpent: number,
    additionalAmount: number
  ): { impactOnSavings: number; newProjection: number; feasible: boolean } {
    const newSpent = currentSpent + additionalAmount;
    const impactOnSavings = additionalAmount;
    const newProjection = newSpent;
    const feasible = newSpent <= monthlyLimit * 1.1; // Permite hasta 10% over

    return {
      impactOnSavings,
      newProjection,
      feasible,
    };
  }

  // Métodos privados auxiliares
  private calculateBudgetHealth(spent: number, limit: number): 'good' | 'warning' | 'danger' {
    const percentage = (spent / limit) * 100;
    if (percentage < 60) return 'good';
    if (percentage < 85) return 'warning';
    return 'danger';
  }

  private calculateSpendingTrend(transactions: Transaction[]): 'increasing' | 'stable' | 'decreasing' {
    if (transactions.length < 2) return 'stable';

    const expenses = transactions.filter(t => t.type === 'expense');
    const lastWeek = expenses.filter(t => {
      const date = new Date(t.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    });

    const previousWeek = expenses.filter(t => {
      const date = new Date(t.date);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= twoWeeksAgo && date < weekAgo;
    });

    const lastWeekTotal = lastWeek.reduce((sum, t) => sum + t.amount, 0);
    const previousWeekTotal = previousWeek.reduce((sum, t) => sum + t.amount, 0);

    if (previousWeekTotal === 0) return 'stable';

    const change = ((lastWeekTotal - previousWeekTotal) / previousWeekTotal) * 100;
    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  private getPreviousMonth(currentMonth: string): string {
    const [year, month] = currentMonth.split('-');
    let prevMonth = parseInt(month) - 1;
    let prevYear = parseInt(year);

    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear--;
    }

    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  }
}

export const analyticsService = new AnalyticsService();
