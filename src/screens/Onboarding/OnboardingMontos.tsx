import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Keyboard,
} from 'react-native';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { ChatBubble, ProgressIndicator } from '../../components/onboarding';

const DIA_CHIPS = [1, 5, 10, 15, 20, 25, 0]; // 0 = ultimo dia

const fmtCOP = (digits: string) => {
  const num = parseInt(digits.replace(/\./g, ''), 10);
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('es-CO').replace(/,/g, '.');
};

interface MontoState {
  monto: string;
  diaPago: number | null;
}

export const OnboardingMontos: React.FC = () => {
  const { updateOnboardingStep, categories, updateCategory } = useFinance();
  const { colors } = useTheme();

  const compromisos = categories.filter((c: any) => c.tipo === 'fijo');

  const [montos, setMontos] = useState<Record<string, MontoState>>(() => {
    const init: Record<string, MontoState> = {};
    compromisos.forEach((c: any) => { init[c.id] = { monto: '', diaPago: null }; });
    return init;
  });

  useEffect(() => { Keyboard.dismiss(); }, []);

  const setMonto = (id: string, raw: string) => {
    const digits = raw.replace(/\./g, '').replace(/[^0-9]/g, '');
    const num = parseInt(digits, 10);
    setMontos(prev => ({ ...prev, [id]: { ...prev[id], monto: isNaN(num) ? '' : fmtCOP(digits) } }));
  };

  const setDia = (id: string, dia: number) => {
    setMontos(prev => ({ ...prev, [id]: { ...prev[id], diaPago: dia } }));
  };

  const canContinue = compromisos.every((c: any) => {
    const s = montos[c.id];
    return s && s.monto.length > 0 && s.diaPago !== null;
  });

  const handleContinue = () => {
    Keyboard.dismiss();
    compromisos.forEach((cat: any) => {
      const s = montos[cat.id];
      if (!s) return;
      const monto = parseInt(s.monto.replace(/\./g, ''), 10) || 0;
      updateCategory({ ...cat, presupuesto: monto, diaPago: s.diaPago ?? undefined });
    });
    updateOnboardingStep(4);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progress}>
        <ProgressIndicator currentStep={3} totalSteps={5} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled' showsVerticalScrollIndicator={false}>
        <ChatBubble
          message='Casi listo. Dime cuanto pagas por cada uno y que dia del mes vence cada pago.'
          isUser={false}
        />
        {compromisos.map((cat: any) => (
          <View key={cat.id} style={[styles.card, { borderColor: cat.color + '40' || '#E5E7EB' }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: (cat.color || '#6366F1') + '20' }]}>
                <Text style={styles.iconText}>{cat.icon || '◈'}</Text>
              </View>
              <Text style={[styles.catName, { color: '#111827' }]}>{cat.name}</Text>
            </View>
            <Text style={styles.fieldLabel}>Cuanto pagas?</Text>
            <TextInput
              style={[styles.input, { borderColor: montos[cat.id]?.monto ? colors.primary : '#E5E7EB', color: '#111827' }]}
              placeholder='Ej: 800.000'
              placeholderTextColor='#9CA3AF'
              keyboardType='numeric'
              value={montos[cat.id]?.monto || ''}
              onChangeText={(t) => setMonto(cat.id, t)}
            />
            <Text style={styles.fieldLabel}>Que dia del mes vence?</Text>
            <View style={styles.chipRow}>
              {DIA_CHIPS.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, montos[cat.id]?.diaPago === d && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => { Keyboard.dismiss(); setDia(cat.id, d); }}
                >
                  <Text style={[styles.chipText, montos[cat.id]?.diaPago === d && { color: '#FFFFFF' }]}>
                    {d === 0 ? 'Ultimo' : String(d)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }, !canContinue && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
          activeOpacity={0.82}
        >
          <Text style={styles.btnText}>Ver mi panel</Text>
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  progress: { marginBottom: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, gap: 14 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, padding: 16, gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20 },
  catName: { fontSize: 16, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  input: {
    borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 18, fontWeight: '700', color: '#111827', backgroundColor: '#F9FAFB',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  chipText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  btn: { paddingVertical: 17, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});