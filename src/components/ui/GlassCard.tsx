import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../state/ThemeContext';

// ─── GlassCard — superficie sólida sin blur ───────────────────────────────────

interface GlassCardProps {
  children:      React.ReactNode;
  style?:        ViewStyle | ViewStyle[];
  intensity?:    number;
  borderRadius?: number;
  accentTint?:   boolean;
  shimmer?:      boolean;
  elevated?:     boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  borderRadius = 20,
  elevated = false,
}) => {
  const { isDark, colors } = useTheme();

  const shadow: ViewStyle = elevated
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 12,
      }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.25 : 0.08,
        shadowRadius: 8,
        elevation: 4,
      };

  return (
    <View style={[
      { borderRadius, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
      shadow,
      style,
    ]}>
      {children}
    </View>
  );
};

// ─── GlassBalanceCard — tarjeta de balance sin blur ──────────────────────────

interface GlassBalanceCardProps {
  children:   React.ReactNode;
  style?:     ViewStyle | ViewStyle[];
  intensity?: number;
}

export const GlassBalanceCard: React.FC<GlassBalanceCardProps> = ({
  children, style,
}) => {
  // Sin glass mode activo, simplemente renderiza los children directamente
  return <>{children}</>;
};

// ─── GlassTabBar — barra inferior sin blur ────────────────────────────────────

interface GlassTabBarProps {
  children: React.ReactNode;
  style?:   ViewStyle | ViewStyle[];
}

export const GlassTabBar: React.FC<GlassTabBarProps> = ({ children, style }) => {
  const { isDark, colors } = useTheme();

  return (
    <View style={[{
      backgroundColor: isDark ? colors.card : '#FFFFFF',
      borderTopWidth: 0.5,
      borderTopColor: colors.border,
    }, style]}>
      {children}
    </View>
  );
};

// ─── GlassBackground — fondo plano sin blobs ni blur ─────────────────────────

interface GlassBackgroundProps {
  children: React.ReactNode;
}

export const GlassBackground: React.FC<GlassBackgroundProps> = ({ children }) => {
  const { isDark } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0a0a14' : '#f0eeff' }]}>
      {children}
    </View>
  );
};
