import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const CONFETTI_COLORS = ['#6366F1', '#22C55E', '#F59E0B', '#EF4444', '#A855F7', '#EC4899', '#06B6D4'];

/** Celebración de confeti reutilizable (extraída de ResumenMensualScreen). */
export const ConfettiBurst: React.FC<{ active: boolean }> = ({ active }) => {
  const pieces = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      x:   new Animated.Value(0),
      y:   new Animated.Value(0),
      op:  new Animated.Value(0),
      rot: new Animated.Value(0),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      angle: (i / 18) * 2 * Math.PI,
    }))
  ).current;

  useEffect(() => {
    if (!active) return;
    const anims = pieces.map(p => {
      p.x.setValue(0); p.y.setValue(0); p.op.setValue(1); p.rot.setValue(0);
      const r = 80 + Math.random() * 60;
      return Animated.parallel([
        Animated.timing(p.x,  { toValue: Math.cos(p.angle) * r, duration: 700, useNativeDriver: true }),
        Animated.timing(p.y,  { toValue: Math.sin(p.angle) * r - 40, duration: 700, useNativeDriver: true }),
        Animated.timing(p.op, { toValue: 0, duration: 700, useNativeDriver: true }),
        Animated.timing(p.rot,{ toValue: 3, duration: 700, useNativeDriver: true }),
      ]);
    });
    Animated.stagger(20, anims).start();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: p.op,
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              { rotate: p.rot.interpolate({ inputRange: [0, 3], outputRange: ['0deg', '540deg'] }) },
            ],
          }}
        />
      ))}
    </View>
  );
};

export default ConfettiBurst;
