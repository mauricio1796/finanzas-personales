import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon, getCategoryIcon } from '../../components/ui/Icon';
import { getPaletaItem } from '../../constants/catalogoCategorias';
import { generarInsightDiario } from '../../services/RealAIService';
import { calcularMetricasFinancieras } from '../../utils/ingresoUtils';
import { THEME } from '../../constants/theme';
import { QuickAddSheet, type QuickAddInitialData } from '../../components/ui/QuickAddSheet';
import { TransactionDetailSheet } from '../../components/ui/TransactionDetailSheet';
import { VoiceButton } from '../../components/ui/VoiceButton';
import { type ParsedTransaction } from '../../services/VoiceService';
import { SwipeableRow } from '../../components/ui/SwipeableRow';
import { DrawerMenu } from '../../components/layout/DrawerMenu';
import { Transaction } from '../../types';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCOP = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

function getSaludo(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12)  return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getNombreMes(mes: number): string {
  return new Date(2025, mes, 1).toLocaleDateString('es-CO', { month: 'long' });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── WeeklyAreaChart ─────────────────────────────────────────────────────────

const CHART_H        = 110;
const Y_AXIS_W       = 32;
// scrollContent paddingH:16 each side (32) + card padding:16 each side (32) = 64 total
const CHART_H_MARGIN = 64;

interface WeeklyAreaChartProps {
  transactions: Transaction[];
}

const fmtShort = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` :
  v >= 1_000     ? `$${Math.round(v / 1_000)}K` : `$${v}`;

const WeeklyAreaChart: React.FC<WeeklyAreaChartProps> = ({ transactions }) => {
  const [containerW, setContainerW] = React.useState(0);
  // SVG width = measured container minus y-axis space
  const chartW = Math.max(1, containerW - Y_AXIS_W);

  // Build last-7-days data
  const days = useMemo(() => {
    const result: { label: string; gastos: number; ingresos: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayStr = d.toDateString();
      const label = d.toLocaleDateString('es-CO', { weekday: 'short' })
        .replace('.', '')
        .charAt(0).toUpperCase() + d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '').slice(1, 3);
      const gastos   = transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === dayStr).reduce((a, t) => a + t.amount, 0);
      const ingresos = transactions.filter(t => t.type === 'income'  && new Date(t.date).toDateString() === dayStr).reduce((a, t) => a + t.amount, 0);
      result.push({ label, gastos, ingresos });
    }
    return result;
  }, [transactions]);

  const maxVal = useMemo(() => Math.max(...days.map(d => Math.max(d.gastos, d.ingresos)), 1), [days]);

  // Weekly totals for stats
  const totalGastos   = useMemo(() => days.reduce((s, d) => s + d.gastos, 0), [days]);
  const totalIngresos = useMemo(() => days.reduce((s, d) => s + d.ingresos, 0), [days]);
  const peakDay       = useMemo(() => days.reduce((best, d) => d.gastos > best.gastos ? d : best, days[0]), [days]);

  const makeAreaPath = (values: number[], closed = true): string => {
    if (chartW <= 1) return '';
    const pts = values.map((v, i) => ({
      x: (i / (values.length - 1)) * chartW,
      y: CHART_H - 8 - (v / maxVal) * (CHART_H - 20),
    }));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) / 3;
      const cp1y = pts[i - 1].y;
      const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) / 3;
      const cp2y = pts[i].y;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pts[i].x} ${pts[i].y}`;
    }
    if (closed) {
      d += ` L ${pts[pts.length - 1].x} ${CHART_H} L ${pts[0].x} ${CHART_H} Z`;
    }
    return d;
  };

  const gastosPath   = makeAreaPath(days.map(d => d.gastos));
  const ingresosPath = makeAreaPath(days.map(d => d.ingresos));
  const gastosLine   = makeAreaPath(days.map(d => d.gastos), false);
  const ingresosLine = makeAreaPath(days.map(d => d.ingresos), false);

  // Y-axis labels
  const yLabels = [0, Math.round(maxVal / 2), maxVal].map(v =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` :
    v >= 1_000     ? `${Math.round(v / 1_000)}K` : String(v)
  );

  return (
    <View style={ac.wrap}>
      {/* Header */}
      <View style={ac.header}>
        <Text style={ac.title}>Flujo semanal</Text>
        <View style={ac.legend}>
          <View style={ac.legendDot} />
          <Text style={ac.legendText}>Gastos</Text>
          <View style={[ac.legendDot, { backgroundColor: '#1D9E75' }]} />
          <Text style={ac.legendText}>Ingresos</Text>
        </View>
      </View>

      {/* Chart area — measured via onLayout */}
      <View
        style={{ flexDirection: 'row', height: CHART_H }}
        onLayout={e => setContainerW(e.nativeEvent.layout.width)}
      >
        {/* Y-axis */}
        <View style={{ width: Y_AXIS_W, height: CHART_H, justifyContent: 'space-between', paddingBottom: 16 }}>
          {[yLabels[2], yLabels[1], yLabels[0]].map((l, i) => (
            <Text key={i} style={ac.yLabel}>{l}</Text>
          ))}
        </View>

        {/* SVG — only render once width is known */}
        {containerW > 0 && (
          <Svg width={chartW} height={CHART_H}>
            <Defs>
              <LinearGradient id="gastoGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#6156E8" stopOpacity="0.25" />
                <Stop offset="1" stopColor="#6156E8" stopOpacity="0.01" />
              </LinearGradient>
              <LinearGradient id="ingresoGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1D9E75" stopOpacity="0.18" />
                <Stop offset="1" stopColor="#1D9E75" stopOpacity="0.01" />
              </LinearGradient>
            </Defs>
            {[0.25, 0.5, 0.75].map((f, i) => (
              <Path key={i} d={`M 0 ${(CHART_H - 8) * f} H ${chartW}`} stroke="#E5E7EB" strokeWidth="0.5" />
            ))}
            <Path d={gastosPath}   fill="url(#gastoGrad)"   />
            <Path d={ingresosPath} fill="url(#ingresoGrad)" />
            <Path d={gastosLine}   fill="none" stroke="#6156E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <Path d={ingresosLine} fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>

      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', paddingLeft: Y_AXIS_W, marginBottom: 14 }}>
        {days.map((d, i) => (
          <Text key={i} style={[ac.xLabel, { flex: 1, textAlign: i === 0 ? 'left' : i === days.length - 1 ? 'right' : 'center' }]}>
            {d.label}
          </Text>
        ))}
      </View>

      {/* Stats strip */}
      <View style={ac.statsRow}>
        <View style={ac.statBox}>
          <Text style={ac.statLabel}>Gastos 7 días</Text>
          <Text style={[ac.statValue, { color: '#EF4444' }]}>{fmtShort(totalGastos)}</Text>
        </View>
        <View style={[ac.statDivider]} />
        <View style={ac.statBox}>
          <Text style={ac.statLabel}>Ingresos 7 días</Text>
          <Text style={[ac.statValue, { color: '#1D9E75' }]}>{fmtShort(totalIngresos)}</Text>
        </View>
        <View style={[ac.statDivider]} />
        <View style={ac.statBox}>
          <Text style={ac.statLabel}>Día pico</Text>
          <Text style={[ac.statValue, { color: '#6156E8' }]}>{peakDay?.label ?? '—'}</Text>
        </View>
      </View>
    </View>
  );
};

const ac = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6156E8',
  },
  legendText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginRight: 6,
  },
  yLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    textAlign: 'right',
    width: Y_AXIS_W - 6,
  },
  xLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────
interface FinancialFeedProps {
  onNavigate: (screen: string) => void;
  onOpenBot?: (initialMessage?: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const FinancialFeed: React.FC<FinancialFeedProps> = ({ onNavigate, onOpenBot }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const {
    user, transactions, categories, profile, goal, userLevel,
    addTransaction: ctxAdd, deleteTransaction: ctxDelete,
    metas, deudas,
  } = useFinance();

  // ── Date constants ──────────────────────────────────────────────────────────
  const now = useMemo(() => new Date(), []);
  const mesActual  = now.getMonth();
  const añoActual  = now.getFullYear();
  const diaHoy     = now.getDate();

  // ── Month selector ──────────────────────────────────────────────────────────
  const [mesSeleccionado, setMesSeleccionado] = useState({ mes: mesActual, año: añoActual });

  const meses = useMemo(() =>
    Array.from({ length: 4 }, (_, i) => {
      const d = new Date(añoActual, mesActual - (3 - i), 1);
      return {
        label: capitalize(d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')),
        mes: d.getMonth(),
        año: d.getFullYear(),
        activo: i === 3,
      };
    }),
  [mesActual, añoActual]);

  // ── Transaction calculations ────────────────────────────────────────────────
  const txMesSel = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === mesSeleccionado.mes && d.getFullYear() === mesSeleccionado.año;
    }),
  [transactions, mesSeleccionado]);

  const metricas = useMemo(
    () => calcularMetricasFinancieras(transactions, categories as any, profile?.monthlySalary ?? 0, mesActual, añoActual),
    [transactions, categories, profile?.monthlySalary, mesActual, añoActual],
  );

  const gastosPorCatSel = useMemo(() => {
    return txMesSel
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
  }, [txMesSel]);

  const ingresosMes = useMemo(() =>
    txMesSel.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0),
  [txMesSel]);

  const gastosMes = useMemo(() =>
    txMesSel.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0),
  [txMesSel]);

  // ── Today / Yesterday transactions ─────────────────────────────────────────
  const hoyStr  = now.toDateString();
  const ayerDate = new Date(now);
  ayerDate.setDate(now.getDate() - 1);
  const ayerStr = ayerDate.toDateString();

  const txHoy  = useMemo(() => transactions.filter(t => new Date(t.date).toDateString() === hoyStr),  [transactions, hoyStr]);
  const txAyer = useMemo(() => transactions.filter(t => new Date(t.date).toDateString() === ayerStr), [transactions, ayerStr]);

  // ── Active debts ───────────────────────────────────────────────────────────
  const deudasActivas = useMemo(() => (deudas ?? []).filter(d => !d.saldada), [deudas]);

  // ── Payment alerts ─────────────────────────────────────────────────────────
  const catsPagoVencido = useMemo(() =>
    categories.filter(c => c.diaPago && !c.pagado && c.diaPago < diaHoy && c.isSelected),
  [categories, diaHoy]);

  const catsPagoProximo = useMemo(() =>
    categories.filter(c => c.diaPago && !c.pagado && c.diaPago >= diaHoy && (c.diaPago ?? 0) <= diaHoy + 3 && c.isSelected),
  [categories, diaHoy]);

  // ── Top categories ─────────────────────────────────────────────────────────
  const topCategorias = useMemo(() =>
    categories
      .filter((c: any) => c.isSelected !== false)
      .map((c: any) => ({
        ...c,
        gastado: gastosPorCatSel[c.name] ?? 0,
        hasBudget: (c.budget ?? 0) > 0,
        pctReal: (c.budget ?? 0) > 0 ? Math.round(((gastosPorCatSel[c.name] ?? 0) / c.budget) * 100) : 0,
        pct:     (c.budget ?? 0) > 0 ? Math.min(Math.round(((gastosPorCatSel[c.name] ?? 0) / c.budget) * 100), 100) : 0,
      }))
      .sort((a: any, b: any) => {
        // Categories with budget first, sorted by % used; then no-budget by amount spent
        if (a.hasBudget && !b.hasBudget) return -1;
        if (!a.hasBudget && b.hasBudget) return 1;
        if (a.hasBudget && b.hasBudget) return b.pctReal - a.pctReal;
        return b.gastado - a.gastado;
      }),
  [categories, gastosPorCatSel]);

  // ── Pending payments ────────────────────────────────────────────────────────
  const categoriasPendientesPago = useMemo(() => {
    return categories
      .filter((c: any) => c.isSelected && !c.pagado && c.tipo === 'gasto' && (c.budget ?? 0) > 0)
      .map((c: any) => {
        const diasRestantes = c.diaPago != null ? (c.diaPago as number) - diaHoy : null;
        const urgencia =
          diasRestantes === null   ? 'activo'   :
          diasRestantes < 0        ? 'vencido'  :
          diasRestantes <= 3       ? 'urgente'  : 'normal';
        return { ...c, diasRestantes, urgencia };
      })
      .sort((a: any, b: any) => {
        const order: Record<string, number> = { vencido: 0, urgente: 1, normal: 2, activo: 3 };
        return (order[a.urgencia] ?? 3) - (order[b.urgencia] ?? 3);
      })
      .slice(0, 3);
  }, [categories, diaHoy]);

  // ── States ─────────────────────────────────────────────────────────────────
  const [drawerVisible,   setDrawerVisible]   = useState(false);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [selectedTx,      setSelectedTx]      = useState<Transaction | null>(null);
  const [quickAddType,    setQuickAddType]    = useState<'income' | 'expense'>('expense');
  const [quickAddInitial, setQuickAddInitial] = useState<QuickAddInitialData | undefined>(undefined);
  const [aiInsight,       setAiInsight]       = useState<string | null>(null);

  // ── Animated values ────────────────────────────────────────────────────────
  const heroAnim    = useRef(new Animated.Value(0)).current;
  const balanceAnim = useRef(new Animated.Value(0)).current;
  const insightAnim = useRef(new Animated.Value(0)).current;
  // Fixed 3 bar anims (max top categories)
  const barAnimsRef = useRef<Animated.Value[]>([]);
  // Grow the anims array as needed (never shrink to avoid hook order issues)
  const ensureBarAnims = (count: number) => {
    while (barAnimsRef.current.length < count) {
      barAnimsRef.current.push(new Animated.Value(0));
    }
    return barAnimsRef.current;
  };
  const barAnims = ensureBarAnims(categories.length || 8);

  // Balance counter display
  const displayBalance = useRef(0);
  const balanceText    = useRef<any>(null);

  // ── Mount effects ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Hero spring
    Animated.spring(heroAnim, {
      toValue: 1,
      tension: 60,
      friction: 9,
      useNativeDriver: true,
    }).start();

    // Balance counter animation — shows available balance (income - expenses)
    Animated.timing(balanceAnim, {
      toValue: metricas.balanceDisponible,
      duration: 1200,
      useNativeDriver: false,
    }).start();

    balanceAnim.addListener(({ value }) => {
      displayBalance.current = value;
      if (balanceText.current) {
        balanceText.current.setNativeProps({ text: fmtCOP(value) });
      }
    });

    // Bars staggered — only animate as many as there are categories
    const activeBars = barAnimsRef.current.slice(0, categories.length || 1);
    Animated.stagger(100, activeBars.map(a =>
      Animated.timing(a, { toValue: 1, duration: 600, useNativeDriver: false })
    )).start();

    // AI insight — usar IA real con fallback local
    generarInsightDiario(transactions as any, categories as any, profile).then(texto => {
      setAiInsight(texto);
      Animated.timing(insightAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }).catch(() => {});

    return () => { balanceAnim.removeAllListeners(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-animate bars when month selection changes ────────────────────────────
  useEffect(() => {
    const activeBars = barAnimsRef.current.slice(0, topCategorias.length || 1);
    activeBars.forEach(a => a.setValue(0));
    Animated.stagger(100, activeBars.map(a =>
      Animated.timing(a, { toValue: 1, duration: 600, useNativeDriver: false })
    )).start();
  }, [mesSeleccionado]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-animate balance counter when available balance changes ─────────────
  useEffect(() => {
    const current = displayBalance.current;
    const target  = metricas.balanceDisponible;
    if (Math.abs(current - target) < 1) return;
    balanceAnim.stopAnimation();
    Animated.timing(balanceAnim, {
      toValue:  target,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [metricas.balanceDisponible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────
  const abrirQuickAdd = (tipo: 'income' | 'expense', initial?: QuickAddInitialData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setQuickAddType(tipo);
    setQuickAddInitial(initial);
    setQuickAddVisible(true);
  };

  const handleVoiceParsed = (tx: ParsedTransaction) => {
    abrirQuickAdd(tx.tipo, {
      amount:      tx.monto,
      category:    tx.categoria,
      description: tx.descripcion,
      type:        tx.tipo,
    });
  };

  // ── ICON_MAP (uses colors, so inside component) ────────────────────────────
  const ICON_MAP: Record<string, { icon: string; bg: string; color: string }> = {
    'Alimentación':    { icon: 'shopping-cart', bg: colors.primaryLight,  color: colors.primary   },
    'Transporte':      { icon: 'map-pin',        bg: colors.warningLight,  color: colors.warning   },
    'Vivienda':        { icon: 'home',           bg: colors.incomeLight,   color: colors.income    },
    'Arriendo':        { icon: 'home',           bg: colors.incomeLight,   color: colors.income    },
    'Salud':           { icon: 'heart',          bg: colors.expenseLight,  color: colors.expense   },
    'Educación':       { icon: 'book-open',      bg: colors.aiLight,       color: colors.ai        },
    'Entretenimiento': { icon: 'tv',             bg: colors.aiLight,       color: colors.ai        },
    'Ropa':            { icon: 'shopping-bag',   bg: colors.primaryLight,  color: colors.primary   },
    'Servicios':       { icon: 'zap',            bg: colors.warningLight,  color: colors.warning   },
    'Telefonía':       { icon: 'phone',          bg: colors.warningLight,  color: colors.warning   },
    'Gym / Sport':     { icon: 'activity',       bg: colors.incomeLight,   color: colors.income    },
    'Mascotas':        { icon: 'feather',        bg: colors.primaryLight,  color: colors.primary   },
    'Ahorro':          { icon: 'dollar-sign',    bg: colors.incomeLight,   color: colors.income    },
    'Deudas':          { icon: 'credit-card',    bg: colors.expenseLight,  color: colors.expense   },
    'Otros':           { icon: 'more-horizontal',bg: colors.cardSecondary, color: colors.textSecondary },
  };

  const getTxIcon = (tx: Transaction) => {
    if (tx.type === 'income') {
      return { icon: 'briefcase', bg: colors.incomeLight, color: colors.income };
    }
    return ICON_MAP[tx.category] ?? { icon: 'circle', bg: colors.cardSecondary, color: colors.textTertiary };
  };

  // ── Subcomponents ──────────────────────────────────────────────────────────
  const renderTxItem = (tx: Transaction) => {
    const { icon, bg, color } = getTxIcon(tx);
    const isIncome = tx.type === 'income';
    const hora = new Date(tx.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    return (
      <SwipeableRow key={tx.id} onDelete={() => ctxDelete(tx.id)}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => setSelectedTx(tx)}>
          <View style={s.txCard}>
            <View style={[s.txIcon, { backgroundColor: bg }]}>
              <Icon name={icon as any} size={18} color={color} />
            </View>
            <View style={s.txInfo}>
              <Text style={[s.txName, { color: THEME.colors.textPrimary }]} numberOfLines={1}>
                {tx.description || tx.category}
              </Text>
              <Text style={s.txSub}>
                {tx.category} · {hora}
              </Text>
            </View>
            <View style={s.txRight}>
              <Text style={[s.txAmount, { color: isIncome ? THEME.colors.income : THEME.colors.expense }]}>
                {isIncome ? '+' : '-'}{fmtCOP(tx.amount)}
              </Text>
              <Icon name="chevron-left" size={12} color={THEME.colors.textTertiary ?? '#CBD5E1'} />
            </View>
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  const renderCatCard = (cat: any, idx: number) => {
    const barAnim   = barAnims[idx] ?? new Animated.Value(0);
    const pctColor  =
      cat.pctReal >= 100 ? colors.expense :
      cat.pctReal >= 80  ? colors.warning :
      colors.income;
    const iconName  = (cat.icon as any) || getCategoryIcon(cat.name);
    const iconBg    = ICON_MAP[cat.name]?.bg    ?? colors.cardSecondary;
    const iconColor = ICON_MAP[cat.name]?.color ?? colors.textSecondary;

    return (
      <View
        key={cat.id}
        style={[s.catCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {/* Top row */}
        <View style={s.catTopRow}>
          <View style={[s.catIconBox, { backgroundColor: iconBg }]}>
            <Icon name={iconName as any} size={14} color={iconColor} />
          </View>
          <Text style={[s.catName, { color: colors.textPrimary }]} numberOfLines={1}>
            {cat.name}
          </Text>
          {cat.hasBudget
            ? <Text style={[s.catPct, { color: pctColor }]}>{cat.pct}%</Text>
            : <Text style={[s.catPct, { color: colors.textTertiary, fontSize: 10 }]}>Sin presupuesto</Text>
          }
        </View>
        {/* Amounts row */}
        <View style={s.catAmountsRow}>
          <Text style={[s.catSpent, { color: colors.textSecondary }]}>
            {fmtCOP(cat.gastado)} gastado
          </Text>
          {cat.hasBudget && (
            <Text style={[s.catOf, { color: colors.textTertiary }]}>
              de {fmtCOP(cat.budget)}
            </Text>
          )}
        </View>
        {/* Progress bar — solo si tiene presupuesto */}
        {cat.hasBudget ? (
          <View style={s.barTrack}>
            <Animated.View
              style={[
                s.barFill,
                {
                  backgroundColor: pctColor,
                  width: barAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', `${cat.pct}%`],
                  }),
                },
              ]}
            />
          </View>
        ) : (
          <View style={[s.barTrack, { backgroundColor: colors.border }]} />
        )}
      </View>
    );
  };

  // ── Quick action items (inside component to access colors + handlers) ───────
  const QUICK_ACTIONS = [
    {
      label: 'Ingreso',
      icon: 'arrow-up',
      bg: colors.incomeLight,
      color: colors.income,
      onPress: () => abrirQuickAdd('income'),
      isVoice: false,
    },
    {
      label: 'Gasto',
      icon: 'arrow-down',
      bg: colors.expenseLight,
      color: colors.expense,
      onPress: () => abrirQuickAdd('expense'),
      isVoice: false,
    },
    {
      label: 'Voz',
      icon: 'mic',
      bg: '#F3E8FF',
      color: '#8B5CF6',
      onPress: () => {},
      isVoice: true,
    },
    {
      label: 'Simular',
      icon: 'cpu',
      bg: colors.warningLight,
      color: colors.warning,
      onPress: () => onNavigate('simulador'),
      isVoice: false,
    },
    {
      label: 'Finn IA',
      icon: 'message-circle',
      bg: colors.aiLight,
      color: colors.ai,
      onPress: () => { if (onOpenBot) onOpenBot(); else onNavigate('bot'); },
      isVoice: false,
    },
  ];

  const firstName = user?.name?.split(' ')[0] ?? 'Tú';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: THEME.colors.background }]}>
      <ScrollView
        style={s.fullScroll}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <View style={[s.hero, { backgroundColor: THEME.colors.background, paddingTop: insets.top + 16 }]}>
        {/* Top bar */}
        <View style={s.heroTopBar}>
          {/* Avatar - 40×40, light indigo */}
          <TouchableOpacity style={s.avatar} onPress={() => onNavigate('perfil')}>
            <Text style={s.avatarLetter}>{(user?.name ?? 'U').charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>

          {/* Greeting + month subtitle */}
          <View style={s.greetingWrap}>
            <Text style={s.greetingText} numberOfLines={1}>
              {getSaludo()}, {firstName}
            </Text>
            <Text style={s.greetingMonth}>
              {capitalize(getNombreMes(mesActual))} {añoActual}
            </Text>
          </View>

          {/* Icon buttons — light-themed */}
          <View style={s.heroIconsRow}>
            <TouchableOpacity style={s.heroIconBtn} onPress={() => onNavigate('calendario')}>
              <Icon name="bell" size={16} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.heroIconBtn} onPress={() => onNavigate('historial')}>
              <Icon name="search" size={16} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.heroIconBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setDrawerVisible(true);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="menu" size={16} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Balance Card — purple ─────────────────────────────────── */}
        <Animated.View
          style={[
            s.balanceCard,
            {
              opacity: heroAnim,
              transform: [{ scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
            },
          ]}
        >
          <Text style={s.balanceLabel}>DISPONIBLE AHORA</Text>
          <Text ref={balanceText} style={s.balanceAmount}>
            {fmtCOP(metricas.balanceDisponible)}
          </Text>
          <Text style={s.balanceMonth}>
            {capitalize(getNombreMes(mesActual))} {añoActual}
          </Text>

          {/* Sub-cards: ingresos totales / gastos */}
          <View style={s.balanceSubCards}>
            <View style={s.balanceSubCard}>
              <Icon name="arrow-up" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={s.balanceSubLabel}>Ingresado</Text>
              <Text style={s.balanceSubValue}>{fmtCOP(metricas.ingresoEfectivo)}</Text>
            </View>
            <View style={s.balanceSubCard}>
              <Icon name="arrow-down" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={s.balanceSubLabel}>Gastado</Text>
              <Text style={s.balanceSubValue}>{fmtCOP(gastosMes)}</Text>
            </View>
          </View>

          {/* 3-segment breakdown bar */}
          <View style={s.segBarWrap}>
            {metricas.porcentajeGastado > 0 && (
              <View style={[s.segSlice, { flex: metricas.porcentajeGastado, backgroundColor: '#F87171' }]} />
            )}
            {metricas.porcentajePendiente > 0 && (
              <View style={[s.segSlice, { flex: metricas.porcentajePendiente, backgroundColor: '#FBBF24' }]} />
            )}
            {metricas.porcentajeLibre > 0 && (
              <View style={[s.segSlice, { flex: metricas.porcentajeLibre, backgroundColor: 'rgba(255,255,255,0.35)' }]} />
            )}
            {metricas.porcentajeGastado === 0 && metricas.porcentajePendiente === 0 && (
              <View style={[s.segSlice, { flex: 100, backgroundColor: 'rgba(255,255,255,0.35)' }]} />
            )}
          </View>
          <View style={s.segLabelsRow}>
            <Text style={s.segLabel}>
              <Text style={{ color: '#F87171' }}>■</Text> Gastado {metricas.porcentajeGastado}%
            </Text>
            <Text style={s.segLabel}>
              <Text style={{ color: '#FBBF24' }}>■</Text> Pendiente {metricas.porcentajePendiente}%
            </Text>
            <Text style={s.segLabel}>
              <Text style={{ color: 'rgba(255,255,255,0.6)' }}>■</Text> Libre {metricas.porcentajeLibre}%
            </Text>
          </View>

          {/* Daily budget pill */}
          <View style={s.dailyPill}>
            <Icon name="calendar" size={10} color="rgba(255,255,255,0.75)" />
            <Text style={s.dailyPillText}>
              {fmtCOP(metricas.gastoPromedioRecomendadoDia)}/día · {metricas.diasRestantesMes} días restantes
            </Text>
          </View>

          {/* CTA when no real income */}
          {!metricas.esIngresoReal && (
            <TouchableOpacity style={s.ctaIngreso} onPress={() => abrirQuickAdd('income')} activeOpacity={0.8}>
              <Icon name="plus-circle" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={s.ctaIngresoText}>Registrar ingreso real</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* ── SCROLL BODY ───────────────────────────────────────────────── */}
      <View style={[s.scrollBody, s.scrollContent]}>
        {/* ── Quick actions ──────────────────────────────────────────── */}
        <View style={s.quickActionsRow}>
          {QUICK_ACTIONS.map((item) => (
            <View key={item.label} style={s.quickActionItem}>
              {item.isVoice ? (
                <>
                  <VoiceButton onParsed={handleVoiceParsed} size="normal" />
                  <Text style={[s.quickActionLabel, { color: colors.textSecondary }]}>
                    {item.label}
                  </Text>
                </>
              ) : (
                <TouchableOpacity
                  onPress={item.onPress}
                  activeOpacity={0.7}
                  style={{ alignItems: 'center', gap: 6 }}
                >
                  <View style={[s.quickActionCircle, { backgroundColor: item.bg }]}>
                    <Icon name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <Text style={[s.quickActionLabel, { color: colors.textSecondary }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* ── Area chart ─────────────────────────────────────────────── */}
        <WeeklyAreaChart transactions={transactions} />

        {/* ── Categorías — estilo imagen ──────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Flujo por categoría</Text>
          <TouchableOpacity onPress={() => onNavigate('estadisticas')}>
            <Text style={[s.sectionLink, { color: colors.primary }]}>Ver más</Text>
          </TouchableOpacity>
        </View>
        {categories
          .filter((c: any) => c.isSelected && (gastosPorCatSel[c.name] ?? 0) > 0)
          .sort((a: any, b: any) => (gastosPorCatSel[b.name] ?? 0) - (gastosPorCatSel[a.name] ?? 0))
          .slice(0, 5)
          .map((cat: any) => {
            const gasto     = gastosPorCatSel[cat.name] ?? 0;
            const budget    = cat.budget ?? 0;
            const remaining = budget > 0 ? budget - gasto : 0;
            const over      = budget > 0 && gasto > budget;
            const iconName  = (cat.icon as any) || getCategoryIcon(cat.name);
            const iconBg    = ICON_MAP[cat.name]?.bg    ?? colors.cardSecondary;
            const iconCol   = ICON_MAP[cat.name]?.color ?? colors.textSecondary;
            const pct       = budget > 0 ? Math.min((gasto / budget) * 100, 100) : 0;
            const pctColor  = over ? colors.expense : pct >= 80 ? colors.warning : colors.income;
            return (
              <View key={cat.id} style={cf.row}>
                <View style={[cf.iconCircle, { backgroundColor: iconBg }]}>
                  <Icon name={iconName as any} size={18} color={iconCol} />
                </View>
                <View style={cf.info}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={cf.catName} numberOfLines={1}>{cat.name}</Text>
                    {budget > 0 && remaining > 0 && (
                      <View style={[cf.surplusTag, { backgroundColor: colors.incomeLight }]}>
                        <Text style={[cf.surplusText, { color: colors.income }]}>Libre</Text>
                      </View>
                    )}
                    {over && (
                      <View style={[cf.surplusTag, { backgroundColor: colors.expenseLight }]}>
                        <Text style={[cf.surplusText, { color: colors.expense }]}>Excedido</Text>
                      </View>
                    )}
                  </View>
                  {budget > 0 && (
                    <View style={cf.barWrap}>
                      <View style={[cf.barFill, { width: `${pct}%` as any, backgroundColor: pctColor }]} />
                    </View>
                  )}
                  <Text style={cf.budgetLabel}>
                    {budget > 0
                      ? `Gastado ${fmtCOP(gasto)} de ${fmtCOP(budget)}`
                      : `Gastado ${fmtCOP(gasto)}`}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {budget > 0 ? (
                    <>
                      <Text style={[cf.amount, { color: over ? colors.expense : colors.income }]}>
                        {over ? `−${fmtCOP(gasto - budget)}` : fmtCOP(remaining)}
                      </Text>
                      <Text style={[cf.budgetLabel, { fontSize: 10 }]}>
                        {over ? 'excedido' : 'disponible'}
                      </Text>
                    </>
                  ) : (
                    <Text style={[cf.amount, { color: colors.expense }]}>−{fmtCOP(gasto)}</Text>
                  )}
                </View>
              </View>
            );
          })}
        {categories.filter((c: any) => c.isSelected && (gastosPorCatSel[c.name] ?? 0) > 0).length === 0 && (
          <View style={[cf.empty, { backgroundColor: colors.card }]}>
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>Sin gastos registrados este mes</Text>
          </View>
        )}

        {/* ── Metas carousel ─────────────────────────────────────────── */}
        {metas.filter(m => !m.completada).length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={[s.sectionTitle ?? { fontSize: 15, fontWeight: '700' }, { color: colors.textPrimary }]}>Mis Metas</Text>
              <TouchableOpacity onPress={() => onNavigate?.('metas')}>
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>Ver todas</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              {metas.filter(m => !m.completada).slice(0, 5).map(meta => {
                const pct = Math.min(meta.montoActual / meta.montoObjetivo, 1);
                return (
                  <TouchableOpacity key={meta.id} onPress={() => onNavigate?.('metas')}
                    style={{ backgroundColor: colors.card, marginHorizontal: 4, borderRadius: 14, padding: 14, width: 160 }}>
                    <Text style={{ fontSize: 26, marginBottom: 6 }}>{meta.emoji}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }} numberOfLines={1}>{meta.nombre}</Text>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden', marginBottom: 4 }}>
                      <View style={{ height: '100%', borderRadius: 2, backgroundColor: meta.color, width: `${pct * 100}%` as any }} />
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>{Math.round(pct * 100)}% alcanzado</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Finn insight ───────────────────────────────────────────── */}
        {aiInsight && (
          <Animated.View
            style={[
              s.insightCard,
              {
                backgroundColor: colors.primaryLight,
                borderColor: colors.primaryDark,
                opacity: insightAnim,
                transform: [{ translateY: insightAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              },
            ]}
          >
            <View style={s.insightRow}>
              <View style={[s.finnAvatar, { backgroundColor: colors.primary }]}>
                <Text style={s.finnLetter}>F</Text>
              </View>
              <View style={s.insightContent}>
                <Text style={[s.insightLabel, { color: colors.primary }]}>
                  FINN · INSIGHT DEL DÍA
                </Text>
                <Text style={[s.insightText, { color: colors.primaryText }]}>
                  {aiInsight}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Payment alert ──────────────────────────────────────────── */}
        {(catsPagoVencido.length > 0 || catsPagoProximo.length > 0) && (() => {
          const isVencido = catsPagoVencido.length > 0;
          const cat: any = isVencido ? catsPagoVencido[0] : catsPagoProximo[0];
          const dias = isVencido ? diaHoy - cat.diaPago : cat.diaPago - diaHoy;
          const texto = isVencido
            ? `${cat.name} venció hace ${dias} día${dias !== 1 ? 's' : ''} · ${fmtCOP(cat.budget ?? 0)} pendiente`
            : `${cat.name} vence en ${dias} día${dias !== 1 ? 's' : ''} · ${fmtCOP(cat.budget ?? 0)}`;
          return (
            <TouchableOpacity
              style={[
                s.alertCard,
                {
                  backgroundColor: isVencido ? colors.warningLight : colors.cardSecondary,
                  borderColor: isVencido ? colors.warning : colors.border,
                },
              ]}
              onPress={() => onNavigate('calendario')}
            >
              <View style={[s.alertIcon, { backgroundColor: isVencido ? colors.warning : colors.border }]}>
                <Icon name="alert-triangle" size={14} color={isVencido ? THEME.colors.surface : colors.textSecondary} />
              </View>
              <Text style={[s.alertText, { color: isVencido ? colors.warning : colors.textSecondary }]}>
                {texto}
              </Text>
              <Icon name="chevron-right" size={14} color={isVencido ? colors.warning : colors.textTertiary} />
            </TouchableOpacity>
          );
        })()}

        {/* ── Budget section ─────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Presupuesto del mes</Text>
          <TouchableOpacity onPress={() => onNavigate('estadisticas')}>
            <Text style={[s.sectionLink, { color: colors.primary }]}>Ver todo</Text>
          </TouchableOpacity>
        </View>

        {/* Month pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.monthScroll}
          contentContainerStyle={s.monthScrollContent}
        >
          {meses.map((m) => {
            const active = m.mes === mesSeleccionado.mes && m.año === mesSeleccionado.año;
            return (
              <TouchableOpacity
                key={`${m.mes}-${m.año}`}
                style={[
                  s.monthPill,
                  active
                    ? { backgroundColor: THEME.colors.primary }
                    : { backgroundColor: '#F4F3F8' },
                ]}
                onPress={() => setMesSeleccionado({ mes: m.mes, año: m.año })}
              >
                <Text
                  style={[
                    s.monthPillText,
                    { color: active ? '#FFFFFF' : '#6B7280', fontWeight: active ? '600' : '400' },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Category cards */}
        {topCategorias.length > 0
          ? topCategorias.map((cat: any, idx: number) => renderCatCard(cat, idx))
          : (
            <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="pie-chart" size={28} color={colors.textTertiary} />
              <Text style={[s.emptyTitle, { color: colors.textSecondary }]}>
                Sin categorías con presupuesto asignado
              </Text>
              <TouchableOpacity onPress={() => onNavigate('estadisticas')}>
                <Text style={[s.emptyAction, { color: colors.primary }]}>Configurar</Text>
              </TouchableOpacity>
            </View>
          )
        }

        {/* ── Pending payments ───────────────────────────────────────── */}
        {categoriasPendientesPago.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={{ height: 0.5, flex: 1, backgroundColor: colors.border }} />
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.6 }}>
                PAGOS PENDIENTES
              </Text>
              <View style={{ height: 0.5, flex: 1, backgroundColor: colors.border }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: 'row', paddingRight: 32 }}>
              {categoriasPendientesPago.map((cat: any) => {
                const paleta = getPaletaItem(cat.name, isDark);
                const colorUrgencia =
                  cat.urgencia === 'vencido' ? colors.expense :
                  cat.urgencia === 'urgente' ? colors.warning :
                  cat.urgencia === 'activo'  ? colors.primary :
                  colors.textSecondary;
                const borderUrgencia =
                  cat.urgencia === 'vencido' ? colors.expense :
                  cat.urgencia === 'urgente' ? colors.warning :
                  cat.urgencia === 'activo'  ? colors.primaryDark :
                  colors.border;
                const iconName = (cat.icon as any) || getCategoryIcon(cat.name);
                const dias = cat.diasRestantes !== null ? Math.abs(cat.diasRestantes) : 0;
                const diasLabel =
                  cat.urgencia === 'activo'    ? 'Presupuestado' :
                  cat.urgencia === 'vencido'   ? `Venció hace ${dias} día${dias !== 1 ? 's' : ''}` :
                  cat.diasRestantes === 0      ? 'Vence hoy' :
                  `Vence en ${dias} día${dias !== 1 ? 's' : ''}`;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => onNavigate('categorias')}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: colors.card,
                      borderWidth: 0.5,
                      borderColor: borderUrgencia,
                      borderRadius: 12,
                      padding: 10,
                      minWidth: 148,
                    }}
                  >
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: paleta.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={iconName} size={13} color={paleta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textPrimary }} numberOfLines={1}>{cat.name}</Text>
                      <Text style={{ fontSize: 10, color: colorUrgencia, marginTop: 1 }}>{diasLabel}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textPrimary }}>{fmtCOP(cat.budget ?? 0)}</Text>
                  </TouchableOpacity>
                );
              })}
              {(categories as any[]).filter((c: any) => c.isSelected && !c.pagado && c.tipo === 'gasto' && (c.budget ?? 0) > 0).length > 3 && (
                <TouchableOpacity
                  onPress={() => onNavigate('categorias')}
                  style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 10, minWidth: 72 }}
                >
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                    +{(categories as any[]).filter((c: any) => c.isSelected && !c.pagado && c.tipo === 'gasto' && (c.budget ?? 0) > 0).length - 3} más
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}

        {/* ── Mis Deudas ─────────────────────────────────────────────── */}
        {deudasActivas.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <View style={[s.sectionHeader, { marginTop: 0 }]}>
              <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Mis Deudas</Text>
              <TouchableOpacity onPress={() => onNavigate('deudas')}>
                <Text style={[s.sectionLink, { color: colors.primary }]}>Ver todas</Text>
              </TouchableOpacity>
            </View>

            {deudasActivas.slice(0, 3).map(deuda => {
              const pct = Math.min(1 - deuda.saldo / deuda.montoOriginal, 1);
              const pagado = deuda.montoOriginal - deuda.saldo;
              return (
                <View
                  key={deuda.id}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.expenseLight, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="credit-card" size={16} color={colors.expense} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>{deuda.nombre}</Text>
                        <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                          Cuota: {fmtCOP(deuda.cuotaMensual)}/mes
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.expense }}>{fmtCOP(deuda.saldo)}</Text>
                      <Text style={{ fontSize: 10, color: colors.textTertiary }}>pendiente</Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginBottom: 6 }}>
                    <View style={{ height: '100%', borderRadius: 3, backgroundColor: colors.expense, width: `${Math.round(pct * 100)}%` as any }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                      Pagado {fmtCOP(pagado)} de {fmtCOP(deuda.montoOriginal)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => onNavigate('deudas')}
                      style={{ backgroundColor: colors.expenseLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.expense }}>Ver deuda</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {deudasActivas.length > 3 && (
              <TouchableOpacity
                onPress={() => onNavigate('deudas')}
                style={{ alignItems: 'center', paddingVertical: 8 }}
              >
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                  +{deudasActivas.length - 3} deuda{deudasActivas.length - 3 > 1 ? 's' : ''} más · Ver todas
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Activity feed ──────────────────────────────────────────── */}
        <View style={[s.sectionHeader, { marginTop: 8 }]}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Actividad reciente</Text>
          <TouchableOpacity onPress={() => onNavigate('historial')}>
            <Text style={[s.sectionLink, { color: colors.primary }]}>Ver todo</Text>
          </TouchableOpacity>
        </View>

        {txHoy.length === 0 && txAyer.length === 0 ? (
          <View style={s.emptyActivity}>
            <Icon name="inbox" size={32} color={colors.textTertiary} />
            <Text style={[s.emptyActivityTitle, { color: colors.textSecondary }]}>
              Sin actividad reciente
            </Text>
            <Text style={[s.emptyActivitySub, { color: colors.textTertiary }]}>
              Registra tu primer gasto del día
            </Text>
          </View>
        ) : (
          <>
            {txHoy.length > 0 && (
              <>
                <Text style={[s.groupLabel, { color: colors.textTertiary }]}>HOY</Text>
                {txHoy.map(renderTxItem)}
              </>
            )}
            {txAyer.length > 0 && (
              <>
                <Text style={[s.groupLabel, { color: colors.textTertiary }]}>AYER</Text>
                {txAyer.map(renderTxItem)}
              </>
            )}
          </>
        )}
      </View>
      </ScrollView>

      {/* ── DrawerMenu ────────────────────────────────────────────────── */}
      <DrawerMenu
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onNavigate={(screen) => {
          setDrawerVisible(false);
          onNavigate(screen);
        }}
      />

      {/* ── QuickAddSheet ─────────────────────────────────────────────── */}
      <QuickAddSheet
        visible={quickAddVisible}
        mode={quickAddInitial?.type ?? quickAddType}
        onClose={() => { setQuickAddVisible(false); setQuickAddInitial(undefined); }}
        onAdd={(amount, category, type, date, description) => {
          ctxAdd({
            id: Date.now().toString(),
            amount,
            category,
            type,
            date: date.toISOString(),
            ...(description ? { description } : {}),
          });
          setQuickAddVisible(false);
          setQuickAddInitial(undefined);
        }}
        initialData={quickAddInitial}
      />

      {/* ── TransactionDetailSheet ────────────────────────────────────── */}
      <TransactionDetailSheet
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Hero — light background
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // Avatar — 40×40, light indigo
  avatar: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF0FF',
  },
  avatarLetter: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6156E8',
  },

  // Greeting
  greetingWrap: {
    flex: 1,
  },
  greetingText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  greetingMonth: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Hero icon buttons — light themed
  heroIconsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroIconBtn: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceSecondary,
  },

  // Balance Card — purple
  balanceCard: {
    backgroundColor: '#6156E8',
    borderRadius: 20,
    padding: 24,
    marginTop: 20,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
    lineHeight: 40,
  },
  balanceMonth: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },

  // Balance sub-cards
  balanceSubCards: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 4,
  },
  balanceSubCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  balanceSubLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  balanceSubValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Segment bar
  segBarWrap: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 100,
    overflow: 'hidden',
    width: '100%',
    marginTop: 14,
    gap: 2,
  },
  segSlice: {
    borderRadius: 100,
  },
  segLabelsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  segLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
  },

  // Daily pill
  dailyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  dailyPillText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },

  // CTA income
  ctaIngreso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  ctaIngresoText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },

  // Scroll body
  fullScroll: {
    flex: 1,
  },
  scrollBody: {
    marginTop: -16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#F8F7FF',
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 16,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickActionItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  quickActionCircle: {
    width: 52,
    height: 52,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 10,
    fontWeight: '500',
  },

  // Finn insight
  insightCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 16,
  },
  insightRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  finnAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  finnLetter: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.surface,
  },
  insightContent: {
    flex: 1,
    gap: 4,
  },
  insightLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  insightText: {
    fontSize: 13,
    lineHeight: 20,
  },

  // Alert card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  alertIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.primary,
  },

  // Month pills
  monthScroll: {
    marginBottom: 16,
  },
  monthScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  monthPill: {
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  monthPillText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Category card
  catCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 6,
  },
  catTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  catPct: {
    fontSize: 11,
    fontWeight: '700',
  },
  catAmountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  catSpent: {
    fontSize: 11,
  },
  catOf: {
    fontSize: 11,
  },

  // Progress bar — semaphore
  barTrack: {
    height: 6,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  barFill: {
    height: 6,
    borderRadius: 100,
  },

  // Empty category
  emptyCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  emptyAction: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Group label
  groupLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingVertical: 8,
  },

  // Transaction card
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txInfo: {
    flex: 1,
    gap: 3,
  },
  txName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  txSub: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Empty activity
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyActivityTitle: {
    fontSize: 14,
  },
  emptyActivitySub: {
    fontSize: 12,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6156E8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6156E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});

// ─── Category-flow styles ────────────────────────────────────────────────────
const cf = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  barWrap: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: 2,
  },
  budgetLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
  },
  surplusTag: {
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  surplusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  empty: {
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
});
