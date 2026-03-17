import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { Icon } from '../components/ui/Icon';
import { useFinance } from '../state/FinanceContext';
import { calcularMeta, calcularCredito, simularReduccion } from '../services/ProyeccionService';

type Escenario = 'meta' | 'credito' | 'reduccion';
const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

const CHART_W = 300;
const CHART_H = 120;

function MiniChart({ puntos, color = '#6366F1' }: { puntos: { mes: number; valor: number }[]; color?: string }) {
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
          <Icon name="minus" size={14} color={value <= min ? '#D1D5DB' : '#6366F1'} />
        </TouchableOpacity>
        <View style={sl.track}>
          <View style={[sl.fill, { width: pct + '%' as any }]} />
        </View>
        <TouchableOpacity onPress={inc} style={[sl.btn, value >= max && sl.btnDisabled]} activeOpacity={0.7}>
          <Icon name="plus" size={14} color={value >= max ? '#D1D5DB' : '#6366F1'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const ProyeccionesScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { profile, premium } = useFinance();
  const [escenario, setEscenario] = useState<Escenario>('meta');
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

  const resultado = useMemo(() => {
    if (escenario === 'meta') return calcularMeta(ahorroMensual, metaTotal, rendimiento / 100);
    if (escenario === 'credito') return calcularCredito(montoCredito, tasaMensual / 100, plazo);
    return simularReduccion(gastoActual, reduccionPct, mesesReduccion, salario);
  }, [escenario, ahorroMensual, metaTotal, rendimiento, montoCredito, tasaMensual, plazo, reduccionPct, gastoActual, mesesReduccion, salario]);

  if (!premium.isPremium) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
              <Icon name="arrow-left" size={20} color="#111827" />
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.headerTitle, onBack && { flex: 1, textAlign: 'center' }]}>Proyecciones</Text>
          <Icon name="trending-up" size={20} color="#6366F1" />
        </View>
        <View style={styles.lockContainer}>
          <Icon name="lock" size={48} color="#D1D5DB" />
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
        <Icon name="trending-up" size={20} color="#6366F1" />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.escenarioRow}>
          {([
            ['meta', 'Meta ahorro', 'target'],
            ['credito', 'Credito', 'credit-card'],
            ['reduccion', 'Reduccion', 'scissors'],
          ] as [Escenario, string, string][]).map(([e, label, icon]) => (
            <TouchableOpacity
              key={e}
              style={[styles.escenarioTab, escenario === e && styles.escenarioTabActive]}
              onPress={() => setEscenario(e)}
            >
              <Icon name={icon as any} size={14} color={escenario === e ? '#6366F1' : '#9CA3AF'} />
              <Text style={[styles.escenarioLabel, escenario === e && styles.escenarioLabelActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
            <MiniChart puntos={resultado.lineasTiempo} color="#6366F1" />
          </View>
          {resultado.insights.map((ins, i) => (
            <View key={i} style={styles.insightRow}>
              <Icon name="check-circle" size={14} color="#6366F1" />
              <Text style={styles.insightText}>{ins}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFFFFF' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  lockContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  lockTitle: { fontSize: 20, fontWeight: '800', color: '#374151' },
  lockSub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  escenarioRow: { flexDirection: 'row', gap: 8 },
  escenarioTab: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' },
  escenarioTabActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  escenarioLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  escenarioLabelActive: { color: '#6366F1', fontWeight: '700' },
  slidersCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, gap: 16 },
  resultCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, gap: 10 },
  resultTitulo: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 },
  resultPrincipal: { fontSize: 28, fontWeight: '800', color: '#111827' },
  chartContainer: { alignItems: 'center', paddingVertical: 8 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  insightText: { fontSize: 13, color: '#374151', flex: 1, lineHeight: 20 },
});

const sl = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  valueText: { fontSize: 14, fontWeight: '800', color: '#6366F1' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { backgroundColor: '#F9FAFB' },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 2 },
});
