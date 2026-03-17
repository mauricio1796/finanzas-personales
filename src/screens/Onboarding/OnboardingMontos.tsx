import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, PanResponder, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../../components/ui/Icon';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';

interface Props { onNext: () => void; onBack: () => void; }

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

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

interface SliderItemProps {
  cat: { id: string; name: string; icon: string; color?: string };
  value: number;
  maxValue: number;
  onChange: (v: number) => void;
}

const STEP = 10000;

const SliderItem: React.FC<SliderItemProps> = ({ cat, value, maxValue, onChange }) => {
  const { colors } = useTheme();
  const trackWidth = useRef(0);
  const panX = useRef(0);
  const fillAnim = useRef(new Animated.Value(value / Math.max(maxValue, 1))).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: value / Math.max(maxValue, 1),
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value, maxValue]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const loc = e.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, loc / Math.max(trackWidth.current, 1)));
        const raw = pct * maxValue;
        const snapped = Math.round(raw / STEP) * STEP;
        onChange(snapped);
        panX.current = loc;
      },
      onPanResponderMove: (_, gs) => {
        const loc = panX.current + gs.dx;
        const pct = Math.max(0, Math.min(1, loc / Math.max(trackWidth.current, 1)));
        const raw = pct * maxValue;
        const snapped = Math.round(raw / STEP) * STEP;
        onChange(snapped);
      },
    })
  ).current;

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[si.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={si.header}>
        <View style={[si.iconWrap, { backgroundColor: (cat.color || colors.primary) + '20' }]}>
          <Icon name={cat.icon as any} size={20} color={cat.color || colors.primary} />
        </View>
        <Text style={[si.catName, { color: colors.textPrimary }]}>{cat.name}</Text>
        <Text style={[si.valueText, { color: value > 0 ? colors.primary : colors.textTertiary }]}>
          {value > 0 ? fmtCOP(value) : '$0'}
        </Text>
      </View>

      <View
        style={[si.trackWrap, { backgroundColor: colors.inputBg }]}
        onLayout={e => { trackWidth.current = e.nativeEvent.layout.width; }}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[si.fill, { width: fillWidth, backgroundColor: colors.primary }]} />
        <Animated.View
          style={[
            si.thumb,
            {
              left: fillWidth,
              borderColor: colors.primary,
              backgroundColor: colors.card,
            },
          ]}
        />
      </View>

      <View style={si.rangeRow}>
        <Text style={[si.rangeLabel, { color: colors.textTertiary }]}>$0</Text>
        <Text style={[si.rangeLabel, { color: colors.textTertiary }]}>
          {fmtCOP(maxValue)}
        </Text>
      </View>
    </View>
  );
};

