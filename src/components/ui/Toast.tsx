import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from './Icon';
import type { FeatherName } from './Icon';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  mensaje: string;
  tipo?: ToastType;
  duracion?: number;
  onHide: () => void;
}

// ── Toast component ───────────────────────────────────────────────────────────

export const Toast: React.FC<ToastProps> = ({
  visible,
  mensaje,
  tipo = 'success',
  duracion = 2500,
  onHide,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -100, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,    duration: 200, useNativeDriver: true }),
      ]).start(() => onHide());
    }, duracion);

    return () => clearTimeout(timer);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const CONFIG: Record<ToastType, { bg: string; text: string; icon: FeatherName }> = {
    success: { bg: colors.incomeLight,   text: colors.incomeText,   icon: 'check-circle' },
    error:   { bg: colors.expenseLight,  text: colors.expenseText,  icon: 'x-circle'     },
    warning: { bg: colors.warningLight,  text: colors.warningText,  icon: 'alert-circle' },
    info:    { bg: colors.primaryLight,  text: colors.primaryText,  icon: 'info'         },
  };
  const cfg = CONFIG[tipo];

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 999,
        opacity,
        transform: [{ translateY }],
      }}
      pointerEvents="none"
    >
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: cfg.bg,
        borderRadius: 14,
        padding: 12,
        borderWidth: 0.5,
        borderColor: cfg.text + '40',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
      }}>
        <Icon name={cfg.icon} size={18} color={cfg.text} />
        <Text style={{ fontSize: 13, fontWeight: '500', color: cfg.text, flex: 1 }}>
          {mensaje}
        </Text>
      </View>
    </Animated.View>
  );
};

// ── useToast hook ─────────────────────────────────────────────────────────────

interface ToastState {
  visible: boolean;
  mensaje: string;
  tipo: ToastType;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    mensaje: '',
    tipo: 'success',
  });

  const mostrar = (mensaje: string, tipo: ToastType = 'success') => {
    setToast({ visible: true, mensaje, tipo });
  };

  const ocultar = () => setToast(t => ({ ...t, visible: false }));

  return { toast, mostrar, ocultar };
}
