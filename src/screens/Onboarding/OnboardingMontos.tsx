import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFinance } from '../../state';
import { Icon } from '../../components/ui/Icon';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { THEME } from '../../constants/theme';
import { reprogramarTodasLasNotificaciones } from '../../services/NotificacionesService';

interface Props { onNext: () => void; onBack: () => void; }

const PRIMARY       = '#6156E8';
const PRIMARY_LIGHT = '#EEF0FF';
const BG            = '#F8F7FF';
const SURFACE       = '#FFFFFF';
const BORDER        = '#E5E7EB';
const TEXT_PRIMARY  = '#111827';
const TEXT_SEC      = '#6B7280';
const TEXT_TERT     = '#9CA3AF';
const INCOME_COLOR  = '#1D9E75';
const EXPENSE_COLOR = '#F55B5B';

const fmtCOP = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

const parseCOP = (s: string) =>
  parseInt(s.replace(/[^0-9]/g, '') || '0', 10);

const SUGERIDOS: Record<string, number> = {
  alimentacion:    0.25,
  transporte:      0.10,
  vivienda:        0.30,
  salud:           0.05,
  educacion:       0.08,
  entretenimiento: 0.05,
  ropa:            0.05,
  servicios:       0.08,
  gym:             0,
  mascotas:        0,
  ahorro:          0.20,
  otros:           0,
};
const SUGERIDOS_FIJOS: Record<string, number> = {
  gym: 100000,
  mascotas: 80000,
  otros: 50000,
};

const STEP = 10000;

// ── CategoryCard ──────────────────────────────────────────────────────────────

