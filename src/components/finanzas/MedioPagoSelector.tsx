/**
 * Selector de medio de pago (chips horizontales) para los formularios de gasto.
 *
 * Tocar el medio seleccionado lo deselecciona: el medio es opcional. Si el
 * usuario aún no tiene medios, muestra una invitación a la Billetera.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';
import { entidadPorId, etiquetaMedio, mediosActivos, tipoInfo } from '../../utils/mediosPago';

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  accent: string;
  /** Abre la Billetera para agregar un medio. Sin él, el estado vacío no se muestra. */
  onAgregar?: () => void;
  label?: string;
}

export const MedioPagoSelector: React.FC<Props> = ({ value, onChange, accent, onAgregar, label = 'PAGASTE CON' }) => {
  const { colors } = useTheme();
  const { mediosPago } = useFinance();
  const activos = mediosActivos(mediosPago);

  if (activos.length === 0 && !onAgregar) return null;

  return (
    <View>
      <Text style={[s.label, { color: colors.textTertiary }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.row}>
        {activos.map(m => {
          const activo = value === m.id;
          const entidad = entidadPorId(m.entidad);
          return (
            <TouchableOpacity
              key={m.id}
              testID={`medio-chip-${m.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={`Pagaste con ${etiquetaMedio(m)}`}
              style={[
                s.chip,
                { borderColor: colors.border, backgroundColor: colors.cardSecondary ?? colors.card },
                activo && { borderColor: accent, backgroundColor: accent + '18' },
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onChange(activo ? null : m.id);
              }}
              activeOpacity={0.75}
            >
              <View style={[s.dot, { backgroundColor: entidad.color }]}>
                <Icon name={tipoInfo(m.tipo).icon as any} size={11} color={entidad.texto} />
              </View>
              <Text style={[s.chipText, { color: activo ? accent : colors.textPrimary }]} numberOfLines={1}>
                {etiquetaMedio(m)}
              </Text>
              {activo && <Icon name="check" size={13} color={accent} />}
            </TouchableOpacity>
          );
        })}
        {onAgregar && (
          <TouchableOpacity
            testID="medio-chip-agregar"
            style={[s.chip, s.chipAgregar, { borderColor: colors.border }]}
            onPress={onAgregar}
            activeOpacity={0.75}
          >
            <Icon name="plus" size={14} color={colors.textSecondary} />
            <Text style={[s.chipText, { color: colors.textSecondary }]}>
              {activos.length === 0 ? 'Agrega tu tarjeta o Nequi' : 'Agregar'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  row: { gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 6, paddingRight: 12, paddingVertical: 6,
    borderRadius: 100, borderWidth: 1.5, maxWidth: 220,
  },
  chipAgregar: { borderStyle: 'dashed', paddingLeft: 12, paddingVertical: 9 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
});
