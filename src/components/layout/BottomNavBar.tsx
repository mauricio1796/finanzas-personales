import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../state/ThemeContext';
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
  colors: any;
}

const TabItem: React.FC<TabItemProps> = ({ icon, label, active, onPress, colors }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8 }}
      activeOpacity={1}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center', gap: 3 }}>
        {active ? (
          <View style={{
            backgroundColor: colors.tabActiveBg,
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
            <Icon name={icon} size={15} color={colors.tabActive} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.tabActive }}>
              {label}
            </Text>
          </View>
        ) : (
          <>
            <Icon name={icon} size={20} color={colors.tabInactive} />
            <Text style={{ fontSize: 9, fontWeight: '500', color: colors.tabInactive }}>
              {label}
            </Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── FABCenter ─────────────────────────────────────────────────────────────────

const FABCenter: React.FC<{ onPress: () => void; colors: any }> = ({ onPress, colors }) => {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim,  { toValue: 0.9, duration: 80,  useNativeDriver: true }),
        Animated.spring(scaleAnim,  { toValue: 1,   tension: 200, friction: 8,  useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 0 }}>
      <TouchableOpacity onPress={handlePress} activeOpacity={1}>
        <Animated.View style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -14,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
          transform: [{ scale: scaleAnim }],
        }}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Icon name="plus" size={22} color="#FFFFFF" />
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
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentScreen,
  onNavigate,
  onQuickAdd,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={{
      backgroundColor: colors.tabBar,
      borderTopWidth: 0.5,
      borderTopColor: colors.tabBarBorder,
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingBottom: insets.bottom,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 12,
    }}>
      {LEFT_TABS.map(tab => (
        <TabItem
          key={tab.key}
          tabKey={tab.key}
          icon={tab.icon}
          label={tab.label}
          active={currentScreen === tab.key}
          onPress={() => onNavigate(tab.key)}
          colors={colors}
        />
      ))}

      <FABCenter onPress={onQuickAdd} colors={colors} />

      {RIGHT_TABS.map(tab => (
        <TabItem
          key={tab.key}
          tabKey={tab.key}
          icon={tab.icon}
          label={tab.label}
          active={currentScreen === tab.key}
          onPress={() => onNavigate(tab.key)}
          colors={colors}
        />
      ))}
    </View>
  );
};
