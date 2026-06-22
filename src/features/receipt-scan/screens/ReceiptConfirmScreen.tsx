import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/state/ThemeContext';
import { Icon } from '@/src/components/ui/Icon';
import { useFinance } from '@/src/core/context/FinanceContext';
import type { ReceiptScanResult, ReceiptConfirmData } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(valor: string): string {
  const num = valor.replace(/\./g, '').replace(/[^0-9]/g, '');
  if (!num) return '';
  return Number(num).toLocaleString('es-CO').replace(/,/g, '.');
}

function parseCOP(valor: string): number {
  return parseInt(valor.replace(/\./g, '').replace(/[^0-9]/g, ''), 10) || 0;
}

function isoToDisplay(iso: string | null): string {
  if (!iso) return '';
  // YYYY-MM-DD → DD/MM/YYYY
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function displayToDate(display: string): Date | null {
  // DD/MM/YYYY → Date
  const parts = display.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y || y < 2000 || y > 2100) return null;
  return new Date(y, m - 1, d);
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  resultado:  ReceiptScanResult;
  onConfirmar: (data: ReceiptConfirmData) => void;
  onCancelar:  () => void;
  guardando:   boolean;
}

export const ReceiptConfirmScreen: React.FC<Props> = ({
  resultado, onConfirmar, onCancelar, guardando,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { categories } = useFinance();

  // Solo categorías raíz de tipo gasto
  const categoriasGasto = useMemo(
    () => categories.filter(c => !c.parentCategoryId && c.tipo !== 'ingreso'),
    [categories],
  );

  // Subcategorías de la categoría seleccionada
  const [monto,       setMonto]       = useState(
    resultado.monto ? formatCOP(String(Math.round(resultado.monto))) : '',
  );
  const [fecha,       setFecha]       = useState(isoToDisplay(resultado.fecha));
  const [comercio,    setComercio]    = useState(resultado.comercio ?? '');
  const [categoria,   setCategoria]   = useState(() => {
    // Busca si la sugerida del modelo coincide exactamente con una del usuario
    const match = categoriasGasto.find(
      c => c.name.toLowerCase() === (resultado.categoria_sugerida ?? '').toLowerCase(),
    );
    return match?.name ?? (categoriasGasto[0]?.name ?? '');
  });
  const [descripcion, setDescripcion] = useState(resultado.comercio ?? '');

  const subcategorias = useMemo(
    () => {
      const padre = categories.find(c => c.name === categoria && !c.parentCategoryId);
      if (!padre) return [];
      return categories.filter(c => c.parentCategoryId === padre.id);
    },
    [categories, categoria],
  );
  const [subcategoria, setSubcategoria] = useState('');

  const confianzaBaja = resultado.confianza < 0.65;

  const handleConfirmar = () => {
    const montoNum = parseCOP(monto);
    if (!montoNum || montoNum <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a $0.');
      return;
    }
    if (!categoria) {
      Alert.alert('Categoría requerida', 'Selecciona una categoría.');
      return;
    }
    const fechaDate = displayToDate(fecha) ?? new Date();

    onConfirmar({
      monto:       montoNum,
      fecha:       fechaDate,
      comercio:    comercio.trim(),
      categoria,
      subcategoria: subcategoria || undefined,
      descripcion:  descripcion.trim() || undefined,
    });
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
          <TouchableOpacity onPress={onCancelar} style={s.backBtn} disabled={guardando}>
            <Icon name="x" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[s.titulo, { color: colors.textPrimary }]}>Confirmar recibo</Text>
        </View>

        {/* Alerta de confianza baja */}
        {confianzaBaja && (
          <View style={[s.alertaBaja, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
            <Icon name="alert-triangle" size={16} color={colors.warning} />
            <Text style={[s.alertaTxt, { color: colors.warningText }]}>
              El recibo no se leyó con claridad. Revisa los datos antes de guardar.
            </Text>
          </View>
        )}

        {/* Nota del modelo */}
        {resultado.nota && (
          <View style={[s.nota, { backgroundColor: colors.aiLight }]}>
            <Icon name="info" size={14} color={colors.ai} />
            <Text style={[s.notaTxt, { color: colors.aiText }]}>{resultado.nota}</Text>
          </View>
        )}

        {/* Indicador de confianza */}
        <View style={[s.confianzaBar, { backgroundColor: colors.card }]}>
          <Text style={[s.confianzaLabel, { color: colors.textTertiary }]}>
            Confianza de lectura
          </Text>
          <View style={[s.barTrack, { backgroundColor: colors.border }]}>
            <View style={[
              s.barFill,
              {
                width: `${Math.round(resultado.confianza * 100)}%` as any,
                backgroundColor: resultado.confianza >= 0.75
                  ? colors.income
                  : resultado.confianza >= 0.5
                    ? colors.warning
                    : colors.expense,
              },
            ]} />
          </View>
          <Text style={[s.confianzaPct, { color: colors.textSecondary }]}>
            {Math.round(resultado.confianza * 100)}%
          </Text>
        </View>

        {/* ── Campos editables ── */}

        {/* Monto */}
        <Text style={[s.label, { color: colors.textTertiary }]}>MONTO TOTAL</Text>
        <View style={[s.montoRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Text style={[s.montoSimbolo, { color: colors.textSecondary }]}>$</Text>
          <TextInput
            style={[s.montoInput, { color: colors.textPrimary }]}
            keyboardType="numeric"
            value={monto}
            onChangeText={t => setMonto(formatCOP(t))}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={[s.montoSufijo, { color: colors.textTertiary }]}>COP</Text>
        </View>

        {/* Fecha */}
        <Text style={[s.label, { color: colors.textTertiary }]}>FECHA</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
          placeholder="DD/MM/AAAA"
          placeholderTextColor={colors.textTertiary}
          value={fecha}
          onChangeText={setFecha}
          keyboardType="numeric"
          maxLength={10}
        />

        {/* Comercio */}
        <Text style={[s.label, { color: colors.textTertiary }]}>COMERCIO / ESTABLECIMIENTO</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
          placeholder="Ej: Éxito, Rappi, Claro..."
          placeholderTextColor={colors.textTertiary}
          value={comercio}
          onChangeText={setComercio}
          maxLength={80}
        />

        {/* Categoría */}
        <Text style={[s.label, { color: colors.textTertiary }]}>CATEGORÍA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={s.chipsRow}>
            {categoriasGasto.map(cat => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => { setCategoria(cat.name); setSubcategoria(''); }}
                style={[
                  s.chip,
                  {
                    backgroundColor: categoria === cat.name ? colors.primary : colors.card,
                    borderColor:     categoria === cat.name ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[s.chipTxt, { color: categoria === cat.name ? '#fff' : colors.textPrimary }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Subcategoría (opcional) */}
        {subcategorias.length > 0 && (
          <>
            <Text style={[s.label, { color: colors.textTertiary }]}>SUBCATEGORÍA (opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={s.chipsRow}>
                <TouchableOpacity
                  onPress={() => setSubcategoria('')}
                  style={[
                    s.chip,
                    {
                      backgroundColor: !subcategoria ? colors.cardSecondary : colors.card,
                      borderColor:     !subcategoria ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[s.chipTxt, { color: colors.textSecondary }]}>Ninguna</Text>
                </TouchableOpacity>
                {subcategorias.map(sub => (
                  <TouchableOpacity
                    key={sub.id}
                    onPress={() => setSubcategoria(sub.id)}
                    style={[
                      s.chip,
                      {
                        backgroundColor: subcategoria === sub.id ? colors.primary : colors.card,
                        borderColor:     subcategoria === sub.id ? colors.primary : colors.border,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipTxt, { color: subcategoria === sub.id ? '#fff' : colors.textPrimary }]}>
                      {sub.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        {/* Descripción */}
        <Text style={[s.label, { color: colors.textTertiary }]}>DESCRIPCIÓN (opcional)</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
          placeholder="Agrega un detalle..."
          placeholderTextColor={colors.textTertiary}
          value={descripcion}
          onChangeText={setDescripcion}
          maxLength={120}
        />

        {/* Botones */}
        <TouchableOpacity
          style={[s.btnPrimario, { backgroundColor: colors.primary, opacity: guardando ? 0.7 : 1 }]}
          onPress={handleConfirmar}
          disabled={guardando}
          activeOpacity={0.85}
        >
          <Icon name={guardando ? 'loader' : 'check'} size={18} color="#fff" />
          <Text style={s.btnPrimarioTxt}>
            {guardando ? 'Guardando...' : 'Confirmar y registrar gasto'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btnSecundario, { borderColor: colors.border }]}
          onPress={onCancelar}
          disabled={guardando}
          activeOpacity={0.7}
        >
          <Text style={[s.btnSecundarioTxt, { color: colors.textSecondary }]}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  header:       { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn:      { padding: 8, marginRight: 8 },
  titulo:       { fontSize: 20, fontWeight: '700' },
  alertaBaja:   {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12,
  },
  alertaTxt:    { flex: 1, fontSize: 13, lineHeight: 18 },
  nota:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, padding: 10, marginBottom: 12 },
  notaTxt:      { flex: 1, fontSize: 13 },
  confianzaBar: { borderRadius: 14, padding: 14, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  confianzaLabel:{ fontSize: 12, color: '#888', flex: 1 },
  barTrack:     { height: 6, borderRadius: 3, width: 80, overflow: 'hidden' },
  barFill:      { height: 6, borderRadius: 3 },
  confianzaPct: { fontSize: 13, fontWeight: '700', minWidth: 36, textAlign: 'right' },
  label:        { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  montoRow:     {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginBottom: 20,
  },
  montoSimbolo: { fontSize: 22, fontWeight: '700', marginRight: 4 },
  montoInput:   { flex: 1, fontSize: 28, fontWeight: '800', paddingVertical: 14 },
  montoSufijo:  { fontSize: 14 },
  input:        {
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, marginBottom: 20,
  },
  chipsRow:     { flexDirection: 'row', gap: 8, paddingRight: 8 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipTxt:      { fontSize: 13, fontWeight: '500' },
  btnPrimario:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 16, paddingVertical: 16, marginTop: 8,
  },
  btnPrimarioTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecundario:  {
    borderWidth: 1, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', marginTop: 10,
  },
  btnSecundarioTxt: { fontSize: 15 },
});
