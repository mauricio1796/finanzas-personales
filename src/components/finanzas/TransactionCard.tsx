/**
 * TransactionCard — tarjeta de un movimiento con acciones desplegables.
 *
 * Mismo lenguaje visual que las tarjetas de Categorías: bloque completo por
 * registro; al tocarlo se despliega una fila con "Ver detalle" y "Eliminar".
 * Se usa en Historial, Gastos e Ingresos para que los tres se vean igual.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { Icon, type FeatherName } from '../ui/Icon';

export interface TransactionCardProps {
  title: string;
  /** Partes de la línea secundaria (se separan con un punto). */
  meta: string[];
  amountLabel: string;
  amountColor: string;
  iconName: FeatherName;
  iconBg: string;
  iconColor: string;
  expanded: boolean;
  onToggle: () => void;
  onViewDetail: () => void;
  onDelete: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const TransactionCard = React.memo(function TransactionCard({
  title, meta, amountLabel, amountColor, iconName, iconBg, iconColor,
  expanded, onToggle, onViewDetail, onDelete, onLongPress, style, testID,
}: TransactionCardProps) {
  const { colors } = useTheme();
  const partes = meta.filter(Boolean);

  return (
    <View
      style={[
        s.card,
        { backgroundColor: colors.card, borderColor: expanded ? colors.primary + '55' : colors.border },
        style,
      ]}
      testID={testID}
    >
      <TouchableOpacity
        onPress={onToggle}
        onLongPress={onLongPress}
        style={s.row}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint="Muestra las opciones del movimiento"
      >
        <View style={[s.icon, { backgroundColor: iconBg }]}>
          <Icon name={iconName} size={18} color={iconColor} />
        </View>

        <View style={s.info}>
          <Text style={[s.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
          {partes.length > 0 && (
            <View style={s.meta}>
              {partes.map((p, i) => (
                <React.Fragment key={`${i}-${p}`}>
                  {i > 0 && <View style={[s.metaDot, { backgroundColor: colors.textTertiary }]} />}
                  <Text style={[s.metaTxt, { color: colors.textTertiary }]} numberOfLines={1}>{p}</Text>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        <Text style={[s.amount, { color: amountColor }]}>{amountLabel}</Text>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textTertiary} />
      </TouchableOpacity>

      {expanded && (
        <View style={[s.actions, { borderTopColor: colors.borderSubtle }]}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.cardSecondary }]}
            onPress={onViewDetail}
            accessibilityRole="button"
          >
            <Icon name="eye" size={14} color={colors.textSecondary} />
            <Text style={[s.actionLabel, { color: colors.textSecondary }]}>Ver detalle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.expenseLight }]}
            onPress={onDelete}
            accessibilityRole="button"
            testID={testID ? `${testID}-eliminar` : undefined}
          >
            <Icon name="trash-2" size={14} color={colors.expense} />
            <Text style={[s.actionLabel, { color: colors.expense }]}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  card:        { borderRadius: 14, borderWidth: 0.5, overflow: 'hidden' },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  icon:        { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info:        { flex: 1, gap: 2 },
  title:       { fontSize: 14, fontWeight: '500' },
  meta:        { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  metaTxt:     { fontSize: 11, flexShrink: 1 },
  metaDot:     { width: 3, height: 3, borderRadius: 1.5 },
  amount:      { fontSize: 15, fontWeight: '500' },
  actions:     { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, borderTopWidth: 0.5 },
  actionBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10 },
  actionLabel: { fontSize: 13, fontWeight: '500' },
});
