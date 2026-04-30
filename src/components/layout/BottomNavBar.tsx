import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHaptics } from '../../hooks/useHaptics';
import { Icon } from '../ui/Icon';
import type { FeatherName } from '../ui/Icon';

// ── Tab config ───────────────────────────────────────────────────────────────

interface TabConfig {
  key: string;
  icon: FeatherName;
  label: string;
}

const LEFT_TABS: TabConfig[] = [
  { key: 'dashboard',  icon: 'home', label: 'Inicio'     },
  { key: 'categorias', icon: 'tag',  label: 'Categorías' },
];

const RIGHT_TABS: TabConfig[] = [
  { key: 'estadisticas', icon: 'bar-chart-2', label: 'Stats'  },
  { key: 'perfil',       icon: 'user',        label: 'Perfil' },
];

// ── TabItem ───────────────────────────────────────────────────────────────────

interface TabItemProps {
  tabKey: string;
  icon: FeatherName;
  label: string;
  active: boolean;
  onPress: () => void;
  onScrollToTop?: () => void;
}

const TabItem: React.FC<TabItemProps> = ({
  icon, label, active, onPress, onScrollToTop,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { selection } = useHaptics();

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }),
    ]).start();

    if (active) {
      selection();
      onScrollToTop?.();
    } else {
      selection();
      onPress();
    }
  };

  const color = active ? '#6156E8' : '#9CA3AF';

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 10 }}
      activeOpacity={1}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center', gap: 3 }}>
        <Icon name={icon} size={22} color={color} />
        <Text style={{ fontSize: 10, color, fontWeight: active ? '700' : '400' }}>
          {label}
        </Text>
        {active && (
          <View style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: '#6156E8',
            marginTop: 1,
          }} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── FABCenter ─────────────────────────────────────────────────────────────────

const FABCenter: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const { medium } = useHaptics();

  const handlePress = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim,  { toValue: 0.9, duration: 80,  useNativeDriver: true }),
        Animated.spring(scaleAnim,  { toValue: 1,   tension: 200, friction: 8, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]),
    ]).start();
    medium();
    onPress();
  };

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 0 }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Animated.View style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#6156E8',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -20,
          shadowColor: '#6156E8',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 8,
          transform: [{ scale: scaleAnim }],
        }}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Text style={{ fontSize: 28, color: '#FFFFFF', lineHeight: 32, includeFontPadding: false }}>+</Text>
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

// ── BottomNavBar ──────────────────────────────────────────────────────────────

interface BottomNavBarProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  onQuickAdd: () => void;
  onScrollToTop?: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentScreen,
  onNavigate,
  onQuickAdd,
  onScrollToTop,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      backgroundColor: '#FFFFFF',
      borderTopWidth: 0.5,
      borderTopColor: '#E5E7EB',
      flexDirection: 'row',
      alignItems: 'flex-start',
      height: 64 + insets.bottom,
      paddingBottom: insets.bottom,
    }}>
      {LEFT_TABS.map(tab => (
        <TabItem
          key={tab.key}
          tabKey={tab.key}
          icon={tab.icon}
          label={tab.label}
          active={currentScreen === tab.key}
          onPress={() => onNavigate(tab.key)}
          onScrollToTop={currentScreen === tab.key ? onScrollToTop : undefined}
        />
      ))}

      <FABCenter onPress={onQuickAdd} />

      {RIGHT_TABS.map(tab => (
        <TabItem
          key={tab.key}
          tabKey={tab.key}
          icon={tab.icon}
          label={tab.label}
          active={currentScreen === tab.key}
          onPress={() => onNavigate(tab.key)}
          onScrollToTop={currentScreen === tab.key ? onScrollToTop : undefined}
        />
      ))}
    </View>
  );
};
