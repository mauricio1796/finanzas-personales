import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { Icon } from '../components/ui/Icon';
import { useFinance } from '../state/FinanceContext';
import { calcularMeta, calcularCredito, simularReduccion, proyectarMesProximo, detectarTendencia } from '../services/ProyeccionService';
import { THEME } from '../constants/theme';

type Escenario = 'proyeccion' | 'meta' | 'credito' | 'reduccion';
const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

const CHART_W = 300;
const CHART_H = 120;

function MiniChart({ puntos, color = THEME.colors.primary }: { puntos: { mes: number; valor: number }[]; color?: string }) {
  if (puntos.length < 2) return null;
  const maxVal = Math.max(...puntos.map(p => p.valor), 1);
  const maxMes = Math.max(...puntos.map(p => p.mes), 1);
  const pts = puntos.map(p => ({
    x: (p.mes / maxMes) * (CHART_W - 20) + 10,
    y: CHART_H - 10 - (p.valor / maxVal) * (CHART_H - 20),
  }));
  const polyPoints = pts.map(p => p.x + ',' + p.y).join(' ');
  return (
    <Svg width={CHART_W} height={CHART_H} viewBox={'0 0 ' + CHART_W + ' ' + CHART_H}>
      <Polyline points={polyPoints} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.length > 0 && <Circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="5" fill={color} />}
    </Svg>
  );
}

interface StepRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formato: 'cop' | 'pct' | 'meses';
  onChange: (v: number) => void;
}

