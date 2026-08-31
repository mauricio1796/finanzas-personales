import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle, DimensionValue } from 'react-native';
import { useTheme } from '../../state/ThemeContext';

// ── Single skeleton block ──────────────────────────────────────────────────────

interface SkeletonProps {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  borderRadius = 8,
  style,
}) => {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const bgColor = shimmerAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [colors.skeleton, colors.skeletonHighlight],
  });

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: bgColor }, style]}
    />
  );
};

// ── Dashboard skeleton — shown during initial load ─────────────────────────────

export const DashboardSkeleton: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Hero */}
      <View style={{
        backgroundColor: colors.headerBg,
        padding: 20,
        paddingTop: 56,
        paddingBottom: 60,
        gap: 12,
      }}>
        <Skeleton width={120} height={12} borderRadius={6} />
        <Skeleton width={200} height={36} borderRadius={8} />
        <View style={{ height: 4 }} />
        <Skeleton width="100%" height={8} borderRadius={4} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton width={60} height={10} borderRadius={5} />
          <Skeleton width={60} height={10} borderRadius={5} />
        </View>
      </View>
      {/* Body */}
      <View style={{ padding: 16, gap: 12, marginTop: -20 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} width={72} height={72} borderRadius={36} />
          ))}
        </View>
        <Skeleton width="100%" height={80}  borderRadius={14} />
        <Skeleton width="100%" height={60}  borderRadius={14} />
        <Skeleton width="100%" height={120} borderRadius={14} />
      </View>
    </View>
  );
};
