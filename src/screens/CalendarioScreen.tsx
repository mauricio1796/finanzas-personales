import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, getCategoryIcon } from '../components/ui/Icon';
import { useFinance } from '../state/FinanceContext';
import { THEME } from '../constants/theme';

const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

function getDiasDelMes(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
function getPrimerDia(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export const CalendarioScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { transactions, categories } = useFinance();
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);

  const mesStr = anio + '-' + String(mes + 1).padStart(2, '0');
  const txDelMes = useMemo(() => transactions.filter(t => t.date.startsWith(mesStr)), [transactions, mesStr]);

  const totalIngresos = txDelMes.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalGastos = txDelMes.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const diasConTx = useMemo(() => {
    const map: Record<number, { ingresos: number; gastos: number; txs: typeof transactions }> = {};
    txDelMes.forEach(t => {
      const dia = new Date(t.date).getDate();
      if (!map[dia]) map[dia] = { ingresos: 0, gastos: 0, txs: [] };
      if (t.type === 'income') map[dia].ingresos += t.amount;
      else map[dia].gastos += t.amount;
      map[dia].txs.push(t);
    });
    return map;
  }, [txDelMes]);

  const numDias = getDiasDelMes(anio, mes);
  const primerDia = getPrimerDia(anio, mes);
  const celdas = Array.from({ length: primerDia + numDias }, (_, i) => i < primerDia ? null : i - primerDia + 1);

  const irAnterior = () => { if (mes === 0) { setMes(11); setAnio(a => a - 1); } else setMes(m => m - 1); };
  const irSiguiente = () => { if (mes === 11) { setMes(0); setAnio(a => a + 1); } else setMes(m => m + 1); };

  const txDiaSeleccionado = diaSeleccionado ? (diasConTx[diaSeleccionado]?.txs ?? []) : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
            <Icon name="arrow-left" size={20} color="#111827" />
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.headerTitle, onBack && { flex: 1, textAlign: 'center' }]}>Calendario</Text>
        <Icon name="calendar" size={20} color={THEME.colors.primary} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Nav mes */}
        <View style={styles.mesNav}>
          <TouchableOpacity onPress={irAnterior} style={styles.navBtn}><Icon name="chevron-left" size={20} color="#374151" /></TouchableOpacity>
          <Text style={styles.mesLabel}>{MESES[mes]} {anio}</Text>
          <TouchableOpacity onPress={irSiguiente} style={styles.navBtn}><Icon name="chevron-right" size={20} color="#374151" /></TouchableOpacity>
        </View>

        {/* Resumen */}
        <View style={styles.resumenCard}>
          <View style={styles.resumenItem}><Icon name="trending-up" size={14} color={THEME.colors.income} /><Text style={styles.resumenLabel}>Ingresos</Text><Text style={[styles.resumenVal, { color: THEME.colors.income }]}>{fmtCOP(totalIngresos)}</Text></View>
          <View style={styles.resumenDivider} />
          <View style={styles.resumenItem}><Icon name="trending-down" size={14} color={THEME.colors.expense} /><Text style={styles.resumenLabel}>Gastos</Text><Text style={[styles.resumenVal, { color: THEME.colors.expense }]}>{fmtCOP(totalGastos)}</Text></View>
          <View style={styles.resumenDivider} />
          <View style={styles.resumenItem}><Icon name="dollar-sign" size={14} color={THEME.colors.primary} /><Text style={styles.resumenLabel}>Balance</Text><Text style={[styles.resumenVal, { color: totalIngresos - totalGastos >= 0 ? THEME.colors.income : THEME.colors.expense }]}>{fmtCOP(totalIngresos - totalGastos)}</Text></View>
        </View>

        {/* Dias semana */}
        <View style={styles.weekRow}>
          {DIAS_SEMANA.map(d => <Text key={d} style={styles.weekLabel}>{d}</Text>)}
        </View>

        {/* Grid dias */}
        <View style={styles.grid}>
          {celdas.map((dia, idx) => {
            if (!dia) return <View key={'e' + idx} style={styles.celdaVacia} />;
            const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear();
            const info = diasConTx[dia];
            const tieneGasto = info && info.gastos > 0;
            const tieneIngreso = info && info.ingresos > 0;
            return (
              <TouchableOpacity key={dia} style={[styles.celda, esHoy && styles.celdaHoy, diaSeleccionado === dia && styles.celdaSeleccionada]} onPress={() => setDiaSeleccionado(dia === diaSeleccionado ? null : dia)} activeOpacity={0.7}>
                <Text style={[styles.celdaNum, esHoy && styles.celdaNumHoy]}>{dia}</Text>
                <View style={styles.celdaDots}>
                  {tieneIngreso && <View style={[styles.dot, { backgroundColor: THEME.colors.income }]} />}
                  {tieneGasto && <View style={[styles.dot, { backgroundColor: THEME.colors.expense }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Detalle del dia */}
        {diaSeleccionado && (
          <View style={styles.diaDetalleCard}>
            <Text style={styles.diaDetalleTitle}>{diaSeleccionado} de {MESES[mes]}</Text>
            {txDiaSeleccionado.length === 0 ? (
              <Text style={styles.sinTx}>Sin movimientos</Text>
            ) : (
              txDiaSeleccionado.map((tx, i) => (
                <View key={tx.id} style={[styles.txRow, i < txDiaSeleccionado.length - 1 && { borderBottomWidth: 1, borderBottomColor: THEME.colors.surfaceSecondary }]}>
                  <View style={[styles.txIcon, { backgroundColor: tx.type === 'income' ? THEME.colors.incomeLight : THEME.colors.expenseLight }]}>
                    <Icon name={getCategoryIcon(tx.category)} size={14} color={tx.type === 'income' ? THEME.colors.income : THEME.colors.expense} />
                  </View>
                  <Text style={styles.txCat}>{tx.category}</Text>
                  <Text style={[styles.txAmt, { color: tx.type === 'income' ? THEME.colors.income : THEME.colors.expense }]}>{tx.type === 'income' ? '+' : '-'}{fmtCOP(tx.amount)}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.colors.surfaceSecondary, backgroundColor: THEME.colors.surface },
  headerTitle: { fontSize: 18, fontWeight: '800', color: THEME.colors.textPrimary },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  mesNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 36, height: 36, borderRadius: THEME.radius.sm, backgroundColor: THEME.colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  mesLabel: { fontSize: 17, fontWeight: '800', color: THEME.colors.textPrimary },
  resumenCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.border, padding: 16, flexDirection: 'row', alignItems: 'center' },
  resumenItem: { flex: 1, alignItems: 'center', gap: 4 },
  resumenDivider: { width: 1, height: 40, backgroundColor: THEME.colors.surfaceSecondary },
  resumenLabel: { fontSize: 11, color: THEME.colors.textTertiary, fontWeight: '600' },
  resumenVal: { fontSize: 13, fontWeight: '800' },
  weekRow: { flexDirection: 'row' },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: THEME.colors.textTertiary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  celdaVacia: { width: '14.28%', aspectRatio: 1 },
  celda: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: THEME.radius.sm },
  celdaHoy: { backgroundColor: THEME.colors.primaryLight },
  celdaSeleccionada: { backgroundColor: THEME.colors.primary },
  celdaNum: { fontSize: 13, fontWeight: '500', color: THEME.colors.textSecondary },
  celdaNumHoy: { fontWeight: '800', color: THEME.colors.primary },
  celdaDots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  diaDetalleCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.border, padding: 16, gap: 8 },
  diaDetalleTitle: { fontSize: 15, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 4 },
  sinTx: { fontSize: 13, color: THEME.colors.textTertiary, textAlign: 'center', paddingVertical: 8 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  txIcon: { width: 32, height: 32, borderRadius: THEME.radius.pill, alignItems: 'center', justifyContent: 'center' },
  txCat: { flex: 1, fontSize: 13, color: THEME.colors.textSecondary, fontWeight: '600' },
  txAmt: { fontSize: 13, fontWeight: '700' },
});
