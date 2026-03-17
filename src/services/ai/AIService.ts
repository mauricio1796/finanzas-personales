import { Transaction, FinancialProfile, FinancialGoal, AIAnalysis, Category } from '../../types';
import { analyticsService } from './AnalyticsService';
import { CATALOGO_CATEGORIAS } from '../../constants/catalogoCategorias';
import {
  calcularMetricasFinancieras,
  buildContextoIA,
  MetricasFinancieras,
} from '../../utils/ingresoUtils';

// ── Tipos de respuesta enriquecida ────────────────────────────────────────────

export interface CategoriaSugerida {
  nombre: string;
  icono: string;
  tipo: 'gasto' | 'ingreso';
  presupuestoSugerido: number;
}

export type BotAccion =
  | { tipo: 'sugerir_categorias'; categorias: CategoriaSugerida[] }
  | { tipo: 'ninguna' };

export interface BotResponse {
  text: string;
  accion?: BotAccion;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

const fCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

function _generarSugerenciasCategorias(
  profile: FinancialProfile,
  categoriesActivas: Category[],
): BotResponse {
  const salario = (profile as any).monthlySalary || 0;
  const nombresActivos = new Set(
    categoriesActivas.filter(c => c.isSelected).map(c => c.name),
  );

  const sugerencias: CategoriaSugerida[] = CATALOGO_CATEGORIAS
    .filter(c => !nombresActivos.has(c.nombre))
    .slice(0, 6)
    .map(c => ({
      nombre: c.nombre,
      icono: c.icono,
      tipo: c.tipo,
      presupuestoSugerido:
        salario > 0
          ? Math.round((salario * c.pctSugerido) / 10000 / 10000) * 10000
          : 0,
    }));

  if (sugerencias.length === 0) {
    return {
      text: '¡Ya tienes todas las categorías principales configuradas! Puedes crear una categoría personalizada desde la pantalla de Categorías.',
    };
  }

  return {
    text: 'Basándome en tu perfil, te sugiero estas categorías. ¿Cuáles quieres agregar a tu presupuesto?',
    accion: { tipo: 'sugerir_categorias', categorias: sugerencias },
  };
}

// ── Router principal de mensajes ──────────────────────────────────────────────

/**
 * Procesa cualquier mensaje del usuario y retorna una BotResponse.
 * Cubre: balance, ahorro, gasto, diario, ingreso, pendiente, reporte, categorías.
 */
export function procesarMensajeUsuario(
  mensaje: string,
  transactions: Transaction[],
  categories: Category[],
  profile: FinancialProfile,
  goal?: FinancialGoal | null,
): BotResponse {
  const msg = mensaje.toLowerCase().trim();
  const ahora = new Date();
  const mes = ahora.getMonth();
  const año = ahora.getFullYear();
  const monthlySalary = (profile as any).monthlySalary || 0;

  const metricas = calcularMetricasFinancieras(transactions, categories, monthlySalary, mes, año);

  // ── Categorías ────────────────────────────────────────────────────────────
  const intentoCategorias =
    msg.includes('categor') ||
    (msg.includes('gasto') && msg.includes('agreg')) ||
    msg.includes('quiero controlar') ||
    msg.includes('nueva categoria') ||
    msg.includes('nueva categoría') ||
    msg.includes('añadir categoria') ||
    msg.includes('añadir categoría') ||
    msg.includes('agregar categoria') ||
    msg.includes('agregar categoría');

  if (intentoCategorias) {
    return _generarSugerenciasCategorias(profile, categories);
  }

  // ── Balance / dinero disponible ───────────────────────────────────────────
  if (
    msg.includes('balance') ||
    msg.includes('cuánto tengo') ||
    msg.includes('cuanto tengo') ||
    msg.includes('disponible') ||
    msg.includes('dinero') ||
    msg.includes('me queda') ||
    msg.includes('me sobra')
  ) {
    const label = metricas.esIngresoReal ? 'ingreso registrado' : 'salario estimado';
    return {
      text:
        `Tu ${label} de este mes es ${fCOP(metricas.ingresoEfectivo)}.\n\n` +
        `• Gastado: ${fCOP(metricas.totalGastado)} (${metricas.porcentajeGastado}%)\n` +
        `• Pendiente: ${fCOP(metricas.totalPendiente)} (${metricas.porcentajePendiente}%)\n` +
        `• Disponible ahora: ${fCOP(metricas.balanceDisponible)}\n` +
        `• Balance final proyectado: ${fCOP(metricas.balanceFinal)} (${metricas.porcentajeLibre}% libre)\n\n` +
        `Presupuesto diario recomendado: ${fCOP(metricas.gastoPromedioRecomendadoDia)}/día para los ${metricas.diasRestantesMes} días restantes.`,
    };
  }

  // ── Ahorro ────────────────────────────────────────────────────────────────
  if (
    msg.includes('ahorro') ||
    msg.includes('ahorrar') ||
    msg.includes('ahorra') ||
    msg.includes('meta') ||
    (msg.includes('cómo') && msg.includes('más'))
  ) {
    const ahorroPct = metricas.ingresoEfectivo > 0
      ? Math.round((metricas.ahorroProyectado / metricas.ingresoEfectivo) * 100)
      : 0;
    let consejo = '';
    if (ahorroPct >= 20) {
      consejo = '¡Excelente! Estás en la regla de oro del 20% de ahorro.';
    } else if (ahorroPct >= 10) {
      consejo = 'Vas bien. Intenta llegar al 20% reduciendo gastos variables.';
    } else {
      consejo = 'Tu tasa de ahorro es baja. Revisa los gastos no esenciales para mejorarla.';
    }
    return {
      text:
        `Ahorro proyectado este mes: ${fCOP(metricas.ahorroProyectado)} (${ahorroPct}% del ingreso).\n\n${consejo}` +
        (goal?.targetAmount
          ? `\n\nMeta de ahorro: ${fCOP(goal.targetAmount)}. A este ritmo lo alcanzas en ${
              metricas.ahorroProyectado > 0
                ? Math.ceil(goal.targetAmount / metricas.ahorroProyectado)
                : '?'
            } meses.`
          : ''),
    };
  }

  // ── Cuánto gasté ──────────────────────────────────────────────────────────
  if (
    msg.includes('gasté') ||
    msg.includes('gaste') ||
    msg.includes('cuánto gast') ||
    msg.includes('cuanto gast') ||
    msg.includes('mis gastos') ||
    msg.includes('resumen de gastos')
  ) {
    const gastosPorCat: Record<string, number> = {};
    transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === mes && d.getFullYear() === año;
      })
      .forEach(t => { gastosPorCat[t.category] = (gastosPorCat[t.category] || 0) + t.amount; });

