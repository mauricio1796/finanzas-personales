import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { SwipeableRow } from '../components/ui/SwipeableRow';
import { Icon } from '../components/ui/Icon';

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtHora = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
type Filtro = 'todos' | 'ingresos' | 'gastos';

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos',    label: 'Todos'    },
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'gastos',   label: 'Gastos'   },
];

interface HistorialScreenProps {
  onBack?: () => void;
}

export const HistorialScreen: React.FC<HistorialScreenProps> = ({ onBack }) => {
  const { transactions, categories, deleteTransaction } = useFinance();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const filtered = useMemo(() => {
    let txs = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (filtro === 'ingresos') txs = txs.filter(t => t.type === 'income');
    if (filtro === 'gastos')   txs = txs.filter(t => t.type === 'expense');
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      txs = txs.filter(t =>
        t.category.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        fmtCOP(t.amount).includes(q)
      );
    }
    return txs;
  }, [transactions, filtro, busqueda]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach(tx => {
      const d = tx.date.slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(tx);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const totalIncome  = useMemo(() => filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filtered]);
  const balance = totalIncome - totalExpense;

  const getCatLabel = (id: string) => {
    const c = (categories as any[]).find((x: any) => x.id === id);
    return c ? (c.icon ? c.icon + ' ' : '') + c.name : id.charAt(0).toUpperCase() + id.slice(1);
  };

  const STATS = [
    { label: 'Total',    value: String(transactions.length), color: colors.textPrimary,                         icon: 'list'              as const },
    { label: 'Ingresos', value: '+' + fmtCOP(totalIncome),  color: colors.income,                              icon: 'arrow-up-circle'   as const },
    { label: 'Gastos',   value: '-' + fmtCOP(totalExpense), color: colors.expense,                             icon: 'arrow-down-circle' as const },
    { label: 'Balance',  value: (balance >= 0 ? '+' : '') + fmtCOP(balance), color: balance >= 0 ? colors.income : colors.expense, icon: 'activity' as const },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <View style={s.headerTopRow}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
              <Icon name="arrow-left" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 28 }} />
          )}
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Historial</Text>
          <View style={{ width: 28 }} />
        </View>
        <Text style={[s.headerLabel, { color: colors.textTertiary }]}>ACTIVIDAD</Text>
      </View>

      {/* Stats strip */}
      <View style={[s.statsStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {STATS.map((stat, i) => (
          <React.Fragment key={stat.label}>
            {i > 0 && <View style={[s.statDiv, { backgroundColor: colors.border }]} />}
            <View style={s.statItem}>
              <Text style={[s.statVal, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[s.statLbl, { color: colors.textTertiary }]}>{stat.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Search row */}
      <View style={[
        s.searchRow,
        { backgroundColor: colors.card, borderColor: searchFocused ? colors.primary : colors.border },
        searchFocused && s.searchRowFocused,
      ]}>
        <Icon name="search" size={15} color={colors.textTertiary} />
        <TextInput
          style={[s.searchInput, { color: colors.textPrimary }]}
          placeholder="Buscar por categoria, descripcion..."
          placeholderTextColor={colors.textTertiary}
          value={busqueda}
          onChangeText={setBusqueda}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {busqueda.length > 0 && (
          <TouchableOpacity
            onPress={() => setBusqueda('')}
            style={[s.clearBtn, { backgroundColor: colors.inputBg }]}
          >
            <Icon name="x" size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter pills */}
      <View style={s.filterRow}>
        {FILTROS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              s.pill,
              { borderColor: filtro === f.key ? colors.primary : colors.border, backgroundColor: filtro === f.key ? colors.primaryLight : colors.card },
            ]}
            onPress={() => setFiltro(f.key)}
          >
            <Text style={[s.pillText, { color: filtro === f.key ? colors.primary : colors.textSecondary }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={[s.countLabel, { color: colors.textTertiary }]}>{filtered.length} resultados</Text>
      </View>

      {/* Transaction list */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {grouped.length === 0 ? (
          <View style={s.empty}>
            <View style={[s.emptyIconWrap, { backgroundColor: colors.cardSecondary }]}>
              <Icon name="inbox" size={32} color={colors.textTertiary} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>Sin movimientos</Text>
            <Text style={[s.emptySub, { color: colors.textTertiary }]}>
              {busqueda ? 'Sin resultados para esa busqueda' : 'Registra ingresos o gastos para verlos aqui'}
            </Text>
          </View>
        ) : (
          grouped.map(([day, txs]) => {
            const dn = txs.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
            return (
              <View key={day} style={s.dayGroup}>
                <View style={s.dayHeader}>
                  <View style={[s.dayDot, { backgroundColor: colors.primary }]} />
                  <Text style={[s.dayLabel, { color: colors.textSecondary }]}>{fmtFecha(day + 'T12:00:00')}</Text>
                  <View style={[s.dayLine, { backgroundColor: colors.border }]} />
                  <Text style={[s.dayNet, { color: dn >= 0 ? colors.income : colors.expense }]}>
                    {dn >= 0 ? '+' : ''}{fmtCOP(dn)}
                  </Text>
                </View>
                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {txs.map((tx, i) => {
                    const inc = tx.type === 'income';
                    return (
                      <SwipeableRow key={tx.id} onDelete={() => deleteTransaction(tx.id)}>
                        <View style={[s.txRow, i < txs.length - 1 && s.txBorder, i < txs.length - 1 && { borderBottomColor: colors.borderSubtle }]}>
                          <View style={[s.txDot, { backgroundColor: inc ? colors.incomeLight : colors.expenseLight }]}>
                            <Text style={[s.txSign, { color: inc ? colors.income : colors.expense }]}>{inc ? '+' : '-'}</Text>
                          </View>
                          <View style={s.txInfo}>
                            <Text style={[s.txCat, { color: colors.textPrimary }]}>{getCatLabel(tx.category)}</Text>
                            {tx.description ? <Text style={[s.txDesc, { color: colors.textSecondary }]} numberOfLines={1}>{tx.description}</Text> : null}
                            <Text style={[s.txTime, { color: colors.textTertiary }]}>{fmtHora(tx.date)}</Text>
                          </View>
                          <View style={s.txRight}>
                            <Text style={[s.txAmt, { color: inc ? colors.income : colors.expense }]}>
                              {inc ? '+' : '-'}{fmtCOP(tx.amount)}
                            </Text>
                            <View style={[s.badge, { backgroundColor: inc ? colors.incomeLight : colors.expenseLight }]}>
                              <Text style={[s.badgeText, { color: inc ? colors.income : colors.expense }]}>
                                {inc ? 'Ingreso' : 'Gasto'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </SwipeableRow>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root:             { flex: 1 },
  header:           { paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 0.5 },
  headerTopRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerLabel:      { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' as any },
  headerTitle:      { fontSize: 26, fontWeight: '900', marginTop: 2 },
  statsStrip:       { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 14, borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 8 },
  statItem:         { flex: 1, alignItems: 'center' },
  statVal:          { fontSize: 13, fontWeight: '800' },
  statLbl:          { fontSize: 10, fontWeight: '600', marginTop: 2 },
  statDiv:          { width: 1, height: 28 },
  searchRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  searchRowFocused: { borderWidth: 2 },
  searchInput:      { flex: 1, fontSize: 14, padding: 0 },
  clearBtn:         { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  filterRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 10 },
  pill:             { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillText:         { fontSize: 13, fontWeight: '600' },
  countLabel:       { fontSize: 11, fontWeight: '600' },
  scroll:           { flex: 1 },
  scrollContent:    { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  dayGroup:         { marginBottom: 16 },
  dayHeader:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dayDot:           { width: 8, height: 8, borderRadius: 4 },
  dayLabel:         { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' as any },
  dayLine:          { flex: 1, height: 1 },
  dayNet:           { fontSize: 12, fontWeight: '800' },
  card:             { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  txRow:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  txBorder:         { borderBottomWidth: 1 },
  txDot:            { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txSign:           { fontSize: 22, fontWeight: '900' },
  txInfo:           { flex: 1, gap: 2 },
  txCat:            { fontSize: 14, fontWeight: '700' },
  txDesc:           { fontSize: 12 },
  txTime:           { fontSize: 11 },
  txRight:          { alignItems: 'flex-end', gap: 4 },
  txAmt:            { fontSize: 15, fontWeight: '800' },
  badge:            { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText:        { fontSize: 10, fontWeight: '700' },
  empty:            { alignItems: 'center', paddingTop: 64, gap: 8 },
  emptyIconWrap:    { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle:       { fontSize: 17, fontWeight: '800' },
  emptySub:         { fontSize: 14, textAlign: 'center' as any, lineHeight: 20, paddingHorizontal: 32 },
});
