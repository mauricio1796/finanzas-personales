import { Transaction, Category, UserLevel } from '../types';

const XP_PER_LEVEL = 1000;

const CATEGORY_COLORS: Record<string, string> = {
  Alimentación: '#6366F1',
  Transporte: '#8B5CF6',
  Entretenimiento: '#F59E0B',
  Servicios: '#10B981',
  Salud: '#EF4444',
  Educación: '#3B82F6',
  Ropa: '#EC4899',
  Hogar: '#14B8A6',
  Deudas: '#F97316',
  Otros: '#9CA3AF',
};

const WEEK_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function getWeekBounds(offsetWeeks: number): { start: Date; end: Date } {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday - offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function filterByWeek(txs: Transaction[], start: Date, end: Date): Transaction[] {
  return txs.filter(t => {
    const d = new Date(t.date);
    return d >= start && d <= end;
  });
}

function formatWeekLabel(start: Date, end: Date): string {
  const s = start.getDate();
  const e = end.getDate();
  const em = MONTHS[end.getMonth()];
  const yr = end.getFullYear();
  if (start.getMonth() === end.getMonth()) {
    return `${s} — ${e} de ${em} ${yr}`;
  }
  return `${s} de ${MONTHS[start.getMonth()]} — ${e} de ${em} ${yr}`;
}

export interface WeeklyMetrics {
  weekLabel: string;
  weekStart: Date;
  weekEnd: Date;
  totalSpent: number;
  totalIncome: number;
  totalSaved: number;
  transactionCount: number;
  avgPerDay: number;
  bestDay: string;
  bestDayAmount: number;
  dailySpend: { label: string; current: number; previous: number }[];
  topCategories: { name: string; amount: number; color: string; percentage: number }[];
  gastos: { thisWeek: number; lastWeek: number; average: number; diff: number; diffPercent: number };
  ingresos: { thisWeek: number; lastWeek: number; average: number; diff: number; diffPercent: number };
  ahorro: { thisWeek: number; lastWeek: number; average: number; diff: number; diffPercent: number };
  aiInsight: string;
  badges: { label: string; color: string; bgColor: string; iconType: 'check' | 'star' | 'clock' | 'target' | 'fire' }[];
  xp: number;
  xpMax: number;
  level: number;
  levelTitle: string;
}

export function computeWeeklyMetrics(
  transactions: Transaction[],
  categories: Category[],
  userLevel: UserLevel | null,
  offsetWeeks: number = 0,
): WeeklyMetrics {
  const { start, end } = getWeekBounds(offsetWeeks);
  const { start: p1s, end: p1e } = getWeekBounds(offsetWeeks + 1);
  const { start: p2s, end: p2e } = getWeekBounds(offsetWeeks + 2);

  const weekTxs  = filterByWeek(transactions, start, end);
  const prevTxs  = filterByWeek(transactions, p1s, p1e);
  const prev2Txs = filterByWeek(transactions, p2s, p2e);

  const expenses  = weekTxs.filter(t => t.type === 'expense');
  const incomes   = weekTxs.filter(t => t.type === 'income');
  const pExpenses = prevTxs.filter(t => t.type === 'expense');
  const pIncomes  = prevTxs.filter(t => t.type === 'income');
  const p2Exp     = prev2Txs.filter(t => t.type === 'expense');
  const p2Inc     = prev2Txs.filter(t => t.type === 'income');

  const sum = (arr: Transaction[]) => arr.reduce((s, t) => s + t.amount, 0);

  const totalSpent   = sum(expenses);
  const totalIncome  = sum(incomes);
  const totalSaved   = totalIncome - totalSpent;
  const pSpent       = sum(pExpenses);
  const pIncome      = sum(pIncomes);
  const pSaved       = pIncome - pSpent;
  const p2Spent      = sum(p2Exp);
  const p2Income     = sum(p2Inc);
  const p2Saved      = p2Income - p2Spent;

  const transactionCount = weekTxs.length;
  const avgPerDay        = totalSpent / 7;

  // Daily spend for current and previous week
  const dailySpend = WEEK_LABELS.map((label, i) => {
    const ds = new Date(start); ds.setDate(start.getDate() + i); ds.setHours(0, 0, 0, 0);
    const de = new Date(start); de.setDate(start.getDate() + i); de.setHours(23, 59, 59, 999);
    const ps = new Date(p1s);   ps.setDate(p1s.getDate() + i);   ps.setHours(0, 0, 0, 0);
    const pe = new Date(p1s);   pe.setDate(p1s.getDate() + i);   pe.setHours(23, 59, 59, 999);
    const curr = expenses.filter(t => { const d = new Date(t.date); return d >= ds && d <= de; }).reduce((s, t) => s + t.amount, 0);
    const prev = pExpenses.filter(t => { const d = new Date(t.date); return d >= ps && d <= pe; }).reduce((s, t) => s + t.amount, 0);
    return { label, current: curr, previous: prev };
  });

  // Best day = lowest spend
  let bestDayIdx = 0;
  let bestDayAmount = dailySpend[0].current;
  for (let i = 1; i < 7; i++) {
    if (dailySpend[i].current < bestDayAmount) {
      bestDayAmount = dailySpend[i].current;
      bestDayIdx = i;
    }
  }
  const bestDay = WEEK_LABELS[bestDayIdx];

  // Top categories
  const catMap: Record<string, number> = {};
  for (const t of expenses) catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  const topCategories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({
      name,
      amount,
      color: CATEGORY_COLORS[name] ?? '#9CA3AF',
      percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
    }));

  // Diffs
  const gastosDiff    = totalSpent - pSpent;
  const gastosDiffPct = pSpent > 0 ? (gastosDiff / pSpent) * 100 : 0;
  const gastosAvg     = (totalSpent + pSpent + p2Spent) / 3;

  const ingresosDiff    = totalIncome - pIncome;
  const ingresosDiffPct = pIncome > 0 ? (ingresosDiff / pIncome) * 100 : 0;
  const ingresosAvg     = (totalIncome + pIncome + p2Income) / 3;

  const ahorroDiff    = totalSaved - pSaved;
  const ahorroDiffPct = pSaved !== 0 ? (ahorroDiff / Math.abs(pSaved)) * 100 : 0;
  const ahorroAvg     = (totalSaved + pSaved + p2Saved) / 3;

  // AI insight (deterministic)
  const topCat  = topCategories[0];
  const pctAbs  = Math.abs(Math.round(gastosDiffPct));
  const fmtCOP  = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
  let aiInsight = '';
  if (gastosDiffPct > 0) {
    aiInsight = `Gastaste ${pctAbs}% más que la semana pasada, principalmente en ${topCat?.name ?? 'gastos varios'}${topCat ? ` (${fmtCOP(topCat.amount)})` : ''}.`;
  } else if (gastosDiffPct < 0) {
    aiInsight = `Gastaste ${pctAbs}% menos que la semana pasada. ¡Buen trabajo controlando tus gastos!`;
  } else {
    aiInsight = 'Tu gasto semanal se mantuvo estable respecto a la semana anterior.';
  }
  if (bestDayAmount === 0) {
    aiInsight += ` El ${bestDay} fue tu mejor día — cero gastos.`;
  }
  if (totalSaved > 0) {
    aiInsight += ` Ahorraste ${fmtCOP(totalSaved)} esta semana.`;
  }

  // Badges
  const allBadges: WeeklyMetrics['badges'] = [];
  if (totalSaved > 0)       allBadges.push({ label: 'Ahorro positivo',  color: '#166534', bgColor: '#DCFCE7', iconType: 'check' });
  if (gastosDiffPct < -10)  allBadges.push({ label: 'Gasto reducido',   color: '#1E40AF', bgColor: '#DBEAFE', iconType: 'star' });
  if (transactionCount > 0) allBadges.push({ label: 'Semana activa',    color: '#92400E', bgColor: '#FEF3C7', iconType: 'fire' });
  const defaults: WeeklyMetrics['badges'] = [
    { label: 'En seguimiento', color: '#4338CA', bgColor: '#EEF2FF', iconType: 'target' },
    { label: 'Registro puntual', color: '#166534', bgColor: '#DCFCE7', iconType: 'clock' },
    { label: 'Avanzando', color: '#1E40AF', bgColor: '#DBEAFE', iconType: 'star' },
  ];
  for (const d of defaults) {
    if (allBadges.length >= 3) break;
    if (!allBadges.find(b => b.label === d.label)) allBadges.push(d);
  }

  const xpMax      = XP_PER_LEVEL;
  const xp         = (userLevel?.experience ?? 0) % xpMax;
  const level      = userLevel?.level ?? 1;
  const levelTitle = userLevel?.title ?? 'Principiante';

  return {
    weekLabel: formatWeekLabel(start, end),
    weekStart: start,
    weekEnd: end,
    totalSpent,
    totalIncome,
    totalSaved,
    transactionCount,
    avgPerDay,
    bestDay,
    bestDayAmount,
    dailySpend,
    topCategories,
    gastos:   { thisWeek: totalSpent, lastWeek: pSpent,  average: gastosAvg,   diff: gastosDiff,   diffPercent: gastosDiffPct },
    ingresos: { thisWeek: totalIncome, lastWeek: pIncome, average: ingresosAvg, diff: ingresosDiff, diffPercent: ingresosDiffPct },
    ahorro:   { thisWeek: totalSaved,  lastWeek: pSaved,  average: ahorroAvg,   diff: ahorroDiff,   diffPercent: ahorroDiffPct },
    aiInsight,
    badges: allBadges.slice(0, 3),
    xp,
    xpMax,
    level,
    levelTitle,
  };
}
