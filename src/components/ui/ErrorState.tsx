import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from './Icon';

interface ErrorStateProps {
  titulo?: string;
  mensaje?: string;
  onRetry?: () => void;
  onBack?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  titulo  = 'Algo salió mal',
  mensaje = 'No pudimos cargar la información. Intenta de nuevo.',
  onRetry,
  onBack,
}) => {
  const { colors } = useTheme();

  return (
    <View style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 16,
      backgroundColor: colors.background,
    }}>
      <View style={{
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: colors.expenseLight,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon name="wifi-off" size={28} color={colors.expense} />
      </View>

      <Text style={{ fontSize: 17, fontWeight: '500', color: colors.textPrimary, textAlign: 'center' }}>
        {titulo}
      </Text>
      <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
        {mensaje}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              borderRadius: 12,
              borderWidth: 0.5,
              borderColor: colors.border,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Volver</Text>
          </TouchableOpacity>
        )}
        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              borderRadius: 12,
              backgroundColor: colors.primary,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#fff' }}>Reintentar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
