import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Animated, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Category } from '../../types';
import { THEME } from '../../constants/theme';

const COLORES = ['#F87171','#34D399','#818CF8','#FBBF24','#38BDF8','#A78BFA','#FB923C','#4ADE80','#F472B6','#2DD4BF'];
const EMOJIS = ['🏠','🚗','🍔','💡','📱','💊','🎓','👗','🎉','💳','🐾','💰','🎮','📚','🏋️','🎵','🎬','🛒','🔐','🏦','🚌','💧','🗂️'];

interface Props { visible: boolean; editing?: Category; existingCount: number; onClose: () => void; onSave: (cat: Category) => void; }

export const ModalCategoria: React.FC<Props> = ({ visible, editing, existingCount, onClose, onSave }) => {
  const [nombre, setNombre] = useState('');
  const [presupuesto, setPresupuesto] = useState('');
  const [tipo, setTipo] = useState<'fijo' | 'variable'>('fijo');
  const [emoji, setEmoji] = useState('🏠');
  const [diaPago, setDiaPago] = useState('');
  const [error, setError] = useState('');
  const slideAnim = useRef(new Animated.Value(500)).current;
  useEffect(() => {
    if (visible) {
      if (editing) {
        setNombre(editing.name);
        setPresupuesto(String(editing.budget ?? ""));
        setTipo((editing.tipo as any) ?? "fijo");
        setEmoji(editing.icon ?? "🏠");
        setDiaPago(editing.diaPago ? String(editing.diaPago) : "");
      } else {
        setNombre(""); setPresupuesto(""); setTipo("fijo"); setEmoji("🏠"); setDiaPago("");
      }
      setError("");
      Keyboard.dismiss();
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 500, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible, editing]);

  const formatInput = (val: string) => {
    const num = val.replace(/[^0-9]/g, "");
    return num ? parseInt(num, 10).toLocaleString("es-CO").replace(/,/g, ".") : "";
  };
  const parseAmount = (val: string) => parseInt(val.replace(/[^0-9]/g, ""), 10) || 0;
  const handleSave = () => {
    if (!nombre.trim()) { setError("El nombre es requerido"); return; }
    if (nombre.length > 30) { setError("Maximo 30 caracteres"); return; }
    const monto = parseAmount(presupuesto);
    if (monto <= 0) { setError("Ingresa un monto valido"); return; }
    const dia = parseInt(diaPago, 10);
    const autoColor = COLORES[existingCount % COLORES.length];
    const cat: Category = {
      id: editing?.id ?? Date.now().toString(),
      name: nombre.trim(),
      icon: emoji,
      color: editing?.color ?? autoColor,
      budget: monto,
      pagado: editing?.pagado ?? false,
      tipo: tipo,
      diaPago: dia >= 1 && dia <= 28 ? dia : undefined,
      fechaCreacion: editing?.fechaCreacion ?? new Date().toISOString(),
    };
    onSave(cat);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.kavWrap} pointerEvents="box-none">
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.handle} />
          <View style={s.hdr}>
            <Text style={s.title}>{editing ? "Editar categoria" : "Nueva categoria"}</Text>
            <TouchableOpacity onPress={onClose}><Text style={s.cancel}>Cancelar</Text></TouchableOpacity>
          </View>
          <ScrollView style={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Text style={s.fieldLabel}>Nombre del gasto</Text>
            <TextInput style={[s.input, Platform.OS === 'web' && ({ outline: 'none' } as any)]} placeholder="Ej: Gimnasio, Netflix..." placeholderTextColor={THEME.colors.textTertiary} value={nombre} onChangeText={t => { setNombre(t); setError(""); }} maxLength={30} />
            <Text style={s.fieldLabel}>Presupuesto mensual (COP)</Text>
            <View style={s.amountRow}>
              <Text style={s.currencySign}>$</Text>
              <TextInput style={[s.input, s.amountInput, Platform.OS === 'web' && ({ outline: 'none' } as any)]} keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} placeholder="0" placeholderTextColor={THEME.colors.textTertiary} value={presupuesto} onChangeText={t => setPresupuesto(formatInput(t))} />
            </View>
            <Text style={s.fieldLabel}>Tipo de gasto</Text>
            <View style={s.tipoRow}>
              <TouchableOpacity style={[s.tipoBtn, tipo === "fijo" && s.tipoBtnActive]} onPress={() => setTipo("fijo")} activeOpacity={0.8}>
                <Text style={s.tipoEmoji}>📌</Text><Text style={[s.tipoText, tipo === "fijo" && s.tipoTextActive]}>Fijo</Text>
                <Text style={[s.tipoSub, tipo === "fijo" && s.tipoSubActive]}>Arriendo, servicios</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.tipoBtn, tipo === "variable" && s.tipoBtnActive]} onPress={() => setTipo("variable")} activeOpacity={0.8}>
                <Text style={s.tipoEmoji}>📊</Text><Text style={[s.tipoText, tipo === "variable" && s.tipoTextActive]}>Variable</Text>
                <Text style={[s.tipoSub, tipo === "variable" && s.tipoSubActive]}>Comida, entretenimiento</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.fieldLabel}>Icono</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.emojiScroll}>
              {EMOJIS.map(e => (<TouchableOpacity key={e} style={[s.emojiBtn, emoji === e && s.emojiBtnActive]} onPress={() => setEmoji(e)} activeOpacity={0.7}><Text style={s.emojiChar}>{e}</Text></TouchableOpacity>))}
            </ScrollView>
            <Text style={s.fieldLabel}>Dia de pago (opcional, 1-28)</Text>
            <TextInput style={[s.input, Platform.OS === 'web' && ({ outline: 'none' } as any)]} keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} placeholder="Sin fecha fija" placeholderTextColor={THEME.colors.textTertiary} value={diaPago} onChangeText={t => { const v = t.replace(/[^0-9]/g,""); setDiaPago(v.length > 2 ? v.slice(0,2) : v); }} maxLength={2} />
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={s.saveBtnText}>Guardar categoria</Text>
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  kavWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: THEME.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" as any },
  handle: { width: 36, height: 4, backgroundColor: THEME.colors.border, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  hdr: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: THEME.colors.surfaceSecondary },
  title: { fontSize: 17, fontWeight: "700", color: THEME.colors.textPrimary },
  cancel: { fontSize: 15, color: THEME.colors.primary, fontWeight: "600" },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: THEME.colors.textTertiary, letterSpacing: 0.8, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: THEME.colors.background, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: THEME.colors.textPrimary },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  currencySign: { fontSize: 18, fontWeight: "700", color: THEME.colors.textPrimary },
  amountInput: { flex: 1 },
  tipoRow: { flexDirection: "row", gap: 10 },
  tipoBtn: { flex: 1, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: THEME.radius.md, padding: 12, alignItems: "center", gap: 4 },
  tipoBtnActive: { borderColor: THEME.colors.primary, backgroundColor: THEME.colors.primaryLight },
  tipoEmoji: { fontSize: 20 },
  tipoText: { fontSize: 14, fontWeight: "700", color: THEME.colors.textSecondary },
  tipoTextActive: { color: THEME.colors.primary },
  tipoSub: { fontSize: 10, color: THEME.colors.textTertiary, textAlign: "center" },
  tipoSubActive: { color: THEME.colors.primary },
  emojiScroll: { marginBottom: 4 },
  emojiBtn: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 8, backgroundColor: THEME.colors.surfaceSecondary },
  emojiBtnActive: { backgroundColor: THEME.colors.primaryLight, borderWidth: 2, borderColor: THEME.colors.primary },
  emojiChar: { fontSize: 22 },
  saveBtn: { backgroundColor: THEME.colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  saveBtnText: { color: THEME.colors.surface, fontSize: 16, fontWeight: "700" },
  error: { color: THEME.colors.expense, fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 4 },
});