import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Animated,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Transaction, calculateTotalExpenses, expensesByCategory } from '@/src/core/financeEngine';
import { useFinance } from '@/src/core/context/FinanceContext';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { aiService } from '../services/ai/AIService';
import { storageService } from '../services/storage/StorageService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, getCategoryIcon } from '../components/ui/Icon';

const formatCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

const CAT_COLORS = [
  '#6366F1', '#10B981', '#EF4444', '#F59E0B',
  '#8B5CF6', '#06B6D4', '#F97316', '#EC4899',
];

const webShadow = (s: string) =>
  Platform.OS === 'web' ? ({ boxShadow: s } as any) : {};

interface EstadisticasProps {
  transactions: Transaction[];
  monthlySalary: number;
}

type Period = '1m' | 'prev' | '3m' | '6m';
type ChartType = 'dona' | 'barras' | 'linea';

const PERIODS: { id: Period; label: string }[] = [
  { id: '1m',   label: 'Este mes' },
  { id: 'prev', label: 'Mes ant.' },
  { id: '3m',   label: '3 meses' },
  { id: '6m',   label: '6 meses' },
];

const CHART_TYPES: { id: ChartType; label: string; icon: string }[] = [
  { id: 'dona',   label: 'Dona',   icon: '◎' },
  { id: 'barras', label: 'Barras', icon: '▦' },
  { id: 'linea',  label: 'Línea',  icon: '∿' },
];

// ─── Bar Chart ────────────────────────────────────────────────────────
interface BarItem { name: string; value: number; color: string; icon?: string; }

function BarChartView({ data }: { data: BarItem[] }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  if (data.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Text style={{ fontSize: 30, marginBottom: 8 }}>📊</Text>
        <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>Sin gastos en este período</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 14 }}>
      {data.map((item, i) => {
        const pct = (item.value / maxVal) * 100;
        return (
          <View key={i} style={{ gap: 5 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }} numberOfLines={1}>
                {item.icon ? item.icon + ' ' : ''}{item.name}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: item.color }}>{formatCOP(item.value)}</Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
              <Animated.View style={{ width: `${pct}%` as any, height: '100%', backgroundColor: item.color, borderRadius: 4 }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Line Chart ───────────────────────────────────────────────────────
interface DailyPoint { label: string; amount: number; }

function LineChartView({ data, chartWidth }: { data: DailyPoint[]; chartWidth: number }) {
  if (data.length < 2) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Text style={{ fontSize: 30, marginBottom: 8 }}>📈</Text>
        <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>
          Registra más transacciones para ver la tendencia diaria
        </Text>
      </View>
    );
  }
  const W = Math.max(chartWidth - 8, 100);
  const H = 130;
  const maxVal = Math.max(...data.map(d => d.amount), 1);
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (d.amount / maxVal) * (H - 12),
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${W.toFixed(1)},${H} L0,${H} Z`;

  return (
    <View>
      <Svg width={W} height={H + 4} style={{ overflow: 'visible' }}>
        <Path d={areaPath} fill="rgba(99,102,241,0.08)" />
        <Path d={linePath} stroke="#6366F1" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#6366F1" />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 10, color: '#9CA3AF', fontWeight: '600' }}>{data[0]?.label}</Text>
        <Text style={{ fontSize: 10, color: '#9CA3AF', fontWeight: '600' }}>{data[data.length - 1]?.label}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700' }}>{formatCOP(data[0]?.amount ?? 0)}</Text>
        <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700' }}>{formatCOP(data[data.length - 1]?.amount ?? 0)}</Text>
      </View>
    </View>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────
interface ChartSlice { value: number; color: string; }

function DonutChart({ data, size = 200, strokeWidth = 26 }: {
  data: ChartSlice[];
  size?: number;
  strokeWidth?: number;
}) {
  const r    = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;

  if (data.length === 0) {
    // Fallback: anillo verde completo (salario sin categorías)
    if (Platform.OS === 'web') {
      const holeR = size * 0.62;
      return (
        <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
          ...({ backgroundImage: `conic-gradient(#10B981 0% 100%)` } as any) }}>
          <View style={{ width: holeR, height: holeR, borderRadius: holeR / 2, backgroundColor: '#FFFFFF' }} />
        </View>
      );
    }
    return (
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#10B981" strokeWidth={strokeWidth} fill="none" />
      </Svg>
    );
  }

  if (Platform.OS === 'web') {
    let cum = 0;
    const stops = data.map(s => {
      const from = cum;
      cum += s.value;
      return `${s.color} ${from.toFixed(2)}% ${cum.toFixed(2)}%`;
    });
    const holeR = size * 0.62;
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        ...({ backgroundImage: `conic-gradient(${stops.join(', ')})` } as any) }}>
        <View style={{ width: holeR, height: holeR, borderRadius: holeR / 2, backgroundColor: '#FFFFFF' }} />
      </View>
    );
  }

  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${size / 2},${size / 2}`}>
        {data.map((s, i) => {
          const arcLen = (s.value / 100) * circ;
          const el = (
            <Circle
              key={i}
              cx={size / 2} cy={size / 2} r={r}
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLen} ${circ}`}
              strokeDashoffset={-offset}
              fill="none"
            />
          );
          offset += arcLen;
          return el;
        })}
      </G>
    </Svg>
  );
}