function StepRow({ label, value, min, max, step, formato, onChange }: StepRowProps) {
  const display = formato === 'cop' ? fmtCOP(value) : formato === 'pct' ? value.toFixed(0) + '%' : value + ' meses';
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  const pct = Math.round(((value - min) / (max - min)) * 100);
  return (
    <View style={sl.container}>
      <View style={sl.row}>
        <Text style={sl.label}>{label}</Text>
        <Text style={sl.valueText}>{display}</Text>
      </View>
      <View style={sl.controls}>
        <TouchableOpacity onPress={dec} style={[sl.btn, value <= min && sl.btnDisabled]} activeOpacity={0.7}>
          <Icon name="minus" size={14} color={value <= min ? THEME.colors.border : THEME.colors.primary} />
        </TouchableOpacity>
        <View style={sl.track}>
          <View style={[sl.fill, { width: pct + '%' as any }]} />
        </View>
        <TouchableOpacity onPress={inc} style={[sl.btn, value >= max && sl.btnDisabled]} activeOpacity={0.7}>
          <Icon name="plus" size={14} color={value >= max ? THEME.colors.border : THEME.colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const ProyeccionesScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { profile, premium, transactions } = useFinance();
  const [escenario, setEscenario] = useState<Escenario>('proyeccion');
  const salario = profile?.monthlySalary ?? 2500000;

  const [ahorroMensual, setAhorroMensual] = useState(500000);
  const [metaTotal, setMetaTotal] = useState(10000000);
  const [rendimiento, setRendimiento] = useState(11);
  const [montoCredito, setMontoCredito] = useState(5000000);
  const [tasaMensual, setTasaMensual] = useState(2);
  const [plazo, setPlazo] = useState(24);
  const [reduccionPct, setReduccionPct] = useState(20);
  const [gastoActual, setGastoActual] = useState(Math.round(salario * 0.7));
  const [mesesReduccion, setMesesReduccion] = useState(12);

  const proyeccionReal = useMemo(() => proyectarMesProximo(transactions, salario), [transactions, salario]);
  const tendencias     = useMemo(() => detectarTendencia(transactions), [transactions]);

  const resultado = useMemo(() => {
    if (escenario === 'proyeccion') return proyeccionReal;
    if (escenario === 'meta') return calcularMeta(ahorroMensual, metaTotal, rendimiento / 100);
    if (escenario === 'credito') return calcularCredito(montoCredito, tasaMensual / 100, plazo);
    return simularReduccion(gastoActual, reduccionPct, mesesReduccion, salario);
  }, [escenario, proyeccionReal, ahorroMensual, metaTotal, rendimiento, montoCredito, tasaMensual, plazo, reduccionPct, gastoActual, mesesReduccion, salario]);

  if (!premium.isPremium) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
              <Icon name="arrow-left" size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.headerTitle, onBack && { flex: 1, textAlign: 'center' }]}>Proyecciones</Text>
          <Icon name="trending-up" size={20} color={THEME.colors.primary} />
        </View>
        <View style={styles.lockContainer}>
          <Icon name="lock" size={48} color={THEME.colors.border} />
          <Text style={styles.lockTitle}>Funcion Premium</Text>
          <Text style={styles.lockSub}>Simula escenarios financieros, calcula cuotas de credito y proyecta tu ahorro con CDTs colombianos.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Proyecciones</Text>
        <Icon name="trending-up" size={20} color={THEME.colors.primary} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.escenarioRow}>
          {([
            ['proyeccion', 'Proyección', 'activity'],
            ['meta', 'Meta ahorro', 'target'],
            ['credito', 'Credito', 'credit-card'],
            ['reduccion', 'Reduccion', 'scissors'],
          ] as [Escenario, string, string][]).map(([e, label, icon]) => (
            <TouchableOpacity
              key={e}
              style={[styles.escenarioTab, escenario === e && styles.escenarioTabActive]}
              onPress={() => setEscenario(e)}
            >
              <Icon name={icon as any} size={14} color={escenario === e ? THEME.colors.primary : THEME.colors.textTertiary} />
              <Text style={[styles.escenarioLabel, escenario === e && styles.escenarioLabelActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {escenario === 'proyeccion' && tendencias.length > 0 && (
          <View style={styles.slidersCard}>
            <Text style={[styles.resultTitulo, { marginBottom: 8 }]}>TENDENCIAS POR CATEGORÍA</Text>
            {tendencias.map(t => (
              <View key={t.categoria} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: THEME.colors.textPrimary, textTransform: 'capitalize' }}>{t.categoria}</Text>
                  <Text style={{ fontSize: 12, color: THEME.colors.textTertiary }}>{fmtCOP(t.promedio)}/mes promedio</Text>
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
                  backgroundColor: t.tendencia === 'sube' ? THEME.colors.expenseLight : t.tendencia === 'baja' ? THEME.colors.incomeLight : THEME.colors.surfaceSecondary }}>
                  <Text style={{ fontSize: 12, fontWeight: '700',
                    color: t.tendencia === 'sube' ? THEME.colors.expense : t.tendencia === 'baja' ? THEME.colors.income : THEME.colors.textTertiary }}>
                    {t.tendencia === 'sube' ? '↑ sube' : t.tendencia === 'baja' ? '↓ baja' : '— estable'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {escenario === 'proyeccion' && transactions.length === 0 && (
          <View style={[styles.slidersCard, { alignItems: 'center', paddingVertical: 24 }]}>
            <Icon name="activity" size={32} color={THEME.colors.border} />
            <Text style={{ fontSize: 14, color: THEME.colors.textTertiary, marginTop: 12, textAlign: 'center' }}>
              Registra transacciones para ver proyecciones reales basadas en tus patrones de gasto.
            </Text>
          </View>
        )}

        {escenario === 'meta' && (
          <View style={styles.slidersCard}>
            <StepRow label="Ahorro mensual" value={ahorroMensual} min={100000} max={5000000} step={100000} formato="cop" onChange={setAhorroMensual} />
            <StepRow label="Meta total" value={metaTotal} min={1000000} max={100000000} step={1000000} formato="cop" onChange={setMetaTotal} />
            <StepRow label="Rendimiento CDT" value={rendimiento} min={5} max={20} step={1} formato="pct" onChange={setRendimiento} />
          </View>
        )}
        {escenario === 'credito' && (
          <View style={styles.slidersCard}>
            <StepRow label="Monto del credito" value={montoCredito} min={500000} max={50000000} step={500000} formato="cop" onChange={setMontoCredito} />
            <StepRow label="Tasa mensual" value={tasaMensual} min={1} max={4} step={1} formato="pct" onChange={setTasaMensual} />
            <StepRow label="Plazo" value={plazo} min={6} max={60} step={6} formato="meses" onChange={setPlazo} />
          </View>
        )}
        {escenario === 'reduccion' && (
          <View style={styles.slidersCard}>
            <StepRow label="Gasto actual/mes" value={gastoActual} min={500000} max={salario > 500000 ? salario : 5000000} step={100000} formato="cop" onChange={setGastoActual} />
            <StepRow label="Reduccion" value={reduccionPct} min={5} max={50} step={5} formato="pct" onChange={setReduccionPct} />
            <StepRow label="Proyectar a" value={mesesReduccion} min={3} max={24} step={3} formato="meses" onChange={setMesesReduccion} />
          </View>
        )}

        <View style={styles.resultCard}>
          <Text style={styles.resultTitulo}>{resultado.titulo}</Text>
          <Text style={styles.resultPrincipal}>{resultado.valorPrincipal}</Text>
          <View style={styles.chartContainer}>
            <MiniChart puntos={resultado.lineasTiempo} color={THEME.colors.primary} />
          </View>
          {resultado.insights.map((ins, i) => (
            <View key={i} style={styles.insightRow}>
              <Icon name="check-circle" size={14} color={THEME.colors.primary} />
              <Text style={styles.insightText}>{ins}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.colors.border, backgroundColor: THEME.colors.surface },
  headerTitle: { fontSize: 18, fontWeight: '800', color: THEME.colors.textPrimary },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  lockContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  lockTitle: { fontSize: 20, fontWeight: '800', color: THEME.colors.textSecondary },
  lockSub: { fontSize: 14, color: THEME.colors.textTertiary, textAlign: 'center', lineHeight: 22 },
  escenarioRow: { flexDirection: 'row', gap: 8 },
  escenarioTab: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: THEME.radius.md, backgroundColor: THEME.colors.surfaceSecondary, borderWidth: 1.5, borderColor: THEME.colors.border },
  escenarioTabActive: { backgroundColor: THEME.colors.primaryLight, borderColor: THEME.colors.primary },
  escenarioLabel: { fontSize: 11, fontWeight: '600', color: THEME.colors.textTertiary },
  escenarioLabelActive: { color: THEME.colors.primary, fontWeight: '700' },
  slidersCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.border, padding: 16, gap: 16 },
  resultCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.border, padding: 16, gap: 10 },
  resultTitulo: { fontSize: 12, fontWeight: '700', color: THEME.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 },
  resultPrincipal: { fontSize: 28, fontWeight: '800', color: THEME.colors.textPrimary },
  chartContainer: { alignItems: 'center', paddingVertical: 8 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  insightText: { fontSize: 13, color: THEME.colors.textSecondary, flex: 1, lineHeight: 20 },
});

const sl = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: THEME.colors.textSecondary },
  valueText: { fontSize: 14, fontWeight: '800', color: THEME.colors.primary },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { width: 32, height: 32, borderRadius: THEME.radius.sm, backgroundColor: THEME.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { backgroundColor: THEME.colors.surfaceSecondary },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: THEME.colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: THEME.colors.primary, borderRadius: 2 },
});
