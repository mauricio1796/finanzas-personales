import { Transaction, FinancialProfile, FinancialGoal, AIAnalysis } from '../../types';
import { analyticsService } from './AnalyticsService';

export interface AIRecommendation {
  id: string;
  type: 'insight' | 'warning' | 'opportunity' | 'celebration';
  title: string;
  message: string;
  action?: string;
  actionUrl?: string;
  urgency: 'low' | 'medium' | 'high';
  timestamp: string;
}

class AIService {
  /**
   * Genera insight diario basado en patrones
   */
  generateDailyInsight(
    transactions: Transaction[],
    profile: FinancialProfile,
    monthlyBudget: number
  ): AIRecommendation {
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = transactions.filter(t => t.date.startsWith(today) && t.type === 'expense');
    
    const todaySpent = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
    const avgDaily = monthlyBudget / 30;

    if (todaySpent > avgDaily * 1.5) {
      return {
        id: `insight-${Date.now()}`,
        type: 'warning',
        title: '⚠️ Gasto alto hoy',
        message: `Hoy has gastado ${todaySpent.toFixed(0)}. Tu promedio diario es ${avgDaily.toFixed(0)}. Considera reducir gastos.`,
        urgency: 'high',
        timestamp: new Date().toISOString(),
      };
    }

    if (todaySpent < avgDaily * 0.5) {
      return {
        id: `insight-${Date.now()}`,
        type: 'celebration',
        title: '🎉 ¡Muy bien!',
        message: `Vas por buen camino. Hoy gastaste menos de lo esperado.`,
        urgency: 'low',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      id: `insight-${Date.now()}`,
      type: 'insight',
      title: '📊 Seguimiento diario',
      message: `Llevas ${todaySpent.toFixed(0)} gastados hoy. Vas en línea con tu presupuesto.`,
      urgency: 'low',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Analiza progreso hacia objetivo financiero
   */
  analyzeGoalProgress(
    transactions: Transaction[],
    goal: FinancialGoal,
    monthlyIncome: number
  ): AIRecommendation {
    const expenses = transactions.filter(t => t.type === 'expense');
    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
    const potentialSavings = monthlyIncome - totalExpenses;

    if (goal.type === 'savings') {
      const monthsToGoal = goal.targetAmount
        ? Math.ceil(goal.targetAmount / Math.max(potentialSavings, 1))
        : 0;

      if (monthsToGoal <= 3) {
        return {
          id: `insight-${Date.now()}`,
          type: 'celebration',
          title: '🎯 ¡Casi lo logras!',
          message: `En ${monthsToGoal} meses más alcanzarás tu meta de ahorro.`,
          urgency: 'low',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        id: `insight-${Date.now()}`,
        type: 'opportunity',
        title: '💡 Acelera tus ahorros',
        message: `Si reduces gastos en 10%, alcanzarías tu meta en ${Math.ceil(monthsToGoal * 0.9)} meses.`,
        urgency: 'medium',
        timestamp: new Date().toISOString(),
      };
    }

    if (goal.type === 'debt_elimination') {
      return {
        id: `insight-${Date.now()}`,
        type: 'insight',
        title: '📉 Plan de deudas',
        message: `Puedes eliminar deudas en ${Math.ceil((goal.targetAmount || 0) / Math.max(potentialSavings, 1))} meses con tu ahorro actual.`,
        urgency: 'high',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      id: `insight-${Date.now()}`,
      type: 'insight',
      title: '📈 Progreso financiero',
      message: `Vas bien en tu objetivo. Continúa monitoreando tus gastos.`,
      urgency: 'low',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detecta anomalías en gastos
   */
  detectAnomalies(transactions: Transaction[]): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];

    const expenses = transactions.filter(t => t.type === 'expense');
    if (expenses.length < 5) return recommendations;

    // Agrupar por categoría y fecha
    const categorySpending: Record<string, number[]> = {};
    expenses.forEach(t => {
      if (!categorySpending[t.category]) categorySpending[t.category] = [];
      categorySpending[t.category].push(t.amount);
    });

    // Detectar gastos anormalmente altos
    Object.entries(categorySpending).forEach(([category, amounts]) => {
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const max = Math.max(...amounts);
      const variance = max - avg;

      if (variance > avg * 0.5) {
        recommendations.push({
          id: `anomaly-${Date.now()}-${category}`,
          type: 'warning',
          title: `⚠️ Gasto alto en ${category}`,
          message: `Detectamos un gasto de ${max.toFixed(0)} en ${category}. Tu promedio es ${avg.toFixed(0)}.`,
          urgency: 'medium',
          timestamp: new Date().toISOString(),
        });
      }
    });

    return recommendations;
  }

  /**
   * Genera presupuesto automático basado en IA (regla 50-30-20)
   */
  generateAutomaticBudget(monthlyIncome: number, profile: FinancialProfile) {
    let necessities = monthlyIncome * 0.5; // 50% - Necesidades
    let entertainment = monthlyIncome * 0.3; // 30% - Entretenimiento
    let savings = monthlyIncome * 0.2; // 20% - Ahorros

    // Ajustes según perfil
    if (profile.hasDebts) {
      necessities = monthlyIncome * 0.45;
      entertainment = monthlyIncome * 0.2;
      savings = monthlyIncome * 0.35;
    }

    if (profile.employmentType === 'student') {
      necessities = monthlyIncome * 0.6;
      entertainment = monthlyIncome * 0.25;
      savings = monthlyIncome * 0.15;
    }

    return {
      necessities: Math.round(necessities),
      entertainment: Math.round(entertainment),
      savings: Math.round(savings),
      totalMonthly: monthlyIncome,
    };
  }

  /**
   * Genera reto personalizado
   */
  generatePersonalizedChallenge(
    transactions: Transaction[],
    profile: FinancialProfile
  ): { title: string; description: string; target: string; days: number } {
    const expenses = transactions.filter(t => t.type === 'expense');
    
    // Encontrar categoría con más gastos
    const categorySpending: Record<string, number> = {};
    expenses.forEach(t => {
      categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
    });

    const topCategory = Object.entries(categorySpending).sort(([, a], [, b]) => b - a)[0]?.[0];

    const challenges = [
      {
        title: `🚫 Reto de ${topCategory}`,
        description: `Intenta no gastar en ${topCategory} durante 7 días.`,
        target: topCategory || 'general',
        days: 7,
      },
      {
        title: '🚶 Reto sin domicilios',
        description: 'Esta semana, come en casa. Sin domicilios.',
        target: 'delivery',
        days: 7,
      },
      {
        title: '💰 Reto de ahorro',
        description: 'Intenta ahorrar 50.000 esta semana.',
        target: 'savings',
        days: 7,
      },
      {
        title: '🎯 Bajo presupuesto',
        description: 'Reduce 20% tus gastos esta semana.',
        target: 'general',
        days: 7,
      },
    ];

    // Seleccionar aleatoriamente
    return challenges[Math.floor(Math.random() * challenges.length)];
  }

  /**
   * Calcula nivel del usuario basado en experiencia
   */
  calculateUserLevel(
    transactionCount: number,
    totalAhorrado: number,
    streakDays: number
  ): { level: number; title: string; nextLevelProgress: number } {
    let experience = transactionCount + (totalAhorrado / 10000) * 100 + streakDays * 5;

    let level = 1;
    let title = 'Principiante';

    if (experience >= 1000) level = 5;
    if (experience >= 800) level = 4;
    if (experience >= 500) level = 3;
    if (experience >= 200) level = 2;

    const titles = ['Principiante', 'Aprendiz', 'Gestor', 'Experto', 'Inversionista'];
    title = titles[level - 1];

    const levelThresholds = [0, 200, 500, 800, 1000];
    const nextLevelProgress = Math.min(
      100,
      ((experience - levelThresholds[level - 1]) /
        (levelThresholds[level] - levelThresholds[level - 1])) *
        100
    );

    return { level, title, nextLevelProgress };
  }
}

export const aiService = new AIService();
