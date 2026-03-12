import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, Platform, Animated, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../../state';
import { useFinanceData } from '../../state/hooks/useFinanceData';
import { Transaction } from '../../types';
import { aiService } from '../../services/ai/AIService';
import { expensesByCategory, calculateTotalExpenses } from '../../core/financeEngine';
import { Icon, getCategoryIcon, UI_ICONS } from '../../components/ui/Icon';
import { TourRegistry } from '../../utils/TourRegistry';

// ─── Helpers ──────────────────────────────────────────────────────────
const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return Math.round(n).toString();
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

const webShadow = (s: string) =>
  Platform.OS === 'web' ? ({ boxShadow: s } as any) : {};


const LEVEL_TITLES = ['', 'Principiante 🌱', 'Aprendiz 📖', 'Gestor 📊', 'Experto 💡', 'Inversionista 🏆'];
const LEVEL_COLORS = ['', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

// ─── Props ────────────────────────────────────────────────────────────
interface FinancialFeedProps {
  transactions: Transaction[];
  onNavigateToSection: (section: string) => void;
}

// ─── Animated counter ─────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const anim  = useRef(new Animated.Value(0)).current;
  const [val, setVal] = useState(0);
  useEffect(() => {
    anim.setValue(0);
    const listener = anim.addListener(({ value }) => setVal(Math.round(value)));
    Animated.timing(anim, { toValue: target, duration, useNativeDriver: false }).start();
    return () => anim.removeListener(listener);
  }, [target]);
  return val;
}

// ─── BalanceHero ──────────────────────────────────────────────────────
const BalanceHero: React.FC<{
  balance: number;
  income: number;
  expenses: number;
  monthlySalary: number;
  userName?: string;
}> = ({ balance, income, expenses, monthlySalary, userName }) => {
  const displayBal = useCountUp(balance);
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = userName?.split(' ')[0] ?? 'Usuario';
  const dateStr = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

  const budgetPct = monthlySalary > 0 ? Math.min((expenses / monthlySalary) * 100, 100) : 0;
  const isOver = expenses > monthlySalary && monthlySalary > 0;
  const barColor = isOver ? '#EF4444' : budgetPct > 80 ? '#F59E0B' : '#10B981';

  return (
    <View style={[heroStyles.card, webShadow('0 4px 20px rgba(0,0,0,0.08)')]}>
      {/* Greeting */}
      <View style={heroStyles.greetRow}>
        <View>
          <Text style={heroStyles.greeting}>{greeting}, {firstName} 👋</Text>
          <Text style={heroStyles.date}>{dateStr}</Text>
        </View>
      </View>

      {/* Big balance */}
      <View style={heroStyles.balanceBlock}>
        <Text style={heroStyles.balanceLabel}>BALANCE DISPONIBLE</Text>
        <Text style={[heroStyles.balanceAmount, { color: balance >= 0 ? '#111827' : '#EF4444' }]}>
          {fmtCOP(displayBal)}
        </Text>
      </View>

      {/* Income / Expense pills */}
      <View style={heroStyles.pillRow}>
        <View style={[heroStyles.pill, { backgroundColor: '#ECFDF5' }]}>
          <Text style={heroStyles.pillIcon}>↑</Text>
          <View>
            <Text style={[heroStyles.pillAmount, { color: '#10B981' }]}>{fmtCOP(income)}</Text>
            <Text style={heroStyles.pillLabel}>Ingresos</Text>
          </View>
        </View>
        <View style={[heroStyles.pill, { backgroundColor: '#FEF2F2' }]}>
          <Text style={heroStyles.pillIcon}>↓</Text>
          <View>
            <Text style={[heroStyles.pillAmount, { color: '#EF4444' }]}>{fmtCOP(expenses)}</Text>
            <Text style={heroStyles.pillLabel}>Gastos</Text>
          </View>
        </View>
        <View style={[heroStyles.pill, { backgroundColor: '#EEF2FF' }]}>
          <Text style={heroStyles.pillIcon}>⊕</Text>
          <View>
            <Text style={[heroStyles.pillAmount, { color: '#6366F1' }]}>{fmtCOP(Math.max(0, income - expenses))}</Text>
            <Text style={heroStyles.pillLabel}>Ahorro</Text>
          </View>
        </View>
      </View>

      {/* Budget bar */}
      {monthlySalary > 0 && (
        <View style={heroStyles.budgetBar}>
          <View style={heroStyles.budgetBarHeader}>
            <Text style={heroStyles.budgetBarLabel}>Presupuesto mensual</Text>
            <Text style={[heroStyles.budgetBarPct, { color: barColor }]}>
              {budgetPct.toFixed(0)}% usado
            </Text>
          </View>
          <View style={heroStyles.barTrack}>
            <Animated.View style={[heroStyles.barFill, { width: `${budgetPct}%` as any, backgroundColor: barColor }]} />
          </View>
          <Text style={heroStyles.budgetBarSub}>
            {fmtCOP(expenses)} de {fmtCOP(monthlySalary)} · quedan {fmtCOP(Math.max(0, monthlySalary - expenses))}
          </Text>
        </View>
      )}
    </View>
  );
};

const heroStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1, borderColor: '#E5E7EB', padding: 20,
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 } : {}),
  },
  greetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 18, fontWeight: '800', color: '#111827' },
  date: { fontSize: 12, color: '#9CA3AF', marginTop: 2, textTransform: 'capitalize' as any },
  balanceBlock: { marginBottom: 16 },
  balanceLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  balanceAmount: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, padding: 10 },
  pillIcon: { fontSize: 16 },
  pillAmount: { fontSize: 13, fontWeight: '800' },
  pillLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginTop: 1 },
  budgetBar: { gap: 6 },
  budgetBarHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetBarLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  budgetBarPct: { fontSize: 11, fontWeight: '700' },
  barTrack: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  budgetBarSub: { fontSize: 11, color: '#9CA3AF' },
});

// ─── BarraEstadoMes ───────────────────────────────────────────────
const BarraEstadoMes: React.FC<{
  categories: any[];
  salario: number;
  onNavigate: (s: string) => void;
}> = ({ categories, salario, onNavigate }) => {
  const mes = new Date().toLocaleString('es-CO', { month: 'long', year: 'numeric' });
  const fCOP = (n: number) => '\$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
  const budgetCats = categories.filter((c: any) => c.tipo || (c.presupuesto ?? 0) > 0);
  const pagado = budgetCats.filter((c: any) => c.pagado).reduce((s: number, c: any) => s + (c.presupuesto || 0), 0);
  const total = budgetCats.reduce((s: number, c: any) => s + (c.presupuesto || 0), 0);
  const pendiente = total - pagado;
  const disponible = salario - total;
  const pct = total > 0 ? Math.min((pagado / total) * 100, 100) : 0;

  if (budgetCats.length === 0) return null;

  return (
    <TouchableOpacity
      style={[barraStyles.card, webShadow('0 2px 10px rgba(0,0,0,0.06)')]}
      onPress={() => onNavigate('ingresos')}
      activeOpacity={0.92}
    >
      <View style={barraStyles.header}>
        <Text style={barraStyles.title}>{mes.charAt(0).toUpperCase() + mes.slice(1)}</Text>
        <Text style={barraStyles.pct}>{pct.toFixed(0)}% pagado</Text>
      </View>
      <View style={barraStyles.track}>
        <View style={[barraStyles.fill, { width: (pct + '%') as any }]} />
      </View>
      <View style={barraStyles.row}>
        <Text style={barraStyles.label}>Pagado <Text style={[barraStyles.val, { color: '#10B981' }]}>{fCOP(pagado)}</Text></Text>
        <Text style={barraStyles.label}>Pendiente <Text style={[barraStyles.val, { color: '#EF4444' }]}>{fCOP(pendiente)}</Text></Text>
        <Text style={barraStyles.label}>Disponible <Text style={[barraStyles.val, { color: disponible >= 0 ? '#6366F1' : '#EF4444' }]}>{fCOP(disponible)}</Text></Text>
      </View>
    </TouchableOpacity>
  );
};

const barraStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB', padding: 16, gap: 10,
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 } : {}),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: '#111827', textTransform: 'capitalize' },
  pct: { fontSize: 13, fontWeight: '700', color: '#6366F1' },
  track: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#10B981', borderRadius: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  val: { fontSize: 12, fontWeight: '700' },
});

// ─── AlertasBanner ────────────────────────────────────────────────
const AlertasBanner: React.FC<{
  categories: any[];
  onNavigate: (s: string) => void;
}> = ({ categories, onNavigate }) => {
  const hoy = new Date().getDate();
  const urgentes = categories.filter((c: any) => {
    if (!c.tipo || c.pagado) return false;
    if (!c.diaPago) return false;
    const diff = c.diaPago - hoy;
    return diff <= 1;
  }).sort((a: any, b: any) => (a.diaPago || 0) - (b.diaPago || 0)).slice(0, 3);

  if (urgentes.length === 0) return null;
  const fCOP = (n: number) => '\$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
  return (
    <View style={{ gap: 6, marginHorizontal: 16, marginBottom: 12 }}>
      {urgentes.map((c: any) => {
        const diff = (c.diaPago || 0) - hoy;
        const isOverdue = diff < 0;
        const isToday = diff === 0;
        const bg = (isOverdue || isToday) ? '#FEF2F2' : '#FFFBEB';
        const border = (isOverdue || isToday) ? '#FCA5A5' : '#FDE68A';
        const label = isOverdue ? 'VENCIDO' : isToday ? 'HOY' : 'MANANA';
        return (
          <TouchableOpacity key={c.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: bg, borderRadius: 12, borderWidth: 1, borderColor: border, padding: 12, gap: 10, marginHorizontal: 16, marginBottom: 6 }} onPress={() => onNavigate("ingresos")} activeOpacity={0.8}>
            <Text style={{ fontSize: 20 }}>{c.icon || "💳"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>{c.name}</Text>
              <Text style={{ fontSize: 11, color: "#6B7280" }}>Dia {c.diaPago === 0 ? "ultimo" : c.diaPago}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: isOverdue || isToday ? "#EF4444" : "#F59E0B" }}>{label}</Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}>{fCOP(c.presupuesto || 0)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const GoalCard: React.FC<{ goal: any; transactions: Transaction[] }> = ({ goal, transactions }) => {
  if (!goal) return null;
  const target = goal.targetAmount ?? 0;
  if (target <= 0) return null;

  const totalSaved = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const current = Math.min(totalSaved, target);
  const pct = (current / target) * 100;
  const remaining = Math.max(0, target - current);

  return (
    <View style={[goalStyles.card, webShadow('0 2px 10px rgba(99,102,241,0.1)')]}>
      <View style={goalStyles.header}>
        <View style={goalStyles.iconCircle}>
          <Text style={{ fontSize: 18 }}>🎯</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={goalStyles.title}>{goal.title}</Text>
          <Text style={goalStyles.sub}>Meta financiera activa</Text>
        </View>
        <Text style={goalStyles.pctText}>{pct.toFixed(0)}%</Text>
      </View>
      <View style={goalStyles.barTrack}>
        <View style={[goalStyles.barFill, { width: `${Math.min(pct, 100)}%` as any }]} />
      </View>
      <View style={goalStyles.footer}>
        <Text style={goalStyles.footerLeft}>{fmtCOP(current)} ahorrados</Text>
        <Text style={goalStyles.footerRight}>Faltan {fmtCOP(remaining)}</Text>
      </View>
    </View>
  );
};

const goalStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E0E7FF',
    padding: 16,
    ...(Platform.OS !== 'web' ? { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 } : {}),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  pctText: { fontSize: 22, fontWeight: '900', color: '#6366F1' },
  barTrack: { height: 8, backgroundColor: '#EEF2FF', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  footerLeft: { fontSize: 12, color: '#10B981', fontWeight: '700' },
  footerRight: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
});

// ─── GamificationCard ─────────────────────────────────────────────────
const GamificationCard: React.FC<{
  userLevel: any;
  transactions: Transaction[];
  achievements: any[];
  onNavigate: (s: string) => void;
}> = ({ userLevel, transactions, achievements, onNavigate }) => {
  const level  = userLevel?.level ?? 1;
  const xp     = userLevel?.experience ?? 0;
  const xpNext = level * 1000;
  const xpPct  = Math.min((xp % 1000) / 10, 100);
  const title  = LEVEL_TITLES[Math.min(level, 5)] ?? LEVEL_TITLES[1];
  const color  = LEVEL_COLORS[Math.min(level, 5)] ?? LEVEL_COLORS[1];

  // Streak: consecutive days with at least 1 transaction
  const streak = useMemo(() => {
    const days = new Set(transactions.map(t => t.date.slice(0, 10)));
    const today = new Date();
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (days.has(d.toISOString().slice(0, 10))) count++;
      else break;
    }
    return count;
  }, [transactions]);

  // Mini achievements (hardcoded + dynamic unlock check)
  const badges = useMemo(() => [
    { icon: '💰', label: 'Primer ingreso', unlocked: transactions.some(t => t.type === 'income') },
    { icon: '📊', label: 'Primer gasto', unlocked: transactions.some(t => t.type === 'expense') },
    { icon: '🔥', label: 'Racha 3 días', unlocked: streak >= 3 },
    { icon: '🏆', label: 'Racha 7 días', unlocked: streak >= 7 },
    { icon: '🌟', label: '10 transacciones', unlocked: transactions.length >= 10 },
    { icon: '💎', label: '50 transacciones', unlocked: transactions.length >= 50 },
  ], [transactions, streak]);

  const unlocked = badges.filter(b => b.unlocked).length;

  return (
    <TouchableOpacity
      style={[gamStyles.card, webShadow('0 2px 10px rgba(0,0,0,0.06)')]}
      onPress={() => onNavigate('perfil')}
      activeOpacity={0.95}
    >
      {/* Level header */}
      <View style={gamStyles.header}>
        <View style={[gamStyles.levelBadge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
          <Text style={[gamStyles.levelNum, { color }]}>Nv.{level}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={gamStyles.title}>{title}</Text>
          <Text style={gamStyles.sub}>{xp} XP · siguiente nivel: {xpNext} XP</Text>
        </View>
        {streak > 0 && (
          <View style={gamStyles.streakPill}>
            <Text style={gamStyles.streakText}>🔥 {streak}d</Text>
          </View>
        )}
      </View>

      {/* XP bar */}
      <View style={gamStyles.xpTrack}>
        <View style={[gamStyles.xpFill, { width: `${xpPct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={gamStyles.xpLabel}>{xpPct.toFixed(0)}% para nivel {level + 1}</Text>

      {/* Badges */}
      <View style={gamStyles.badgesRow}>
        {badges.map((b, i) => (
          <View key={i} style={[gamStyles.badge, !b.unlocked && gamStyles.badgeLocked]}>
            <Text style={[gamStyles.badgeIcon, !b.unlocked && { opacity: 0.3 }]}>{b.icon}</Text>
          </View>
        ))}
        <View style={gamStyles.badgeStats}>
          <Text style={gamStyles.badgeStatsNum}>{unlocked}/{badges.length}</Text>
          <Text style={gamStyles.badgeStatsSub}>logros</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const gamStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB', padding: 16,
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 } : {}),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  levelBadge: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  levelNum: { fontSize: 16, fontWeight: '900' },
  title: { fontSize: 14, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  streakPill: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  streakText: { fontSize: 13, fontWeight: '700', color: '#D97706' },
  xpTrack: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  xpFill: { height: '100%', borderRadius: 3 },
  xpLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginBottom: 14 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  badgeLocked: { backgroundColor: '#F9FAFB' },
  badgeIcon: { fontSize: 18 },
  badgeStats: { marginLeft: 'auto' as any, alignItems: 'flex-end' },
  badgeStatsNum: { fontSize: 18, fontWeight: '900', color: '#111827' },
  badgeStatsSub: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
});

// ─── BudgetAlerts ─────────────────────────────────────────────────────
const BudgetAlerts: React.FC<{
  transactions: Transaction[];
  categories: any[];
  onNavigate: (s: string) => void;
}> = ({ transactions, categories, onNavigate }) => {
  const now = new Date();
  const thisMonth = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }),
    [transactions]
  );

  const alerts = useMemo(() => {
    const byCategory = expensesByCategory(thisMonth);
    return categories
      .filter(c => c.budget && c.budget > 0)
      .map(c => ({ cat: c, spent: byCategory[c.id] ?? 0, pct: ((byCategory[c.id] ?? 0) / c.budget!) * 100 }))
      .filter(a => a.pct >= 80)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
  }, [thisMonth, categories]);

  if (alerts.length === 0) return null;

  return (
    <TouchableOpacity
      style={[alertStyles.card, webShadow('0 2px 8px rgba(239,68,68,0.1)')]}
      onPress={() => onNavigate('estadisticas')}
      activeOpacity={0.9}
    >
      <View style={alertStyles.header}>
        <Text style={alertStyles.title}>⚠️ Alertas de presupuesto</Text>
        <Text style={alertStyles.link}>Ver todo ›</Text>
      </View>
      {alerts.map((a, i) => (
        <View key={i} style={alertStyles.row}>
          <Icon name={getCategoryIcon(a.cat.id ?? a.cat.name)} size={14} color={a.pct >= 100 ? '#EF4444' : '#F59E0B'} />
          <Text style={alertStyles.catName}>{a.cat.name}</Text>
          <View style={alertStyles.alertBarTrack}>
            <View style={[alertStyles.alertBarFill, {
              width: `${Math.min(a.pct, 100)}%` as any,
              backgroundColor: a.pct >= 100 ? '#EF4444' : '#F59E0B',
            }]} />
          </View>
          <Text style={[alertStyles.pct, { color: a.pct >= 100 ? '#EF4444' : '#F59E0B' }]}>
            {a.pct.toFixed(0)}%
          </Text>
        </View>
      ))}
    </TouchableOpacity>
  );
};

const alertStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#FFFBEB', borderRadius: 16,
    borderWidth: 1, borderColor: '#FDE68A', padding: 14,
    ...(Platform.OS !== 'web' ? { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 6, elevation: 2 } : {}),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  link: { fontSize: 12, fontWeight: '600', color: '#D97706' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },

  catName: { fontSize: 12, fontWeight: '600', color: '#374151', width: 70 },
  alertBarTrack: { flex: 1, height: 5, backgroundColor: '#FEF3C7', borderRadius: 3, overflow: 'hidden' },
  alertBarFill: { height: '100%', borderRadius: 3 },
  pct: { fontSize: 11, fontWeight: '700', width: 36, textAlign: 'right' as any },
});

// ─── AIInsight ────────────────────────────────────────────────────────
const AIInsightCard: React.FC<{
  transactions: Transaction[];
  profile: any;
  goal: any;
  onNavigate: (s: string) => void;
}> = ({ transactions, profile, goal, onNavigate }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.12, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const insight = useMemo(() => {
    if (profile && transactions.length > 0) {
      return aiService.generateDailyInsight(transactions as any, profile as any, profile.monthlySalary ?? 0);
    }
    return { message: goal ? `Meta activa: "${(goal as any).title}". Registra transacciones para análisis.` : 'Registra tus gastos e ingresos para recibir recomendaciones.' };
  }, [transactions.length, profile, goal]);

  return (
    <TouchableOpacity style={[aiStyles.card, webShadow('0 2px 12px rgba(99,102,241,0.10)')]} onPress={() => onNavigate('bot')} activeOpacity={0.88}>
      <Animated.View style={[aiStyles.avatar, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={aiStyles.avatarIcon}>✦</Text>
      </Animated.View>
      <View style={aiStyles.body}>
        <Text style={aiStyles.title}>Consejo del día</Text>
        <Text style={aiStyles.text} numberOfLines={2}>{insight.message}</Text>
      </View>
      <Text style={aiStyles.arrow}>›</Text>
    </TouchableOpacity>
  );
};

const aiStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E0E7FF',
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    ...(Platform.OS !== 'web' ? { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 } : {}),
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarIcon: { fontSize: 20, color: '#6366F1' },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 12, fontWeight: '700', color: '#6366F1', letterSpacing: 0.3 },
  text: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  arrow: { fontSize: 22, color: '#9CA3AF' },
});

// ─── TodayTransactions ────────────────────────────────────────────────
const TxItem: React.FC<{ tx: Transaction; index: number; isLast: boolean }> = ({ tx, index, isLast }) => {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 280, delay: index * 40, useNativeDriver: true }).start();
  }, []);
  const isIncome = tx.type === 'income';
  return (
    <Animated.View style={[txStyles.row, !isLast && txStyles.rowBorder, { opacity: fade }]}>
      <View style={[txStyles.icon, { backgroundColor: isIncome ? '#DCFCE7' : '#FEE2E2' }]}>
        <Icon name={getCategoryIcon(tx.category)} size={18} color={isIncome ? '#16A34A' : '#DC2626'} />
      </View>
      <View style={txStyles.info}>
        <Text style={txStyles.cat}>{tx.category.charAt(0).toUpperCase() + tx.category.slice(1)}</Text>
        {tx.description ? <Text style={txStyles.desc} numberOfLines={1}>{tx.description}</Text> : null}
        <Text style={txStyles.date}>{fmtDate(tx.date)}</Text>
      </View>
      <Text style={[txStyles.amt, { color: isIncome ? '#16A34A' : '#DC2626' }]}>
        {isIncome ? '+' : '-'}{fmtCOP(tx.amount)}
      </Text>
    </Animated.View>
  );
};

const txStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  info: { flex: 1, gap: 2 },
  cat: { fontSize: 14, fontWeight: '600', color: '#111827' },
  desc: { fontSize: 11, color: '#9CA3AF' },
  date: { fontSize: 11, color: '#9CA3AF' },
  amt: { fontSize: 14, fontWeight: '700' },
});

// ─── DrawerMenu ────────────────────────────────────────────────────────
const DRAWER_ITEMS = [
  { key: 'inicio',        label: 'Inicio',          icon: '🏠', section: ''            },
  { key: 'ingresos',      label: 'Ingresos',        icon: '💰', section: 'ingresos'    },
  { key: 'gastos',        label: 'Gastos',          icon: '💸', section: 'gastos'      },
  { key: 'estadisticas',  label: 'Estadísticas',    icon: '📊', section: 'estadisticas'},
  { key: 'finanzas',      label: 'Presupuesto',     icon: '🗂',  section: 'finanzas'   },
  { key: 'bot',           label: 'Asistente IA',    icon: '🤖', section: 'bot'         },
  { key: 'historial',     label: 'Historial',       icon: '📜', section: 'historial'  },
  { key: 'perfil',        label: 'Mi Perfil',       icon: '👤', section: 'perfil'      },
];

const DrawerMenu: React.FC<{
  visible: boolean;
  onClose: () => void;
  onNavigate: (s: string) => void;
  userName?: string;
  userLevel?: any;
}> = ({ visible, onClose, onNavigate, userName, userLevel }) => {
  const slideAnim  = React.useRef(new Animated.Value(-300)).current;
  const backdropOp = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -300, duration: 230, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleItem = (section: string) => {
    onClose();
    setTimeout(() => { if (section) onNavigate(section); }, 160);
  };

  const level = userLevel?.level ?? 1;
  const title = userLevel?.title ?? 'Principiante';
  const firstName = userName?.split(' ')[0] ?? 'Usuario';
  const xpPct = userLevel ? Math.round((userLevel.experience % 1000) / 10) : 0;

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={drwStyles.backdrop} activeOpacity={1} onPress={onClose}>
        <Animated.View style={[drwStyles.backdropInner, { opacity: backdropOp }]} />
      </TouchableOpacity>

      <Animated.View style={[drwStyles.panel, { transform: [{ translateX: slideAnim }] }]}>
        <View style={drwStyles.header}>
          <View style={drwStyles.appRow}>
            <View style={drwStyles.appIconBg}>
              <Text style={drwStyles.appIcon}>✦</Text>
            </View>
            <View>
              <Text style={drwStyles.appName}>FinancyAI</Text>
              <Text style={drwStyles.appSub}>Tus finanzas inteligentes</Text>
            </View>
          </View>
          <View style={drwStyles.userCard}>
            <View style={drwStyles.avatarCircle}>
              <Text style={drwStyles.avatarLetter}>{firstName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={drwStyles.userName}>{firstName}</Text>
              <Text style={drwStyles.userTitle}>Nivel {level} - {title}</Text>
              <View style={drwStyles.xpBar}>
                <View style={[drwStyles.xpFill, { width: (xpPct + '%') as any }]} />
              </View>
            </View>
          </View>
        </View>

        <View style={drwStyles.nav}>
          {DRAWER_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.key}
              style={[drwStyles.navItem, i < DRAWER_ITEMS.length - 1 && drwStyles.navItemBorder]}
              onPress={() => handleItem(item.section)}
              activeOpacity={0.7}
            >
              <Text style={drwStyles.navIcon}>{item.icon}</Text>
              <Text style={drwStyles.navLabel}>{item.label}</Text>
              <Text style={drwStyles.navArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={drwStyles.footer}>
          <Text style={drwStyles.footerText}>FinancyAI v1.0</Text>
        </View>
      </Animated.View>
    </Modal>
  );
};

const drwStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  backdropInner: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: 280,
    backgroundColor: '#FFFFFF', zIndex: 10,
  },
  header: { backgroundColor: '#6366F1', paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20 },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  appIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  appIcon: { fontSize: 18, color: '#FFFFFF' },
  appName: { fontSize: 17, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },
  appSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 12 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  userName: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  userTitle: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  xpBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 2 },
  nav: { flex: 1, paddingVertical: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, gap: 14 },
  navItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  navIcon: { fontSize: 20, width: 28, textAlign: 'center' as any },
  navLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  navArrow: { fontSize: 20, color: '#D1D5DB', fontWeight: '300' },
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  footerText: { fontSize: 11, color: '#D1D5DB', textAlign: 'center' as any },
});


// ─── Main Component ────────────────────────────────────────────────────
// ─── Main Component ────────────────────────────────────────────────────
export const FinancialFeed: React.FC<FinancialFeedProps> = ({ transactions, onNavigateToSection }) => {
  const { user, profile, goal, userLevel, achievements, categories } = useFinance();
  const { balance, totalIncome, totalExpenses } = useFinanceData();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmall = width < 768;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Tour ref: hero card
  const heroRef = useRef<View>(null);
  useEffect(() => {
    TourRegistry.register('hero_card', heroRef as any);
    return () => TourRegistry.unregister('hero_card');
  }, []);

  const monthlySalary = profile?.monthlySalary ?? user?.monthlySalary ?? 0;

  // Today's transactions
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTxs = useMemo(
    () => transactions.filter(t => t.date.slice(0, 10) === todayStr),
    [transactions]
  );
  // Recent transactions (excluding today, up to 5)
  const recentTxs = useMemo(
    () => transactions.filter(t => t.date.slice(0, 10) !== todayStr).slice(0, 5),
    [transactions]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isSmall ? 0 : 0 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.appHeader}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setDrawerOpen(true)}>
            <Icon name={UI_ICONS.menu} size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.appTitle}>FinancyAI</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => onNavigateToSection('estadisticas')}>
              <Icon name={UI_ICONS.stats} size={20} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => onNavigateToSection('bot')}>
              <Icon name={UI_ICONS.ai} size={20} color="#6366F1" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Balance Hero ── */}
        <View ref={heroRef} collapsable={false}>
          <BalanceHero
            balance={balance}
            income={totalIncome}
            expenses={totalExpenses}
            monthlySalary={monthlySalary}
            userName={user?.name}
          />
        </View>

        {/* ── Barra Estado Mes ── */}
        <BarraEstadoMes
          categories={categories}
          salario={monthlySalary}
          onNavigate={onNavigateToSection}
        />

        {/* ── Alertas Urgentes ── */}
        <AlertasBanner
          categories={categories}
          onNavigate={onNavigateToSection}
        />

        {/* ── Budget Alerts ── */}
        <BudgetAlerts
          transactions={transactions}
          categories={categories}
          onNavigate={onNavigateToSection}
        />

        {/* ── Goal Progress ── */}
        <GoalCard goal={goal} transactions={transactions} />

        {/* ── Gamification ── */}
        <GamificationCard
          userLevel={userLevel}
          transactions={transactions}
          achievements={achievements}
          onNavigate={onNavigateToSection}
        />

        {/* ── AI Insight ── */}
        <AIInsightCard
          transactions={transactions}
          profile={profile}
          goal={goal}
          onNavigate={onNavigateToSection}
        />

        {/* ── Hoy ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Hoy {todayTxs.length > 0 ? `· ${todayTxs.length} movimientos` : ''}
            </Text>
          </View>
          <View style={styles.txCard}>
            {todayTxs.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>☀️</Text>
                <Text style={styles.emptyText}>Sin movimientos hoy</Text>
                <Text style={styles.emptySub}>Usa los botones + / − para registrar</Text>
              </View>
            ) : (
              todayTxs.map((tx, i) => <TxItem key={tx.id} tx={tx} index={i} isLast={i === todayTxs.length - 1} />)
            )}
          </View>
        </View>

        {/* ── Recientes ── */}
        {recentTxs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Últimos movimientos</Text>
              <TouchableOpacity onPress={() => onNavigateToSection('ingresos')}>
                <Text style={styles.sectionLink}>Ver todos ›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.txCard}>
              {recentTxs.map((tx, i) => <TxItem key={tx.id} tx={tx} index={i} isLast={i === recentTxs.length - 1} />)}
            </View>
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

{/* ── Drawer Menu ── */}
      <DrawerMenu
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={onNavigateToSection}
        userName={user?.name}
        userLevel={userLevel}
      />

      {/* ── Bottom Action Bar ── */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.btnExpense} onPress={() => onNavigateToSection('quick_expense')}>
          <Text style={styles.btnIcon}>−</Text>
          <Text style={styles.btnLabel}>Gasto</Text>
        </TouchableOpacity>
        <View style={styles.balancePill}>
          <Text style={styles.balancePillLabel}>BALANCE</Text>
          <Text style={[styles.balancePillAmount, { color: balance >= 0 ? '#111827' : '#EF4444' }]}>
            {fmtCOP(balance)}
          </Text>
        </View>
        <TouchableOpacity style={styles.btnIncome} onPress={() => onNavigateToSection('quick_income')}>
          <Text style={styles.btnIcon}>+</Text>
          <Text style={styles.btnLabel}>Ingreso</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16, paddingTop: 0 },

  // App header
  appHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
    backgroundColor: '#F8FAFC',
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { fontSize: 18, color: '#374151', fontWeight: '700' },
  appTitle: { fontSize: 17, fontWeight: '900', color: '#111827', letterSpacing: 0.2 },
  headerRight: { flexDirection: 'row', gap: 2 },

  // Sections
  section: { marginHorizontal: 16, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  sectionLink: { fontSize: 13, fontWeight: '600', color: '#6366F1' },

  // Transaction card
  txCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E5E7EB',
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 } : {}),
  },

  // Empty state
  emptyState: { padding: 28, alignItems: 'center', gap: 6 },
  emptyEmoji: { fontSize: 32, marginBottom: 4 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  // Action bar
  actionBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB',
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 } : {}),
  },
  btnExpense: {
    width: 60, height: 54, borderRadius: 16, backgroundColor: '#FEF2F2',
    borderWidth: 1.5, borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center',
  },
  btnIncome: {
    width: 60, height: 54, borderRadius: 16, backgroundColor: '#ECFDF5',
    borderWidth: 1.5, borderColor: '#6EE7B7', alignItems: 'center', justifyContent: 'center',
  },
  btnIcon: { fontSize: 22, fontWeight: '300', color: '#374151', lineHeight: 26 },
  btnLabel: { fontSize: 9, fontWeight: '700', color: '#6B7280', marginTop: 1 },
  balancePill: {
    flex: 1, height: 54, borderRadius: 16, backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center',
  },
  balancePillLabel: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8 },
  balancePillAmount: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5, marginTop: 1 },
});