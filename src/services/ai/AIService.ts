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
    monthlyBudget: number,
    categories?: any[]
  ): AIRecommendation {
    const cats = categories || [];
    const hoy = new Date().getDate();
    const fCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
    const vencidos = cats.filter((c: any) => c.tipo && c.diaPago && c.diaPago < hoy && !c.pagado);
    const venceHoy = cats.filter((c: any) => c.tipo && c.diaPago === hoy && !c.pagado);
    const vence3d  = cats.filter((c: any) => c.tipo && !c.pagado && c.diaPago && c.diaPago > hoy && c.diaPago <= hoy + 3);
    const pagados  = cats.filter((c: any) => c.tipo && c.pagado);
    const pendienteTotal = cats.filter((c: any) => c.tipo && !c.pagado).reduce((s: number, c: any) => s + (c.presupuesto || 0), 0);

    if (vencidos.length > 0) {
      return {
        id: 'insight-' + Date.now(),
        type: 'warning',
        title: 'Pagos vencidos',
        message: 'Tienes ' + vencidos.length + ' pago(s) vencido(s): ' + vencidos.map((c: any) => c.name).join(', ') + '. Registralos cuanto antes.',
        urgency: 'high',
        timestamp: new Date().toISOString(),
      };
    }
    if (venceHoy.length > 0) {
      const nombres = venceHoy.map((c: any) => c.name).join(' y ');
      return {
        id: 'insight-' + Date.now(),
        type: 'warning',
        title: 'Pago hoy',
        message: 'Hoy vence: ' + nombres + '. No lo dejes para despues.',
        urgency: 'high',
        timestamp: new Date().toISOString(),
      };
    }
    if (vence3d.length > 0) {
      const cat = vence3d[0];
      return {
        id: 'insight-' + Date.now(),
        type: 'insight',
        title: 'Pago proximo',
        message: cat.name + ' vence en ' + (cat.diaPago - hoy) + ' dias. Asegurate de tener ' + fCOP(cat.presupuesto || 0) + ' disponibles.',
        urgency: 'medium',
        timestamp: new Date().toISOString(),
      };
    }
    if (cats.length > 0 && pagados.length === cats.filter((c: any) => c.tipo).length) {
      return {
        id: 'insight-' + Date.now(),
        type: 'celebration',
        title: 'Mes al dia',
        message: 'Todos tus compromisos del mes estan pagados. Excelente gestion!',
        urgency: 'low',
        timestamp: new Date().toISOString(),
      };
    }
    if (pendienteTotal > 0) {
      return {
        id: 'insight-' + Date.now(),
        type: 'insight',
        title: 'Compromisos pendientes',
        message: 'Te quedan ' + fCOP(pendienteTotal) + ' por pagar este mes en ' + cats.filter((c: any) => c.tipo && !c.pagado).length + ' compromiso(s).',
        urgency: 'low',
        timestamp: new Date().toISOString(),
      };
    }
    // Fallback to transaction-based insight
    const today = new Date().toISOString().split('T')[0];
    const todayTxs = transactions.filter(t => t.date.startsWith(today) && t.type === 'expense');
    const todaySpent = todayTxs.reduce((sum, t) => sum + t.amount, 0);
    const avgDaily = monthlyBudget / 30;
    return {
      id: 'insight-' + Date.now(),
      type: todaySpent > avgDaily * 1.5 ? 'warning' : 'insight',
      title: todaySpent > avgDaily * 1.5 ? 'Gasto alto hoy' : 'Seguimiento diario',
      message: todaySpent > avgDaily * 1.5
        ? 'Hoy gastaste ' + fCOP(todaySpent) + '. Tu promedio diario es ' + fCOP(avgDaily) + '.'
        : 'Registra tus compromisos de pago para que Finn te ayude a organizarte.',
      urgency: todaySpent > avgDaily * 1.5 ? 'high' : 'low',
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
  analyzePago(
    compromiso: any,
    montoPagado: number,
    fechaPago: Date,
    ingresoMensual: number,
    totalComprometidoMes: number
  ): string {
    const diferencia = montoPagado - (compromiso.presupuesto || 0);
    const diaPago = compromiso.diaPago || 1;
    const diasRetraso = fechaPago.getDate() - diaPago;
    const pct = ingresoMensual > 0 ? ((compromiso.presupuesto || 0) / ingresoMensual) * 100 : 0;
    const fCOP = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString('es-CO').replace(/,/g, '.');
    const pendiente = totalComprometidoMes - (compromiso.presupuesto || 0);
    let msg = '';
    if (diasRetraso > 3) {
      msg += 'Registrado con ' + diasRetraso + ' dias de retraso. ';
      if (diasRetraso > 7) msg += 'Los pagos tardios pueden generar recargos. ';
    } else {
      msg += 'Pagado a tiempo. ';
    }
    if (diferencia > 0) {
      msg += 'Pagaste ' + fCOP(diferencia) + ' mas de lo presupuestado. Considera actualizar el monto. ';
    } else if (diferencia < 0) {
      msg += 'Pagaste ' + fCOP(diferencia) + ' menos del presupuesto. ';
    }
    if (pct > 35) {
      msg += compromiso.name + ' representa el ' + pct.toFixed(0) + '% de tu ingreso. ';
    }
    if (pendiente > 0) {
      msg += 'Aun tienes ' + fCOP(pendiente) + ' en otros compromisos este mes.';
    } else {
      msg += 'Todos tus compromisos del mes estan al dia!';
    }
    return msg.trim();
  }
}

export const aiService = new AIService();