const si = StyleSheet.create({
  card:       { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catName:    { flex: 1, fontSize: 15, fontWeight: '600' },
  valueText:  { fontSize: 15, fontWeight: '700' },
  trackWrap:  { height: 6, borderRadius: 3, position: 'relative', justifyContent: 'center' },
  fill:       { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  thumb:      { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, marginLeft: -11, top: -8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  rangeRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  rangeLabel: { fontSize: 10 },
});

export const OnboardingMontos: React.FC<Props> = ({ onNext, onBack }) => {
  const { categories, updateCategory, profile } = useFinance();
  const { colors } = useTheme();
  const sal = profile?.monthlySalary || 0;
  const maxSlider = Math.max(Math.round(sal * 0.8), 2000000);

  const budgetCats = categories.filter(c => c.tipo === 'gasto' || c.tipo === 'variable' || c.tipo === 'fijo' || !c.tipo);

  const [budgets, setBudgets] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    budgetCats.forEach(c => {
      const pct = SUGERIDOS[c.id] ?? 0;
      const fixed = SUGERIDOS_FIJOS[c.id] ?? 0;
      init[c.id] = c.budget ?? (pct > 0 ? Math.round(sal * pct / STEP) * STEP : fixed);
    });
    return init;
  });

  const totalAsignado = Object.values(budgets).reduce((s, v) => s + v, 0);
  const pctTotal = sal > 0 ? Math.min(totalAsignado / sal, 1) : 0;
  const overBudget = totalAsignado > sal && sal > 0;

  const barAnim = useRef(new Animated.Value(pctTotal)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(bubbleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    Animated.timing(barAnim, { toValue: pctTotal, duration: 250, useNativeDriver: false }).start();
    if (overBudget) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [pctTotal]);

  const handleChange = (id: string, val: number) => {
    setBudgets(prev => ({ ...prev, [id]: val }));
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    budgetCats.forEach(cat => {
      updateCategory(cat.id, { budget: budgets[cat.id] ?? 0 });
    });
    onNext();
  };

  const bubbleSlide = {
    opacity: bubbleAnim,
    transform: [{ translateX: bubbleAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
  };

  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <OnboardingShell step={4} totalSteps={5} onBack={onBack} keyboardAvoiding={false}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.scrollContent, { paddingHorizontal: 16 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Finn bubble */}
        <View style={[s.finnRow, { marginBottom: 16 }]}>
          <View style={[s.finnAvatar, { backgroundColor: colors.primary }]}>
            <Text style={s.finnLetter}>F</Text>
          </View>
          <Animated.View style={[s.bubble, { backgroundColor: colors.card, borderColor: colors.border }, bubbleSlide]}>
            <Text style={[s.bubbleText, { color: colors.textPrimary }]}>
              Asigna un presupuesto mensual a cada categoria
            </Text>
          </Animated.View>
        </View>

        {/* Sliders */}
        {budgetCats.map(cat => (
          <View key={cat.id} style={{ marginBottom: 12 }}>
            <SliderItem
              cat={cat}
              value={budgets[cat.id] ?? 0}
              maxValue={maxSlider}
              onChange={v => handleChange(cat.id, v)}
            />
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed bottom: budget indicator + button */}
      <View style={[s.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingHorizontal: 16, paddingBottom: 16 }]}>
        <View style={[s.budgetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.budgetRow}>
            <Text style={[s.budgetLabel, { color: colors.textSecondary }]}>Asignado</Text>
            <Text style={[s.budgetValue, { color: overBudget ? colors.expense : colors.textPrimary }]}>
              {fmtCOP(totalAsignado)}
              <Text style={[s.budgetOf, { color: colors.textTertiary }]}>{sal > 0 ? ' / ' + fmtCOP(sal) : ''}</Text>
            </Text>
          </View>
          <View style={[s.budgetTrack, { backgroundColor: colors.border }]}>
            <Animated.View style={[s.budgetFill, { width: barWidth, backgroundColor: overBudget ? colors.expense : colors.income }]} />
          </View>
        </View>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: colors.primary }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>Confirmar presupuestos</Text>
        </TouchableOpacity>
      </View>
    </OnboardingShell>
  );
};

const s = StyleSheet.create({
  scrollContent: { paddingTop: 8, paddingBottom: 16 },
  finnRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  finnAvatar:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  finnLetter:    { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  bubble:        { flex: 1, borderRadius: 14, borderTopLeftRadius: 4, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  bubbleText:    { fontSize: 15, lineHeight: 22 },
  footer:        { borderTopWidth: 1, paddingTop: 12, gap: 10 },
  budgetCard:    { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  budgetRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetLabel:   { fontSize: 12, fontWeight: '500' },
  budgetValue:   { fontSize: 15, fontWeight: '700' },
  budgetOf:      { fontSize: 12, fontWeight: '400' },
  budgetTrack:   { height: 6, borderRadius: 3, overflow: 'hidden' },
  budgetFill:    { height: '100%', borderRadius: 3 },
  btn:           { borderRadius: 16, padding: 16, alignItems: 'center' },
  btnText:       { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
});
