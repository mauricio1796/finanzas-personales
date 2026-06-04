import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import type { Meta } from '../types';
import { THEME } from '../constants/theme';

const EMOJIS = ['🎯','🏠','✈️','🚗','💍','📚','💻','🏋️','🌴','💰','🎓','🎮'];
const COLORS  = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316'];

function fmt(n: number) { return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.'); }

interface MetaFormProps {
  visible: boolean;
  onClose: () => void;
  onSave: (meta: Omit<Meta, 'id' | 'creadaEn' | 'completada' | 'montoActual'>) => void;
}

const MetaForm: React.FC<MetaFormProps> = ({ visible, onClose, onSave }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [nombre, setNombre]         = useState('');
  const [objetivo, setObjetivo]     = useState('');
  const [emoji, setEmoji]           = useState('🎯');
  const [color, setColor]           = useState('#6366F1');
  const [fecha, setFecha]           = useState('');

  const reset = () => { setNombre(''); setObjetivo(''); setEmoji('🎯'); setColor('#6366F1'); setFecha(''); };

  const handleSave = () => {
    const monto = parseInt(objetivo.replace(/\./g, ''), 10);
    if (!nombre.trim() || !monto) return;
    onSave({ nombre: nombre.trim(), montoObjetivo: monto, emoji, color, fechaLimite: fecha || undefined });
    reset();
    onClose();
  };

  return (
    <Modal testID="meta-form-modal" transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={st.overlay} onPress={onClose}>
          <Pressable style={[st.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={[st.handle, { backgroundColor: colors.border }]} />
            <Text style={[st.sheetTitle, { color: colors.textPrimary }]}>Nueva Meta</Text>

            <Text style={[st.label, { color: colors.textTertiary }]}>EMOJI</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {EMOJIS.map(e => (
                <TouchableOpacity key={e} onPress={() => setEmoji(e)}
                  style={[st.emojiBtn, emoji === e && { borderColor: color, borderWidth: 2 }]}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[st.label, { color: colors.textTertiary }]}>COLOR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => setColor(c)}
                  style={[st.colorDot, { backgroundColor: c }, color === c && st.colorDotActive]} />
              ))}
            </ScrollView>

            <TextInput testID="meta-title-input" style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Nombre de la meta" placeholderTextColor={colors.textTertiary}
              value={nombre} onChangeText={setNombre} />

            <TextInput testID="meta-target-input" style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Monto objetivo (COP)" placeholderTextColor={colors.textTertiary}
              keyboardType="numeric" value={objetivo}
              onChangeText={t => { const d = t.replace(/\./g,'').replace(/\D/g,''); const n = parseInt(d,10); setObjetivo(isNaN(n)?'':n.toLocaleString('es-CO').replace(/,/g,'.')); }} />

            <TextInput testID="meta-deadline-input" style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Fecha límite (AAAA-MM-DD, opcional)" placeholderTextColor={colors.textTertiary}
              value={fecha} onChangeText={setFecha} />

            <TouchableOpacity testID="meta-save-btn" style={[st.saveBtn, { backgroundColor: color }]} onPress={handleSave}>
              <Text style={st.saveBtnText}>Crear Meta</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface AbonoModalProps {
  meta: Meta | null;
  onClose: () => void;
  onAbono: (monto: number) => void;
}

const AbonoModal: React.FC<AbonoModalProps> = ({ meta, onClose, onAbono }) => {
  const { colors } = useTheme();
  const [monto, setMonto] = useState('');
  if (!meta) return null;

  const handleAbono = () => {
    const m = parseInt(monto.replace(/\./g,''), 10);
    if (!m || m <= 0) return;
    onAbono(m);
    setMonto('');
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible={!!meta} onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={st.overlay} onPress={onClose}>
          <Pressable style={[st.abonoCard, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>{meta.emoji}</Text>
            <Text style={[st.abonoTitle, { color: colors.textPrimary }]}>Abonar a "{meta.nombre}"</Text>
            <Text style={[st.abonoSub, { color: colors.textTertiary }]}>
              {fmt(meta.montoActual)} de {fmt(meta.montoObjetivo)}
            </Text>
            <TextInput style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary, marginTop: 16 }]}
              placeholder="Monto a abonar" placeholderTextColor={colors.textTertiary}
              keyboardType="numeric" value={monto}
              onChangeText={t => { const d = t.replace(/\./g,'').replace(/\D/g,''); const n = parseInt(d,10); setMonto(isNaN(n)?'':n.toLocaleString('es-CO').replace(/,/g,'.')); }} />
            <TouchableOpacity style={[st.saveBtn, { backgroundColor: meta.color }]} onPress={handleAbono}>
              <Text style={st.saveBtnText}>Abonar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface MetasScreenProps { onBack: () => void; }

export const MetasScreen: React.FC<MetasScreenProps> = ({ onBack }) => {
  const insets                                        = useSafeAreaInsets();
  const { colors }                                    = useTheme();
  const { metas, addMeta, deleteMeta, abonarMeta }    = useFinance();
  const [showForm, setShowForm]                       = useState(false);
  const [abonoTarget, setAbonoTarget]                 = useState<Meta | null>(null);

  const handleSave = (data: Omit<Meta, 'id' | 'creadaEn' | 'completada' | 'montoActual'>) => {
    addMeta({
      ...data,
      id: Date.now().toString(),
      montoActual: 0,
      completada: false,
      creadaEn: new Date().toISOString(),
    });
  };

  const activas    = metas.filter(m => !m.completada);
  const completadas = metas.filter(m => m.completada);

  return (
    <View testID="metas-screen" style={[st.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[st.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={st.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: colors.textPrimary }]}>Mis Metas</Text>
        <TouchableOpacity testID="metas-add-btn" onPress={() => setShowForm(true)} style={[st.addBtn, { backgroundColor: colors.primaryLight }]}>
          <Icon name="plus" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {metas.length === 0 && (
          <View style={st.empty}>
            <Text style={{ fontSize: 48 }}>🎯</Text>
            <Text style={[st.emptyTitle, { color: colors.textPrimary }]}>Sin metas aún</Text>
            <Text style={[st.emptySub, { color: colors.textTertiary }]}>Crea tu primera meta financiera y comienza a ahorrar con propósito.</Text>
          </View>
        )}

        {activas.length > 0 && (
          <>
            <Text style={[st.sectionLabel, { color: colors.textTertiary }]}>EN PROGRESO</Text>
            {activas.map(meta => {
              const pct = Math.min(meta.montoActual / meta.montoObjetivo, 1);
              return (
                <View key={meta.id} style={[st.card, { backgroundColor: colors.card }]}>
                  <View style={st.cardTop}>
                    <View style={[st.cardEmoji, { backgroundColor: meta.color + '20' }]}>
                      <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[st.cardNombre, { color: colors.textPrimary }]}>{meta.nombre}</Text>
                      <Text style={[st.cardMonto, { color: colors.textSecondary }]}>
                        {fmt(meta.montoActual)} / {fmt(meta.montoObjetivo)}
                      </Text>
                      {meta.fechaLimite && (
                        <Text style={[st.cardFecha, { color: colors.textTertiary }]}>
                          Límite: {meta.fechaLimite}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => deleteMeta(meta.id)} style={st.deleteBtn}>
                      <Icon name="trash-2" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  <View style={[st.barBg, { backgroundColor: colors.border }]}>
                    <View style={[st.barFill, { width: `${pct * 100}%` as any, backgroundColor: meta.color }]} />
                  </View>
                  <View style={st.cardBottom}>
                    <Text style={[st.pctText, { color: meta.color }]}>{Math.round(pct * 100)}%</Text>
                    <TouchableOpacity onPress={() => setAbonoTarget(meta)} style={[st.abonoBtn, { backgroundColor: meta.color }]}>
                      <Text style={st.abonoBtnText}>+ Abonar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {completadas.length > 0 && (
          <>
            <Text style={[st.sectionLabel, { color: colors.textTertiary, marginTop: 24 }]}>COMPLETADAS</Text>
            {completadas.map(meta => (
              <View key={meta.id} style={[st.card, { backgroundColor: colors.card, opacity: 0.7 }]}>
                <View style={st.cardTop}>
                  <View style={[st.cardEmoji, { backgroundColor: colors.incomeLight }]}>
                    <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[st.cardNombre, { color: colors.textPrimary }]}>{meta.nombre} ✓</Text>
                    <Text style={[st.cardMonto, { color: colors.income }]}>{fmt(meta.montoObjetivo)} alcanzado</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteMeta(meta.id)} style={st.deleteBtn}>
                    <Icon name="trash-2" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <MetaForm visible={showForm} onClose={() => setShowForm(false)} onSave={handleSave} />
      <AbonoModal meta={abonoTarget} onClose={() => setAbonoTarget(null)}
        onAbono={m => abonoTarget && abonarMeta(abonoTarget.id, m)} />
    </View>
  );
};

const st = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: '700', marginLeft: 8 },
  addBtn:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty:        { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySub:     { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  card:         { borderRadius: 16, padding: 16, marginBottom: 14 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardEmoji:    { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardNombre:   { fontSize: 15, fontWeight: '700' },
  cardMonto:    { fontSize: 13, marginTop: 2 },
  cardFecha:    { fontSize: 11, marginTop: 2 },
  deleteBtn:    { padding: 8 },
  barBg:        { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  barFill:      { height: '100%', borderRadius: 3 },
  cardBottom:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pctText:      { fontSize: 13, fontWeight: '700' },
  abonoBtn:     { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  abonoBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  // Sheet
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:   { fontSize: 18, fontWeight: '800', marginBottom: 20 },
  label:        { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  emojiBtn:     { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  colorDot:     { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.15 }] },
  input:        { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 12 },
  saveBtn:      { paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText:  { color: '#fff', fontSize: 16, fontWeight: '800' },
  // Abono
  abonoCard:    { margin: 24, borderRadius: 20, padding: 24 },
  abonoTitle:   { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  abonoSub:     { fontSize: 13, textAlign: 'center' },
});