// ─── Confetti ─────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#EF4444'];
const N_PIECES = 18;

function ConfettiBurst({ visible }: { visible: boolean }) {
  const anims = useRef(
    Array.from({ length: N_PIECES }, () => ({
      x: new Animated.Value(0), y: new Animated.Value(0),
      op: new Animated.Value(1), rot: new Animated.Value(0),
    }))
  ).current;

  React.useEffect(() => {
    if (!visible) return;
    const animations = anims.map(a => {
      const dx = (Math.random() - 0.5) * 200;
      const dy = -(Math.random() * 140 + 60);
      a.x.setValue(0); a.y.setValue(0); a.op.setValue(1); a.rot.setValue(0);
      return Animated.parallel([
        Animated.timing(a.x,   { toValue: dx, duration: 600, useNativeDriver: true }),
        Animated.timing(a.y,   { toValue: dy, duration: 600, useNativeDriver: true }),
        Animated.timing(a.op,  { toValue: 0,  duration: 600, useNativeDriver: true }),
        Animated.timing(a.rot, { toValue: Math.random() * 4 - 2, duration: 600, useNativeDriver: true }),
      ]);
    });
    Animated.stagger(20, animations).start();
  }, [visible]);

  if (!visible) return null;
  return (
    <View style={confettiStyles.container} pointerEvents="none">
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[confettiStyles.piece, {
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            transform: [
              { translateX: a.x }, { translateY: a.y },
              { rotate: a.rot.interpolate({ inputRange: [-2, 2], outputRange: ['-180deg', '180deg'] }) },
            ],
            opacity: a.op,
          }]}
        />
      ))}
    </View>
  );
}

const confettiStyles = StyleSheet.create({
  container: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
    width: '100%', bottom: 60, zIndex: 100, pointerEvents: 'none' as any,
  },
  piece: { position: 'absolute', width: 8, height: 8, borderRadius: 2 },
});

function filterByPeriod(txs: Transaction[], period: Period): Transaction[] {
  const now = new Date();
  return txs.filter(t => {
    const d = new Date(t.date);
    if (period === '1m') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === 'prev') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
    }
    if (period === '3m') return d >= new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return d >= new Date(now.getFullYear(), now.getMonth() - 5, 1);
  });
}

