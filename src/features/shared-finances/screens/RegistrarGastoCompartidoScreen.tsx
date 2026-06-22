import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../state/ThemeContext';
import { Icon } from '../../../components/ui/Icon';
import { registrarGastoCompartido } from '../services/SharedExpenseService';
import type { SharedExpense } from '../types';

const CATEGORIAS_COMUNES = [
  { nombre: 'Alimentación', icono: '🛒' },
  { nombre: 'Vivienda',     icono: '🏠' },
  { nombre: 'Transporte',   icono: '🚌' },
  { nombre: 'Servicios',    icono: '⚡' },
  { nombre: 'Salud',        icono: '❤️' },
  { nombre: 'Entretenimiento', icono: '🎬' },
  { nombre: 'Restaurantes', icono: '🍽️' },
  { nombre: 'Mercado',      icono: '🛍️' },
  { nombre: 'Otro',         icono: '📦' },
];

function hoy(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatCOP(valor: string): string {
  const num = valor.replace(/\D/g, '');
  if (!num) return '';
  return Number(num).toLocaleString('es-CO');
}

interface Props {
  spaceId: string;
  onGastoRegistrado: (gasto: SharedExpense) => void;
  onCancelar: () => void;
}

export const RegistrarGastoCompartidoScreen: React.FC<Props> = ({
  spaceId, onGastoRegistrado, onCancelar,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [monto, setMonto]             = useState('');
  const [categoria, setCategoria]     = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha]             = useState(hoy());
  const [cargando, setCargando]       = useState(false);

  const montoNumerico = Number(monto.replace(/\D/g, ''));

  const handleGuardar = async () => {
    if (!montoNumerico || montoNumerico <= 0) {
      Alert.alert('Monto requerido', 'Ingresa un monto mayor a $0.');
      return;
    }
    if (!categoria) {
      Alert.alert('Categoría requerida', 'Selecciona una categoría.');
      return;
    }
    try {
      setCargando(true);
      const gasto = await registrarGastoCompartido({
        spaceId,
        amount: montoNumerico,
        category: categoria,
        description: descripcion.trim() || undefined,
        date: fecha,
      });
      onGastoRegistrado(gasto);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo registrar el gasto.');
    } finally {
      setCargando(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[s.container, { paddingTop: insets.top + 16 }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onCancelar} style={s.backBtn}>
            <Icon name="x" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={s.titulo}>Nuevo gasto compartido</Text>
        </View>

        {/* Badge compartido */}
        <View style={[s.sharedBadge, { backgroundColor: colors.primaryLight }]}>
          <Icon name="users" size={14} color={colors.primary} />
          <Text style={[s.sharedText, { color: colors.primaryText }]}>
            Este gasto se divide 50/50 automáticamente
          </Text>
        </View>

        {/* Monto */}
        <Text style={[s.label, { color: colors.textTertiary }]}>MONTO TOTAL</Text>
        <View style={[s.montoContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Text style={[s.montoPrefix, { color: colors.textSecondary }]}>$</Text>
          <TextInput
            style={[s.montoInput, { color: colors.textPrimary }]}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={monto}
            onChangeText={t => setMonto(formatCOP(t))}
            returnKeyType="next"
          />
          <Text style={[s.montoSufijo, { color: colors.textTertiary }]}>COP</Text>
        </View>

        {montoNumerico > 0 && (
          <Text style={[s.splitHint, { color: colors.textSecondary }]}>
            Cada uno paga: ${Math.round(montoNumerico / 2).toLocaleString('es-CO')}
          </Text>
        )}

        {/* Categoría */}
        <Text style={[s.label, { color: colors.textTertiary }]}>CATEGORÍA</Text>
        <View style={s.categoriasGrid}>
          {CATEGORIAS_COMUNES.map(cat => (
            <TouchableOpacity
              key={cat.nombre}
              onPress={() => setCategoria(cat.nombre)}
              style={[
                s.categoriaChip,
                {
                  backgroundColor: categoria === cat.nombre ? colors.primary : colors.card,
                  borderColor: categoria === cat.nombre ? colors.primary : colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={s.categoriaEmoji}>{cat.icono}</Text>
              <Text style={[s.categoriaTexto, { color: categoria === cat.nombre ? '#fff' : colors.textPrimary }]}>
                {cat.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Descripción */}
        <Text style={[s.label, { color: colors.textTertiary }]}>DESCRIPCIÓN (opcional)</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
          placeholder="Ej: Mercado del fin de semana"
          placeholderTextColor={colors.textTertiary}
          value={descripcion}
          onChangeText={setDescripcion}
          maxLength={100}
        />

        {/* Fecha */}
        <Text style={[s.label, { color: colors.textTertiary }]}>FECHA</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
          value={fecha}
          onChangeText={setFecha}
          maxLength={10}
        />

        <TouchableOpacity
          style={[s.btnGuardar, { backgroundColor: colors.primary, opacity: cargando ? 0.7 : 1 }]}
          onPress={handleGuardar}
          disabled={cargando}
          activeOpacity={0.8}
        >
          {cargando
            ? <ActivityIndicator color="#fff" />
            : <>
                <Icon name="check" size={18} color="#fff" />
                <Text style={s.btnTexto}>Registrar gasto</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { padding: 8, marginRight: 8 },
  titulo: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  sharedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    alignSelf: 'flex-start', marginBottom: 24,
  },
  sharedText: { fontSize: 13, fontWeight: '600' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  montoContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, marginBottom: 8,
  },
  montoPrefix: { fontSize: 22, fontWeight: '700', marginRight: 4 },
  montoInput: { flex: 1, fontSize: 28, fontWeight: '800', paddingVertical: 14 },
  montoSufijo: { fontSize: 14 },
  splitHint: { fontSize: 13, marginBottom: 20, textAlign: 'center' },
  categoriasGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24,
  },
  categoriaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  categoriaEmoji: { fontSize: 16 },
  categoriaTexto: { fontSize: 13, fontWeight: '500' },
  input: {
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, marginBottom: 20,
  },
  btnGuardar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 16, paddingVertical: 16, marginTop: 8,
  },
  btnTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
