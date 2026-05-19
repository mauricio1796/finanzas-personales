import React, { useState, useMemo } from 'react';
import {
  StyleSheet, TextInput, Pressable, View, Text,
  ScrollView, Platform, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFinance, Transaction } from '@/src/core/context/FinanceContext';
import { SwipeableRow } from '@/src/components/ui/SwipeableRow';
import { Icon } from '@/src/components/ui/Icon';
import { useTheme } from '@/src/state/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const parseCOP = (s: string) => parseInt(s.replace(/\./g, '').replace(/[^0-9]/g, ''), 10);
const fmtCOP  = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
const fmtInput = (raw: string) => {
  const d = raw.replace(/\./g, '').replace(/[^0-9]/g, '');
  const n = parseInt(d, 10);
  return isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.');
};

// ── Income categories ─────────────────────────────────────────────────────────
const INCOME_CATS = [
  { id: 'salary',      label: 'Salario',      icon: 'briefcase' as const,  color: '#10B981', bg: '#D1FAE5' },
  { id: 'freelance',   label: 'Freelance',    icon: 'code'  as const,      color: '#6366F1', bg: '#EEF2FF' },
  { id: 'investment',  label: 'Inversiones',  icon: 'trending-up' as const,color: '#F59E0B', bg: '#FEF3C7' },
  { id: 'bonus',       label: 'Bonus',        icon: 'gift' as const,       color: '#EC4899', bg: '#FCE7F3' },
  { id: 'rent',        label: 'Arriendo',     icon: 'home' as const,       color: '#14B8A6', bg: '#CCFBF1' },
  { id: 'sales',       label: 'Ventas',       icon: 'shopping-bag' as const,color:'#8B5CF6', bg: '#EDE9FE' },
  { id: 'pension',     label: 'Pensión',      icon: 'shield' as const,     color: '#0EA5E9', bg: '#E0F2FE' },
  { id: 'other',       label: 'Otros',        icon: 'more-horizontal' as const, color: '#6B7280', bg: '#F3F4F6' },
] as const;

