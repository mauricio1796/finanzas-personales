import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Rect, Circle, Path, Line, Defs,
  LinearGradient as SvgGradient, Stop,
  Text as SvgText, G,
} from 'react-native-svg';

import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { getCategoryIcon } from '../components/ui/Icon';
import { calcularMetricasFinancieras } from '../utils/ingresoUtils';
import {
  getMesLabel, getMesLabelLargo, getDiaLabel,
  getBarData, getAreaData, getHeatmapData, getTreemapData,
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

const { width: SW } = Dimensions.get('window');
const CHART_W = SW - 64;

const CAT_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#14B8A6', '#EC4899', '#0EA5E9',
  '#F97316', '#84CC16', '#06B6D4', '#A855F7',
];

type Tab = 'resumen' | 'tendencia' | 'calor' | 'distribucion';
type PeriodoBars = 3 | 6 | 12;

interface Props {
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
  transactions?: any[];
  monthlySalary?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const EstadisticasScreen: React.FC<Props> = ({ onBack, onNavigate }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, accentColor } = useTheme();
  const { transactions, categories, profile, goal } = useFinance();

  const now    = useMemo(() => new Date(), []);
  const [tab,  setTab]  = useState<Tab>('resumen');
  const [mes,  setMes]  = useState(now.getMonth());
  const [año,  setAño]  = useState(now.getFullYear());
  const [periodoBars, setPeriodoBars] = useState<PeriodoBars>(6);
  const [selectedHeatCell, setSelectedHeatCell] = useState<HeatCell | null>(null);

  // No animations — static professional charts

  const salary = profile?.monthlySalary ?? 0;

