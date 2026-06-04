import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Pressable, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon, getCategoryIcon } from '../components/ui/Icon';
import type { GastoRecurrente } from '../types';
import { THEME } from '../constants/theme';

function fmt(n: number) { return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.'); }

const FRECUENCIAS: GastoRecurrente['frecuencia'][] = ['diario','semanal','quincenal','mensual','anual'];
const FREQ_LABEL: Record<GastoRecurrente['frecuencia'], string> = {
  diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual', anual: 'Anual',
};

const CATS = [
  'alimentacion','transporte','servicios','arriendo','salud','entretenimiento','ropa','otros',
];

function mensualizar(monto: number, freq: GastoRecurrente['frecuencia']): number {
  switch (freq) {
    case 'diario':     return monto * 30;
    case 'semanal':    return monto * 4.33;
    case 'quincenal':  return monto * 2;
    case 'mensual':    return monto;
    case 'anual':      return monto / 12;
  }
}

interface RecurrenteFormProps {
  visible: boolean;
  onClose: () => void;
  onSave: (r: Omit<GastoRecurrente, 'id' | 'creadoEn' | 'proximoPago'>) => void;
}

const RecurrenteForm: React.FC<RecurrenteFormProps> = ({ visible, onClose, onSave }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [nombre, setNombre]         = useState('');
  const [monto, setMonto]           = useState('');
  const [categoria, setCategoria]   = useState('servicios');
  const [frecuencia, setFrecuencia] = useState<GastoRecurrente['frecuencia']>('mensual');
  const [dia, setDia]               = useState('');
  const [desc, setDesc]             = useState('');

  const reset = () => { setNombre(''); setMonto(''); setCategoria('servicios'); setFrecuencia('mensual'); setDia(''); setDesc(''); };

  const handleSave = () => {
    const m = parseInt(monto.replace(/\./g,''), 10);
    if (!nombre.trim() || !m) return;
    onSave({ nombre: nombre.trim(), monto: m, categoria, frecuencia, diaPago: dia ? parseInt(dia,10) : undefined, activo: true, descripcion: desc || undefined });
    reset();
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={st.overlay} onPress={onClose}>
          <Pressable style={[st.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={[st.handle, { backgroundColor: colors.border }]} />
            <Text style={[st.sheetTitle, { color: colors.textPrimary }]}>Nuevo Gasto Recurrente</Text>

            <TextInput style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Nombre (Ej: Netflix, Arriendo)" placeholderTextColor={colors.textTertiary}
              value={nombre} onChangeText={setNombre} />

            <TextInput style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Monto (COP)" placeholderTextColor={colors.textTertiary}
              keyboardType="numeric" value={monto}
              onChangeText={t => { const d = t.replace(/\./g,'').replace(/\D/g,''); const n = parseInt(d,10); setMonto(isNaN(n)?'':n.toLocaleString('es-CO').replace(/,/g,'.')); }} />

            <Text style={[st.label, { color: colors.textTertiary }]}>FRECUENCIA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {FRECUENCIAS.map(f => (
                <TouchableOpacity key={f} onPress={() => setFrecuencia(f)}
                  style={[st.freqChip, { borderColor: colors.border, backgroundColor: colors.cardSecondary ?? colors.card },
                    frecuencia === f && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <Text style={[st.freqText, { color: frecuencia === f ? '#fff' : colors.textSecondary }]}>{FREQ_LABEL[f]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[st.label, { color: colors.textTertiary }]}>CATEGORÍA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {CATS.map(c => (
                <TouchableOpacity key={c} onPress={() => setCategoria(c)}
                  style={[st.freqChip, { borderColor: colors.border, backgroundColor: colors.cardSecondary ?? colors.card },
                    categoria === c && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <Text style={{ fontSize: 12, color: categoria === c ? '#fff' : colors.textSecondary, textTransform: 'capitalize' }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {frecuencia === 'mensual' && (
              <TextInput style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Día de pago (1-31, opcional)" placeholderTextColor={colors.textTertiary}
                keyboardType="numeric" value={dia} onChangeText={setDia} />
            )}

            <TextInput style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Descripción (opcional)" placeholderTextColor={colors.textTertiary}
              value={desc} onChangeText={setDesc} />

            <TouchableOpacity style={[st.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Text style={st.saveBtnText}>Guardar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface RecurrentesScreenProps { onBack: () => void; }

export const RecurrentesScreen: React.FC<RecurrentesScreenProps> = ({ onBack }) => {
  const insets                                               = useSafeAreaInsets();
  const { colors }                                           = useTheme();
  const { recurrentes, addRecurrente, deleteRecurrente, toggleRecurrente } = useFinance();
  const [showForm, setShowForm]                              = useState(false);

  const handleSave = (data: Omit<GastoRecurrente, 'id' | 'creadoEn' | 'proximoPago'>) => {
    addRecurrente({ ...data, id: Date.now().toString(), creadoEn: new Date().toISOString() });
  };

  const activos   = recurrentes.filter(r => r.activo);
  const pausados  = recurrentes.filter(r => !r.activo);

  const totalMensual = useMemo(
    () => activos.reduce((s, r) => s + mensualizar(r.monto, r.frecuencia), 0),
    [activos],
  );

  return (
    <View style={[st.screen, { backgroundColor: colors.background }]}>
      <View style={[st.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={st.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: colors.textPrimary }]}>Gastos Recurrentes</Text>
        <TouchableOpacity onPress={() => setShowForm(true)} style={[st.addBtn, { backgroundColor: colors.primaryLight }]}>
          <Icon name="plus" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {activos.length > 0 && (
          <View style={[st.summaryCard, { backgroundColor: colors.primaryLight }]}>
            <Text style={[st.summaryLabel, { color: colors.textTertiary }]}>COMPROMETIDO AL MES</Text>
            <Text style={[st.summaryAmount, { color: colors.primary }]}>{fmt(totalMensual)}</Text>
            <Text style={[st.summarySub, { color: colors.textSecondary }]}>{activos.length} gasto{activos.length !== 1 ? 's' : ''} activo{activos.length !== 1 ? 's' : ''}</Text>
          </View>
        )}

        {recurrentes.length === 0 && (
          <View style={st.empty}>
            <Text style={{ fontSize: 48 }}>🔁</Text>
            <Text style={[st.emptyTitle, { color: colors.textPrimary }]}>Sin gastos recurrentes</Text>
            <Text style={[st.emptySub, { color: colors.textTertiary }]}>Registra Netflix, arriendo, servicios… y lleva control de tus compromisos fijos.</Text>
          </View>
        )}

        {activos.length > 0 && <Text style={[st.sectionLabel, { color: colors.textTertiary }]}>ACTIVOS</Text>}
        {activos.map(r => (
          <View key={r.id} style={[st.card, { backgroundColor: colors.card }]}>
            <View style={st.cardRow}>
              <View style={[st.catIcon, { backgroundColor: colors.primaryLight }]}>
                <Icon name={getCategoryIcon(r.categoria)} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[st.cardNombre, { color: colors.textPrimary }]}>{r.nombre}</Text>
                <Text style={[st.cardSub, { color: colors.textSecondary }]}>
                  {fmt(r.monto)} · {FREQ_LABEL[r.frecuencia]}
                  {r.diaPago ? ` · día ${r.diaPago}` : ''}
                </Text>
                <Text style={[st.cardEq, { color: colors.textTertiary }]}>
                  ≈ {fmt(mensualizar(r.monto, r.frecuencia))}/mes
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <Switch value={r.activo} onValueChange={() => toggleRecurrente(r.id)}
                  trackColor={{ false: colors.border, true: colors.primary + '80' }}
                  thumbColor={r.activo ? colors.primary : colors.textTertiary} />
                <TouchableOpacity onPress={() => deleteRecurrente(r.id)}>
                  <Icon name="trash-2" size={15} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {pausados.length > 0 && (
          <>
            <Text style={[st.sectionLabel, { color: colors.textTertiary, marginTop: 20 }]}>PAUSADOS</Text>
            {pausados.map(r => (
              <View key={r.id} style={[st.card, { backgroundColor: colors.card, opacity: 0.6 }]}>
                <View style={st.cardRow}>
                  <View style={[st.catIcon, { backgroundColor: colors.border }]}>
                    <Icon name={getCategoryIcon(r.categoria)} size={18} color={colors.textTertiary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[st.cardNombre, { color: colors.textPrimary }]}>{r.nombre}</Text>
                    <Text style={[st.cardSub, { color: colors.textSecondary }]}>{fmt(r.monto)} · {FREQ_LABEL[r.frecuencia]}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <Switch value={r.activo} onValueChange={() => toggleRecurrente(r.id)}
                      trackColor={{ false: colors.border, true: colors.primary + '80' }}
                      thumbColor={colors.textTertiary} />
                    <TouchableOpacity onPress={() => deleteRecurrente(r.id)}>
                      <Icon name="trash-2" size={15} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <RecurrenteForm visible={showForm} onClose={() => setShowForm(false)} onSave={handleSave} />
    </View>
  );
};

const st = StyleSheet.create({
  screen:        { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { flex: 1, fontSize: 18, fontWeight: '700', marginLeft: 8 },
  addBtn:        { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  summaryCard:   { borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center' },
  summaryLabel:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  summaryAmount: { fontSize: 32, fontWeight: '800', marginTop: 4 },
  summarySub:    { fontSize: 13, marginTop: 4 },
  empty:         { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySub:      { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sectionLabel:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  card:          { borderRadius: 14, padding: 14, marginBottom: 10 },
  cardRow:       { flexDirection: 'row', alignItems: 'center' },
  catIcon:       { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardNombre:    { fontSize: 15, fontWeight: '700' },
  cardSub:       { fontSize: 12, marginTop: 2 },
  cardEq:        { fontSize: 11, marginTop: 2 },
  // Modal
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  handle:        { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:    { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label:         { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  freqChip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, marginRight: 8 },
  freqText:      { fontSize: 13, fontWeight: '600' },
  input:         { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 12 },
  saveBtn:       { paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText:   { color: '#fff', fontSize: 16, fontWeight: '800' },
});