// ─── Main Component ───────────────────────────────────────────────────
export function Estadisticas({ transactions, monthlySalary }: EstadisticasProps) {
  const { width } = useWindowDimensions();
  const { categories, updateCategory, profile, goal } = useFinance();
  const isSmall = width < 768;

  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('1m');
  const [chartType, setChartType] = useState<ChartType>('dona');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editFocused, setEditFocused] = useState(false);
  const [paidCatIds, setPaidCatIds] = useState<Set<string>>(new Set());
  const [confettiKey, setConfettiKey] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Load paid category IDs from storage on mount
  useEffect(() => {
    storageService.getPaidTxIds().then(ids => {
      if (ids && ids.length > 0) setPaidCatIds(new Set(ids));
    });
  }, []);

  // Sync edit amount when a category is selected
  useEffect(() => {
    if (selectedCatId) {
      const cat = categories.find(c => c.id === selectedCatId);
      setEditAmount(cat?.budget ? cat.budget.toString() : '');
    }
  }, [selectedCatId]);

  const filteredTxs = useMemo(() => filterByPeriod(transactions, period), [transactions, period]);

  // Expense stats for the period
  const stats = useMemo(() => {
    const expByCategory = expensesByCategory(filteredTxs);
    const totalExpenses = calculateTotalExpenses(filteredTxs);
    const expenses = filteredTxs.filter(t => t.type === 'expense');
    const spendingPercentage = monthlySalary > 0 ? (totalExpenses / monthlySalary) * 100 : 0;
    return {
      totalExpenses, expByCategory, spendingPercentage,
      averageExpense: expenses.length > 0 ? totalExpenses / expenses.length : 0,
      transactionCount: expenses.length,
    };
  }, [filteredTxs, monthlySalary]);

  // ── Budget allocation data (drives the donut) ──────────────────────
  const budgetData = useMemo(() => {
    const budgeted = categories
      .filter(c => (c.budget ?? 0) > 0)
      .map((c, i) => ({
        id: c.id,
        name: c.name,
        icon: c.icon ?? '📦',
        budget: c.budget!,
        pct: monthlySalary > 0 ? Math.min((c.budget! / monthlySalary) * 100, 100) : 0,
        color: c.color ?? CAT_COLORS[i % CAT_COLORS.length],
        spent: stats.expByCategory[c.id] ?? 0,
      }));

    const totalBudgeted = budgeted.reduce((s, b) => s + b.budget, 0);
    const remaining = Math.max(0, monthlySalary - totalBudgeted);
    return { budgeted, remaining, totalBudgeted };
  }, [categories, monthlySalary, stats.expByCategory]);

  // Donut slices: verde = salario libre, colores = categorías que lo "muerden"
  // El verde siempre va primero (base del salario), luego las categorías encima
  const donutSlices = useMemo((): ChartSlice[] => {
    if (monthlySalary <= 0) return [{ value: 100, color: '#10B981' }];
    // Si no hay categorías, todo verde
    if (budgetData.budgeted.length === 0) return [{ value: 100, color: '#10B981' }];
    // Disponible (verde) va al principio como base
    const categorySlices = budgetData.budgeted.map(b => ({ value: b.pct, color: b.color }));
    const remainingPct = budgetData.remaining > 0
      ? (budgetData.remaining / monthlySalary) * 100
      : 0;
    // Verde al final (lo que queda libre)
    if (remainingPct > 0) {
      categorySlices.push({ value: remainingPct, color: '#10B981' });
    }
    return categorySlices;
  }, [budgetData, monthlySalary]);

  // Expense slices by category (actual spending, reactive)
  const expenseSlices = useMemo((): BarItem[] => {
    return Object.entries(stats.expByCategory)
      .map(([catId, amount], i) => {
        const cat = categories.find(c => c.id === catId);
        return {
          name: cat?.name ?? catId,
          value: amount,
          color: cat?.color ?? CAT_COLORS[i % CAT_COLORS.length],
          icon: cat?.icon,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [stats.expByCategory, categories]);

  // Donut slices for actual spending (not budget)
  const expenseDonutSlices = useMemo((): ChartSlice[] => {
    const total = stats.totalExpenses;
    if (total <= 0) return [];
    return expenseSlices.map(s => ({ value: (s.value / total) * 100, color: s.color }));
  }, [expenseSlices, stats.totalExpenses]);

  // Daily spending trend (for line chart)
  const dailySpending = useMemo((): DailyPoint[] => {
    const map = new Map<string, number>();
    filteredTxs
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const day = t.date.slice(0, 10);
        map.set(day, (map.get(day) ?? 0) + t.amount);
      });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        label: new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        amount,
      }));
  }, [filteredTxs]);

  // AI insights
  const aiInsights = useMemo(() => {
    const anomalies = aiService.detectAnomalies(transactions as any);
    const goalInsight = goal && profile
      ? aiService.analyzeGoalProgress(transactions as any, goal as any, monthlySalary)
      : null;
    return { anomalies: anomalies.slice(0, 2), goalInsight };
  }, [transactions.length, goal, profile, monthlySalary]);

  // Selected category for the modal
  const selectedCat = useMemo(
    () => (selectedCatId ? categories.find(c => c.id === selectedCatId) : null),
    [selectedCatId, categories]
  );

  // ── Actions ──────────────────────────────────────────────────────────
  const handleTogglePaid = useCallback((catId: string) => {
    setPaidCatIds(prev => {
      const next = new Set(prev);
      const wasPaid = next.has(catId);
      wasPaid ? next.delete(catId) : next.add(catId);
      storageService.savePaidTxIds([...next]).catch(console.error);
      if (!wasPaid) {
        setConfettiKey(k => k + 1);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 700);
      }
      return next;
    });
  }, []);

  const handleSaveBudget = useCallback(() => {
    if (!selectedCatId) return;
    const amount = parseInt(editAmount.replace(/\./g, ''), 10);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Monto inválido', 'Ingresa un valor numérico válido');
      return;
    }
    updateCategory(selectedCatId, { budget: amount });
    setSelectedCatId(null);
  }, [selectedCatId, editAmount, updateCategory]);

  const handleDeleteCategory = useCallback(() => {
    if (!selectedCatId) return;
    Alert.alert(
      'Eliminar categoría',
      '¿Quitar esta categoría del presupuesto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: () => {
            updateCategory(selectedCatId, { budget: 0 });
            setSelectedCatId(null);
          },
        },
      ]
    );
  }, [selectedCatId, updateCategory]);

  const STAT_CARDS = [
    { label: 'GASTOS TOTALES', value: formatCOP(stats.totalExpenses), color: '#EF4444', bg: '#FEF2F2' },
    { label: 'GASTO PROMEDIO', value: formatCOP(stats.averageExpense), color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'PRESUPUESTADO',  value: formatCOP(budgetData.totalBudgeted), color: '#8B5CF6', bg: '#F5F3FF' },
    { label: '% PRESUPUESTO',  value: `${stats.spendingPercentage.toFixed(0)}%`,
      color: stats.spendingPercentage > 100 ? '#EF4444' : '#10B981',
      bg:    stats.spendingPercentage > 100 ? '#FEF2F2' : '#ECFDF5' },
  ];

  const currentMonth = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  return (
    <ScrollView
      style={[styles.scroll, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>ESTADÍSTICAS</Text>
        <Text style={styles.headerMonth}>{currentMonth}</Text>
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.periodPill, period === p.id && styles.periodPillActive]}
              onPress={() => setPeriod(p.id)}
            >
              <Text style={[styles.periodPillText, period === p.id && styles.periodPillTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Stat cards — 2×2 grid */}
      <View style={styles.statsGrid}>
        {STAT_CARDS.map((s, i) => (
          <View key={i} style={[styles.statCard, { backgroundColor: s.bg, borderTopColor: s.color }, webShadow('0 2px 8px rgba(0,0,0,0.05)')]}>
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
          </View>
        ))}
      </View>

      {/* ── Mis Gastos — chart selector ── */}
      <View style={[styles.card, webShadow('0 2px 8px rgba(0,0,0,0.05)')]}>
        {/* Card header: title + chart type tabs */}
        <View style={styles.chartCardHeader}>
          <View>
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Mis Gastos</Text>
            <Text style={styles.chartCardSub}>
              {stats.totalExpenses > 0 ? formatCOP(stats.totalExpenses) + ' gastados' : 'Sin gastos'}
            </Text>
          </View>
          <View style={styles.chartTypeTabs}>
            {CHART_TYPES.map(ct => (
              <TouchableOpacity
                key={ct.id}
                style={[styles.chartTypeTab, chartType === ct.id && styles.chartTypeTabActive]}
                onPress={() => setChartType(ct.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chartTypeTabIcon, chartType === ct.id && styles.chartTypeTabIconActive]}>
                  {ct.icon}
                </Text>
                <Text style={[styles.chartTypeTabText, chartType === ct.id && styles.chartTypeTabTextActive]}>
                  {ct.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Chart area */}
        {stats.totalExpenses <= 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>💸</Text>
            <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>
              Aún no hay gastos registrados en este período
            </Text>
          </View>
        ) : chartType === 'dona' ? (
          <View>
            <View style={styles.donutContainer}>
              <DonutChart data={expenseDonutSlices} size={180} strokeWidth={24} />
              <View style={styles.donutCenter}>
                <Text style={[styles.donutCenterAmount, { color: '#EF4444' }]}>{formatCOP(stats.totalExpenses)}</Text>
                <Text style={styles.donutCenterLabel}>gastado</Text>
              </View>
            </View>
            {/* Legend */}
            <View style={{ gap: 8, marginTop: 8 }}>
              {expenseSlices.slice(0, 6).map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                  <Text style={{ flex: 1, fontSize: 13, color: '#374151', fontWeight: '600' }}>
                    {item.icon ? item.icon + ' ' : ''}{item.name}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: item.color }}>
                    {formatCOP(item.value)}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', minWidth: 32, textAlign: 'right' }}>
                    {stats.totalExpenses > 0 ? ((item.value / stats.totalExpenses) * 100).toFixed(0) : 0}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : chartType === 'barras' ? (
          <BarChartView data={expenseSlices} />
        ) : (
          <LineChartView data={dailySpending} chartWidth={width - 64} />
        )}
      </View>

      {/* ── Budget Donut ── */}
      <View style={[styles.card, webShadow('0 2px 8px rgba(0,0,0,0.05)')]}>
        <Text style={styles.cardTitle}>Presupuesto Mensual</Text>

        {monthlySalary <= 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>💰</Text>
            <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center' }}>
              Configura tu salario mensual en la pestaña Ingresos para ver la distribución de presupuesto
            </Text>
          </View>
        ) : (
          <>
            {/* Donut + center label */}
            <View style={styles.donutContainer}>
              <DonutChart data={donutSlices} size={200} strokeWidth={26} />
              <View style={styles.donutCenter}>
                <Text style={[styles.donutCenterAmount, { color: '#10B981' }]}>{formatCOP(monthlySalary)}</Text>
                <Text style={styles.donutCenterLabel}>salario mensual</Text>
                {budgetData.totalBudgeted > 0 && (
                  <Text style={styles.donutCenterSub}>
                    {((budgetData.totalBudgeted / monthlySalary) * 100).toFixed(0)}% asignado
                  </Text>
                )}
              </View>
            </View>

            {/* Budget summary */}
            <View style={styles.budgetSummaryRow}>
              <View style={styles.budgetSummaryItem}>
                <Text style={[styles.budgetSummaryValue, { color: '#6366F1' }]}>{formatCOP(budgetData.totalBudgeted)}</Text>
                <Text style={styles.budgetSummaryLabel}>📋 Asignado</Text>
              </View>
              <View style={styles.budgetSummaryDivider} />
              <View style={styles.budgetSummaryItem}>
                <Text style={[styles.budgetSummaryValue, { color: '#10B981' }]}>
                  {formatCOP(Math.max(0, budgetData.remaining))}
                </Text>
                <Text style={styles.budgetSummaryLabel}>💚 Disponible</Text>
              </View>
              <View style={styles.budgetSummaryDivider} />
              <View style={styles.budgetSummaryItem}>
                <Text style={[styles.budgetSummaryValue, { color: '#EF4444' }]}>{formatCOP(stats.totalExpenses)}</Text>
                <Text style={styles.budgetSummaryLabel}>🔴 Gastado</Text>
              </View>
            </View>

            {/* Category legend — tappable */}
            {budgetData.budgeted.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>
                  Aún no tienes categorías con presupuesto.{'\n'}Toca una categoría abajo para asignar.
                </Text>
              </View>
            ) : (
              <View style={styles.legendList}>
                {budgetData.budgeted.map((item) => {
                  const isPaid = paidCatIds.has(item.id);
                  const spentPct = item.budget > 0 ? Math.min((item.spent / item.budget) * 100, 100) : 0;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.legendRow}
                      onPress={() => setSelectedCatId(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.legendColorBar, { backgroundColor: item.color }]} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.legendRowTop}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Icon name={getCategoryIcon(item.id)} size={14} color={item.color} />
                            <Text style={styles.legendCatName}>{item.name}</Text>
                          </View>
                          <View style={styles.legendRight}>
                            <Text style={[styles.legendBudget, { color: item.color }]}>
                              {formatCOP(item.budget)}
                            </Text>
                            <View style={[styles.paidBadge, isPaid && styles.paidBadgeActive]}>
                              <Text style={[styles.paidBadgeText, isPaid && styles.paidBadgeTextActive]}>
                                {isPaid ? '✓ Pagado' : 'Pendiente'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        {/* Spend bar */}
                        <View style={styles.spendBarTrack}>
                          <View style={[styles.spendBarFill, { width: `${spentPct}%` as any, backgroundColor: item.color }]} />
                        </View>
                        <Text style={styles.spendBarLabel}>
                          {formatCOP(item.spent)} gastado · {item.pct.toFixed(0)}% del salario
                        </Text>
                      </View>
                      <Text style={styles.legendArrow}>›</Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Remaining / unassigned — verde como el donut */}
                {budgetData.remaining > 0 && (
                  <View style={styles.legendRow}>
                    <View style={[styles.legendColorBar, { backgroundColor: '#10B981' }]} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name="check-circle" size={14} color="#10B981" />
                        <Text style={[styles.legendCatName, { color: '#10B981' }]}>Libre</Text>
                      </View>
                      <Text style={styles.spendBarLabel}>{formatCOP(budgetData.remaining)} disponible</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Quick-add: categories without budget */}
            {categories.filter(c => !c.budget || c.budget === 0).length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.quickAddLabel}>AGREGAR AL PRESUPUESTO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingTop: 8 }}>
                    {categories
                      .filter(c => !c.budget || c.budget === 0)
                      .slice(0, 8)
                      .map(c => (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.quickAddPill}
                          onPress={() => setSelectedCatId(c.id)}
                        >
                          <Icon name={getCategoryIcon(c.id)} size={13} color="#6B7280" />
                          <Text style={styles.quickAddText}>{c.name}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </>
        )}
      </View>

      {/* AI Insights */}
      <View style={[styles.card, webShadow('0 2px 8px rgba(0,0,0,0.05)')]}>
        <View style={styles.aiCardHeader}>
          <View style={styles.aiAvatarSmall}>
            <Text style={styles.aiAvatarIcon}>✦</Text>
          </View>
          <Text style={styles.cardTitle}>Análisis IA</Text>
        </View>

        <View style={styles.insightRow}>
          <Text style={styles.insightEmoji}>{stats.spendingPercentage > 100 ? '⚠️' : '✅'}</Text>
          <Text style={styles.insightText}>
            {stats.spendingPercentage > 100
              ? `Superaste el presupuesto en ${(stats.spendingPercentage - 100).toFixed(0)}%`
              : `Quedan ${(100 - stats.spendingPercentage).toFixed(0)}% del presupuesto mensual`}
          </Text>
        </View>

        <View style={styles.insightRow}>
          <Text style={styles.insightEmoji}>📊</Text>
          <Text style={styles.insightText}>
            {stats.transactionCount} transacciones registradas este período
          </Text>
        </View>

        {aiInsights.goalInsight && (
          <View style={[styles.insightRow, styles.insightHighlight]}>
            <Text style={styles.insightEmoji}>🎯</Text>
            <Text style={styles.insightText}>{aiInsights.goalInsight.message}</Text>
          </View>
        )}

        {aiInsights.anomalies.map((a, i) => (
          <View key={i} style={[styles.insightRow, styles.insightWarning]}>
            <Text style={styles.insightEmoji}>⚠️</Text>
            <Text style={styles.insightText}>{a.message}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 16 }} />

      {/* ── Category Budget Modal ── */}
      <Modal
        visible={selectedCatId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCatId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedCat && (
              <>
                {/* Handle bar */}
                <View style={styles.modalHandle} />

                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[styles.modalCatIcon, { backgroundColor: (selectedCat.color ?? '#6366F1') + '20' }]}>
                      <Icon name={getCategoryIcon(selectedCat.id)} size={26} color={selectedCat.color ?? '#6366F1'} />
                    </View>
                    <View>
                      <Text style={styles.modalCatName}>{selectedCat.name}</Text>
                      <Text style={styles.modalCatSub}>
                        {selectedCat.budget ? `Presupuesto actual: ${formatCOP(selectedCat.budget)}` : 'Sin presupuesto asignado'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedCatId(null)} style={styles.modalClose}>
                    <Icon name="x" size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                  {/* Spent this month */}
                  {stats.expByCategory[selectedCatId!] > 0 && (
                    <View style={[styles.infoBox, { backgroundColor: '#FEF2F2' }]}>
                      <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: '600' }}>GASTADO ESTE PERÍODO</Text>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: '#EF4444', marginTop: 2 }}>
                        {formatCOP(stats.expByCategory[selectedCatId!] ?? 0)}
                      </Text>
                      {selectedCat.budget && selectedCat.budget > 0 && (
                        <>
                          <View style={styles.spendBarTrack}>
                            <View style={[styles.spendBarFill, {
                              width: `${Math.min((stats.expByCategory[selectedCatId!] / selectedCat.budget) * 100, 100)}%` as any,
                              backgroundColor: '#EF4444',
                            }]} />
                          </View>
                          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                            {((stats.expByCategory[selectedCatId!] / selectedCat.budget) * 100).toFixed(0)}% del presupuesto usado
                          </Text>
                        </>
                      )}
                    </View>
                  )}

                  {/* Budget input */}
                  <Text style={styles.modalFieldLabel}>PRESUPUESTO DEL MES</Text>
                  <TextInput
                    style={[styles.modalInput, editFocused && styles.modalInputFocused]}
                    placeholder="Ej: 500.000"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={editAmount}
                    onChangeText={(txt) => { const d = txt.replace(/\./g, '').replace(/[^0-9]/g, ''); const n = parseInt(d, 10); setEditAmount(isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.')); }}
                    onFocus={() => setEditFocused(true)}
                    onBlur={() => setEditFocused(false)}
                  />

                  {/* Paid toggle */}
                  <Text style={[styles.modalFieldLabel, { marginTop: 16 }]}>ESTADO DE PAGO</Text>
                  <View style={styles.paidToggleRow}>
                    <TouchableOpacity
                      style={[styles.paidToggleBtn, paidCatIds.has(selectedCatId!) && styles.paidToggleBtnActive]}
                      onPress={() => handleTogglePaid(selectedCatId!)}
                    >
                      <Text style={[styles.paidToggleText, paidCatIds.has(selectedCatId!) && styles.paidToggleTextActive]}>
                        {paidCatIds.has(selectedCatId!) ? '✓ Pagado' : 'Marcar como Pagado'}
                      </Text>
                    </TouchableOpacity>
                    {paidCatIds.has(selectedCatId!) && (
                      <TouchableOpacity
                        style={styles.unpaidBtn}
                        onPress={() => handleTogglePaid(selectedCatId!)}
                      >
                        <Text style={styles.unpaidBtnText}>A pagar</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Save button */}
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveBudget}>
                    <Text style={styles.saveBtnText}>Guardar Presupuesto</Text>
                  </TouchableOpacity>

                  {/* Delete / remove from budget */}
                  {(selectedCat.budget ?? 0) > 0 && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteCategory}>
                      <Text style={styles.deleteBtnText}>🗑 Quitar del presupuesto</Text>
                    </TouchableOpacity>
                  )}

                  <View style={{ height: 32 }} />
                </ScrollView>

                <ConfettiBurst key={confettiKey} visible={showConfetti} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: 24, gap: 16 },

  // Header
  header: { marginBottom: 4 },
  headerLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '700', letterSpacing: 1.2 },
  headerMonth: { fontSize: 22, fontWeight: '800', color: '#111827', textTransform: 'capitalize' as any },

  // Period selector
  periodRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  periodPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  periodPillActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  periodPillText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  periodPillTextActive: { color: '#FFFFFF' },

  // Stat cards
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%' as any, flexGrow: 1, borderRadius: 14, borderTopWidth: 3, padding: 16,
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 } : {}),
  },
  statLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },

  // Card
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 20,
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 } : {}),
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 16 },

  // Chart type selector card
  chartCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  chartCardSub: { fontSize: 13, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  chartTypeTabs: { flexDirection: 'row', gap: 6 },
  chartTypeTab: {
    alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', minWidth: 52,
  },
  chartTypeTabActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  chartTypeTabIcon: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
  chartTypeTabIconActive: { color: '#6366F1' },
  chartTypeTabText: { fontSize: 10, color: '#9CA3AF', fontWeight: '700', marginTop: 2 },
  chartTypeTabTextActive: { color: '#6366F1' },

  // Donut
  donutContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 16 },
  donutCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  donutCenterAmount: { fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  donutCenterLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  donutCenterSub: { fontSize: 10, color: '#6B7280', fontWeight: '600', marginTop: 1 },

  // Budget summary row
  budgetSummaryRow: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 16 },
  budgetSummaryItem: { flex: 1, alignItems: 'center' },
  budgetSummaryDivider: { width: 1, backgroundColor: '#E5E7EB' },
  budgetSummaryValue: { fontSize: 14, fontWeight: '800', color: '#111827' },
  budgetSummaryLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },

  // Legend list
  legendList: { gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  legendColorBar: { width: 4, borderRadius: 2, alignSelf: 'stretch', minHeight: 40 },
  legendRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  legendCatName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  legendRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendBudget: { fontSize: 13, fontWeight: '800' },
  legendArrow: { fontSize: 20, color: '#D1D5DB', marginLeft: 4, alignSelf: 'center' },

  // Paid badge (in legend)
  paidBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  paidBadgeActive: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  paidBadgeText: { fontSize: 10, fontWeight: '700', color: '#9CA3AF' },
  paidBadgeTextActive: { color: '#10B981' },

  // Spend bar
  spendBarTrack: { height: 5, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  spendBarFill: { height: '100%', borderRadius: 3 },
  spendBarLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginTop: 3 },

  // Quick add pills
  quickAddLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '700', letterSpacing: 0.8 },
  quickAddPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  quickAddText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  // AI insights
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  aiAvatarSmall: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  aiAvatarIcon: { fontSize: 14, color: '#6366F1' },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  insightEmoji: { fontSize: 16, marginTop: 1 },
  insightText: { fontSize: 13, color: '#374151', flex: 1, lineHeight: 18 },
  insightHighlight: { backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, borderBottomWidth: 0, marginBottom: 4 },
  insightWarning: { backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 10, borderBottomWidth: 0, marginBottom: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%', overflow: 'hidden',
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 20 } : {}),
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalCatIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalCatName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalCatSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },

  // Modal content
  infoBox: { borderRadius: 12, padding: 14, marginBottom: 16 },
  modalFieldLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF',
    padding: 14, borderRadius: 10, fontSize: 20, color: '#111827', fontWeight: '700',
  },
  modalInputFocused: { borderColor: '#6366F1', borderWidth: 2 },

  // Paid toggle in modal
  paidToggleRow: { flexDirection: 'row', gap: 10 },
  paidToggleBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5,
    borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#F9FAFB',
  },
  paidToggleBtnActive: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  paidToggleText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  paidToggleTextActive: { color: '#10B981' },
  unpaidBtn: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  unpaidBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },

  // Save / Delete buttons in modal
  saveBtn: { backgroundColor: '#6366F1', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  deleteBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  deleteBtnText: { fontSize: 14, color: '#EF4444', fontWeight: '600' },
});