    const top = Object.entries(gastosPorCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, monto]) => `  • ${cat}: ${fCOP(monto)}`)
      .join('\n');

    return {
      text:
        `Este mes has gastado ${fCOP(metricas.totalGastado)} (${metricas.porcentajeGastado}% de tu ingreso).\n\n` +
        (top ? `Top categorías:\n${top}` : 'Aún no tienes gastos registrados este mes.'),
    };
  }

  // ── Presupuesto diario ────────────────────────────────────────────────────
  if (
    msg.includes('diario') ||
    msg.includes('por día') ||
    msg.includes('por dia') ||
    msg.includes('cada día') ||
    msg.includes('cada dia') ||
    msg.includes('presupuesto del día') ||
    msg.includes('cuánto puedo gastar')
  ) {
    return {
      text:
        `Con tu balance actual de ${fCOP(metricas.balanceFinal)} y ${metricas.diasRestantesMes} días restantes del mes, ` +
        `tu presupuesto diario recomendado es ${fCOP(metricas.gastoPromedioRecomendadoDia)}/día.\n\n` +
        (metricas.totalPendiente > 0
          ? `Este cálculo ya descuenta los ${fCOP(metricas.totalPendiente)} de compromisos pendientes.`
          : 'Tienes todos tus compromisos al día. ¡Bien hecho!'),
    };
  }

  // ── Ingreso ───────────────────────────────────────────────────────────────
  if (
    msg.includes('ingreso') ||
    msg.includes('salario') ||
    msg.includes('sueldo') ||
    msg.includes('cuánto gano') ||
    msg.includes('cuanto gano')
  ) {
    return {
      text: metricas.esIngresoReal
        ? `Has registrado ${fCOP(metricas.ingresoEfectivo)} de ingresos este mes.\n\nEso cubre:\n• ${metricas.porcentajeGastado}% en gastos\n• ${metricas.porcentajePendiente}% en compromisos\n• ${metricas.porcentajeLibre}% disponible`
        : `Tu salario configurado es ${fCOP(monthlySalary)}. No has registrado ingresos reales este mes aún.\n\nRegistra tu ingreso del mes para que los cálculos sean precisos. Puedes hacerlo con el botón "+" en la pantalla principal.`,
    };
  }

  // ── Pendientes / compromisos ──────────────────────────────────────────────
  if (
    msg.includes('pendiente') ||
    msg.includes('compromiso') ||
    msg.includes('pagar') ||
    msg.includes('vencimiento') ||
    msg.includes('debo') ||
    msg.includes('falta')
  ) {
    const pendientes = categories.filter(
      (c: any) => c.isSelected && c.diaPago && !c.pagado && c.tipo === 'gasto' && (c.budget ?? 0) > 0,
    );
    if (pendientes.length === 0) {
      return { text: '¡Todos tus compromisos del mes están pagados! Excelente gestión financiera.' };
    }
    const lista = pendientes
      .sort((a: any, b: any) => (a.diaPago || 31) - (b.diaPago || 31))
      .map((c: any) => `  • ${c.name}: ${fCOP(c.budget)} (día ${c.diaPago})`)
      .join('\n');
    return {
      text:
        `Tienes ${pendientes.length} compromiso(s) pendiente(s) por ${fCOP(metricas.totalPendiente)}:\n\n${lista}\n\nTu balance proyectado después de pagarlos es ${fCOP(metricas.balanceFinal)}.`,
    };
  }

  // ── Reporte completo ──────────────────────────────────────────────────────
  if (
    msg.includes('reporte') ||
    msg.includes('resumen') ||
    msg.includes('informe') ||
    msg.includes('estado financiero') ||
    msg.includes('cómo voy') ||
    msg.includes('como voy')
  ) {
    const contexto = buildContextoIA(metricas, categories, transactions, profile, mes, año);
    const estado =
      metricas.porcentajeGastado + metricas.porcentajePendiente > 90
        ? '⚠️ Estás usando más del 90% de tu ingreso. Atención.'
        : metricas.porcentajeLibre >= 20
        ? '✅ Vas bien. Tienes margen saludable.'
        : '🔶 Margen ajustado. Controla los gastos variables.';
    return { text: `${estado}\n\n${contexto}` };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return {
    text:
      `Hola, soy Finn 👋 Puedo ayudarte con:\n\n• "¿Cuánto tengo disponible?"\n• "¿Cuánto gasté este mes?"\n• "¿Cuánto puedo gastar por día?"\n• "¿Cuánto estoy ahorrando?"\n• "Mis compromisos pendientes"\n• "Reporte de este mes"\n• "Agregar categoría"\n\n¿Qué quieres saber sobre tus finanzas?`,
  };
}

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
    const pendienteTotal = cats.filter((c: any) => c.tipo && !c.pagado).reduce((s: number, c: any) => s + (c.budget || 0), 0);

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
        message: cat.name + ' vence en ' + (cat.diaPago - hoy) + ' dias. Asegurate de tener ' + fCOP(cat.budget || 0) + ' disponibles.',
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
    const diferencia = montoPagado - (compromiso.budget || 0);
    const diaPago = compromiso.diaPago || 1;
    const diasRetraso = fechaPago.getDate() - diaPago;
    const pct = ingresoMensual > 0 ? ((compromiso.budget || 0) / ingresoMensual) * 100 : 0;
    const fCOP = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString('es-CO').replace(/,/g, '.');
    const pendiente = totalComprometidoMes - (compromiso.budget || 0);
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