  const txnCount = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === mes && d.getFullYear() === año;
    }).length,
  [transactions, mes, año]);

  // ── Memos ──────────────────────────────────────────────────────────────────
  const metricas = useMemo(
    () => getResumenMetricas(transactions, mes, año, salary),
    [transactions, mes, año, salary],
  );
  const metricasIngreso = useMemo(
    () => calcularMetricasFinancieras(transactions, categories as any, salary, mes, año),
    [transactions, categories, salary, mes, año],
  );
  const barData = useMemo(() => getBarData(transactions, periodoBars), [transactions, periodoBars]);
  const areaData = useMemo(() => getAreaData(transactions, 6, salary), [transactions, salary]);
  const heatData = useMemo(() => getHeatmapData(transactions, mes, año), [transactions, mes, año]);
  const treemapData = useMemo(() => getTreemapData(transactions, mes, año), [transactions, mes, año]);

  const maxBarMonto  = useMemo(() => Math.max(...barData.flatMap(d => [d.gastoActual, d.gastoAnterior]), 1), [barData]);
  const maxHeatMonto = useMemo(() => Math.max(...heatData.map(c => c.monto), 1), [heatData]);
  const maxAreaMonto = useMemo(() => Math.max(...areaData.map(d => d.ahorro), goal?.targetAmount ?? 1, 1), [areaData, goal]);

  // Gastado por categoría este mes
  const gastoPorCat = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === mes && d.getFullYear() === año;
      })
      .forEach(t => { map[t.category] = (map[t.category] ?? 0) + t.amount; });
    return map;
  }, [transactions, mes, año]);

  const totalGastos  = Object.values(gastoPorCat).reduce((a, b) => a + b, 0);
  const totalIngresos = useMemo(() =>
    transactions
      .filter(t => { const d = new Date(t.date); return t.type === 'income' && d.getMonth() === mes && d.getFullYear() === año; })
      .reduce((s, t) => s + t.amount, 0),
    [transactions, mes, año],
  );
  const balance = totalIngresos - totalGastos;

  // Donut slices
  const donutSlices = useMemo(() => {
    const sorted = Object.entries(gastoPorCat)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
    const main   = sorted.filter(s => totalGastos > 0 && s.amount / totalGastos >= 0.03);
    const otros  = sorted.filter(s => totalGastos > 0 && s.amount / totalGastos < 0.03)
      .reduce((a, s) => a + s.amount, 0);
    return [
      ...main,
      ...(otros > 0 ? [{ name: 'Otros', amount: otros }] : []),
    ].map((s, i) => ({
      ...s,
      color: CAT_COLORS[i % CAT_COLORS.length],
      pct: totalGastos > 0 ? Math.round((s.amount / totalGastos) * 100) : 0,
    }));
  }, [gastoPorCat, totalGastos]);

  // Area chart geometry
  const AREA_H = 160;
  const AREA_PAD_T = 16;
  const AREA_PAD_B = 24;
  const DRAW_H = AREA_H - AREA_PAD_T - AREA_PAD_B;

  const areaPoints = useMemo(() =>
    areaData.map((d, i) => ({
      x: areaData.length > 1 ? (i / (areaData.length - 1)) * CHART_W : CHART_W / 2,
      y: AREA_PAD_T + DRAW_H - (maxAreaMonto > 0 ? (d.ahorro / maxAreaMonto) * DRAW_H : 0),
      ...d,
    })),
  [areaData, maxAreaMonto]);

  const linePath = useMemo(() => buildSmoothPath(areaPoints), [areaPoints]);
  const areaPath = useMemo(() => {
    if (areaPoints.length < 2) return '';
    const last = areaPoints[areaPoints.length - 1];
    const first = areaPoints[0];
    return `${linePath} L ${last.x.toFixed(1)},${(AREA_H - AREA_PAD_B).toFixed(1)} L ${first.x.toFixed(1)},${(AREA_H - AREA_PAD_B).toFixed(1)} Z`;
  }, [linePath, areaPoints]);

  // Bar geometry
  const BAR_H  = 120;
  const GRP_W  = CHART_W / Math.max(barData.length, 1);
  const BAR_W  = Math.max(GRP_W * 0.25, 6);


  const mesesDisponibles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return { mes: d.getMonth(), año: d.getFullYear(), label: capitalize(getMesLabel(d.getMonth())) };
    }),
  [now]);

  // ── Color helpers ──────────────────────────────────────────────────────────
  const bg       = colors.background;
  const card     = colors.card;
  const cardSec  = colors.cardSecondary;
  const txt      = colors.textPrimary;
  const txts     = colors.textSecondary;
  const txtT     = colors.textTertiary;
  const bdr      = colors.border;
  const primary  = colors.primary;
  const income   = colors.income ?? '#10B981';
  const expense  = colors.expense ?? '#EF4444';

  // ── Tab: RESUMEN ───────────────────────────────────────────────────────────
  const renderResumen = () => {
    const DSVG = Math.min(SW - 48, 260);
    const CX   = DSVG / 2;
    const CY   = DSVG / 2;
    const R    = DSVG * 0.33;
    const STROKE = DSVG * 0.11;
    const CIRC = 2 * Math.PI * R;
    const GAP  = (2 / 360) * CIRC;

    let cumulative = 0;
    const slices = donutSlices.map(s => {
      const dash = (s.pct / 100) * CIRC;
      const off  = cumulative;
      cumulative += dash;
      return { ...s, dash, off };
    });

    const catGrid = (categories as any[]).filter(c => c.isSelected).slice(0, 8);

    return (
      <View>
        {/* ── Donut card ── */}
        <View style={[cs.card, { backgroundColor: card }]}>
          <View style={cs.cardHeader}>
            <Text style={[cs.cardTitle, { color: txt }]}>Gastos por categoría</Text>
            <Text style={[cs.cardSub, { color: txtT }]}>{capitalize(getMesLabelLargo(mes, año))}</Text>
          </View>

          {totalGastos === 0 ? (
            <Empty icon="pie-chart" text="Sin gastos registrados este mes" />
          ) : (
            <>
              {/* Donut */}
              <View style={{ alignItems: 'center', marginVertical: 8 }}>
                <Svg width={DSVG} height={DSVG}>
                  {/* Track */}
                  <Circle cx={CX} cy={CY} r={R} fill="none" stroke={isDark ? '#2A2A35' : '#F1F0FF'} strokeWidth={STROKE} />

                  {slices.map((sl, i) => {
                    const d = Math.max(0, sl.dash - GAP);
                    const g = Math.max(0, CIRC - d);
                    return (
                      <Circle
                        key={i} cx={CX} cy={CY} r={R}
                        fill="none" stroke={sl.color} strokeWidth={STROKE}
                        strokeLinecap="round"
                        strokeDasharray={`${d.toFixed(2)} ${g.toFixed(2)}`}
                        strokeDashoffset={`${(-sl.off + GAP / 2).toFixed(2)}`}
                        transform={`rotate(-90 ${CX} ${CY})`}
                      />
                    );
                  })}

                  {/* Center */}
                  <SvgText x={CX} y={CY - 10} textAnchor="middle" fontSize={Math.round(DSVG * 0.07)} fontWeight="800" fill={txt}>
                    {fmtShort(totalGastos)}
                  </SvgText>
                  <SvgText x={CX} y={CY + 8} textAnchor="middle" fontSize={10} fill={txtT}>
                    total gastado
                  </SvgText>
                  {salary > 0 && (
                    <SvgText x={CX} y={CY + 24} textAnchor="middle" fontSize={11} fontWeight="700" fill={primary}>
                      {metricasIngreso.porcentajeGastado}% del salario
                    </SvgText>
                  )}
                </Svg>
              </View>

              {/* Legend with progress bars */}
              <View style={cs.legendList}>
                {slices.map((sl, i) => (
                  <View key={i} style={cs.legendRow}>
                    <View style={[cs.legendDot, { backgroundColor: sl.color }]} />
                    <Text style={[cs.legendName, { color: txt }]} numberOfLines={1}>{sl.name}</Text>
                    <View style={[cs.legendTrack, { backgroundColor: isDark ? '#2A2A35' : '#F3F4F6' }]}>
                      <View style={[cs.legendFill, { width: `${sl.pct}%`, backgroundColor: sl.color }]} />
                    </View>
                    <Text style={[cs.legendPct, { color: sl.color }]}>{sl.pct}%</Text>
                    <Text style={[cs.legendAmt, { color: txtT }]}>{fmtShort(sl.amount)}</Text>
                  </View>
                ))}
              </View>

              {/* Change badge */}
              {metricas.cambioPctVsMesAnterior !== 0 && (
                <View style={[cs.badge, {
                  backgroundColor: metricas.cambioPctVsMesAnterior < 0
                    ? income + '18' : expense + '18',
                  alignSelf: 'center', marginTop: 12,
                }]}>
                  <Icon
                    name={metricas.cambioPctVsMesAnterior < 0 ? 'trending-down' : 'trending-up'}
                    size={11}
                    color={metricas.cambioPctVsMesAnterior < 0 ? income : expense}
                  />
                  <Text style={[cs.badgeText, {
                    color: metricas.cambioPctVsMesAnterior < 0 ? income : expense,
                  }]}>
                    {Math.abs(metricas.cambioPctVsMesAnterior)}% vs mes anterior
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── KPI row ── */}
        <View style={cs.kpiRow}>
          <KpiCard label="Gastado" value={fmtShort(metricasIngreso.totalGastado)} color={expense} icon="arrow-down-circle" bg={expense + '15'} />
          <KpiCard label="Balance" value={fmtShort(metricasIngreso.balanceFinal)} color={income} icon="check-circle" bg={income + '15'} />
          <KpiCard label="% Usado" value={`${metricasIngreso.porcentajeGastado}%`} color={primary} icon="percent" bg={primary + '15'} />
        </View>

        {/* ── Budget diario ── */}
        <View style={[cs.card, { backgroundColor: card }]}>
          <View style={cs.cardHeader}>
            <Text style={[cs.cardTitle, { color: txt }]}>Presupuesto diario</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={[cs.bigNumWrap, { backgroundColor: primary + '12' }]}>
              <Icon name="calendar" size={18} color={primary} />
              <Text style={[cs.bigNum, { color: primary }]}>
                {fmtShort(metricasIngreso.gastoPromedioRecomendadoDia)}
              </Text>
              <Text style={[cs.bigNumLabel, { color: txtT }]}>/ día</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <StatLine label="Mayor categoría" value={metricas.categoriaMayorGasto || '—'} color={txt} sub={txtT} />
              <StatLine label="Txn este mes" value={`${txnCount} movimientos`} color={txt} sub={txtT} />
            </View>
          </View>
        </View>

        {/* ── Category grid ── */}
        {catGrid.length > 0 && (
          <View style={[cs.card, { backgroundColor: card }]}>
            <View style={cs.cardHeader}>
              <Text style={[cs.cardTitle, { color: txt }]}>Mis categorías</Text>
            </View>
            <View style={cs.catGrid}>
              {catGrid.map((cat: any, idx: number) => {
                const accent   = CAT_COLORS[idx % CAT_COLORS.length];
                const gasto    = gastoPorCat[cat.name] ?? 0;
                const iconName = (cat.icon as any) || getCategoryIcon(cat.name);
                return (
                  <View key={cat.id} style={cs.catCell}>
                    <View style={[cs.catCircle, { backgroundColor: accent + '18' }]}>
                      <Icon name={iconName} size={22} color={accent} />
                    </View>
                    <Text style={[cs.catName, { color: txts }]} numberOfLines={1}>{cat.name}</Text>
                    {gasto > 0 && (
                      <Text style={[cs.catAmt, { color: accent }]}>{fmtShort(gasto)}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  };

  // ── Tab: TENDENCIA ─────────────────────────────────────────────────────────
  const renderTendencia = () => {
    const hasBars = barData.some(d => d.gastoActual > 0 || d.gastoAnterior > 0);
    const maxG    = Math.max(...barData.map(d => d.gastoActual), 0);
    const conDatos = barData.filter(d => d.gastoActual > 0);
    const promedio = conDatos.length > 0
      ? conDatos.reduce((s, d) => s + d.gastoActual, 0) / conDatos.length : 0;
    const minG = conDatos.length > 0 ? Math.min(...conDatos.map(d => d.gastoActual)) : 0;
    const sinAhorro = areaData.every(d => d.ahorro === 0);
    const goalAmt   = goal?.targetAmount ?? 0;
    const goalY     = goalAmt > 0
      ? AREA_PAD_T + DRAW_H - (goalAmt / maxAreaMonto) * DRAW_H : null;

    return (
      <View>
        {/* Period pills */}
        <View style={cs.pillRow}>
          {([3, 6, 12] as PeriodoBars[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[cs.pill, periodoBars === p ? { backgroundColor: primary } : { backgroundColor: card, borderWidth: 1, borderColor: bdr }]}
              onPress={() => setPeriodoBars(p)}
            >
              <Text style={[cs.pillText, { color: periodoBars === p ? '#fff' : txts }]}>{p}m</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bar chart */}
        <View style={[cs.card, { backgroundColor: card }]}>
          <View style={cs.cardHeader}>
            <Text style={[cs.cardTitle, { color: txt }]}>Gastos mensuales</Text>
            <View style={cs.legendRow}>
              <View style={[cs.legendDot, { backgroundColor: primary, opacity: 0.35 }]} />
              <Text style={[cs.legendName, { color: txts, fontSize: 10 }]}>Ant.</Text>
              <View style={[cs.legendDot, { backgroundColor: primary }]} />
              <Text style={[cs.legendName, { color: txts, fontSize: 10 }]}>Act.</Text>
            </View>
          </View>

          {!hasBars ? (
            <Empty icon="bar-chart-2" text="Sin datos en este período" />
          ) : (
            <>
              <Svg width={CHART_W} height={BAR_H + 36}>
                <Defs>
                  <SvgGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={primary} stopOpacity={1} />
                    <Stop offset="100%" stopColor={primary} stopOpacity={0.5} />
                  </SvgGradient>
                  <SvgGradient id="barGradPrev" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={primary} stopOpacity={0.4} />
                    <Stop offset="100%" stopColor={primary} stopOpacity={0.1} />
                  </SvgGradient>
                </Defs>

                {/* Grid */}
                {[0, 0.5, 1].map((pct, gi) => {
                  const y = BAR_H - pct * BAR_H;
                  return (
                    <React.Fragment key={gi}>
                      <Line x1={0} y1={y} x2={CHART_W} y2={y} stroke={bdr} strokeWidth={0.5} strokeDasharray={gi > 0 ? '3 3' : undefined} />
                      {pct > 0 && (
                        <SvgText x={2} y={y - 3} fontSize={8} fill={txtT}>{fmtShort(maxBarMonto * pct)}</SvgText>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Bars */}
                {barData.map((d, i) => {
                  const cx     = i * GRP_W + GRP_W / 2;
                  const hCurr  = maxBarMonto > 0 ? Math.max(d.gastoActual > 0 ? 4 : 0, (d.gastoActual / maxBarMonto) * BAR_H) : 0;
                  const hPrev  = maxBarMonto > 0 ? Math.max(d.gastoAnterior > 0 ? 4 : 0, (d.gastoAnterior / maxBarMonto) * BAR_H) : 0;
                  const gap    = BAR_W * 0.35;
                  return (
                    <G key={i}>
                      {hPrev > 0 && (
                        <Rect
                          x={cx - gap / 2 - BAR_W} y={BAR_H - hPrev}
                          width={BAR_W} height={hPrev}
                          rx={4} fill="url(#barGradPrev)"
                        />
                      )}
                      {hCurr > 0 && (
                        <Rect
                          x={cx + gap / 2} y={BAR_H - hCurr}
                          width={BAR_W} height={hCurr}
                          rx={4} fill="url(#barGrad)"
                        />
                      )}
                      <SvgText x={cx} y={BAR_H + 14} textAnchor="middle" fontSize={9} fill={txtT}>
                        {d.label}
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>

              {/* Stats */}
              <View style={[cs.statStrip, { backgroundColor: cardSec, marginTop: 12 }]}>
                {[
                  { label: 'Máximo', value: fmtShort(maxG), color: expense },
                  { label: 'Promedio', value: fmtShort(promedio), color: primary },
                  { label: 'Mínimo', value: fmtShort(minG), color: income },
                ].map(m => (
                  <View key={m.label} style={cs.statStripCell}>
                    <Text style={[cs.statStripVal, { color: m.color }]}>{m.value}</Text>
                    <Text style={[cs.statStripLabel, { color: txtT }]}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Area chart — ahorro */}
        <View style={[cs.card, { backgroundColor: card }]}>
          <View style={cs.cardHeader}>
            <Text style={[cs.cardTitle, { color: txt }]}>Ahorro acumulado</Text>
            {goalAmt > 0 && (
              <View style={[cs.badge, { backgroundColor: income + '18' }]}>
                <Text style={[cs.badgeText, { color: income }]}>Meta: {fmtShort(goalAmt)}</Text>
              </View>
            )}
          </View>

          {sinAhorro ? (
            <Empty icon="trending-up" text="Registra transacciones para ver tu progreso" />
          ) : (
            <>
              <Svg width={CHART_W} height={AREA_H}>
                <Defs>
                  <SvgGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={income} stopOpacity={0.35} />
                    <Stop offset="100%" stopColor={income} stopOpacity={0.02} />
                  </SvgGradient>
                </Defs>

                {[0, 0.5, 1].map((pct, gi) => {
                  const y = AREA_PAD_T + DRAW_H - pct * DRAW_H;
                  return (
                    <React.Fragment key={gi}>
                      <Line x1={0} y1={y} x2={CHART_W} y2={y} stroke={bdr} strokeWidth={0.5} strokeDasharray={gi > 0 ? '3 3' : undefined} />
                      {pct > 0 && <SvgText x={2} y={y - 3} fontSize={8} fill={txtT}>{fmtShort(maxAreaMonto * pct)}</SvgText>}
                    </React.Fragment>
                  );
                })}

                {goalY !== null && (
                  <>
                    <Line x1={0} y1={goalY} x2={CHART_W} y2={goalY} stroke={income} strokeDasharray="5 3" strokeWidth={1.5} opacity={0.7} />
                    <SvgText x={CHART_W - 30} y={goalY - 4} fontSize={9} fill={income} fontWeight="600">Meta</SvgText>
                  </>
                )}

                {areaPath && <Path d={areaPath} fill="url(#areaGrad)" />}
                {linePath && <Path d={linePath} stroke={income} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}

                {areaPoints.map((pt, i) => {
                  const isLast = i === areaPoints.length - 1;
                  return (
                    <React.Fragment key={i}>
                      {isLast && <Circle cx={pt.x} cy={pt.y} r={10} fill={income} opacity={0.15} />}
                      <Circle cx={pt.x} cy={pt.y} r={isLast ? 5 : 3} fill={income} stroke="#fff" strokeWidth={1.5} />
                    </React.Fragment>
                  );
                })}

                {areaData.map((d, i) => (
                  <SvgText
                    key={i}
                    x={areaData.length > 1 ? (i / (areaData.length - 1)) * CHART_W : CHART_W / 2}
                    y={AREA_H - 4} textAnchor="middle" fontSize={9} fill={txtT}
                  >
                    {d.label}
                  </SvgText>
                ))}
              </Svg>

              <View style={[cs.statStrip, { backgroundColor: cardSec, marginTop: 12 }]}>
                <View style={cs.statStripCell}>
                  <Text style={[cs.statStripVal, { color: income }]}>{fmtShort(areaData[areaData.length - 1]?.ahorro ?? 0)}</Text>
                  <Text style={[cs.statStripLabel, { color: txtT }]}>Acumulado</Text>
                </View>
                {goalAmt > 0 && (
                  <View style={cs.statStripCell}>
                    <Text style={[cs.statStripVal, { color: primary }]}>
                      {Math.min(100, Math.round(((areaData[areaData.length - 1]?.ahorro ?? 0) / goalAmt) * 100))}%
                    </Text>
                    <Text style={[cs.statStripLabel, { color: txtT }]}>Progreso meta</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  // ── Tab: CALOR ─────────────────────────────────────────────────────────────
  const renderCalor = () => {
    const CELL     = 32;
    const GAP      = 4;
    const LABEL_W  = 24;
    const GRID_W   = LABEL_W + 7 * (CELL + GAP);
    const GRID_H   = 4 * (CELL + GAP) + 28;
    const DAYS     = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const diaMax   = heatData.reduce((m, c) => c.monto > m.monto ? c : m, heatData[0] ?? { semana: 0, dia: 0, monto: 0, count: 0 });
    const sinGasto = heatData.filter(c => c.monto === 0).length;

    return (
      <View>
        <View style={[cs.card, { backgroundColor: card }]}>
          <View style={cs.cardHeader}>
            <Text style={[cs.cardTitle, { color: txt }]}>Intensidad de gasto</Text>
            <Text style={[cs.cardSub, { color: txtT }]}>{capitalize(getMesLabelLargo(mes, año))}</Text>
          </View>

          <View style={{ alignItems: 'center' }}>
            <Svg width={GRID_W} height={GRID_H}>
              {DAYS.map((lbl, di) => (
                <SvgText key={di} x={LABEL_W + di * (CELL + GAP) + CELL / 2} y={14}
                  textAnchor="middle" fontSize={10} fontWeight="600" fill={txtT}>{lbl}</SvgText>
              ))}
              {['S1', 'S2', 'S3', 'S4'].map((lbl, wi) => (
                <SvgText key={wi} x={0} y={26 + wi * (CELL + GAP) + CELL / 2}
                  fontSize={9} fill={txtT}>{lbl}</SvgText>
              ))}
              {heatData.map((cell, idx) => {
                const intensity = getHeatIntensity(cell.monto, maxHeatMonto);
                const fill      = getHeatColor(intensity, isDark);
                const cx = LABEL_W + cell.dia * (CELL + GAP);
                const cy = 22 + cell.semana * (CELL + GAP);
                return <Rect key={idx} x={cx} y={cy} width={CELL} height={CELL} rx={7} fill={fill} />;
              })}
            </Svg>

            {/* Tap overlay */}
            <View style={[StyleSheet.absoluteFill, { top: 44 }]}>
              {heatData.map((cell, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: LABEL_W + cell.dia * (CELL + GAP),
                    top: 22 + cell.semana * (CELL + GAP) - 44,
                    width: CELL, height: CELL,
                  }}
                  onPress={() => setSelectedHeatCell(p =>
                    p?.semana === cell.semana && p.dia === cell.dia ? null : cell
                  )}
                />
              ))}
            </View>
          </View>

          {/* Tooltip */}
          {selectedHeatCell && (
            <View style={[cs.tooltip, { backgroundColor: cardSec, borderColor: bdr }]}>
              <Text style={[cs.tooltipTitle, { color: txt }]}>
                {getDiaLabel(selectedHeatCell.dia)} — Semana {selectedHeatCell.semana + 1}
              </Text>
              <Text style={[cs.tooltipVal, { color: primary }]}>
                {selectedHeatCell.monto > 0 ? fmtCOP(selectedHeatCell.monto) : 'Sin gastos'}
              </Text>
              {selectedHeatCell.count > 0 && (
                <Text style={[cs.tooltipSub, { color: txtT }]}>
                  {selectedHeatCell.count} transacción{selectedHeatCell.count !== 1 ? 'es' : ''}
                </Text>
              )}
            </View>
          )}

          {/* Legend */}
          <View style={cs.heatLegend}>
            <Text style={[{ fontSize: 10, color: txtT }]}>Menos</Text>
            {[0, 0.2, 0.4, 0.7, 1.0].map((v, i) => (
              <View key={i} style={[cs.heatCell, { backgroundColor: getHeatColor(v, isDark) }]} />
            ))}
            <Text style={[{ fontSize: 10, color: txtT }]}>Más</Text>
          </View>
        </View>

        {/* Insights */}
        <View style={[cs.card, { backgroundColor: card }]}>
          <View style={cs.cardHeader}>
            <Text style={[cs.cardTitle, { color: txt }]}>Patrones detectados</Text>
          </View>
          <View style={{ gap: 10 }}>
            {diaMax.monto > 0 && (
              <InsightRow
                icon="zap" iconColor="#F59E0B"
                text={`Mayor actividad los ${getDiaLabel(diaMax.dia)} con ${fmtCOP(diaMax.monto)}`}
                bg="#FEF3C7" card={card} txt={txts}
              />
            )}
            <InsightRow
              icon="shield" iconColor={income}
              text={`${sinGasto} días sin ningún gasto registrado`}
              bg={income + '15'} card={card} txt={txts}
            />
            {txnCount > 0 && (
              <InsightRow
                icon="activity" iconColor={primary}
                text={`${txnCount} transacciones en ${capitalize(getMesLabel(mes))}`}
                bg={primary + '12'} card={card} txt={txts}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  // ── Tab: DISTRIBUCIÓN ──────────────────────────────────────────────────────
  const renderDistribucion = () => {
    const sinDatos  = treemapData.length === 0;
    const allNodes  = treemapData.flatMap(row => row.nodes);

    return (
      <View>
        <View style={[cs.card, { backgroundColor: card }]}>
          <View style={cs.cardHeader}>
            <Text style={[cs.cardTitle, { color: txt }]}>Distribución de gastos</Text>
            <Text style={[cs.cardSub, { color: txtT }]}>{capitalize(getMesLabel(mes))}</Text>
          </View>

          {sinDatos ? (
            <>
              <Empty icon="grid" text={`Sin gastos en ${capitalize(getMesLabel(mes))}`} />
              <TouchableOpacity onPress={() => onNavigate?.('gastos')} style={[cs.ctaBtn, { backgroundColor: primary }]}>
                <Text style={cs.ctaBtnText}>Registrar gasto</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View>
              {treemapData.map((row, ri) => (
                <View key={ri} style={[cs.treemapRow, { height: row.height }]}>
                  {row.nodes.map((node, ni) => (
                    <TouchableOpacity
                      key={ni}
                      style={[cs.treemapNode, { flex: node.flex, height: row.height, backgroundColor: node.color }]}
                      onPress={() => Alert.alert(node.name, `${fmtCOP(node.amount)}\n${node.percentage}% del total`)}
                    >
                      <Text style={cs.treemapName} numberOfLines={1}>
                        {node.flex < 0.15 ? node.name.slice(0, 3) : node.name}
                      </Text>
                      {row.height >= 64 && (
                        <Text style={cs.treemapAmt}>{fmtShort(node.amount)}</Text>
                      )}
                      {node.flex >= 0.2 && (
                        <Text style={cs.treemapPct}>{node.percentage}%</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Category breakdown list */}
        {!sinDatos && (
          <View style={[cs.card, { backgroundColor: card }]}>
            <View style={cs.cardHeader}>
              <Text style={[cs.cardTitle, { color: txt }]}>Desglose por categoría</Text>
            </View>
            {allNodes.map((node, i) => (
              <View key={i} style={[cs.breakdownRow, i > 0 && { borderTopWidth: 1, borderTopColor: bdr }]}>
                <View style={[cs.breakdownDot, { backgroundColor: node.color }]} />
                <Text style={[cs.breakdownName, { color: txt }]}>{node.name}</Text>
                <View style={{ flex: 1 }}>
                  <View style={[cs.legendTrack, { backgroundColor: isDark ? '#2A2A35' : '#F3F4F6', height: 6 }]}>
                    <View style={[cs.legendFill, { width: `${node.percentage}%`, backgroundColor: node.color, height: 6 }]} />
                  </View>
                </View>
                <Text style={[cs.breakdownAmt, { color: node.color }]}>{fmtShort(node.amount)}</Text>
                <Text style={[cs.breakdownPct, { color: txtT }]}>{node.percentage}%</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ── Tabs config ────────────────────────────────────────────────────────────
  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'resumen',       label: 'Resumen',  icon: 'pie-chart' },
    { key: 'tendencia',     label: 'Tendencia', icon: 'trending-up' },
    { key: 'calor',         label: 'Calor',    icon: 'activity' },
    { key: 'distribucion',  label: 'Mapa',     icon: 'grid' },
  ];

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <View style={[cs.root, { backgroundColor: bg }]}>

      {/* ── Gradient hero header ── */}
      <LinearGradient
        colors={isDark
          ? [accentColor + 'CC', accentColor + '88', bg]
          : [accentColor, accentColor + 'DD', accentColor + '22']}
        style={[cs.hero, { paddingTop: insets.top + 12 }]}
      >
        <View style={cs.heroRow}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={cs.heroBack} hitSlop={12}>
              <Icon name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={cs.heroTitle}>Estadísticas</Text>
            <Text style={cs.heroSub}>{capitalize(getMesLabelLargo(mes, año))}</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate?.('exportar')} style={cs.heroAction}>
            <Icon name="download" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Hero KPI strip */}
        <View style={cs.heroStrip}>
          <HeroKpi label="Ingresos" value={fmtShort(totalIngresos)} positive />
          <View style={cs.heroStripDivider} />
          <HeroKpi label="Gastos" value={fmtShort(totalGastos)} positive={false} />
          <View style={cs.heroStripDivider} />
          <HeroKpi label="Balance" value={fmtShort(balance)} positive={balance >= 0} />
        </View>
      </LinearGradient>

      {/* ── Month pill scroller ── */}
      <View style={[cs.monthBar, { backgroundColor: card, borderBottomColor: bdr }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cs.monthBarContent}>
          {mesesDisponibles.map((m, i) => {
            const active = m.mes === mes && m.año === año;
            return (
              <TouchableOpacity
                key={i}
                style={[cs.monthPill, active
                  ? { backgroundColor: primary }
                  : { backgroundColor: cardSec }]}
                onPress={() => { setMes(m.mes); setAño(m.año); }}
              >
                <Text style={[cs.monthPillText, { color: active ? '#fff' : txts }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Tab bar ── */}
      <View style={[cs.tabBar, { backgroundColor: card, borderBottomColor: bdr }]}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[cs.tabItem, active && [cs.tabItemActive, { borderBottomColor: primary }]]}
              onPress={() => setTab(t.key)}
            >
              <Icon name={t.icon as any} size={14} color={active ? primary : txtT} />
              <Text style={[cs.tabLabel, { color: active ? primary : txtT, fontWeight: active ? '700' : '400' }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Tab content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[cs.content, { paddingBottom: 56 + insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'resumen'      && renderResumen()}
        {tab === 'tendencia'    && renderTendencia()}
        {tab === 'calor'        && renderCalor()}
        {tab === 'distribucion' && renderDistribucion()}
      </ScrollView>
    </View>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const HeroKpi: React.FC<{ label: string; value: string; positive: boolean }> = ({ label, value, positive }) => (
  <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    <Text style={{ fontSize: 16, color: '#fff', fontWeight: '800', letterSpacing: -0.5 }}>{value}</Text>
    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: positive ? '#34D399' : '#FCA5A5' }} />
  </View>
);

const KpiCard: React.FC<{ label: string; value: string; color: string; icon: string; bg: string }> = ({ label, value, color, icon, bg }) => (
  <View style={[cs.kpiCard, { backgroundColor: bg }]}>
    <Icon name={icon as any} size={16} color={color} />
    <Text style={[cs.kpiVal, { color }]}>{value}</Text>
    <Text style={[cs.kpiLabel, { color: color + 'AA' }]}>{label}</Text>
  </View>
);

const StatLine: React.FC<{ label: string; value: string; color: string; sub: string }> = ({ label, value, color, sub }) => (
  <View>
    <Text style={{ fontSize: 10, color: sub }}>{label}</Text>
    <Text style={{ fontSize: 13, color, fontWeight: '700' }} numberOfLines={1}>{value}</Text>
  </View>
);

const InsightRow: React.FC<{ icon: string; iconColor: string; text: string; bg: string; card: string; txt: string }> = ({ icon, iconColor, text, bg, txt }) => (
  <View style={[cs.insightRow, { backgroundColor: bg }]}>
    <Icon name={icon as any} size={14} color={iconColor} />
    <Text style={[cs.insightText, { color: txt }]}>{text}</Text>
  </View>
);

const Empty: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={cs.empty}>
    <Icon name={icon as any} size={28} color="#9CA3AF" />
    <Text style={cs.emptyText}>{text}</Text>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────
export const Estadisticas = EstadisticasScreen;

const cs = StyleSheet.create({
  root: { flex: 1 },

  // Hero
  hero: { paddingHorizontal: 20, paddingBottom: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  heroBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  heroAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  heroStrip: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14, alignItems: 'center' },
  heroStripDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)' },

  // Month bar
  monthBar: { borderBottomWidth: 1 },
  monthBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 6, flexDirection: 'row' },
  monthPill: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6 },
  monthPillText: { fontSize: 12, fontWeight: '500' },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 3, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomWidth: 2 },
  tabLabel: { fontSize: 10, letterSpacing: 0.2 },

  // Content
  content: { padding: 16, gap: 0 },

  // Card
  card: {
    borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  cardSub: { fontSize: 11, fontWeight: '400' },

  // KPI row
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  kpiCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  kpiVal: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  kpiLabel: { fontSize: 10, fontWeight: '500' },

  // Donut legend
  legendList: { gap: 8, marginTop: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 2.5 },
  legendName: { fontSize: 12, fontWeight: '500', width: 90 },
  legendTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  legendFill: { height: 5, borderRadius: 3 },
  legendPct: { fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' },
  legendAmt: { fontSize: 10, width: 44, textAlign: 'right' },

  // Badge
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  // Period pills
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: { borderRadius: 100, paddingHorizontal: 16, paddingVertical: 7 },
  pillText: { fontSize: 12, fontWeight: '600' },

  // Stat strip
  statStrip: { flexDirection: 'row', borderRadius: 12, padding: 12 },
  statStripCell: { flex: 1, alignItems: 'center', gap: 3 },
  statStripVal: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  statStripLabel: { fontSize: 10 },

  // Big number
  bigNumWrap: { borderRadius: 14, padding: 14, alignItems: 'center', gap: 4, minWidth: 100 },
  bigNum: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  bigNumLabel: { fontSize: 11 },

  // Category grid
  catGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  catCell: { width: '25%', alignItems: 'center', paddingVertical: 14, gap: 6 },
  catCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 11, fontWeight: '500', textAlign: 'center', maxWidth: 72 },
  catAmt: { fontSize: 10, fontWeight: '700' },

  // Heatmap
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  heatCell: { width: 18, height: 18, borderRadius: 4 },
  tooltip: { marginTop: 12, borderRadius: 14, borderWidth: 1, padding: 14, gap: 3 },
  tooltipTitle: { fontSize: 12, fontWeight: '600' },
  tooltipVal: { fontSize: 16, fontWeight: '800' },
  tooltipSub: { fontSize: 11 },

  // Insight
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  insightText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // Treemap
  treemapRow: { flexDirection: 'row', gap: 3, marginBottom: 3 },
  treemapNode: { borderRadius: 10, overflow: 'hidden', padding: 10, justifyContent: 'flex-end' },
  treemapName: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.95)' },
  treemapAmt: { fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  treemapPct: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 },

  // Breakdown list
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  breakdownDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownName: { fontSize: 13, fontWeight: '500', width: 90 },
  breakdownAmt: { fontSize: 12, fontWeight: '700' },
  breakdownPct: { fontSize: 11, width: 36, textAlign: 'right' },

  // CTA
  ctaBtn: { borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12 },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
