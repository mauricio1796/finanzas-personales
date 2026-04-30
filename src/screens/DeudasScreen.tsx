import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { calcularAmortizacion } from '../services/ProyeccionService';
import { THEME } from '../constants/theme';
import type { Deuda, PagoDeuda } from '../types';

function fmt(n: number) { return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.'); }

type Estrategia = 'avalancha' | 'bola_de_nieve';

interface DeudaFormProps {
  visible: boolean;
  onClose: () => void;
  onSave: (d: Omit<Deuda, 'id' | 'creadaEn' | 'pagos' | 'saldada'>) => void;
}

const DeudaForm: React.FC<DeudaFormProps> = ({ visible, onClose, onSave }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [nombre, setNombre]     = useState('');
  const [monto, setMonto]       = useState('');
  const [tasa, setTasa]         = useState('');
  const [cuota, setCuota]       = useState('');
  const [dia, setDia]           = useState('');

  const reset = () => { setNombre(''); setMonto(''); setTasa(''); setCuota(''); setDia(''); };

  const handleSave = () => {
    const m = parseInt(monto.replace(/\./g,''), 10);
    const t = parseFloat(tasa.replace(',','.'));
    const c = parseInt(cuota.replace(/\./g,''), 10);
    if (!nombre.trim() || !m || isNaN(t) || !c) return;
    onSave({ nombre: nombre.trim(), montoOriginal: m, saldo: m, tasaMensual: t, cuotaMensual: c, diaPago: dia ? parseInt(dia,10) : undefined });
    reset();
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={st.overlay} onPress={onClose}>
          <Pressable style={[st.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={[st.handle, { backgroundColor: colors.border }]} />
            <Text style={[st.sheetTitle, { color: colors.textPrimary }]}>Nueva Deuda</Text>

            {[
              { label: 'Nombre', value: nombre, onChange: setNombre, placeholder: 'Ej: Tarjeta Visa', keyboard: 'default' as const },
              { label: 'Saldo actual (COP)', value: monto, onChange: (t: string) => { const d = t.replace(/\./g,'').replace(/\D/g,''); const n = parseInt(d,10); setMonto(isNaN(n)?'':n.toLocaleString('es-CO').replace(/,/g,'.')); }, placeholder: '0', keyboard: 'numeric' as const },
              { label: 'Tasa mensual (%)', value: tasa, onChange: setTasa, placeholder: 'Ej: 2.5', keyboard: 'decimal-pad' as const },
              { label: 'Cuota mensual (COP)', value: cuota, onChange: (t: string) => { const d = t.replace(/\./g,'').replace(/\D/g,''); const n = parseInt(d,10); setCuota(isNaN(n)?'':n.toLocaleString('es-CO').replace(/,/g,'.')); }, placeholder: '0', keyboard: 'numeric' as const },
              { label: 'Día de pago (opcional)', value: dia, onChange: setDia, placeholder: 'Ej: 15', keyboard: 'numeric' as const },
            ].map(f => (
              <View key={f.label} style={{ marginBottom: 12 }}>
                <Text style={[st.label, { color: colors.textTertiary }]}>{f.label.toUpperCase()}</Text>
                <TextInput style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder={f.placeholder} placeholderTextColor={colors.textTertiary}
                  keyboardType={f.keyboard} value={f.value} onChangeText={f.onChange} />
              </View>
            ))}

            <TouchableOpacity style={[st.saveBtn, { backgroundColor: colors.expense }]} onPress={handleSave}>
              <Text style={st.saveBtnText}>Agregar Deuda</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface PagoModalProps {
  deuda: Deuda | null;
  onClose: () => void;
  onPagar: (pago: PagoDeuda) => void;
}

const PagoModal: React.FC<PagoModalProps> = ({ deuda, onClose, onPagar }) => {
  const { colors } = useTheme();
  const [monto, setMonto] = useState('');
  if (!deuda) return null;

  const handlePago = () => {
    const m = parseInt(monto.replace(/\./g,''), 10);
    if (!m || m <= 0) return;
    onPagar({ id: Date.now().toString(), monto: m, fecha: new Date().toISOString() });
    setMonto('');
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible={!!deuda} onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={st.overlay} onPress={onClose}>
          <Pressable style={[st.pagoCard, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[st.sheetTitle, { color: colors.textPrimary, marginBottom: 4 }]}>Pagar "{deuda.nombre}"</Text>
            <Text style={[{ color: colors.textTertiary, marginBottom: 16, fontSize: 13 }]}>Saldo: {fmt(deuda.saldo)}</Text>
            <TextInput style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Monto del pago" placeholderTextColor={colors.textTertiary}
              keyboardType="numeric" value={monto}
              onChangeText={t => { const d = t.replace(/\./g,'').replace(/\D/g,''); const n = parseInt(d,10); setMonto(isNaN(n)?'':n.toLocaleString('es-CO').replace(/,/g,'.')); }} />
            <TouchableOpacity style={[st.saveBtn, { backgroundColor: colors.expense }]} onPress={handlePago}>
              <Text style={st.saveBtnText}>Registrar Pago</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface DeudasScreenProps { onBack: () => void; }

export const DeudasScreen: React.FC<DeudasScreenProps> = ({ onBack }) => {
  const insets                                  = useSafeAreaInsets();
  const { colors }                              = useTheme();
  const { deudas, addDeuda, deleteDeuda, pagarDeuda } = useFinance();
  const [showForm, setShowForm]                 = useState(false);
  const [pagoTarget, setPagoTarget]             = useState<Deuda | null>(null);
  const [expandedId, setExpandedId]             = useState<string | null>(null);
  const [estrategia, setEstrategia]             = useState<Estrategia>('avalancha');

  const activas   = deudas.filter(d => !d.saldada);
  const saldadas  = deudas.filter(d => d.saldada);

  const ordenadas = useMemo(() => {
    const copia = [...activas];
    if (estrategia === 'avalancha') copia.sort((a,b) => b.tasaMensual - a.tasaMensual);
    else copia.sort((a,b) => a.saldo - b.saldo);
    return copia;
  }, [activas, estrategia]);

  const totalDeuda = activas.reduce((s, d) => s + d.saldo, 0);

  const handleSave = (data: Omit<Deuda, 'id' | 'creadaEn' | 'pagos' | 'saldada'>) => {
    addDeuda({ ...data, id: Date.now().toString(), pagos: [], saldada: false, creadaEn: new Date().toISOString() });
  };

  return (
    <View style={[st.screen, { backgroundColor: colors.background }]}>
      <View style={[st.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={st.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: colors.textPrimary }]}>Gestor de Deudas</Text>
        <TouchableOpacity onPress={() => setShowForm(true)} style={[st.addBtn, { backgroundColor: colors.expenseLight ?? THEME.colors.expenseLight }]}>
          <Icon name="plus" size={20} color={colors.expense} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* Resumen */}
        {activas.length > 0 && (
          <View style={[st.summaryCard, { backgroundColor: colors.expense + '15', borderColor: colors.expense + '30' }]}>
            <Text style={[st.summaryLabel, { color: colors.textTertiary }]}>DEUDA TOTAL</Text>
            <Text style={[st.summaryAmount, { color: colors.expense }]}>{fmt(totalDeuda)}</Text>
            <Text style={[st.summarySub, { color: colors.textSecondary }]}>{activas.length} deuda{activas.length !== 1 ? 's' : ''} activa{activas.length !== 1 ? 's' : ''}</Text>
          </View>
        )}

        {/* Estrategia toggle */}
        {activas.length > 1 && (
          <View style={[st.toggleRow, { backgroundColor: colors.cardSecondary ?? colors.card }]}>
            {(['avalancha','bola_de_nieve'] as Estrategia[]).map(e => (
              <TouchableOpacity key={e} onPress={() => setEstrategia(e)}
                style={[st.toggleBtn, estrategia === e && { backgroundColor: colors.expense }]}>
                <Text style={[st.toggleText, { color: estrategia === e ? THEME.colors.surface : colors.textSecondary }]}>
                  {e === 'avalancha' ? '⚡ Avalancha' : '❄️ Bola de nieve'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {deudas.length === 0 && (
          <View style={st.empty}>
            <Text style={{ fontSize: 48 }}>💳</Text>
            <Text style={[st.emptyTitle, { color: colors.textPrimary }]}>Sin deudas</Text>
            <Text style={[st.emptySub, { color: colors.textTertiary }]}>Registra tus deudas para hacer seguimiento y organizarte con la estrategia óptima.</Text>
          </View>
        )}

        {ordenadas.map((deuda, idx) => {
          const expanded = expandedId === deuda.id;
          const cuotas   = expanded ? calcularAmortizacion(deuda.saldo, deuda.tasaMensual, deuda.cuotaMensual, 12) : [];
          const pct      = 1 - deuda.saldo / deuda.montoOriginal;
          return (
            <View key={deuda.id} style={[st.card, { backgroundColor: colors.card }]}>
              <View style={st.cardTop}>
                {activas.length > 1 && (
                  <View style={[st.rank, { backgroundColor: colors.expense + '20' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.expense }}>{idx + 1}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: activas.length > 1 ? 10 : 0 }}>
                  <Text style={[st.cardNombre, { color: colors.textPrimary }]}>{deuda.nombre}</Text>
                  <Text style={[st.cardSub, { color: colors.textSecondary }]}>
                    Saldo: {fmt(deuda.saldo)} · Tasa: {deuda.tasaMensual}%/mes
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => setExpandedId(expanded ? null : deuda.id)} style={st.iconBtn}>
                    <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteDeuda(deuda.id)} style={st.iconBtn}>
                    <Icon name="trash-2" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[st.barBg, { backgroundColor: colors.border }]}>
                <View style={[st.barFill, { width: `${Math.max(pct * 100, 2)}%` as any, backgroundColor: THEME.colors.income }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>{Math.round(pct * 100)}% pagado</Text>
                <TouchableOpacity onPress={() => setPagoTarget(deuda)} style={[st.pagoBtn, { backgroundColor: colors.expense }]}>
                  <Text style={st.pagoBtnText}>Pagar cuota</Text>
                </TouchableOpacity>
              </View>

              {expanded && cuotas.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={[st.label, { color: colors.textTertiary, marginBottom: 8 }]}>PRÓXIMOS 12 MESES</Text>
                  <View style={[st.tableHeader, { backgroundColor: colors.cardSecondary ?? colors.border + '40' }]}>
                    {['Mes','Cuota','Capital','Interés','Saldo'].map(h => (
                      <Text key={h} style={[st.tableCell, { color: colors.textTertiary }]}>{h}</Text>
                    ))}
                  </View>
                  {cuotas.map(r => (
                    <View key={r.mes} style={[st.tableRow, { borderBottomColor: colors.border }]}>
                      <Text style={[st.tableCell, { color: colors.textSecondary }]}>{r.mes}</Text>
                      <Text style={[st.tableCell, { color: colors.textPrimary }]}>{fmt(r.cuota)}</Text>
                      <Text style={[st.tableCell, { color: THEME.colors.income }]}>{fmt(r.capital)}</Text>
                      <Text style={[st.tableCell, { color: colors.expense }]}>{fmt(r.interes)}</Text>
                      <Text style={[st.tableCell, { color: colors.textSecondary }]}>{fmt(r.saldo)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {saldadas.length > 0 && (
          <>
            <Text style={[st.label, { color: colors.textTertiary, marginTop: 24, marginBottom: 12 }]}>SALDADAS</Text>
            {saldadas.map(d => (
              <View key={d.id} style={[st.card, { backgroundColor: colors.card, opacity: 0.6 }]}>
                <View style={st.cardTop}>
                  <Icon name="check-circle" size={20} color={THEME.colors.income} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[st.cardNombre, { color: colors.textPrimary }]}>{d.nombre} ✓</Text>
                    <Text style={[st.cardSub, { color: THEME.colors.income }]}>Pagado {fmt(d.montoOriginal)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteDeuda(d.id)} style={st.iconBtn}>
                    <Icon name="trash-2" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <DeudaForm visible={showForm} onClose={() => setShowForm(false)} onSave={handleSave} />
      <PagoModal deuda={pagoTarget} onClose={() => setPagoTarget(null)}
        onPagar={p => pagoTarget && pagarDeuda(pagoTarget.id, p)} />
    </View>
  );
};

const st = StyleSheet.create({
  screen:         { flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { flex: 1, fontSize: 18, fontWeight: '700', marginLeft: 8 },
  addBtn:         { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  summaryCard:    { borderRadius: THEME.radius.lg, padding: 20, marginBottom: 20, borderWidth: 1, alignItems: 'center' },
  summaryLabel:   { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  summaryAmount:  { fontSize: 32, fontWeight: '800', marginTop: 4 },
  summarySub:     { fontSize: 13, marginTop: 4 },
  toggleRow:      { flexDirection: 'row', borderRadius: THEME.radius.md, padding: 4, marginBottom: 20, gap: 4 },
  toggleBtn:      { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  toggleText:     { fontSize: 13, fontWeight: '700' },
  empty:          { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySub:       { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card:           { borderRadius: THEME.radius.lg, padding: 16, marginBottom: 14 },
  cardTop:        { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rank:           { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardNombre:     { fontSize: 15, fontWeight: '700' },
  cardSub:        { fontSize: 12, marginTop: 2 },
  iconBtn:        { padding: 6 },
  barBg:          { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill:        { height: '100%', borderRadius: 3 },
  pagoBtn:        { paddingHorizontal: 16, paddingVertical: 7, borderRadius: THEME.radius.lg },
  pagoBtnText:    { color: THEME.colors.surface, fontSize: 13, fontWeight: '700' },
  tableHeader:    { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4, borderRadius: THEME.radius.sm, marginBottom: 4 },
  tableRow:       { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1 },
  tableCell:      { flex: 1, fontSize: 11, textAlign: 'center' },
  // Modal
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:          { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  handle:         { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:     { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label:          { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  input:          { borderWidth: 1, borderRadius: THEME.radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  saveBtn:        { paddingVertical: 15, borderRadius: THEME.radius.lg, alignItems: 'center', marginTop: 8 },
  saveBtnText:    { color: THEME.colors.surface, fontSize: 16, fontWeight: '800' },
  pagoCard:       { margin: 24, borderRadius: THEME.radius.lg, padding: 24 },
});
