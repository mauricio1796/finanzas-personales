import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Animated,
  StyleSheet, Dimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useFinance } from '../state';
import { Icon } from '../components/ui/Icon';
import { computeWeeklyMetrics, WeeklyMetrics } from '../services/WeeklyReportService';
import { THEME } from '../constants/theme';
import { useTheme } from '../state/ThemeContext';
import { AppColors } from '../constants/colors';

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

interface ResumenSemanalScreenProps {
  onBack: () => void;
  onOpenBot?: (initialMessage: string) => void;
}

// ─── Daily Bar Chart (SVG) ─────────────────────────────────────────────────
const DailyBarChart: React.FC<{
  data: { label: string; current: number; previous: number }[];
}> = ({ data }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const chartWidth = Dimensions.get('window').width - 32 - 28;
  const svgHeight  = 160;
  const barAreaH   = 130;
  const topPad     = 10;
  const labelH     = 20;
  const yAxisW     = 36;
  const plotW      = chartWidth - yAxisW;

  const allValues = data.flatMap(d => [d.current, d.previous]);
  const maxVal    = Math.max(...allValues, 1);

  const groupW   = plotW / 7;
  const barW     = (groupW - 8) / 2;
  const barAreaY = topPad;
  const barAreaBottom = barAreaY + (barAreaH - labelH);

  const toY = (v: number) => {
    const pct = v / maxVal;
    const maxBarH = barAreaBottom - barAreaY;
    return barAreaBottom - pct * maxBarH;
  };

  const fmtK = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
    if (v >= 1_000)     return `$${Math.round(v / 1_000)}k`;
    return `$${Math.round(v)}`;
  };

  const gridLines = [0.25, 0.5, 0.75].map(f => ({
    y: toY(maxVal * f),
    label: fmtK(maxVal * f),
  }));

  return (
    <View>
      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.primary }} />
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>Esta semana</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.primaryLight }} />
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>Semana anterior</Text>
        </View>
      </View>

      <Svg width={chartWidth} height={svgHeight}>
        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <React.Fragment key={i}>
            <Line
              x1={yAxisW} y1={g.y} x2={chartWidth} y2={g.y}
              stroke={colors.cardSecondary} strokeWidth={1}
            />
            <SvgText
              x={yAxisW - 4} y={g.y + 4}
              textAnchor="end" fontSize={9} fill={colors.textTertiary}
            >
              {g.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const groupX = yAxisW + i * groupW + 4;
          const currH  = Math.max(2, barAreaBottom - toY(d.current));
          const prevH  = Math.max(2, barAreaBottom - toY(d.previous));
          const currY  = barAreaBottom - currH;
          const prevY  = barAreaBottom - prevH;
          const labelY = barAreaBottom + 14;
          return (
            <React.Fragment key={i}>
              <Rect x={groupX}         y={currY} width={barW} height={currH} rx={4} fill={colors.primary} />
              <Rect x={groupX + barW}  y={prevY} width={barW} height={prevH} rx={4} fill={colors.primaryLight} />
              <SvgText
                x={groupX + barW}
                y={labelY}
                textAnchor="middle"
                fontSize={10}
                fill={colors.textTertiary}
              >
                {d.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
};

// ─── Metric Card ──────────────────────────────────────────────────────────
type DeltaType = 'up' | 'down' | 'neutral';

interface MetricCardProps {
  label: string;
  value: string;
  deltaLabel: string;
  deltaType: DeltaType;
  animVal: Animated.Value;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, deltaLabel, deltaType, animVal }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const deltaStyle = {
    up:      { bg: colors.incomeLight, text: '#166534' },
    down:    { bg: colors.expenseLight, text: colors.expense },
    neutral: { bg: colors.primaryLight, text: colors.primary },
  }[deltaType];

  return (
    <Animated.View style={[
      styles.metricCard,
      { transform: [{ scale: animVal }], opacity: animVal },
    ]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <View style={[styles.deltaBadge, { backgroundColor: deltaStyle.bg }]}>
        {deltaType !== 'neutral' && (
          <Icon
            name={deltaType === 'up' ? 'trending-up' : 'trending-down'}
            size={10}
            color={deltaStyle.text}
          />
        )}
        <Text style={[styles.deltaText, { color: deltaStyle.text }]}>{deltaLabel}</Text>
      </View>
    </Animated.View>
  );
};

// ─── Horizontal Category Bars ─────────────────────────────────────────────
const CategoryBars: React.FC<{
  categories: WeeklyMetrics['topCategories'];
}> = ({ categories }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const anims = useRef(categories.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = categories.map((cat, i) =>
      Animated.timing(anims[i], {
        toValue: cat.percentage / 100,
        duration: 500,
        delay: i * 80,
        useNativeDriver: false,
      })
    );
    Animated.parallel(animations).start();
  }, [categories]);

  return (
    <View style={{ gap: 10 }}>
      {categories.map((cat, i) => (
        <View key={cat.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.catBarName} numberOfLines={1}>{cat.name}</Text>
          <View style={styles.catBarTrack}>
            <Animated.View style={[
              styles.catBarFill,
              {
                backgroundColor: cat.color,
                width: anims[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) as any,
              },
            ]} />
          </View>
          <Text style={styles.catBarAmount}>{fmtCOP(cat.amount)}</Text>
        </View>
      ))}
    </View>
  );
};

// ─── Comparativa Tab Row ──────────────────────────────────────────────────
interface ComparativaRow { label: string; value: string; color?: string }

const ComparativaSection: React.FC<{ rows: ComparativaRow[] }> = ({ rows }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <View>
    {rows.map((row, i) => (
      <View key={i} style={[
        styles.compRow,
        i < rows.length - 1 && styles.compRowBorder,
      ]}>
        <Text style={styles.compLabel}>{row.label}</Text>
        <Text style={[styles.compValue, row.color ? { color: row.color } : {}]}>{row.value}</Text>
      </View>
    ))}
  </View>
  );
};

