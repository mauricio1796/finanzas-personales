import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../state/ThemeContext';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: any;
}

/**
 * Encabezado de sección: título en negrita + línea de subtítulo gris,
 * con acción opcional a la derecha. Ritmo visual consistente en toda la app.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[s.row, style]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: colors.textPrimary }]}>{title}</Text>
        {!!subtitle && (
          <Text style={[s.sub, { color: colors.textSecondary }]}>{subtitle}</Text>
        )}
      </View>

      {!!actionLabel && (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[s.action, { color: colors.primary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 12.5,
    fontWeight: '400',
    marginTop: 2,
  },
  action: {
    fontSize: 13,
    fontWeight: '600',
    paddingTop: 2,
  },
});
