import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { THEME } from '../../constants/theme';
import { Icon } from './Icon';
import type { FeatherName } from './Icon';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon?: FeatherName;
  /** color de acento del ícono / chip */
  accent?: string;
  /** texto del chip de variación (ej. "-12% vs Abril") */
  delta?: string;
  /** true = verde (mejora), false = rojo, undefined = neutro */
  deltaPositive?: boolean;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Tarjeta de métrica al estilo del sistema de diseño:
 * etiqueta arriba, ícono en círculo tenue, cifra grande, unidad y chip de variación.
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  icon,
  accent,
  delta,
  deltaPositive,
  style,
}) => {
  const { colors } = useTheme();
  const acc = accent ?? colors.primary;

  const deltaColor =
    deltaPositive === undefined
      ? colors.textSecondary
      : deltaPositive
        ? colors.income
        : colors.expense;
  const deltaBg =
    deltaPositive === undefined
      ? colors.cardSecondary
      : deltaPositive
        ? colors.incomeLight
        : colors.expenseLight;

  return (
    <View
      style={[
        s.card,
        { backgroundColor: colors.card },
        THEME.shadow.card,
        style,
      ]}
    >
      <View style={s.topRow}>
        <Text style={[s.label, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
        {!!icon && (
          <View style={[s.iconChip, { backgroundColor: acc + '1A' }]}>
            <Icon name={icon} size={14} color={acc} />
          </View>
        )}
      </View>

      <Text style={[s.value, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
      {!!unit && (
        <Text style={[s.unit, { color: colors.textTertiary }]}>{unit}</Text>
      )}

      {!!delta && (
        <View style={[s.deltaChip, { backgroundColor: deltaBg }]}>
          <Text style={[s.deltaText, { color: deltaColor }]}>{delta}</Text>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: THEME.radius.card,
    padding: 16,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '500',
    flex: 1,
  },
  iconChip: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  unit: {
    fontSize: 11,
    fontWeight: '400',
  },
  deltaChip: {
    alignSelf: 'flex-start',
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  deltaText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
