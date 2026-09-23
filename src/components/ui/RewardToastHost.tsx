import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../state/ThemeContext';
import { Icon } from './Icon';
import { subscribeRewardToast, type RewardToastPayload } from '../../utils/rewardToastBus';

const VISIBLE_MS = 2600;

// Toast minimalista para logros/subidas de nivel — misma tarjeta que el resto
// de la app (círculo de ícono + texto), sin confeti ni íconos "de trofeo IA".
export const RewardToastHost: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [current, setCurrent] = useState<RewardToastPayload | null>(null);
  const queueRef = useRef<RewardToastPayload[]>([]);
  const anim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrarSiguiente = () => {
    const next = queueRef.current.shift();
    if (!next) { setCurrent(null); return; }
    setCurrent(next);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        mostrarSiguiente();
      });
    }, VISIBLE_MS);
  };

  useEffect(() => {
    const unsub = subscribeRewardToast(payload => {
      queueRef.current.push(payload);
      if (!current) mostrarSiguiente();
    });
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.wrap,
        {
          top: insets.top + 8,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
          ],
        },
      ]}
    >
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.iconCircle, { backgroundColor: current.iconBg }]}>
          <Icon name={current.icon as any} size={16} color={current.iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.textPrimary }]} numberOfLines={1}>{current.title}</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{current.subtitle}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
    elevation: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 0.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#0B1220',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 13, fontWeight: '700' },
  subtitle: { fontSize: 11, fontWeight: '500', marginTop: 1 },
});