// ─── Badge Icon ───────────────────────────────────────────────────────────
const BADGE_ICON_MAP = {
  check:  'check-circle',
  star:   'star',
  clock:  'clock',
  target: 'target',
  fire:   'zap',
} as const;

// ─── Main Screen ──────────────────────────────────────────────────────────
export function ResumenSemanalScreen({ onBack, onOpenBot }: ResumenSemanalScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { transactions, categories, userLevel } = useFinance();

  const [offsetWeeks, setOffsetWeeks] = useState(0);
  const [activeTab, setActiveTab] = useState<'gastos' | 'ingresos' | 'ahorro'>('gastos');

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const metrics = useMemo(
    () => computeWeeklyMetrics(transactions, categories, userLevel ?? null, offsetWeeks),
    [transactions, categories, userLevel, offsetWeeks],
  );

  // Card entrance anims
  const cardAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(80, cardAnims.map(a =>
      Animated.spring(a, { toValue: 1, friction: 7, useNativeDriver: true })
    )).start();
  }, []);

  // Fade on week change
  const handleWeekChange = (delta: number) => {
    fadeAnim.setValue(0);
    setOffsetWeeks(o => o + delta);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  // Metric card configs
  const spentDelta = Math.abs(Math.round(metrics.gastos.diffPercent));
  const spentDeltaType: DeltaType = metrics.gastos.diffPercent > 5 ? 'down' : metrics.gastos.diffPercent < -5 ? 'up' : 'neutral';

  const prevAvgPerDay = metrics.gastos.lastWeek / 7;
  const avgDayDiff = metrics.avgPerDay - prevAvgPerDay;
  const avgDayType: DeltaType = avgDayDiff > 0 ? 'down' : avgDayDiff < 0 ? 'up' : 'neutral';

  // Comparativa rows
  const gastosDiffLabel = metrics.gastos.diffPercent > 0
    ? `+${fmtCOP(Math.abs(metrics.gastos.diff))} vs ant.`
    : `-${fmtCOP(Math.abs(metrics.gastos.diff))} vs ant.`;

  const comparativaRows: Record<string, ComparativaRow[]> = {
    gastos: [
      { label: 'Esta semana',         value: fmtCOP(metrics.gastos.thisWeek) },
      { label: 'Semana anterior',     value: fmtCOP(metrics.gastos.lastWeek) },
      { label: 'Promedio del mes',    value: fmtCOP(metrics.gastos.average) },
      {
        label: 'Diferencia vs ant.',
        value: gastosDiffLabel,
        color: metrics.gastos.diff > 0 ? colors.expense : colors.income,
      },
    ],
    ingresos: [
      { label: 'Esta semana',               value: fmtCOP(metrics.ingresos.thisWeek) },
      { label: 'Semana anterior',           value: fmtCOP(metrics.ingresos.lastWeek) },
      { label: 'Ingreso mensual estimado',  value: fmtCOP(metrics.ingresos.average * 4) },
      {
        label: 'Diferencia vs ant.',
        value: metrics.ingresos.diff >= 0
          ? `+${fmtCOP(metrics.ingresos.diff)}`
          : `-${fmtCOP(Math.abs(metrics.ingresos.diff))}`,
        color: metrics.ingresos.diff >= 0 ? colors.income : colors.expense,
      },
    ],
    ahorro: [
      { label: 'Esta semana',     value: fmtCOP(metrics.ahorro.thisWeek),  color: colors.income },
      { label: 'Semana anterior', value: fmtCOP(metrics.ahorro.lastWeek) },
      { label: 'Promedio',        value: fmtCOP(metrics.ahorro.average) },
      {
        label: 'Progreso meta',
        value: metrics.totalIncome > 0
          ? `${Math.round((metrics.totalSaved / metrics.totalIncome) * 100)}%`
          : '—',
        color: colors.primary,
      },
    ],
  };

  const botMsg = `Finn, analiza mi semana del ${metrics.weekStart.toLocaleDateString('es-CO')} al ${metrics.weekEnd.toLocaleDateString('es-CO')} y dame recomendaciones concretas para mejorar`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {/* Top row */}
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Icon name="chevron-left" size={20} color={'#fff'} />
          </TouchableOpacity>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>
              {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <Text style={styles.headerTitle}>Tu semana en números</Text>

        {/* XP bar */}
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>Nivel {metrics.level} · {metrics.levelTitle}</Text>
          <Text style={styles.xpLabel}>{metrics.xp} / {metrics.xpMax} XP</Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${(metrics.xp / metrics.xpMax) * 100}%` as any }]} />
        </View>
      </View>

      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Week selector ── */}
        <View style={styles.card}>
          <View style={styles.weekSelector}>
            <TouchableOpacity
              onPress={() => handleWeekChange(1)}
              style={styles.weekArrow}
              activeOpacity={0.7}
            >
              <Icon name="chevron-left" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.weekLabel}>{metrics.weekLabel}</Text>
            <TouchableOpacity
              onPress={() => offsetWeeks > 0 && handleWeekChange(-1)}
              style={[styles.weekArrow, offsetWeeks === 0 && { opacity: 0.3 }]}
              activeOpacity={0.7}
              disabled={offsetWeeks === 0}
            >
              <Icon name="chevron-right" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Metric grid 2x2 ── */}
        <View style={styles.metricGrid}>
          <MetricCard
            label="Total gastado"
            value={fmtCOP(metrics.totalSpent)}
            deltaLabel={`${spentDelta > 0 ? (metrics.gastos.diff > 0 ? '+' : '-') : ''}${spentDelta}%`}
            deltaType={spentDeltaType}
            animVal={cardAnims[0]}
          />
          <MetricCard
            label="Transacciones"
            value={String(metrics.transactionCount)}
            deltaLabel="esta semana"
            deltaType="neutral"
            animVal={cardAnims[1]}
          />
          <MetricCard
            label="Gasto promedio/día"
            value={fmtCOP(metrics.avgPerDay)}
            deltaLabel={avgDayDiff === 0 ? 'sin cambio' : (avgDayDiff > 0 ? '▲ vs ant.' : '▼ vs ant.')}
            deltaType={avgDayType}
            animVal={cardAnims[2]}
          />
          <MetricCard
            label="Mejor día"
            value={metrics.bestDay}
            deltaLabel={metrics.bestDayAmount === 0 ? '$0 gastado' : fmtCOP(metrics.bestDayAmount)}
            deltaType="up"
            animVal={cardAnims[3]}
          />
        </View>

        {/* ── Daily bar chart ── */}
        <View style={[styles.card, styles.chartCard]}>
          <Text style={styles.sectionTitle}>Gasto diario</Text>
          <DailyBarChart data={metrics.dailySpend} />
        </View>

        {/* ── Top categories ── */}
        {metrics.topCategories.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Top categorías</Text>
            <CategoryBars categories={metrics.topCategories} />
          </View>
        )}

        {/* ── Comparativa tabs ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Comparativa semanal</Text>
          <View style={styles.tabs}>
            {(['gastos', 'ingresos', 'ahorro'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ComparativaSection rows={comparativaRows[activeTab]} />
        </View>

        {/* ── Finn AI card ── */}
        <View style={styles.finnCard}>
          <View style={styles.finnRow}>
            <View style={styles.finnAvatar}>
              <Text style={styles.finnAvatarText}>F</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.finnLabel}>INSIGHT PERSONALIZADO</Text>
              <Text style={styles.finnInsight}>{metrics.aiInsight}</Text>
            </View>
          </View>
        </View>

        {/* ── Badges ── */}
        <View style={styles.badgesRow}>
          {metrics.badges.map((badge, i) => (
            <View key={i} style={styles.badgeCard}>
              <View style={[styles.badgeIconBox, { backgroundColor: badge.bgColor }]}>
                <Icon name={(BADGE_ICON_MAP[badge.iconType] ?? 'star') as any} size={12} color={badge.color} />
              </View>
              <Text style={[styles.badgeLabel, { color: badge.color }]} numberOfLines={2}>
                {badge.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ── CTA button ── */}
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => onOpenBot?.(botMsg)}
          activeOpacity={0.85}
        >
          <Icon name="message-circle" size={18} color={'#fff'} />
          <Text style={styles.ctaBtnText}>Pedir análisis profundo a Finn</Text>
          <Icon name="arrow-up-right" size={16} color={'#fff'} />
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 24 }} />
      </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  // ── Header
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dateBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 12,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  xpLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '400',
  },
  xpTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: THEME.radius.sm,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: THEME.radius.sm,
  },

  // ── Layout
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  chartCard: {
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 12,
  },

  // ── Week selector
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekArrow: {
    width: 32,
    height: 32,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },

  // ── Metric grid
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '400',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // ── Category bars
  catBarName: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '400',
    width: 90,
  },
  catBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.cardSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  catBarAmount: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
    width: 70,
    textAlign: 'right',
  },

  // ── Tabs
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: THEME.radius.pill,
    paddingVertical: 6,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '500',
  },

  // ── Comparativa rows
  compRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  compRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  compLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  compValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },

  // ── Finn card
  finnCard: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  finnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  finnAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finnAvatarText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  finnLabel: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '500',
    letterSpacing: 0.04 * 10,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  finnInsight: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '400',
    lineHeight: 20,
  },

  // ── Badges
  badgesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  badgeCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: THEME.radius.md,
    padding: 8,
    alignItems: 'center',
    gap: 6,
  },
  badgeIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
  },

  // ── CTA
  ctaBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
});
