import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Alert, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Rect, Circle, Path, Line,
  Text as SvgText, Defs, LinearGradient, Stop, G,
} from 'react-native-svg';
import { getCategoryIcon } from '../components/ui/Icon';

import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { calcularMetricasFinancieras } from '../utils/ingresoUtils';
import { THEME } from '../constants/theme';
import {
  getMesLabel, getMesLabelLargo, getDiaLabel,
  getBarData, getAreaData, getHeatmapData, getDonutData, getTreemapData,
  getResumenMetricas, buildSmoothPath,
  getHeatIntensity, getHeatColor,
  type HeatCell,
} from '../utils/statsUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCOP = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1_000) + 'k';
  return '$' + Math.round(n);
};
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_PADDING = 16;
const CHART_W = SCREEN_W - 32 - CARD_PADDING * 2;
const C = 251.3; // circumference r=40

// ── Types ──────────────────────────────────────────────────────────────────────
type PeriodoBars = 3 | 6 | 12;

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
  // legacy props (ignored, data comes from context)
  transactions?: any[];
  monthlySalary?: number;
}

// ── Component ──────────────────────────────────────────────────────────────────
export const EstadisticasScreen: React.FC<Props> = ({ onBack, onNavigate }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { transactions, categories, profile, goal } = useFinance();

  // ── State ──────────────────────────────────────────────────────────────────
  const now = useMemo(() => new Date(), []);
  const [mesSeleccionado, setMesSeleccionado] = useState({
    mes: now.getMonth(),
    año: now.getFullYear(),
  });
  const [periodoBars, setPeriodoBars] = useState<PeriodoBars>(3);
  const [selectedHeatCell, setSelectedHeatCell] = useState<HeatCell | null>(null);

  // Animated values
  const barProgress  = useRef(new Animated.Value(0)).current;
  const areaOpacity  = useRef(new Animated.Value(0)).current;
  const heatOpacity  = useRef(new Animated.Value(0)).current;
  const treemapAnim  = useRef(new Animated.Value(0)).current;

  // Donut: individual Animated.Values per segment
  const donutAnimRef = useRef<Animated.Value[]>([]);
  const [donutDashes, setDonutDashes] = useState<number[]>([]);

  // Bar heights driven by barProgress listener
  const [barHCurr, setBarHCurr] = useState<number[]>([]);
  const [barHPrev, setBarHPrev] = useState<number[]>([]);

  // ── Memos ──────────────────────────────────────────────────────────────────
  const { mes, año } = mesSeleccionado;
  const salary = profile?.monthlySalary ?? 0;

  const metricas = useMemo(
    () => getResumenMetricas(transactions, mes, año, salary),
    [transactions, mes, año, salary],
  );

  const metricasIngreso = useMemo(
    () => calcularMetricasFinancieras(transactions, categories as any, salary, mes, año),
    [transactions, categories, salary, mes, año],
  );

  const barData = useMemo(
    () => getBarData(transactions, periodoBars),
    [transactions, periodoBars],
  );

  const areaData = useMemo(
    () => getAreaData(transactions, 6, salary),
    [transactions, salary],
  );

  const heatData = useMemo(
    () => getHeatmapData(transactions, mes, año),
    [transactions, mes, año],
  );

  const treemapData = useMemo(
    () => getTreemapData(transactions, mes, año),
    [transactions, mes, año],
  );

  const donutData = useMemo(
    () => getDonutData(transactions, mes, año, salary, colors.primary, colors.income, colors.warning),
    [transactions, mes, año, salary, colors.primary, colors.income, colors.warning],
  );

  const maxHeatMonto = useMemo(
    () => Math.max(...heatData.map(c => c.monto), 1),
    [heatData],
  );

  const maxBarMonto = useMemo(
    () => Math.max(...barData.flatMap(d => [d.gastoActual, d.gastoAnterior]), 1),
    [barData],
  );

  const maxAreaMonto = useMemo(
    () => Math.max(...areaData.map(d => d.ahorro), goal?.targetAmount ?? 1, 1),
    [areaData, goal],
  );

  const mesesDisponibles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return {
        mes: d.getMonth(),
        año: d.getFullYear(),
        label: capitalize(getMesLabel(d.getMonth())),
        labelLargo: getMesLabelLargo(d.getMonth(), d.getFullYear()),
      };
    }),
  [now]);

  // ── Chart constants ────────────────────────────────────────────────────────
  const BAR_AREA_H = 110;
  const GROUP_W = CHART_W / Math.max(barData.length, 1);
  const BAR_W = Math.max(GROUP_W * 0.28, 4);
  const BAR_GAP = BAR_W * 0.4;

  const barH = (monto: number) =>
    maxBarMonto > 0 ? Math.max(monto > 0 ? 3 : 0, (monto / maxBarMonto) * BAR_AREA_H) : 0;

  // Area chart
  const AREA_H = 140;
  const AREA_PAD_TOP = 16;
  const AREA_PAD_BOTTOM = 20;
  const DRAW_H = AREA_H - AREA_PAD_TOP - AREA_PAD_BOTTOM;

  const areaPoints = useMemo(() =>
    areaData.map((d, i) => ({
      x: areaData.length > 1 ? (i / (areaData.length - 1)) * CHART_W : CHART_W / 2,
      y: AREA_PAD_TOP + DRAW_H - (maxAreaMonto > 0 ? (d.ahorro / maxAreaMonto) * DRAW_H : 0),
      ...d,
    })),
  [areaData, maxAreaMonto, CHART_W, DRAW_H]);

  const linePath  = useMemo(() => buildSmoothPath(areaPoints), [areaPoints]);
  const areaPath  = useMemo(() => {
    if (areaPoints.length < 2) return '';
    const last = areaPoints[areaPoints.length - 1];
    const first = areaPoints[0];
    return `${linePath} L ${last.x.toFixed(1)},${(AREA_H - AREA_PAD_BOTTOM).toFixed(1)} L ${first.x.toFixed(1)},${(AREA_H - AREA_PAD_BOTTOM).toFixed(1)} Z`;
  }, [linePath, areaPoints, AREA_H, AREA_PAD_BOTTOM]);

  // ── Animations ─────────────────────────────────────────────────────────────

  // Bar animation via barProgress listener
  useEffect(() => {
    const id = barProgress.addListener(({ value }) => {
      setBarHCurr(barData.map(d => barH(d.gastoActual) * value));
      setBarHPrev(barData.map(d => barH(d.gastoAnterior) * value));
    });
    return () => barProgress.removeListener(id);
  }, [barData, maxBarMonto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate all sections on mount / month change
  useEffect(() => {
    initDonutAnims();
    barProgress.setValue(0);
    Animated.timing(barProgress, { toValue: 1, duration: 700, useNativeDriver: false }).start();
    areaOpacity.setValue(0);
    Animated.timing(areaOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    heatOpacity.setValue(0);
    Animated.timing(heatOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    treemapAnim.setValue(0);
    Animated.spring(treemapAnim, { toValue: 1, tension: 50, friction: 9, useNativeDriver: true }).start();
  }, [mesSeleccionado]); // eslint-disable-line react-hooks/exhaustive-deps

  function initDonutAnims() {
    // Clean up old listeners
    donutAnimRef.current.forEach(a => a.removeAllListeners());
    // Create new anims
    donutAnimRef.current = donutData.map(() => new Animated.Value(0));
    setDonutDashes(donutData.map(() => 0));
    // Add listeners
    donutAnimRef.current.forEach((anim, i) => {
      anim.addListener(({ value }) => {
        const dash = (donutData[i]?.dashLength ?? 0) * value;
        setDonutDashes(prev => {
          const next = [...prev];
          next[i] = dash;
          return next;
        });
      });
    });
    // Start staggered
    Animated.stagger(
      150,
      donutAnimRef.current.map(a =>
        Animated.timing(a, { toValue: 1, duration: 800, useNativeDriver: false }),
      ),
    ).start();
  }

  // Initial animation
  useEffect(() => {
    initDonutAnims();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render helpers ─────────────────────────────────────────────────────────

  const card = (children: React.ReactNode, extra?: object) => (
    <View style={[s.card, extra]}>
      {children}
    </View>
  );

  // ── TAB: RESUMEN ───────────────────────────────────────────────────────────

  const renderResumen = () => {
    // ── Per-category donut data ───────────────────────────────────────────────
    const CAT_COLORS = [
      '#1E88C7', '#00B89F', '#F45B69', '#9B5DE5',
      '#F5A623', '#E91E8C', '#43AA8B', '#577590',
      '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8DADC',
    ];

    const gastoPorCat: Record<string, number> = {};
    transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === mes && d.getFullYear() === año;
      })
      .forEach(t => { gastoPorCat[t.category] = (gastoPorCat[t.category] ?? 0) + t.amount; });

    const totalGastos = Object.values(gastoPorCat).reduce((a, b) => a + b, 0);

    // Build slices sorted desc by amount, group tiny ones as "Otros"
    const sorted = Object.entries(gastoPorCat)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    const mainSlices = sorted.filter(s => s.amount / Math.max(totalGastos, 1) >= 0.04);
    const otrosTotal = sorted.filter(s => s.amount / Math.max(totalGastos, 1) < 0.04)
      .reduce((a, s) => a + s.amount, 0);

    const rawSlices = [
      ...mainSlices,
      ...(otrosTotal > 0 ? [{ name: 'Otros', amount: otrosTotal }] : []),
    ].map((s, idx) => ({
      ...s,
      color: CAT_COLORS[idx % CAT_COLORS.length],
      pct: totalGastos > 0 ? Math.round((s.amount / totalGastos) * 100) : 0,
    }));

    // Donut geometry
    const DSVG  = Math.min(SCREEN_W - 32, 290);
    const CX    = DSVG / 2;
    const CY    = DSVG / 2;
    const R     = DSVG * 0.315;
    const SW    = DSVG * 0.10;
    const CIRC  = 2 * Math.PI * R;
    const GAP   = (3 / 360) * CIRC; // 3° gap between slices

    // Compute cumulative offsets
    let cumulative = 0;
    const slices = rawSlices.map(s => {
      const dashLength = (s.pct / 100) * CIRC;
      const offset     = cumulative;
      cumulative += dashLength;
      return { ...s, dashLength, offset };
    });

    // Label position (midpoint of each arc, outside the ring)
    const labelPos = (offset: number, dashLength: number) => {
      const midFrac = (offset + dashLength / 2) / CIRC;
      const angle   = midFrac * 2 * Math.PI - Math.PI / 2;
      const lr      = R + SW / 2 + 22;
      return { x: CX + lr * Math.cos(angle), y: CY + lr * Math.sin(angle) };
    };

    // Category grid (all selected categories)
    const catGrid = (categories as any[]).filter(c => c.isSelected).slice(0, 9);

    return (
      <>
        {/* ── Hero donut card ── */}
        <View style={[s.card, { alignItems: 'center', paddingTop: 24, paddingBottom: 24 }]}>
          <Text style={[s.cardTitle, { marginBottom: 2, textAlign: 'center' }]}>
            Gastos por categoría
          </Text>
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 20 }}>
            {capitalize(getMesLabelLargo(mes, año))}
          </Text>

          {totalGastos === 0 ? (
            <View style={s.emptyWrap}>
              <Icon name="pie-chart" size={32} color={colors.textTertiary} />
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>
                Sin gastos registrados este mes
              </Text>
            </View>
          ) : (
            <Svg width={DSVG} height={DSVG}>
              {/* Background track */}
              <Circle cx={CX} cy={CY} r={R} fill="none" stroke="#F0EFFF" strokeWidth={SW} />

              {/* One circle per category slice */}
              {slices.map((sl, i) => {
                const dash = Math.max(0, sl.dashLength - GAP);
                const gap  = Math.max(0, CIRC - dash);
                return (
                  <Circle
                    key={i}
                    cx={CX} cy={CY} r={R}
                    fill="none"
                    stroke={sl.color}
                    strokeWidth={SW}
                    strokeLinecap="butt"
                    strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
                    strokeDashoffset={`${(-(sl.offset) + GAP / 2).toFixed(2)}`}
                    transform={`rotate(-90 ${CX} ${CY})`}
                  />
                );
              })}

              {/* Percentage labels outside ring — only for slices ≥ 7% */}
              {slices.filter(sl => sl.pct >= 7).map((sl, i) => {
                const { x, y } = labelPos(sl.offset, sl.dashLength);
                return (
                  <SvgText
                    key={i}
                    x={x} y={y + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight="700"
                    fill={sl.color}
                  >
                    {sl.pct}%
                  </SvgText>
                );
              })}

              {/* Center: total gastos */}
              <SvgText
                x={CX} y={CY - 12}
                textAnchor="middle"
                fontSize={Math.round(DSVG * 0.065)}
                fontWeight="800"
                fill="#111827"
              >
                {fmtCOP(totalGastos)}
              </SvgText>
              <SvgText
                x={CX} y={CY + 8}
                textAnchor="middle"
                fontSize={10}
                fill="#9CA3AF"
              >
                total gastado
              </SvgText>
              {salary > 0 && (
                <SvgText
                  x={CX} y={CY + 24}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="700"
                  fill="#6156E8"
                >
                  {metricasIngreso.porcentajeGastado}% del salario
                </SvgText>
              )}
            </Svg>
          )}

          {/* Legend chips */}
          {totalGastos > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              {slices.map((sl, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: sl.color + '18', borderRadius: 100,
                  paddingHorizontal: 10, paddingVertical: 4,
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sl.color }} />
                  <Text style={{ fontSize: 11, color: '#374151', fontWeight: '500' }}>
                    {sl.name}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: sl.color }}>
                    {sl.pct}%
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Change badge */}
          {metricas.cambioPctVsMesAnterior !== 0 && (
            <View style={[s.changeBadge, {
              marginTop: 14, alignSelf: 'center',
              backgroundColor: metricas.cambioPctVsMesAnterior < 0 ? colors.incomeLight : colors.expenseLight,
            }]}>
              <Icon
                name={metricas.cambioPctVsMesAnterior < 0 ? 'trending-down' : 'trending-up'}
                size={11}
                color={metricas.cambioPctVsMesAnterior < 0 ? colors.income : colors.expense}
              />
              <Text style={[s.changeText, { color: metricas.cambioPctVsMesAnterior < 0 ? colors.income : colors.expense }]}>
                {Math.abs(metricas.cambioPctVsMesAnterior)}% vs mes anterior
              </Text>
            </View>
          )}
        </View>

        {/* ── Quick metrics ── */}
        <View style={s.metricGrid}>
          {[
            { val: fmtCOP(metricasIngreso.totalGastado),    label: 'Total gastado', color: THEME.colors.expense },
            { val: fmtCOP(metricasIngreso.balanceFinal),    label: 'Balance final', color: THEME.colors.income  },
            { val: `${metricasIngreso.porcentajeGastado}%`, label: 'Gastado',       color: '#6156E8' },
          ].map(m => (
            <View key={m.label} style={s.metricCell}>
              <Text style={[s.metricVal, { color: m.color }]} numberOfLines={1}>{m.val}</Text>
              <Text style={s.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        <View style={[s.metricGrid, { marginTop: 8 }]}>
          {[
            { val: fmtCOP(metricasIngreso.gastoPromedioRecomendadoDia), label: 'Presup. diario' },
            { val: metricas.categoriaMayorGasto,                         label: 'Mayor categoría' },
          ].map(m => (
            <View key={m.label} style={s.metricCell2}>
              <Text style={s.metricVal2} numberOfLines={1}>{m.val}</Text>
              <Text style={s.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Category icon grid ── */}
        <View style={[s.card, { marginTop: 16 }]}>
          <Text style={s.cardTitle}>Mis categorías</Text>
          <View style={dg.grid}>
            {catGrid.map((cat: any, idx: number) => {
              const accent   = CAT_COLORS[idx % CAT_COLORS.length];
              const iconName = (cat.icon as any) || getCategoryIcon(cat.name);
              return (
                <View key={cat.id} style={dg.cell}>
                  <View style={[dg.circle, { backgroundColor: accent + '18' }]}>
                    <Icon name={iconName} size={24} color={accent} />
                  </View>
                  <Text style={dg.label} numberOfLines={1}>{cat.name}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </>
    );
  };

  // ── TAB: COMPARATIVO ───────────────────────────────────────────────────────

  const renderComparativo = () => {
    const hasDatos = barData.some(d => d.gastoActual > 0 || d.gastoAnterior > 0);
    const conDatos = barData.filter(d => d.gastoActual > 0);
    const maxG = Math.max(...barData.map(d => d.gastoActual), 0);
    const minG = conDatos.length > 0 ? Math.min(...conDatos.map(d => d.gastoActual)) : 0;
    const promedio = conDatos.length > 0
      ? conDatos.reduce((s, d) => s + d.gastoActual, 0) / conDatos.length
      : 0;

    return (
      <>
        {/* Period selector */}
        <View style={s.periodoRow}>
          {([3, 6, 12] as PeriodoBars[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[
                s.periodoPill,
                periodoBars === p
                  ? { backgroundColor: '#6156E8' }
                  : { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E7EB' },
              ]}
              onPress={() => setPeriodoBars(p)}
            >
              <Text style={[s.periodoPillText, { color: periodoBars === p ? '#FFFFFF' : '#6B7280' }]}>
                {p} meses
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {card(
          <>
            {!hasDatos ? (
              <View style={s.emptyWrap}>
                <Icon name="bar-chart-2" size={28} color={colors.textTertiary} />
                <Text style={[s.emptyText, { color: colors.textSecondary }]}>Sin datos en este período</Text>
              </View>
            ) : (
              <>
                <Svg width={CHART_W} height={BAR_AREA_H + 30}>
                  {/* Grid lines */}
                  {[0, 0.5, 1].map((pct, gi) => {
                    const y = BAR_AREA_H - pct * BAR_AREA_H;
                    return (
                      <React.Fragment key={gi}>
                        <Line
                          x1={0} y1={y} x2={CHART_W} y2={y}
                          stroke={colors.borderSubtle}
                          strokeWidth={0.5}
                        />
                        <SvgText
                          x={0} y={y - 3}
                          fontSize={8}
                          fill={colors.textTertiary}
                        >
                          {pct === 0 ? '$0' : fmtShort(maxBarMonto * pct)}
                        </SvgText>
                      </React.Fragment>
                    );
                  })}

                  {/* Bars */}
                  {barData.map((d, i) => {
                    const cx = i * GROUP_W + GROUP_W / 2;
                    const hCurr = barHCurr[i] ?? 0;
                    const hPrev = barHPrev[i] ?? 0;
                    return (
                      <React.Fragment key={i}>
                        {/* Previous year bar */}
                        {hPrev > 0 && (
                          <Rect
                            x={cx - BAR_GAP / 2 - BAR_W}
                            y={BAR_AREA_H - hPrev}
                            width={BAR_W}
                            height={hPrev}
                            rx={3}
                            fill={colors.primary}
                            opacity={0.35}
                          />
                        )}
                        {/* Current year bar */}
                        {hCurr > 0 && (
                          <Rect
                            x={cx + BAR_GAP / 2}
                            y={BAR_AREA_H - hCurr}
                            width={BAR_W}
                            height={hCurr}
                            rx={3}
                            fill={colors.primary}
                          />
                        )}
                        {/* X label */}
                        <SvgText
                          x={cx}
                          y={BAR_AREA_H + 18}
                          textAnchor="middle"
                          fontSize={9}
                          fill={colors.textTertiary}
                        >
                          {d.label}
                        </SvgText>
                      </React.Fragment>
                    );
                  })}
                </Svg>

                {/* Legend */}
                <View style={s.barLegend}>
                  <View style={s.legendRow}>
                    <View style={[s.legendDot, { backgroundColor: colors.primary, opacity: 0.35 }]} />
                    <Text style={[s.legendLabel, { color: colors.textSecondary }]}>Año anterior</Text>
                  </View>
                  <View style={s.legendRow}>
                    <View style={[s.legendDot, { backgroundColor: colors.primary }]} />
                    <Text style={[s.legendLabel, { color: colors.textSecondary }]}>Este año</Text>
                  </View>
                </View>
              </>
            )}
          </>,
        )}

        {/* Stats row */}
        {hasDatos && (
          <View style={[s.metricGrid, { marginTop: 12 }]}>
            {[
              { val: fmtCOP(maxG),     label: 'Mayor gasto' },
              { val: fmtCOP(minG),     label: 'Menor gasto' },
              { val: fmtCOP(promedio), label: 'Promedio' },
            ].map(m => (
              <View key={m.label} style={s.metricCell}>
                <Text style={[s.metricVal, { color: '#6156E8' }]} numberOfLines={1}>{m.val}</Text>
                <Text style={s.metricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
        )}
      </>
    );
  };

  // ── TAB: AHORRO ────────────────────────────────────────────────────────────

  const renderAhorro = () => {
    const totalAhorro = areaData[areaData.length - 1]?.ahorro ?? 0;
    const sinDatos = areaData.every(d => d.ahorro === 0);
    const goalAmt = goal?.targetAmount ?? 0;
    const goalY = goalAmt > 0
      ? AREA_PAD_TOP + DRAW_H - (goalAmt / maxAreaMonto) * DRAW_H
      : null;

    return (
      <>
        {card(
          <>
            <Text style={s.cardTitle}>Ahorro acumulado</Text>
            {sinDatos ? (
              <View style={s.emptyWrap}>
                <Icon name="trending-up" size={28} color={colors.textTertiary} />
                <Text style={[s.emptyText, { color: colors.textSecondary }]}>
                  Registra transacciones para ver tu progreso de ahorro
                </Text>
              </View>
            ) : (
              <Animated.View style={{ opacity: areaOpacity }}>
                <Svg width={CHART_W} height={AREA_H}>
                  <Defs>
                    <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%"   stopColor={colors.primary} stopOpacity={0.4} />
                      <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.02} />
                    </LinearGradient>
                  </Defs>

                  {/* Grid lines */}
                  {[0, 0.5, 1].map((pct, gi) => {
                    const y = AREA_PAD_TOP + DRAW_H - pct * DRAW_H;
                    return (
                      <React.Fragment key={gi}>
                        <Line x1={0} y1={y} x2={CHART_W} y2={y} stroke={colors.borderSubtle} strokeWidth={0.5} />
                        <SvgText x={0} y={y - 3} fontSize={8} fill={colors.textTertiary}>
                          {fmtShort(maxAreaMonto * pct)}
                        </SvgText>
                      </React.Fragment>
                    );
                  })}

                  {/* Goal line */}
                  {goalY !== null && (
                    <>
                      <Line
                        x1={0} y1={goalY} x2={CHART_W} y2={goalY}
                        stroke={colors.income}
                        strokeDasharray="4 3"
                        strokeWidth={1}
                        opacity={0.6}
                      />
                      <SvgText x={CHART_W - 26} y={goalY - 4} fontSize={8} fill={colors.income}>
                        Meta
                      </SvgText>
                    </>
                  )}

                  {/* Area fill */}
                  {areaPath && (
                    <Path d={areaPath} fill="url(#areaGrad)" />
                  )}
                  {/* Line */}
                  {linePath && (
                    <Path d={linePath} stroke={colors.primary} strokeWidth={2} fill="none" />
                  )}

                  {/* Points */}
                  {areaPoints.map((pt, i) => {
                    const isLast = i === areaPoints.length - 1;
                    return (
                      <React.Fragment key={i}>
                        {isLast && (
                          <Circle cx={pt.x} cy={pt.y} r={8} fill={colors.primary} opacity={0.2} />
                        )}
                        <Circle cx={pt.x} cy={pt.y} r={isLast ? 5 : 3.5} fill={colors.primary} />
                      </React.Fragment>
                    );
                  })}

                  {/* X labels */}
                  {areaData.map((d, i) => (
                    <SvgText
                      key={i}
                      x={areaData.length > 1 ? (i / (areaData.length - 1)) * CHART_W : CHART_W / 2}
                      y={AREA_H - 4}
                      textAnchor="middle"
                      fontSize={9}
                      fill={colors.textTertiary}
                    >
                      {d.label}
                    </SvgText>
                  ))}
                </Svg>
              </Animated.View>
            )}

            {/* Footer */}
            <View style={s.areaFooter}>
              <View>
                <Text style={[s.metricLabel, { color: colors.textTertiary }]}>Acumulado</Text>
                <Text style={[s.areaFooterVal, { color: colors.primary }]}>{fmtCOP(totalAhorro)}</Text>
              </View>
              {goalAmt > 0 && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.metricLabel, { color: colors.textTertiary }]}>Meta anual</Text>
                  <Text style={[s.areaFooterVal, { color: colors.income }]}>{fmtCOP(goalAmt)}</Text>
                </View>
              )}
            </View>
          </>,
        )}
      </>
    );
  };

  // ── TAB: CALOR ─────────────────────────────────────────────────────────────

  const renderCalor = () => {
    const CELL = 28;
    const GAP  = 3;
    const LABEL_W = 22;
    const GRID_W = LABEL_W + 7 * (CELL + GAP);
    const GRID_H = 4 * (CELL + GAP) + 24;
    const DIA_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

    const diaMaxCell = heatData.reduce((max, c) => c.monto > max.monto ? c : max, heatData[0] ?? { semana: 0, dia: 0, monto: 0, count: 0 });
    const sinGasto   = heatData.filter(c => c.monto === 0).length;

    return (
      <>
        <Text style={[s.heatExplain, { color: colors.textTertiary }]}>
          Intensidad de gasto por día de la semana
        </Text>

        {card(
          <>
            <Animated.View style={{ opacity: heatOpacity }}>
              <Svg width={GRID_W} height={GRID_H}>
                {/* Day labels */}
                {DIA_LABELS.map((lbl, di) => (
                  <SvgText
                    key={di}
                    x={LABEL_W + di * (CELL + GAP) + CELL / 2}
                    y={13}
                    textAnchor="middle"
                    fontSize={9}
                    fill={colors.textTertiary}
                  >
                    {lbl}
                  </SvgText>
                ))}

                {/* Week labels */}
                {['S1', 'S2', 'S3', 'S4'].map((lbl, wi) => (
                  <SvgText
                    key={wi}
                    x={0}
                    y={22 + wi * (CELL + GAP) + CELL / 2}
                    fontSize={8}
                    fill={colors.textTertiary}
                  >
                    {lbl}
                  </SvgText>
                ))}

                {/* Cells */}
                {heatData.map((cell, idx) => {
                  const intensity = getHeatIntensity(cell.monto, maxHeatMonto);
                  const fillColor = getHeatColor(intensity, isDark);
                  const cx = LABEL_W + cell.dia * (CELL + GAP);
                  const cy = 20 + cell.semana * (CELL + GAP);
                  return (
                    <Rect
                      key={idx}
                      x={cx} y={cy}
                      width={CELL} height={CELL}
                      rx={5}
                      fill={fillColor}
                    />
                  );
                })}
              </Svg>
            </Animated.View>

            {/* Tappable overlay for heat cells */}
            <View style={[StyleSheet.absoluteFill, { top: 0, left: CARD_PADDING, width: GRID_W }]}>
              {heatData.map((cell, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      left: LABEL_W + cell.dia * (CELL + GAP),
                      top: 20 + cell.semana * (CELL + GAP),
                      width: CELL,
                      height: CELL,
                      position: 'absolute',
                    },
                  ]}
                  onPress={() => setSelectedHeatCell(prev =>
                    prev?.semana === cell.semana && prev.dia === cell.dia ? null : cell
                  )}
                />
              ))}
            </View>

            {/* Tooltip */}
            {selectedHeatCell !== null && (
              <View style={[s.tooltip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.tooltipTitle, { color: colors.textPrimary }]}>
                  {getDiaLabel(selectedHeatCell.dia)} — Semana {selectedHeatCell.semana + 1}
                </Text>
                <Text style={[s.tooltipVal, { color: colors.primary }]}>
                  {selectedHeatCell.monto > 0 ? fmtCOP(selectedHeatCell.monto) : 'Sin gastos'}
                </Text>
                {selectedHeatCell.count > 0 && (
                  <Text style={[s.tooltipSub, { color: colors.textTertiary }]}>
                    {selectedHeatCell.count} transacción{selectedHeatCell.count !== 1 ? 'es' : ''}
                  </Text>
                )}
              </View>
            )}

            {/* Legend */}
            <View style={s.heatLegend}>
              <Text style={[s.metricLabel, { color: colors.textTertiary }]}>Menos</Text>
              {[0, 0.1, 0.3, 0.6, 1.0].map((v, i) => (
                <View key={i} style={[s.heatLegendCell, { backgroundColor: getHeatColor(v, isDark) }]} />
              ))}
              <Text style={[s.metricLabel, { color: colors.textTertiary }]}>Más</Text>
            </View>
          </>,
        )}

        {/* Insights */}
        <View style={[s.insightRow, { marginTop: 12 }]}>
          {diaMaxCell.monto > 0 && (
            <View style={[s.insightPill, { backgroundColor: colors.cardSecondary }]}>
              <Icon name="activity" size={12} color={colors.warning} />
              <Text style={[s.insightPillText, { color: colors.textSecondary }]}>
                Mayor gasto: {getDiaLabel(diaMaxCell.dia)} · {fmtCOP(diaMaxCell.monto)}
              </Text>
            </View>
          )}
          <View style={[s.insightPill, { backgroundColor: colors.cardSecondary }]}>
            <Icon name="check-circle" size={12} color={colors.income} />
            <Text style={[s.insightPillText, { color: colors.textSecondary }]}>
              {sinGasto} días sin gastos
            </Text>
          </View>
        </View>
      </>
    );
  };

  // ── TAB: TREEMAP ───────────────────────────────────────────────────────────

  const renderTreemap = () => {
    const sinDatos = treemapData.length === 0;
    const mesLabel = capitalize(getMesLabel(mes));
    const allNodes = treemapData.flatMap(row => row.nodes);

    return (
      <>
        {sinDatos ? (
          <View style={[s.emptyWrap, { paddingVertical: 40 }]}>
            <Icon name="pie-chart" size={32} color={colors.textTertiary} />
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>
              Sin gastos registrados en {mesLabel}
            </Text>
            <TouchableOpacity onPress={() => onNavigate?.('gastos')}>
              <Text style={[s.emptyAction, { color: colors.primary }]}>Agregar gasto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Animated.View
              style={{
                opacity: treemapAnim,
                transform: [{ scale: treemapAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
              }}
            >
              {treemapData.map((row, ri) => (
                <View key={ri} style={[s.treemapRow, { height: row.height }]}>
                  {row.nodes.map((node, ni) => (
                    <TouchableOpacity
                      key={ni}
                      style={[s.treemapNode, { flex: node.flex, height: row.height, backgroundColor: node.color }]}
                      onPress={() =>
                        Alert.alert(node.name, `${fmtCOP(node.amount)} · ${node.percentage}% del total`)
                      }
                    >
                      <Text style={s.treemapName} numberOfLines={1}>
                        {node.flex < 0.15 ? node.name.slice(0, 3) : node.name}
                      </Text>
                      {row.height >= 70 && (
                        <Text style={s.treemapAmount}>{fmtShort(node.amount)}</Text>
                      )}
                      {node.flex >= 0.2 && (
                        <Text style={s.treemapPct}>{node.percentage}%</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </Animated.View>

            {/* Color legend */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 12 }}
              contentContainerStyle={s.treemapLegend}
            >
              {allNodes.map((node, i) => (
                <View key={i} style={s.treemapLegendItem}>
                  <View style={[s.treemapLegendDot, { backgroundColor: node.color }]} />
                  <Text style={[s.treemapLegendText, { color: colors.textSecondary }]}>
                    {node.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </>
    );
  };

  // ── MAIN RENDER ────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: '#F8F7FF' }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: '#F8F7FF', paddingTop: insets.top + 12 }]}>
        <Text style={s.headerTitle}>Estadísticas</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={s.monthBadge}>
            <Text style={s.monthBadgeText}>
              {capitalize(getMesLabelLargo(mes, año))}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onNavigate?.('exportar')}
            style={[s.downloadBtn, { backgroundColor: THEME.colors.primaryLight }]}
          >
            <Icon name="download" size={16} color={THEME.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Month selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.monthScroll, { backgroundColor: '#F8F7FF' }]}
        contentContainerStyle={s.monthScrollContent}
      >
        {mesesDisponibles.map((m, i) => {
          const active = m.mes === mes && m.año === año;
          return (
            <TouchableOpacity
              key={i}
              style={[
                s.monthPill,
                active
                  ? { backgroundColor: '#6156E8' }
                  : { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E7EB' },
              ]}
              onPress={() => setMesSeleccionado({ mes: m.mes, año: m.año })}
            >
              <Text style={[s.monthPillText, { color: active ? '#FFFFFF' : '#6B7280', fontWeight: active ? '600' : '400' }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Single scrollable content — all sections stacked */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.tabContent, { paddingBottom: 56 + insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Resumen ── */}
        <Text style={s.sectionHeading}>RESUMEN</Text>
        {renderResumen()}

        {/* ── Comparativo ── */}
        <Text style={[s.sectionHeading, { marginTop: 8 }]}>COMPARATIVO</Text>
        {renderComparativo()}

        {/* ── Ahorro ── */}
        <Text style={[s.sectionHeading, { marginTop: 8 }]}>AHORRO</Text>
        {renderAhorro()}

        {/* ── Mapa de calor ── */}
        <Text style={[s.sectionHeading, { marginTop: 8 }]}>MAPA DE CALOR</Text>
        {renderCalor()}

        {/* ── Treemap ── */}
        <Text style={[s.sectionHeading, { marginTop: 8 }]}>DISTRIBUCIÓN</Text>
        {renderTreemap()}
      </ScrollView>
    </View>
  );
};

// Backward-compat export
export const Estadisticas = EstadisticasScreen;

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header — light themed
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  monthBadge: {
    backgroundColor: THEME.colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  monthBadgeText: { fontSize: 12, color: '#6156E8', fontWeight: '500' },
  downloadBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Month scroll
  monthScroll:        { maxHeight: 50, flexShrink: 0 },
  monthScrollContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  monthPill:          { borderRadius: 100, paddingHorizontal: 14, height: 34, justifyContent: 'center' },
  monthPillText:      { fontSize: 12 },

  // Section heading
  sectionHeading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
    color: '#9CA3AF',
  },

  tabContent: { paddingHorizontal: 16, paddingTop: 12, gap: 0 },

  // Card — white, rounded, shadow
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },

  // Metric grids
  metricGrid:  { flexDirection: 'row', gap: 8 },
  metricCell:  {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: '#F8F7FF',
  },
  metricCell2: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
    backgroundColor: '#F8F7FF',
  },
  metricVal:   { fontSize: 22, fontWeight: '700', color: '#6156E8' },
  metricVal2:  { fontSize: 15, fontWeight: '700', color: '#6156E8' },
  metricLabel: { fontSize: 11, fontWeight: '400', color: '#9CA3AF' },

  // Donut
  donutRow:       { flexDirection: 'row', alignItems: 'center', gap: 16 },
  donutLegend:    { flex: 1, gap: 10 },
  legendItem:     { gap: 4 },
  legendRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:      { width: 8, height: 8, borderRadius: 2 },
  legendLabel:    { flex: 1, fontSize: 11 },
  legendPct:      { fontSize: 11, fontWeight: '500' },
  legendBarTrack: { height: 3, borderRadius: 2, overflow: 'hidden' },
  legendBarFill:  { height: 3, borderRadius: 2 },
  changeBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: THEME.radius.sm, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
  changeText:     { fontSize: 10, fontWeight: '500' },

  // Comparativo
  periodoRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  periodoPill:     { borderRadius: 100, paddingHorizontal: 18, height: 34, justifyContent: 'center' },
  periodoPillText: { fontSize: 12, fontWeight: '500' },
  barLegend:       { flexDirection: 'row', gap: 16, marginTop: 8, justifyContent: 'center' },

  // Ahorro
  areaFooter:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  areaFooterVal: { fontSize: 15, fontWeight: '700' },

  // Calor
  heatExplain:     { fontSize: 11, marginBottom: 8, color: '#9CA3AF' },
  heatLegend:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  heatLegendCell:  { width: 14, height: 14, borderRadius: 3 },
  insightRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  insightPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  insightPillText: { fontSize: 11, color: '#6B7280' },

  // Tooltip
  tooltip:      { marginTop: 10, borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', padding: 12, gap: 2, backgroundColor: '#FFFFFF' },
  tooltipTitle: { fontSize: 11, fontWeight: '500', color: '#111827' },
  tooltipVal:   { fontSize: 14, fontWeight: '700', color: '#6156E8' },
  tooltipSub:   { fontSize: 10, color: '#9CA3AF' },

  // Treemap
  treemapRow:        { flexDirection: 'row', gap: 3, marginBottom: 3 },
  treemapNode:       { borderRadius: 8, overflow: 'hidden', padding: 8, justifyContent: 'flex-end' },
  treemapName:       { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.9)' },
  treemapAmount:     { fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  treemapPct:        { fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  treemapLegend:     { gap: 8, paddingRight: 8 },
  treemapLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  treemapLegendDot:  { width: 10, height: 10, borderRadius: 2 },
  treemapLegendText: { fontSize: 10, color: '#6B7280' },

  // Empty
  emptyWrap:   { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText:   { fontSize: 13, textAlign: 'center', color: '#6B7280' },
  emptyAction: { fontSize: 13, fontWeight: '600', color: '#6156E8' },
});

// ── Category grid styles ──────────────────────────────────────────────────────
const dg = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
  },
  cell: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 80,
  },
});
