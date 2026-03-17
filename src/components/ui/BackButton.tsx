import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from './Icon';

interface BackButtonProps {
  onPress: () => void;
  label?: string;
  color?: string;
  style?: any;
}

export const BackButton: React.FC<BackButtonProps> = ({ onPress, label, color, style }) => {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textPrimary;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.btn, style]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <Icon name="arrow-left" size={18} color={iconColor} />
      {label && <Text style={[s.label, { color: iconColor }]}>{label}</Text>}
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
});