// ── Financial tips ────────────────────────────────────────────────────────────
const TIPS = [
  { icon: '💡', text: 'Regla 50/30/20: 50% necesidades, 30% deseos, 20% ahorro.' },
  { icon: '📈', text: 'Un ingreso extra bien invertido puede multiplicarse en años.' },
  { icon: '🎯', text: 'Define un % fijo de ahorro antes de gastar cualquier ingreso.' },
  { icon: '🔁', text: 'Diversifica: no dependas de una sola fuente de ingresos.' },
  { icon: '🏦', text: 'Automatiza tu ahorro para que ocurra sin esfuerzo.' },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface IngresosProps {
  transactions: Transaction[];
  onAddIncome: (amount: number, category: string, date: Date, description?: string) => void;
  onDeleteTransaction: (id: string) => void;
  onBack?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
export function Ingresos({ transactions, onAddIncome, onDeleteTransaction, onBack }: IngresosProps) {
  const insets  = useSafeAreaInsets();
  const { colors, isDark, accentColor } = useTheme();
  const { user, updateUserSalary } = useFinance();

  // ── Form state ────────────────────────────────────────────────────────────
  const [amount,       setAmount]       = useState('');
  const [description,  setDescription]  = useState('');
  const [selectedCat,  setSelectedCat]  = useState<string>('salary');
  const [monthlySalary,setMonthlySalary]= useState(
    user?.monthlySalary ? String(Math.round(user.monthlySalary).toLocaleString('es-CO').replace(/,/g, '.')) : '',
  );
  const [error,        setError]        = useState('');
  const [amtFocused,   setAmtFocused]   = useState(false);
  const [descFocused,  setDescFocused]  = useState(false);
  const [tipIdx]                        = useState(() => Math.floor(Math.random() * TIPS.length));

  // ── Derived ───────────────────────────────────────────────────────────────
  const incomeList = useMemo(
    () => transactions.filter(t => t.type === 'income').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions],
  );
  const totalThisMonth = useMemo(() => {
    const now = new Date();
    return incomeList
      .filter(t => { const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .reduce((s, t) => s + t.amount, 0);
  }, [incomeList]);

  const catObj = INCOME_CATS.find(c => c.id === selectedCat) ?? INCOME_CATS[0];

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAdd = () => {
    setError('');
    const n = parseCOP(amount);
    if (isNaN(n) || n <= 0) { setError('Ingresa un monto válido'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onAddIncome(n, catObj.label, new Date(), description || undefined);
    setAmount('');
    setDescription('');
  };

  const handleSaveSalary = () => {
    const n = parseCOP(monthlySalary);
    if (!isNaN(n) && n > 0) {
      updateUserSalary(n);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={[s.root, { backgroundColor: isDark ? colors.background : '#F0FDF4' }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Hero header ────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#059669', '#10B981', '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: insets.top + 20 }]}
      >
        {onBack && (
          <Pressable onPress={onBack} style={s.backBtn} hitSlop={12}>
            <Icon name="arrow-left" size={20} color="#fff" />
          </Pressable>
        )}
        <Text style={s.heroLabel}>INGRESOS</Text>
        <Text style={s.heroAmount}>{fmtCOP(totalThisMonth)}</Text>
        <Text style={s.heroSub}>registrado este mes</Text>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statVal}>{incomeList.length}</Text>
            <Text style={s.statLabel}>transacciones</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statVal}>{fmtCOP(user?.monthlySalary ?? 0)}</Text>
            <Text style={s.statLabel}>salario base</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statVal}>{incomeList.length > 0 ? fmtCOP(Math.round(totalThisMonth / incomeList.length)) : '$0'}</Text>
            <Text style={s.statLabel}>promedio</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={s.body}>

        {/* ── Tip card ────────────────────────────────────────────────── */}
        <View style={[s.tipCard, { backgroundColor: isDark ? '#052E16' : '#ECFDF5', borderColor: '#6EE7B7' }]}>
          <Text style={s.tipIcon}>{TIPS[tipIdx].icon}</Text>
          <Text style={[s.tipText, { color: isDark ? '#6EE7B7' : '#065F46' }]}>{TIPS[tipIdx].text}</Text>
        </View>

        {/* ── Salary setup ────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.cardHeader}>
            <View style={[s.cardIconBox, { backgroundColor: '#D1FAE5' }]}>
              <Icon name="dollar-sign" size={16} color="#059669" />
            </View>
            <View>
              <Text style={[s.cardTitle, { color: colors.textPrimary }]}>Salario mensual</Text>
              <Text style={[s.cardSub, { color: colors.textTertiary }]}>Base para planear tu mes</Text>
            </View>
          </View>
          <View style={s.salaryRow}>
            <View style={[s.amountInputWrap, { borderColor: '#10B981', backgroundColor: isDark ? '#052E16' : '#F0FDF4' }]}>
              <Text style={[s.currSign, { color: '#10B981' }]}>$</Text>
              <TextInput
                style={[s.amountInput, { color: colors.textPrimary }]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={monthlySalary}
                onChangeText={t => setMonthlySalary(fmtInput(t))}
                selectTextOnFocus
              />
            </View>
            <Pressable style={s.saveSalaryBtn} onPress={handleSaveSalary}>
              <Icon name="check" size={18} color="#fff" />
            </Pressable>
          </View>
          {user?.monthlySalary ? (
            <Text style={[s.salaryConfirm, { color: '#10B981' }]}>
              ✓ Salario guardado: {fmtCOP(user.monthlySalary)}
            </Text>
          ) : (
            <Text style={[s.salaryHint, { color: colors.textTertiary }]}>
              Configura tu salario para calcular disponible, ahorro y metas
            </Text>
          )}
        </View>

        {/* ── New income form ──────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.cardHeader}>
            <View style={[s.cardIconBox, { backgroundColor: '#D1FAE5' }]}>
              <Icon name="plus-circle" size={16} color="#059669" />
            </View>
            <View>
              <Text style={[s.cardTitle, { color: colors.textPrimary }]}>Nuevo ingreso</Text>
              <Text style={[s.cardSub, { color: colors.textTertiary }]}>Registra cualquier entrada de dinero</Text>
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
            borderColor: amtFocused ? '#10B981' : colors.border,
            borderWidth: amtFocused ? 2 : 1,
            backgroundColor: isDark ? '#052E16' : '#F0FDF4',
          }]}>
            <Text style={[s.currSign, { color: amtFocused ? '#10B981' : colors.textTertiary }]}>$</Text>
            <TextInput
              style={[s.amountInput, { color: colors.textPrimary, fontSize: 22 }]}
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
          <Text style={[s.fieldLabel, { color: colors.textTertiary, marginTop: 18 }]}>FUENTE DE INGRESO</Text>
          <View style={s.catGrid}>
            {INCOME_CATS.map(c => {
              const active = selectedCat === c.id;
              return (
                <Pressable
                  key={c.id}
                  style={[s.catCell, { backgroundColor: active ? c.color : (isDark ? colors.cardSecondary : c.bg + '66'), borderColor: active ? c.color : colors.border }]}
                  onPress={() => {
                    setSelectedCat(c.id);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                >
                  <Icon name={c.icon} size={18} color={active ? '#fff' : c.color} />
                  <Text style={[s.catCellLabel, { color: active ? '#fff' : c.color }]}>{c.label}</Text>
                  {active && <View style={s.catCellCheck}><Text style={{ fontSize: 8, color: '#fff' }}>✓</Text></View>}
                </Pressable>
              );
            })}
          </View>

          {/* Description */}
          <Text style={[s.fieldLabel, { color: colors.textTertiary, marginTop: 18 }]}>NOTA (opcional)</Text>
          <TextInput
            style={[s.descInput, {
              borderColor: descFocused ? '#10B981' : colors.border,
              borderWidth: descFocused ? 2 : 1,
              backgroundColor: isDark ? colors.cardSecondary : '#F9FAFB',
              color: colors.textPrimary,
            }]}
            placeholder="Ej: Pago quincena, proyecto cliente…"
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            onFocus={() => setDescFocused(true)}
            onBlur={() => setDescFocused(false)}
            maxLength={80}
          />

          {/* CTA */}
          <Pressable
            style={[s.addBtn, { backgroundColor: '#10B981' }]}
            onPress={handleAdd}
          >
            <Icon name="arrow-up-circle" size={20} color="#fff" />
            <Text style={s.addBtnText}>Registrar ingreso</Text>
          </Pressable>
        </View>

        {/* ── History ─────────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.cardHeader, { marginBottom: 4 }]}>
            <View style={[s.cardIconBox, { backgroundColor: '#D1FAE5' }]}>
              <Icon name="clock" size={16} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: colors.textPrimary }]}>Historial</Text>
            </View>
            <Text style={[s.txCount, { color: colors.textTertiary }]}>{incomeList.length} registros</Text>
          </View>

          {incomeList.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>💰</Text>
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>Sin ingresos aún</Text>
              <Text style={[s.emptyDesc, { color: colors.textTertiary }]}>Registra tu primer ingreso arriba</Text>
            </View>
          ) : (
            incomeList.map((item, idx) => {
              const cat = INCOME_CATS.find(c => c.label === item.category);
              return (
                <SwipeableRow key={item.id} onDelete={() => onDeleteTransaction(item.id)}>
                  <View style={[s.txItem, idx < incomeList.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={[s.txIcon, { backgroundColor: cat?.bg ?? '#D1FAE5' }]}>
                      <Icon name={(cat?.icon ?? 'dollar-sign') as any} size={16} color={cat?.color ?? '#10B981'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.txCat, { color: colors.textPrimary }]}>{item.category}</Text>
                      {item.description ? <Text style={[s.txDesc, { color: colors.textSecondary }]} numberOfLines={1}>{item.description}</Text> : null}
                      <Text style={[s.txDate, { color: colors.textTertiary }]}>
                        {new Date(item.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <Text style={[s.txAmount, { color: '#10B981' }]}>+{fmtCOP(item.amount)}</Text>
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 14, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },

  body: { padding: 16, gap: 14 },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  tipIcon: { fontSize: 22 },
  tipText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 } : {}),
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cardIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 1 },

  salaryRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  salaryConfirm: { fontSize: 12, fontWeight: '600', marginTop: 10 },
  salaryHint: { fontSize: 12, marginTop: 10, lineHeight: 16 },
  saveSalaryBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },

  amountInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, flex: 1,
  },
  currSign: { fontSize: 18, fontWeight: '700', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800', padding: 0 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCell: {
    flexBasis: '22%', flexGrow: 1,
    paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', gap: 6,
    position: 'relative',
  },
  catCellLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  catCellCheck: {
    position: 'absolute', top: 4, right: 4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },

  descInput: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontWeight: '500',
  },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 18,
    ...(Platform.OS !== 'web' ? { shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 } : {}),
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
