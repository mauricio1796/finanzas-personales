import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  strength?: 'light' | 'medium' | 'strong';
  radius?: number;
  padding?: number;
}

const BG = {
  light:  'rgba(255, 255, 255, 0.08)',
  medium: 'rgba(255, 255, 255, 0.13)',
  strong: 'rgba(255, 255, 255, 0.20)',
};

const BORDER = {
  light:  'rgba(255, 255, 255, 0.18)',
  medium: 'rgba(255, 255, 255, 0.22)',
  strong: 'rgba(255, 255, 255, 0.30)',
};

const webBlur = Platform.OS === 'web' ? {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
} as Record<string, string> : {};

const webShadow = Platform.OS === 'web' ? {
  boxShadow: '0 8px 32px rgba(0,0,0,0.37), inset 0 1px 0 rgba(255,255,255,0.15)',
} as Record<string, string> : {};

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  strength = 'light',
  radius = 24,
  padding,
}) => {
  const dynamicStyle: ViewStyle = {
    backgroundColor: BG[strength],
    borderRadius: radius,
    borderWidth: 1,
    borderColor: BORDER[strength],
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 10,
    } : {}),
    ...(padding !== undefined ? { padding } : {}),
  };

  return (
    <View
      style={[
        styles.base,
        dynamicStyle,
        ...(Platform.OS === 'web' ? [webBlur as ViewStyle, webShadow as ViewStyle] : []),
        ...(Array.isArray(style) ? style : style ? [style] : []),
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
