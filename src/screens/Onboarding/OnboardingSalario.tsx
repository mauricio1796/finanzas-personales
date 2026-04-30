import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Keyboard, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../../components/ui/Icon';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { THEME } from '../../constants/theme';

interface Props { onNext: () => void; onBack: () => void; }

const fmtCOP = (raw: string) => {
  const n = parseInt(raw.replace(/\./g, '').replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.');
};

export const OnboardingSalario: React.FC<Props> = ({ onNext, onBack }) => {
  const { setProfile, profile } = useFinance();
  const { colors } = useTheme();

  const nombre   = profile?.mainFinancialConcern?.split(' ')[0] ?? '';
  const [income,   setIncome]   = useState(
    profile?.monthlySalary ? fmtCOP(String(profile.monthlySalary)) : ''
  );
  const [hasDebt,  setHasDebt]  = useState<boolean | null>(profile?.hasDebts ?? null);
  const [debtAmt,  setDebtAmt]  = useState('');
  const [incFocus, setIncFocus] = useState(false);
  const [debtFocus,setDebtFocus]= useState(false);
  const [showDebt, setShowDebt] = useState(profile?.hasDebts !== undefined && income.length > 0);
  const [showSavings, setShowSavings] = useState(income.length > 0);

  const bubble1  = useRef(new Animated.Value(0)).current;
  const bubble2  = useRef(new Animated.Value(0)).current;
  const debtAnim = useRef(new Animated.Value(0)).current;
  const savAnim  = useRef(new Animated.Value(0)).current;
  const barAnim  = useRef(new Animated.Value(0)).current;
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.spring(bubble1, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    if (showDebt)    showDebtSection();
    if (showSavings) animateSavings(getSalarioNum());
  }, []);

  const getSalarioNum = () => parseInt(income.replace(/\./g, ''), 10) || 0;

  const animateSavings = (sal: number) => {
    const pct = sal > 0 ? Math.min(0.25, 200000 / sal) : 0;
    barAnim.setValue(0);
    Animated.timing(barAnim, { toValue: pct, duration: 600, useNativeDriver: false }).start();
  };

  const showDebtSection = () => {
    Animated.spring(bubble2, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    Animated.timing(debtAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const handleIncomeChange = (txt: string) => {
    const digits = txt.replace(/\./g, '').replace(/[^0-9]/g, '');
    const formatted = fmtCOP(digits);
    setIncome(formatted);
    const sal = parseInt(digits, 10) || 0;
    if (sal > 0) {
      if (!showSavings) {
        setShowSavings(true);
        Animated.spring(savAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }).start();
      }
      animateSavings(sal);
      if (debounce.current) clearTimeout(debounce.current);
      if (!showDebt) {
        debounce.current = setTimeout(() => { setShowDebt(true); showDebtSection(); }, 900);
      }
    }
  };

  const handleSelectDebt = (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHasDebt(val);
  };

  const canContinue = income.length > 0 && getSalarioNum() > 0 && hasDebt !== null;

  const handleNext = () => {
    if (!canContinue) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const sal  = getSalarioNum();
    const debt = parseInt(debtAmt.replace(/\./g, ''), 10) || 0;
    setProfile({
      id: profile?.id ?? Date.now().toString(),
      userId: '1',
      employmentType: profile?.employmentType ?? 'employed',
      incomeType: 'fixed',
      monthlySalary: sal,
      hasDebts: hasDebt!,
      debtAmount: hasDebt ? debt : undefined,
      mainFinancialConcern: profile?.mainFinancialConcern ?? '',
      currencyPreference: 'COP',
      createdAt: profile?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onNext();
  };

  const bubbleSlide = (a: Animated.Value) => ({
    opacity: a,
    transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
  });

  const sal = getSalarioNum();
  const savEstimado = Math.round(sal * 0.20);
  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <OnboardingShell step={2} totalSteps={5} onBack={onBack}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.inner, { paddingHorizontal: 24 }]}>
          {/* Finn bubble */}
          <View style={s.finnRow}>
            <View style={[s.finnAvatar, { backgroundColor: colors.primary }]}>
              <Text style={s.finnLetter}>F</Text>
            </View>
            <Animated.View style={[s.bubble, { backgroundColor: colors.card, borderColor: colors.border }, bubbleSlide(bubble1)]}>
              <Text style={[s.bubbleText, { color: colors.textPrimary }]}>
                {nombre ? 'Cuanto ganas al mes, ' + nombre + '? Solo tu veras esto' : 'Cuanto ganas al mes? Solo tu veras esto'}
              </Text>
            </Animated.View>
          </View>

          {/* Salary input */}
          <View style={[s.salaryRow, { borderBottomColor: incFocus ? colors.primary : colors.border, borderBottomWidth: incFocus ? 2 : 1 }]}>
            <Text style={[s.currencySign, { color: colors.textTertiary }]}>$</Text>
            <TextInput
              style={[s.salaryInput, { color: colors.textPrimary }]}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              value={income}
              onChangeText={handleIncomeChange}
              onFocus={() => setIncFocus(true)}
              onBlur={() => setIncFocus(false)}
              autoFocus
            />
            <Text style={[s.perMonth, { color: colors.textTertiary }]}>/mes</Text>
          </View>

          {/* Savings indicator */}
          {showSavings && sal > 0 && (
            <Animated.View style={[s.savingsCard, { backgroundColor: colors.primaryLight, opacity: savAnim }]}>
              <View style={s.savingsHeader}>
                <Icon name="trending-up" size={14} color={colors.primary} />
                <Text style={[s.savingsLabel, { color: colors.primary }]}>Capacidad de ahorro estimada</Text>
              </View>
              <View style={[s.savingsTrack, { backgroundColor: colors.border }]}>
                <Animated.View style={[s.savingsFill, { width: barWidth, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[s.savingsAmt, { color: colors.primaryText }]}>
                {'$' + Math.round(savEstimado).toLocaleString('es-CO').replace(/,/g, '.') + ' / mes (20%)'}
              </Text>
            </Animated.View>
          )}

          {/* Debts section */}
          {showDebt && (
            <Animated.View style={{ opacity: debtAnim }}>
              <View style={[s.finnRow, { marginTop: 16, marginBottom: 12 }]}>
                <View style={[s.finnAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={s.finnLetter}>F</Text>
                </View>
                <Animated.View style={[s.bubble, { backgroundColor: colors.card, borderColor: colors.border }, bubbleSlide(bubble2)]}>
                  <Text style={[s.bubbleText, { color: colors.textPrimary }]}>
                    Tienes deudas o creditos activos?
                  </Text>
                </Animated.View>
              </View>

              <View style={s.debtRow}>
                <TouchableOpacity
                  style={[s.debtBtn, { backgroundColor: hasDebt === true ? colors.expenseLight : colors.card, borderColor: hasDebt === true ? colors.expense : colors.border, borderWidth: hasDebt === true ? 1.5 : 0.5 }]}
                  onPress={() => handleSelectDebt(true)}
                  activeOpacity={0.8}
                >
                  <Icon name="trending-down" size={22} color={hasDebt === true ? colors.expense : colors.textSecondary} />
                  <Text style={[s.debtBtnText, { color: hasDebt === true ? colors.expense : colors.textPrimary }]}>
                    Si, tengo{'\n'}deudas
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.debtBtn, { backgroundColor: hasDebt === false ? colors.incomeLight : colors.card, borderColor: hasDebt === false ? colors.income : colors.border, borderWidth: hasDebt === false ? 1.5 : 0.5 }]}
                  onPress={() => handleSelectDebt(false)}
                  activeOpacity={0.8}
                >
                  <Icon name="check-circle" size={22} color={hasDebt === false ? colors.income : colors.textSecondary} />
                  <Text style={[s.debtBtnText, { color: hasDebt === false ? colors.income : colors.textPrimary }]}>
                    No tengo{'\n'}deudas
                  </Text>
                </TouchableOpacity>
              </View>

              {hasDebt === true && (
                <View style={[s.debtInput, { borderColor: debtFocus ? colors.primary : colors.border }]}>
                  <Text style={[s.debtInputPrefix, { color: colors.textTertiary }]}>$</Text>
                  <TextInput
                    style={[s.debtInputField, { color: colors.textPrimary }]}
                    placeholder="Monto total de deudas"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    value={debtAmt}
                    onChangeText={t => { const d = t.replace(/\./g, '').replace(/[^0-9]/g, ''); setDebtAmt(fmtCOP(d)); }}
                    onFocus={() => setDebtFocus(true)}
                    onBlur={() => setDebtFocus(false)}
                  />
                </View>
              )}
            </Animated.View>
          )}

          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={[s.btn, { backgroundColor: colors.primary, opacity: canContinue ? 1 : 0.4 }]}
            onPress={handleNext}
            disabled={!canContinue}
            activeOpacity={0.85}
          >
            <Text style={s.btnText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </OnboardingShell>
  );
};

const s = StyleSheet.create({
  inner:         { flex: 1, paddingTop: 8, paddingBottom: 24, gap: 12 },
  finnRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  finnAvatar:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  finnLetter:    { fontSize: 16, fontWeight: '600', color: THEME.colors.surface },
  bubble:        { flex: 1, borderRadius: 14, borderTopLeftRadius: 4, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  bubbleText:    { fontSize: 15, lineHeight: 22 },
  salaryRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  currencySign:  { fontSize: 32, fontWeight: '400' },
  salaryInput:   { flex: 1, fontSize: 36, fontWeight: '500' },
  perMonth:      { fontSize: 16, alignSelf: 'flex-end', paddingBottom: 8 },
  savingsCard:   { borderRadius: THEME.radius.md, padding: 12, gap: 8 },
  savingsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savingsLabel:  { fontSize: 12, fontWeight: '600' },
  savingsTrack:  { height: 6, borderRadius: 3, overflow: 'hidden' },
  savingsFill:   { height: '100%', borderRadius: 3 },
  savingsAmt:    { fontSize: 13, fontWeight: '700' },
  debtRow:       { flexDirection: 'row', gap: 12 },
  debtBtn:       { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center', gap: 8 },
  debtBtnText:   { fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  debtInput:     { flexDirection: 'row', alignItems: 'center', borderRadius: THEME.radius.md, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, gap: 8, marginTop: 8 },
  debtInputPrefix:{ fontSize: 18, fontWeight: '500' },
  debtInputField: { flex: 1, fontSize: 18, fontWeight: '500' },
  btn:           { borderRadius: THEME.radius.lg, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText:       { fontSize: 16, fontWeight: '500', color: THEME.colors.surface },
});
