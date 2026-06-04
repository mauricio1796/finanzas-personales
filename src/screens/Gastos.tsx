import React, { useState, useMemo } from 'react';
import {
  StyleSheet, TextInput, Pressable, View, Text,
  ScrollView, Platform, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Transaction } from '@/src/core/financeEngine';
import { useFinance } from '@/src/core/context/FinanceContext';
import { SwipeableRow } from '@/src/components/ui/SwipeableRow';
import { Icon } from '@/src/components/ui/Icon';
import { useTheme } from '@/src/state/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBgIconoCategoria, getIconoCategoria } from '@/src/utils/categoryUtils';

const parseCOP  = (s: string) => parseInt(s.replace(/\./g, '').replace(/[^0-9]/g, ''), 10);
const fmtCOP    = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
const fmtInput  = (raw: string) => {
  const d = raw.replace(/\./g, '').replace(/[^0-9]/g, '');
  const n = parseInt(d, 10);
  return isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.');
};

// ── Expense tips ──────────────────────────────────────────────────────────────
const TIPS = [
  { icon: '🛑', text: 'Antes de pagar pregúntate: ¿lo necesito o solo lo quiero?' },
  { icon: '📊', text: 'Registrar cada gasto te da control total de tu dinero.' },
  { icon: '⏰', text: 'Espera 24 h antes de compras impulsivas mayores a $100k.' },
  { icon: '🧾', text: 'Compara precios antes de pagar servicios recurrentes.' },
  { icon: '📱', text: 'Revisa tus suscripciones mensuales — elimina las que no usas.' },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface GastosProps {
  transactions: Transaction[];
  onAddExpense: (amount: number, category: string, date: Date, description?: string) => void;
  onDeleteTransaction: (id: string) => void;
  onBack?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
export function Gastos({ transactions, onAddExpense, onDeleteTransaction, onBack }: GastosProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { categories } = useFinance();

  // Only top-level expense categories
  const topCats = useMemo(
    () => categories.filter(c => !c.parentCategoryId && c.tipo !== 'ingreso'),
    [categories],
  );

  // ── Form state ────────────────────────────────────────────────────────────
  const [amount,      setAmount]      = useState('');
  const [description, setDescription] = useState('');
  const [selCatId,    setSelCatId]    = useState<string | null>(topCats[0]?.id ?? null);
  const [selSubId,    setSelSubId]    = useState<string | null>(null);
  const [error,         setError]         = useState('');
  const [amtFocused,    setAmtFocused]    = useState(false);
  const [descFocused,   setDescFocused]   = useState(false);
  const [tipIdx]                          = useState(() => Math.floor(Math.random() * TIPS.length));
  const [subModalOpen, setSubModalOpen]   = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const expList = useMemo(
    () => transactions.filter(t => t.type === 'expense').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions],
  );
  const totalThisMonth = useMemo(() => {
    const now = new Date();
    return expList
      .filter(t => { const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .reduce((s, t) => s + t.amount, 0);
  }, [expList]);

  const subcats = useMemo(
    () => selCatId ? categories.filter(c => c.parentCategoryId === selCatId) : [],
    [categories, selCatId],
  );

  const selCat = topCats.find(c => c.id === selCatId);
  const selSub = subcats.find(c => c.id === selSubId);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAdd = () => {
    setError('');
    const n = parseCOP(amount);
    if (isNaN(n) || n <= 0) { setError('Ingresa un monto válido'); return; }
    if (!selCat) { setError('Selecciona una categoría'); return; }
    if (subcats.length > 0 && !selSubId) { setError('Selecciona una subcategoría'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const addFn = onAddExpense as any;
    addFn(n, selCat.name, new Date(), description || undefined, selSubId ?? undefined);
    setAmount('');
    setDescription('');
    setSelSubId(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={[s.root, { backgroundColor: isDark ? colors.background : '#FFF5F5' }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Hero header ────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#DC2626', '#EF4444', '#F87171']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: insets.top + 20 }]}
      >
        {onBack && (
          <Pressable onPress={onBack} style={s.backBtn} hitSlop={12}>
            <Icon name="arrow-left" size={20} color="#fff" />
          </Pressable>
        )}
        <Text style={s.heroLabel}>GASTOS</Text>
        <Text style={s.heroAmount}>{fmtCOP(totalThisMonth)}</Text>
        <Text style={s.heroSub}>gastado este mes</Text>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statVal}>{expList.length}</Text>
            <Text style={s.statLabel}>transacciones</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statVal}>{expList.length > 0 ? fmtCOP(Math.round(totalThisMonth / (new Date().getDate()))) : '$0'}</Text>
            <Text style={s.statLabel}>gasto/día</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statVal}>{expList.length > 0 ? fmtCOP(Math.round(totalThisMonth / expList.length)) : '$0'}</Text>
            <Text style={s.statLabel}>promedio</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={s.body}>

        {/* ── Tip card ────────────────────────────────────────────────── */}
        <View style={[s.tipCard, { backgroundColor: isDark ? '#3B0A0A' : '#FFF5F5', borderColor: '#FCA5A5' }]}>
          <Text style={s.tipIcon}>{TIPS[tipIdx].icon}</Text>
          <Text style={[s.tipText, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>{TIPS[tipIdx].text}</Text>
        </View>

        {/* ── Form card ────────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.cardHeader}>
            <View style={[s.cardIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Icon name="minus-circle" size={16} color="#EF4444" />
            </View>
            <View>
              <Text style={[s.cardTitle, { color: colors.textPrimary }]}>Nuevo gasto</Text>
              <Text style={[s.cardSub, { color: colors.textTertiary }]}>¿En qué gastaste hoy?</Text>
            </View>
          </View>

          {error ? (
            <View style={s.errorBox}>
              <Icon name="alert-circle" size={14} color="#EF4444" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Amount */}
          <Text style={[s.fieldLabel, { color: colors.textTertiary }]}>MONTO</Text>
          <View style={[s.amountInputWrap, {
            borderColor: amtFocused ? '#EF4444' : colors.border,
            borderWidth: amtFocused ? 2 : 1,
            backgroundColor: isDark ? '#2D0808' : '#FFF5F5',
          }]}>
            <Text style={[s.currSign, { color: amtFocused ? '#EF4444' : colors.textTertiary }]}>$</Text>
            <TextInput
              style={[s.amountInput, { color: colors.textPrimary }]}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              value={amount}
              onChangeText={t => setAmount(fmtInput(t))}
              onFocus={() => setAmtFocused(true)}
              onBlur={() => setAmtFocused(false)}
              selectTextOnFocus
            />
          </View>

          {/* Category grid */}
          <Text style={[s.fieldLabel, { color: colors.textTertiary, marginTop: 18 }]}>CATEGORÍA</Text>
          <View style={s.catGrid}>
            {topCats.map(c => {
              const active = selCatId === c.id;
              const { bg, color } = getBgIconoCategoria(c.name, isDark);
              const iconName = (c.icon as string) || getIconoCategoria(c.name);
              return (
                <Pressable
                  key={c.id}
                  style={[s.catCell, {
                    backgroundColor: active ? '#EF4444' : (isDark ? colors.cardSecondary : bg),
                    borderColor: active ? '#EF4444' : colors.border,
                  }]}
                  onPress={() => {
                    setSelCatId(c.id);
                    setSelSubId(null);
                    Haptics.selectionAsync().catch(() => {});
                    const hasSubs = categories.some(cat => cat.parentCategoryId === c.id);
                    if (hasSubs) setTimeout(() => setSubModalOpen(true), 150);
                  }}
                >
                  <Icon name={iconName as any} size={18} color={active ? '#fff' : color} />
                  <Text style={[s.catCellLabel, { color: active ? '#fff' : color }]} numberOfLines={1}>{c.name}</Text>
                  {active && <View style={s.catCellCheck}><Text style={{ fontSize: 8, color: '#fff' }}>✓</Text></View>}
                </Pressable>
              );
            })}
          </View>

          {/* Subcategory selector */}
          {subcats.length > 0 && (
            <>
              <Text style={[s.fieldLabel, { color: colors.textTertiary, marginTop: 18 }]}>SUBCATEGORÍA</Text>
              <Pressable
                style={[s.subPicker, {
                  borderColor: selSub ? '#EF4444' : colors.border,
                  borderWidth: selSub ? 2 : 1,
                  backgroundColor: isDark ? colors.cardSecondary : '#FFF5F5',
                }]}
                onPress={() => { setSubModalOpen(true); Haptics.selectionAsync().catch(() => {}); }}
              >
                {selSub ? (
                  <Text style={[s.subPickerVal, { color: colors.textPrimary }]}>
                    {selSub.icon ? `${selSub.icon}  ` : ''}{selSub.name}
                  </Text>
                ) : (
                  <Text style={[s.subPickerPlaceholder, { color: colors.textTertiary }]}>Seleccionar subcategoría…</Text>
                )}
                <Icon name="chevron-down" size={16} color={selSub ? '#EF4444' : colors.textTertiary} />
              </Pressable>
            </>
          )}

          {/* Subcategory modal */}
          <Modal
            visible={subModalOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setSubModalOpen(false)}
          >
            <Pressable style={s.modalOverlay} onPress={() => setSubModalOpen(false)}>
              <Pressable style={[s.modalSheet, { backgroundColor: colors.card }]} onPress={e => e.stopPropagation()}>
                <View style={s.modalHandle} />
                <Text style={[s.modalTitle, { color: colors.textPrimary }]}>
                  Subcategoría de {selCat?.name}
                </Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {subcats.map(sub => {
                    const active = selSubId === sub.id;
                    return (
                      <Pressable
                        key={sub.id}
                        style={[s.modalItem, {
                          backgroundColor: active ? '#FEE2E2' : 'transparent',
                          borderColor: active ? '#EF4444' : colors.border,
                        }]}
                        onPress={() => {
                          setSelSubId(sub.id);
                          setSubModalOpen(false);
                          Haptics.selectionAsync().catch(() => {});
                        }}
                      >
                        <View style={[s.modalItemIconPlaceholder, { backgroundColor: active ? '#FEE2E2' : (isDark ? colors.cardSecondary : '#F9FAFB') }]}>
                          <Icon name={(sub.icon as any) || 'tag'} size={15} color={active ? '#EF4444' : colors.textSecondary} />
                        </View>
                        <Text style={[s.modalItemLabel, { color: active ? '#EF4444' : colors.textPrimary }]}>{sub.name}</Text>
                        {active && <Icon name="check" size={16} color="#EF4444" />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Description */}
          <Text style={[s.fieldLabel, { color: colors.textTertiary, marginTop: 18 }]}>NOTA (opcional)</Text>
          <TextInput
            style={[s.descInput, {
              borderColor: descFocused ? '#EF4444' : colors.border,
              borderWidth: descFocused ? 2 : 1,
              backgroundColor: isDark ? colors.cardSecondary : '#F9FAFB',
              color: colors.textPrimary,
            }]}
            placeholder="Ej: Supermercado, Netflix, gasolina…"
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            onFocus={() => setDescFocused(true)}
            onBlur={() => setDescFocused(false)}
            maxLength={80}
          />

          {/* Budget feedback */}
          {selCat && selCat.budget && selCat.budget > 0 && (
            <View style={[s.budgetBar, { backgroundColor: isDark ? '#2D0808' : '#FFF5F5' }]}>
              <View style={s.budgetBarRow}>
                <Text style={[s.budgetBarLabel, { color: colors.textTertiary }]}>Presupuesto {selCat.name}</Text>
                <Text style={[s.budgetBarLabel, { color: '#EF4444', fontWeight: '700' }]}>{fmtCOP(selCat.budget)}</Text>
              </View>
              <View style={[s.budgetTrack, { backgroundColor: colors.border }]}>
                <View style={[s.budgetFill, {
                  flex: Math.min(totalThisMonth / selCat.budget, 1),
                  backgroundColor: totalThisMonth >= selCat.budget ? '#EF4444' : '#F87171',
                }]} />
              </View>
            </View>
          )}

          {/* CTA */}
          <Pressable style={s.addBtn} onPress={handleAdd}>
            <Icon name="arrow-down-circle" size={20} color="#fff" />
            <Text style={s.addBtnText}>Registrar gasto</Text>
          </Pressable>
        </View>

        {/* ── History ─────────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.cardHeader, { marginBottom: 4 }]}>
            <View style={[s.cardIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Icon name="clock" size={16} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: colors.textPrimary }]}>Historial</Text>
            </View>
            <Text style={[s.txCount, { color: colors.textTertiary }]}>{expList.length} registros</Text>
          </View>

          {expList.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>🎉</Text>
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>Sin gastos este mes</Text>
              <Text style={[s.emptyDesc, { color: colors.textTertiary }]}>¡Excelente control financiero!</Text>
            </View>
          ) : (
            expList.map((item, idx) => {
              const cat = categories.find(c => c.id === item.category || c.name === item.category);
              const sub = item.subcategory ? categories.find(c => c.id === item.subcategory) : null;
              const catName = cat?.name ?? item.category;
              const { bg: iconBg, color: iconColor } = getBgIconoCategoria(catName, isDark);
              const iconName = (cat?.icon as string) || getIconoCategoria(catName);
              return (
                <SwipeableRow key={item.id} onDelete={() => onDeleteTransaction(item.id)}>
                  <View style={[s.txItem, idx < expList.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={[s.txIcon, { backgroundColor: isDark ? '#2D0808' : iconBg }]}>
                      <Icon name={iconName as any} size={16} color={iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.txCat, { color: colors.textPrimary }]}>
                        {catName}{sub ? <Text style={{ color: colors.textSecondary, fontWeight: '500' }}> · {sub.name}</Text> : null}
                      </Text>
                      {item.description ? <Text style={[s.txDesc, { color: colors.textSecondary }]} numberOfLines={1}>{item.description}</Text> : null}
                      <Text style={[s.txDate, { color: colors.textTertiary }]}>
                        {new Date(item.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <Text style={[s.txAmount, { color: '#EF4444' }]}>-{fmtCOP(item.amount)}</Text>
                  </View>
                </SwipeableRow>
              );
            })
          )}
        </View>

      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  hero: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  backBtn: { marginBottom: 12 },
  heroLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2,
    color: 'rgba(255,255,255,0.75)', marginBottom: 8,
  },
  heroAmount: { fontSize: 42, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 20 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16, padding: 16, gap: 8,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 13, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },

  body: { padding: 16, gap: 14 },

  tipCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  tipIcon: { fontSize: 22 },
  tipText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },

  card: {
    borderRadius: 18, borderWidth: 1, padding: 20,
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 } : {}),
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cardIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 1 },

  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },

  amountInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
  },
  currSign: { fontSize: 18, fontWeight: '700', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800', padding: 0 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCell: {
    flexBasis: '22%', flexGrow: 1,
    paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', gap: 6, position: 'relative',
  },
  catCellLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  catCellCheck: {
    position: 'absolute', top: 4, right: 4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },

  subPicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  },
  subPickerVal: { fontSize: 15, fontWeight: '600', flex: 1 },
  subPickerPlaceholder: { fontSize: 15, flex: 1 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '70%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', marginBottom: 16 },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 12,
    borderRadius: 14, borderWidth: 1, marginBottom: 8,
  },
  modalItemIconPlaceholder: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  modalItemLabel: { flex: 1, fontSize: 15, fontWeight: '600' },

  descInput: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontWeight: '500',
  },

  budgetBar: {
    marginTop: 14, borderRadius: 10, padding: 12, gap: 8,
  },
  budgetBarRow: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetBarLabel: { fontSize: 12 },
  budgetTrack: { height: 6, borderRadius: 3, flexDirection: 'row', overflow: 'hidden' },
  budgetFill: { height: 6, borderRadius: 3 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 18,
    backgroundColor: '#EF4444',
    ...(Platform.OS !== 'web' ? { shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 } : {}),
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10,
    padding: 12, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: '#EF4444',
  },
  errorText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },

  txCount: { fontSize: 12, fontWeight: '600' },
  txItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txCat: { fontSize: 14, fontWeight: '700' },
  txDesc: { fontSize: 12, marginTop: 1 },
  txDate: { fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '800', flexShrink: 0 },

  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyDesc: { fontSize: 13 },
});
