/**
 * Cortina de privacidad: cubre la app cuando no está al frente para que la
 * vista previa del selector de apps no muestre saldos ni movimientos.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../state/ThemeContext';

const FINN_AVATAR = require('../../../assets/images/finn-avatar.png');

export function PrivacyShield() {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.heroGradientFrom, colors.heroGradientTo]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={s.root}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={s.center}>
        <Image source={FINN_AVATAR} style={s.avatar} />
        <Text style={s.brand}>Financy<Text style={s.brandBold}>AI</Text></Text>
        <Text style={s.sub}>Tu información está protegida</Text>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 6 },
  brand:  { color: '#fff', fontSize: 24, fontWeight: '600', letterSpacing: -0.4 },
  brandBold: { fontWeight: '900' },
  sub:    { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
});
