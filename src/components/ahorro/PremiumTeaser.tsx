/**
 * PremiumTeaser — adelanto compacto de una función Premium dentro de una
 * pantalla (a diferencia de PremiumLock, que ocupa la pantalla entera).
 * Dice algo verdadero del usuario ("Finn encontró 3 decisiones…") sin
 * revelar el detalle.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';

interface Props {
  titulo: string;
  texto: string;
  onUpgrade?: () => void;
  testID?: string;
}

export function PremiumTeaser({ titulo, texto, onUpgrade, testID }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onUpgrade} disabled={!onUpgrade}
      style={[st.card, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '33' }]}>
      <View style={[st.ico, { backgroundColor: colors.primary }]}>
        <Icon name="lock" size={16} color="#fff" />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[st.titulo, { color: colors.textPrimary }]}>{titulo}</Text>
          <View style={[st.badge, { backgroundColor: colors.primary }]}>
            <Text style={st.badgeText}>PREMIUM</Text>
          </View>
        </View>
        <Text style={[st.texto, { color: colors.textSecondary }]}>{texto}</Text>
      </View>
      {onUpgrade && <Icon name="chevron-right" size={16} color={colors.primary} />}
    </Pressable>
  );
}

const st = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
  ico:       { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  titulo:    { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  badge:     { borderRadius: 100, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 8.5, fontWeight: '800', letterSpacing: 0.4 },
  texto:     { fontSize: 12.5, lineHeight: 17 },
});
