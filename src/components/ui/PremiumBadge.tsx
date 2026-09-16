import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from './Icon';

interface PremiumBadgeProps {
  size?: 'sm' | 'md';
  label?: string;
}

/** Etiqueta discreta "PREMIUM", coherente con el resto de la app. */
export const PremiumBadge: React.FC<PremiumBadgeProps> = ({ size = 'sm', label = 'PREMIUM' }) => {
  const { colors } = useTheme();
  const sm = size === 'sm';
  return (
    <View style={[s.badge, { backgroundColor: colors.primary, paddingHorizontal: sm ? 7 : 10, paddingVertical: sm ? 2 : 4 }]}>
      <Icon name="zap" size={sm ? 8 : 10} color="#fff" />
      <Text style={[s.text, { fontSize: sm ? 9 : 11 }]}>{label}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 100, alignSelf: 'flex-start' },
  text: { color: '#fff', fontWeight: '800', letterSpacing: 0.4 },
});

export default PremiumBadge;