interface CategoryCardProps {
  cat: { id: string; name: string; icon: string; color?: string };
  budget: number;
  diaPago: number | undefined;
  onBudgetChange: (v: number) => void;
  onDiaChange: (d: number) => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  cat, budget, diaPago, onBudgetChange, onDiaChange,
}) => {
  const [rawInput, setRawInput] = useState(budget > 0 ? String(Math.round(budget)) : '');
  const accent = cat.color || PRIMARY;

  const decrement = () => {
    const next = Math.max(0, budget - STEP);
    onBudgetChange(next);
    setRawInput(next > 0 ? String(next) : '');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const increment = () => {
    const next = budget + STEP;
    onBudgetChange(next);
    setRawInput(String(next));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const handleInputChange = (text: string) => {
    setRawInput(text);
    onBudgetChange(parseCOP(text));
  };
  const handleInputBlur = () => {
    const v = parseCOP(rawInput);
    setRawInput(v > 0 ? String(v) : '');
    onBudgetChange(v);
  };

  // Day pills: 1-28
  const days = Array.from({ length: 28 }, (_, i) => i + 1);

  return (
    <View style={cc.card}>
      {/* Header */}
      <View style={cc.header}>
        <View style={[cc.iconWrap, { backgroundColor: accent + '18' }]}>
          <Icon name={cat.icon as any} size={20} color={accent} />
        </View>
        <Text style={cc.catName}>{cat.name}</Text>
      </View>

      {/* Budget stepper */}
      <View style={cc.stepperRow}>
        <TouchableOpacity style={cc.stepBtn} onPress={decrement} activeOpacity={0.7}>
          <Icon name="minus" size={16} color={TEXT_SEC} />
        </TouchableOpacity>

        <TextInput
          style={cc.input}
          keyboardType="numeric"
          value={rawInput}
          onChangeText={handleInputChange}
          onBlur={handleInputBlur}
          placeholder="$0"
          placeholderTextColor={TEXT_TERT}
          selectTextOnFocus
        />

        <TouchableOpacity style={cc.stepBtn} onPress={increment} activeOpacity={0.7}>
          <Icon name="plus" size={16} color={TEXT_SEC} />
        </TouchableOpacity>
      </View>

      {/* Día de pago */}
      <View style={cc.daySection}>
        <View style={cc.dayHeaderRow}>
          <Icon name="bell" size={13} color={TEXT_TERT} />
          <Text style={cc.dayLabel}>Día de pago (recibirás aviso un día antes)</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={cc.daysScroll}
          nestedScrollEnabled
        >
          {days.map(d => {
            const active = diaPago === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => {
                  onDiaChange(active ? 0 : d);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }}
                style={[cc.dayPill, active && cc.dayPillActive]}
                activeOpacity={0.7}
              >
                <Text style={[cc.dayPillText, active && cc.dayPillTextActive]}>
                  {d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const cc = StyleSheet.create({
  card: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 12,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    flex: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F4F3F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 42,
    backgroundColor: '#F4F3F8',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    paddingHorizontal: 8,
  },
  daySection: {
    gap: 8,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dayLabel: {
    fontSize: 11,
    color: TEXT_TERT,
    fontWeight: '500',
  },
  daysScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  dayPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F4F3F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillActive: {
    backgroundColor: PRIMARY,
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SEC,
  },
  dayPillTextActive: {
    color: SURFACE,
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export const OnboardingMontos: React.FC<Props> = ({ onNext, onBack }) => {
  const { categories, updateCategory, profile } = useFinance();
  const sal = profile?.monthlySalary || 0;

  const budgetCats = categories.filter(
    c => c.tipo === 'gasto' || c.tipo === 'variable' || c.tipo === 'fijo' || !c.tipo,
  );

  const [budgets, setBudgets] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    budgetCats.forEach(c => {
      const pct = SUGERIDOS[c.id] ?? 0;
      const fixed = SUGERIDOS_FIJOS[c.id] ?? 0;
      init[c.id] = c.budget ?? (pct > 0 ? Math.round(sal * pct / STEP) * STEP : fixed);
    });
    return init;
  });

  const [diasPago, setDiasPago] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    budgetCats.forEach(c => { init[c.id] = c.diaPago ?? 0; });
    return init;
  });

  const totalAsignado = Object.values(budgets).reduce((s, v) => s + v, 0);
  const pctTotal = sal > 0 ? Math.min(totalAsignado / sal, 1) : 0;
  const overBudget = totalAsignado > sal && sal > 0;

  const barAnim    = useRef(new Animated.Value(pctTotal)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(bubbleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    Animated.timing(barAnim, { toValue: pctTotal, duration: 250, useNativeDriver: false }).start();
    if (overBudget) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [pctTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const updated = budgetCats.map(cat => {
      const patch: Partial<typeof cat> = {
        budget: budgets[cat.id] ?? 0,
        diaPago: diasPago[cat.id] || undefined,
      };
      updateCategory(cat.id, patch);
      return { ...cat, ...patch };
    });
    // Reschedule all notifications so new diaPago values are picked up
    const allCats = categories.map(c => {
      const up = updated.find(u => u.id === c.id);
      return up ? { ...c, ...up } : c;
    });
    try {
      await reprogramarTodasLasNotificaciones(allCats as any);
    } catch (_) {}
    onNext();
  };

  const bubbleSlide = {
    opacity: bubbleAnim,
    transform: [{ translateX: bubbleAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
  };

  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <OnboardingShell step={4} totalSteps={5} onBack={onBack} keyboardAvoiding={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {/* Finn bubble */}
        <View style={s.finnRow}>
          <View style={s.finnAvatar}>
            <Text style={s.finnLetter}>F</Text>
          </View>
          <Animated.View style={[s.bubble, bubbleSlide]}>
            <Text style={s.bubbleText}>
              Asigna un presupuesto mensual a cada categoría y elige su día de pago para que te avisemos un día antes.
            </Text>
          </Animated.View>
        </View>

        {budgetCats.map(cat => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            budget={budgets[cat.id] ?? 0}
            diaPago={diasPago[cat.id] || undefined}
            onBudgetChange={v => setBudgets(prev => ({ ...prev, [cat.id]: v }))}
            onDiaChange={d => setDiasPago(prev => ({ ...prev, [cat.id]: d }))}
          />
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed bottom */}
      <View style={s.footer}>
        <View style={s.budgetCard}>
          <View style={s.budgetRow}>
            <Text style={s.budgetLabel}>Asignado</Text>
            <Text style={[s.budgetValue, overBudget && { color: EXPENSE_COLOR }]}>
              {fmtCOP(totalAsignado)}
              {sal > 0 && (
                <Text style={s.budgetOf}>{' / ' + fmtCOP(sal)}</Text>
              )}
            </Text>
          </View>
          <View style={s.budgetTrack}>
            <Animated.View
              style={[s.budgetFill, {
                width: barWidth,
                backgroundColor: overBudget ? EXPENSE_COLOR : INCOME_COLOR,
              }]}
            />
          </View>
        </View>

        <TouchableOpacity style={s.btn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={s.btnText}>Confirmar presupuestos</Text>
        </TouchableOpacity>
      </View>
    </OnboardingShell>
  );
};

const s = StyleSheet.create({
  scrollContent: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  finnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  finnAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  finnLetter: {
    fontSize: 16,
    fontWeight: '600',
    color: SURFACE,
  },
  bubble: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_PRIMARY,
  },
  footer: {
    backgroundColor: SURFACE,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  budgetCard: {
    backgroundColor: BG,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
    gap: 8,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_SEC,
  },
  budgetValue: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  budgetOf: {
    fontSize: 12,
    fontWeight: '400',
    color: TEXT_TERT,
  },
  budgetTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BORDER,
    overflow: 'hidden',
  },
  budgetFill: {
    height: '100%',
    borderRadius: 3,
  },
  btn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
    color: SURFACE,
  },
});
