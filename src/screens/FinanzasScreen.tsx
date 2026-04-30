import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state/FinanceContext';
import { SwipeableRow } from '../components/ui/SwipeableRow';
import { Icon, getCategoryIcon } from '../components/ui/Icon';
import { ResumenPresupuesto } from '../components/finanzas/ResumenPresupuesto';
import { CategoriaCard } from '../components/finanzas/CategoriaCard';
import { ModalCategoria } from '../components/finanzas/ModalCategoria';
import { ConfirmarPagoModal } from '../components/ui/ConfirmarPagoModal';
import { THEME } from '../constants/theme';

type SubTab = 'historial' | 'presupuesto';
type PeriodoFilter = 'mes' | 'anterior' | '3m' | 'todo';
type TipoFilter = 'todos' | 'ingresos' | 'gastos';

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

function filterByPeriod(txs: any[], periodo: PeriodoFilter) {
  const now = new Date();
  return txs.filter(t => {
    const d = new Date(t.date);
    if (periodo === 'mes') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (periodo === 'anterior') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
    }
    if (periodo === '3m') {
      const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return d >= cutoff;
    }
    return true;
  });
}

// ─── Historial ───────────────────────────────────────────────────────────────
function HistorialTab({ onDelete }: { onDelete: (id: string) => void }) {
  const { transactions } = useFinance();
  const [periodo, setPeriodo] = useState<PeriodoFilter>('mes');
  const [tipo, setTipo] = useState<TipoFilter>('todos');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let txs = filterByPeriod(transactions, periodo);
    if (tipo !== 'todos') txs = txs.filter(t => t.type === (tipo === 'ingresos' ? 'income' : 'expense'));
    if (query.trim()) {
      const q = query.toLowerCase();
      txs = txs.filter(t => t.category.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q));
    }
    return [...txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, periodo, tipo, query]);

  const totalIngresos = useMemo(() => filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [filtered]);
  const totalGastos   = useMemo(() => filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filtered]);

  const PERIODOS: { id: PeriodoFilter; label: string }[] = [
    { id: 'mes', label: 'Este mes' }, { id: 'anterior', label: 'Mes ant.' },
    { id: '3m', label: '3 meses' }, { id: 'todo', label: 'Todo' },
  ];
  const TIPOS: { id: TipoFilter; label: string }[] = [
    { id: 'todos', label: 'Todos' }, { id: 'ingresos', label: 'Ingresos' }, { id: 'gastos', label: 'Gastos' },
  ];

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  };

  return (
    <ScrollView style={s.fill} contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Summary */}
      <View style={s.summaryRow}>
        <View style={[s.summaryCard, { borderTopColor: THEME.colors.income }]}>
          <Text style={s.summaryLabel}>INGRESOS</Text>
          <Text style={[s.summaryValue, { color: THEME.colors.income }]}>{fmtCOP(totalIngresos)}</Text>
        </View>
        <View style={[s.summaryCard, { borderTopColor: THEME.colors.expense }]}>
          <Text style={s.summaryLabel}>GASTOS</Text>
          <Text style={[s.summaryValue, { color: THEME.colors.expense }]}>{fmtCOP(totalGastos)}</Text>
        </View>
        <View style={[s.summaryCard, { borderTopColor: THEME.colors.primary }]}>
          <Text style={s.summaryLabel}>BALANCE</Text>
          <Text style={[s.summaryValue, { color: totalIngresos - totalGastos >= 0 ? THEME.colors.primary : THEME.colors.expense }]}>
            {fmtCOP(totalIngresos - totalGastos)}
          </Text>
        </View>
      </View>

      {/* Periodo pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillsScroll} contentContainerStyle={s.pillsRow}>
        {PERIODOS.map(p => (
          <TouchableOpacity key={p.id} style={[s.pill, periodo === p.id && s.pillActive]} onPress={() => setPeriodo(p.id)} activeOpacity={0.7}>
            <Text style={[s.pillText, periodo === p.id && s.pillTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tipo filter */}
      <View style={s.tipoRow}>
        {TIPOS.map(t => (
          <TouchableOpacity key={t.id} style={[s.tipoBtn, tipo === t.id && s.tipoBtnActive]} onPress={() => setTipo(t.id)} activeOpacity={0.7}>
            <Text style={[s.tipoBtnText, tipo === t.id && s.tipoBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Icon name="search" size={15} color={THEME.colors.textTertiary} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar por categoría o descripción..."
          placeholderTextColor={THEME.colors.textTertiary}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}><Icon name="x" size={14} color={THEME.colors.textTertiary} /></TouchableOpacity>
        )}
      </View>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <View style={s.emptyBox}>
          <Icon name="inbox" size={32} color={THEME.colors.border} />
          <Text style={s.emptyText}>Sin transacciones</Text>
        </View>
      ) : (
        <View style={s.card}>
          {filtered.map((tx, i) => {
            const isIncome = tx.type === 'income';
            return (
              <SwipeableRow key={tx.id} onDelete={() => onDelete(tx.id)}>
                <View style={[s.txRow, i < filtered.length - 1 && s.txRowBorder]}>
                  <View style={[s.txIcon, { backgroundColor: isIncome ? THEME.colors.incomeLight : THEME.colors.expenseLight }]}>
                    <Icon name={getCategoryIcon(tx.category)} size={16} color={isIncome ? THEME.colors.income : THEME.colors.expense} />
                  </View>
                  <View style={s.txInfo}>
                    <Text style={s.txCat}>{tx.category}</Text>
                    {tx.description ? <Text style={s.txDesc}>{tx.description}</Text> : null}
                    <Text style={s.txDate}>{fmtDate(tx.date)}</Text>
                  </View>
                  <Text style={[s.txAmount, { color: isIncome ? THEME.colors.income : THEME.colors.expense }]}>
                    {isIncome ? '+' : '-'}{fmtCOP(tx.amount)}
                  </Text>
                </View>
              </SwipeableRow>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// --- Presupuesto Tab ---

function PresupuestoTab() {
  const { transactions, categories, profile, addCategory, updateCategory, deleteCategory, markCategoryPaid, unmarkCategoryPaid } = useFinance();
  const salary = (profile as any)?.monthlySalary ?? 0;
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(undefined);
  const [pagoModal, setPagoModal] = useState<{ visible: boolean; compromiso: any | null }>({ visible: false, compromiso: null });

  const budgetCats = useMemo(() => categories.filter((c: any) => c.tipo || (c.budget ?? 0) > 0), [categories]);
  const totalPresupuesto = useMemo(() => budgetCats.reduce((s: number, c: any) => s + (c.budget ?? 0), 0), [budgetCats]);

  const getMesActual = () => { const n = new Date(); return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0"); };

  const gastadoPorCategoria = useMemo(() => {
    const mes = getMesActual();
    const map: Record<string, number> = {};
    transactions.filter((t: any) => t.type === "expense" && t.date.startsWith(mes)).forEach((t: any) => {
      const cat = budgetCats.find((c: any) => c.name === t.category);
      if (cat) map[cat.id] = (map[cat.id] ?? 0) + t.amount;
    });
    return map;
  }, [transactions, budgetCats]);

  // Sort: alertas first, then pending, then paid
  const sorted = useMemo(() => {
    const today = new Date().getDate();
    return [...budgetCats].sort((a: any, b: any) => {
      const aAlert = !a.pagado && a.diaPago && Math.abs(a.diaPago - today) <= 1;
      const bAlert = !b.pagado && b.diaPago && Math.abs(b.diaPago - today) <= 1;
      if (aAlert && !bAlert) return -1;
      if (!aAlert && bAlert) return 1;
      if (!a.pagado && b.pagado) return -1;
      if (a.pagado && !b.pagado) return 1;
      return 0;
    });
  }, [budgetCats]);

  const handleDelete = (id: string) => {
    Alert.alert("Eliminar", "Deseas eliminar esta categoria?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => deleteCategory(id) },
    ]);
  };

  const openEdit = (cat: any) => { setEditingCat(cat); setModalVisible(true); };
  const openCreate = () => { setEditingCat(undefined); setModalVisible(true); };

  return (
    <ScrollView style={s.fill} contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      <ResumenPresupuesto salario={salary} totalPresupuesto={totalPresupuesto} />

      {sorted.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>💰</Text>
          <Text style={[s.emptyText, { fontWeight: "700", fontSize: 15, color: THEME.colors.textPrimary }]}>Aun no tienes categorias</Text>
          <Text style={[s.emptyText, { marginTop: 4 }]}>Agrega tus gastos fijos para ver tu presupuesto real</Text>
        </View>
      ) : (
        sorted.map((cat: any) => (
          <CategoriaCard
            key={cat.id}
            category={cat}
            gastado={gastadoPorCategoria[cat.id] ?? 0}
            onEdit={() => openEdit(cat)}
            onDelete={() => handleDelete(cat.id)}
            onTogglePaid={() => cat.pagado ? unmarkCategoryPaid(cat.id) : setPagoModal({ visible: true, compromiso: cat })}
          />
        ))
      )}

      <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.8}>
        <Text style={s.addBtnIcon}>＋</Text>
        <Text style={s.addBtnText}>Agregar categoria</Text>
      </TouchableOpacity>

      <ConfirmarPagoModal
        visible={pagoModal.visible}
        compromiso={pagoModal.compromiso}
        onClose={() => setPagoModal({ visible: false, compromiso: null })}
      />

      <ModalCategoria
        visible={modalVisible}
        editing={editingCat}
        existingCount={categories.length}
        onClose={() => setModalVisible(false)}
        onSave={cat => { if (editingCat) { updateCategory(cat.id, cat); } else { addCategory(cat); } }}
      />
    </ScrollView>
  );
}
// --- Main Screen ---
interface FinanzasScreenProps { onBack?: () => void; }
export const FinanzasScreen: React.FC<FinanzasScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { deleteTransaction } = useFinance();
  const [subTab, setSubTab] = useState<SubTab>("historial");
  const handleDelete = (id: string) => {
    Alert.alert("Eliminar", "Deseas eliminar esta transaccion?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => deleteTransaction(id) },
    ]);
  };
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View style={s.headerTopRow}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
              <Icon name="arrow-left" size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          ) : <View style={{ width: 28 }} />}
          <Text style={s.headerTitle}>Finanzas</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={s.subTabBar}>
          {(["historial", "presupuesto"] as SubTab[]).map(tab => (
            <TouchableOpacity key={tab} style={[s.subTab, subTab === tab && s.subTabActive]} onPress={() => setSubTab(tab)} activeOpacity={0.7}>
              <Text style={[s.subTabText, subTab === tab && s.subTabTextActive]}>{tab === "historial" ? "Historial" : "Presupuesto"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {subTab === "historial" ? <HistorialTab onDelete={handleDelete} /> : <PresupuestoTab />}
    </View>
  );
};
// --- Styles ---
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.colors.background },
  fill: { flex: 1 },
  tabContent: { padding: 16, paddingBottom: 32, gap: 12 },
  header: { backgroundColor: THEME.colors.surface, borderBottomWidth: 1, borderBottomColor: THEME.colors.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },
  headerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: THEME.colors.textPrimary, flex: 1, textAlign: "center" },
  subTabBar: { flexDirection: "row", gap: 4 },
  subTab: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  subTabActive: { borderBottomColor: THEME.colors.primary },
  subTabText: { fontSize: 14, fontWeight: "600", color: THEME.colors.textTertiary },
  subTabTextActive: { color: THEME.colors.primary },
  card: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.border, overflow: "hidden" },
  cardTitle: { fontSize: 13, fontWeight: "700", color: THEME.colors.textPrimary, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, borderWidth: 1, borderColor: THEME.colors.border, borderTopWidth: 3, padding: 12, alignItems: "center" },
  summaryLabel: { fontSize: 10, fontWeight: "700", color: THEME.colors.textTertiary, letterSpacing: 0.8, marginBottom: 4 },
  summaryValue: { fontSize: 13, fontWeight: "700" },
  pillsScroll: { flexGrow: 0 },
  pillsRow: { gap: 6, paddingVertical: 2 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: THEME.radius.lg, backgroundColor: THEME.colors.surfaceSecondary, borderWidth: 1, borderColor: THEME.colors.border },
  pillActive: { backgroundColor: THEME.colors.primaryLight, borderColor: THEME.colors.primary },
  pillText: { fontSize: 13, fontWeight: "600", color: THEME.colors.textSecondary },
  pillTextActive: { color: THEME.colors.primary },
  tipoRow: { flexDirection: "row", gap: 6 },
  tipoBtn: { flex: 1, paddingVertical: 8, borderRadius: THEME.radius.sm, backgroundColor: THEME.colors.surfaceSecondary, alignItems: "center" },
  tipoBtnActive: { backgroundColor: THEME.colors.primary },
  tipoBtnText: { fontSize: 13, fontWeight: "600", color: THEME.colors.textSecondary },
  tipoBtnTextActive: { color: THEME.colors.surface },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.border, paddingHorizontal: 12, gap: 8, height: 42 },
  searchInput: { flex: 1, fontSize: 14, color: THEME.colors.textPrimary },
  emptyBox: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: THEME.colors.textTertiary },
  txRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  txRowBorder: { borderBottomWidth: 1, borderBottomColor: THEME.colors.surfaceSecondary },
  txIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  txInfo: { flex: 1 },
  txCat: { fontSize: 14, fontWeight: "600", color: THEME.colors.textPrimary },
  txDesc: { fontSize: 12, color: THEME.colors.textTertiary, marginTop: 1 },
  txDate: { fontSize: 11, color: THEME.colors.textTertiary, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: "700" },
  sectionHeader: { fontSize: 11, fontWeight: "700", color: THEME.colors.textTertiary, letterSpacing: 1.2, marginTop: 4, marginLeft: 2 },
  overviewRow: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 14 },
  overviewItem: { flex: 1, alignItems: "center" },
  overviewDivider: { width: 1, backgroundColor: THEME.colors.surfaceSecondary, marginVertical: 4 },
  overviewLabel: { fontSize: 11, color: THEME.colors.textTertiary, fontWeight: "600", marginBottom: 4 },
  overviewValue: { fontSize: 15, fontWeight: "700", color: THEME.colors.textPrimary },
  totalBarTrack: { height: 4, backgroundColor: THEME.colors.surfaceSecondary, borderRadius: 2, marginHorizontal: 16, marginBottom: 6 },
  totalBarFill: { height: 4, borderRadius: 2 },
  totalBarLabel: { fontSize: 11, color: THEME.colors.textTertiary, textAlign: "center", paddingBottom: 14 },
  budgetRow: { paddingHorizontal: 16, paddingVertical: 12 },
  budgetRowBorder: { borderBottomWidth: 1, borderBottomColor: THEME.colors.surfaceSecondary },
  budgetMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  budgetDot: { width: 10, height: 10, borderRadius: 5 },
  budgetCatName: { fontSize: 14, fontWeight: "600", color: THEME.colors.textPrimary },
  budgetCatSub: { fontSize: 11, color: THEME.colors.textTertiary, marginTop: 1 },
  budgetBarWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  budgetBarTrack: { flex: 1, height: 6, backgroundColor: THEME.colors.surfaceSecondary, borderRadius: 3 },
  budgetBarFill: { height: 6, borderRadius: 3 },
  budgetBarAmt: { fontSize: 12, fontWeight: "700", color: THEME.colors.textSecondary, minWidth: 70, textAlign: "right" },
  addBtn: { borderWidth: 2, borderColor: THEME.colors.primary, borderStyle: "dashed", borderRadius: THEME.radius.lg, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: THEME.colors.background },
  addBtnIcon: { fontSize: 18, color: THEME.colors.primary, fontWeight: "700" },
  addBtnText: { fontSize: 15, color: THEME.colors.primary, fontWeight: "600" },
});