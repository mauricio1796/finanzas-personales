import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { Icon, UI_ICONS, FeatherName } from '../ui/Icon';
import { TourRegistry } from '../../utils/TourRegistry';

type ScreenName = 'dashboard' | 'ingresos' | 'gastos' | 'categorias' | 'estadisticas' | 'bot' | 'perfil' | 'explorar';

interface Tab {
  id: ScreenName;
  icon: FeatherName;
  label: string;
}

const TABS: Tab[] = [
  { id: 'dashboard',    icon: UI_ICONS.home,     label: 'Inicio'   },
  { id: 'explorar',     icon: 'compass',         label: 'Explorar' },
  { id: 'bot',          icon: UI_ICONS.ai,       label: 'IA'       },
  { id: 'ingresos',     icon: UI_ICONS.finanzas, label: 'Finanzas' },
  { id: 'perfil',       icon: UI_ICONS.perfil,   label: 'Perfil'   },
];

interface BottomNavBarProps {
  currentScreen: ScreenName;
  onScreenChange: (screen: ScreenName) => void;
  userName?: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentScreen,
  onScreenChange,
}) => {
  const { colors } = useTheme();

  // Register tab refs for product tour
  const tabRefs = useRef<Map<string, React.RefObject<View>>>(
    new Map(TABS.map(t => [t.id, React.createRef<View>()]))
  );

  useEffect(() => {
    TABS.forEach(t => {
      const ref = tabRefs.current.get(t.id);
      if (ref) TourRegistry.register('tab_' + t.id, ref as any);
    });
    return () => { TABS.forEach(t => TourRegistry.unregister('tab_' + t.id)); };
  }, []);

  const activeTab = (currentScreen === 'gastos' || currentScreen === 'categorias')
    ? 'ingresos'
    : currentScreen === 'estadisticas'
    ? 'explorar'
    : currentScreen;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
        },
      ]}
    >
      <View style={styles.tabs}>
        {TABS.map(tab => {
          const isActive = tab.id === activeTab;
          const tabRef = tabRefs.current.get(tab.id);
          return (
            <TouchableOpacity
              key={tab.id}
              ref={tabRef as any}
              onPress={() => onScreenChange(tab.id)}
              style={styles.tab}
              activeOpacity={0.7}
              accessibilityLabel={tab.label}
              accessibilityRole="button"
            >
              <View style={[
                styles.iconWrapper,
                isActive && { backgroundColor: '#EEF2FF' },
              ]}>
                <Icon
                  name={tab.icon}
                  size={20}
                  color={isActive ? colors.primary : '#9CA3AF'}
                />
                {tab.id === 'bot' && (
                  <View style={[styles.aiBadge, { backgroundColor: colors.primary }]} />
                )}
              </View>
              <Text style={[
                styles.label,
                { color: isActive ? colors.primary : '#9CA3AF' },
                isActive && styles.labelActive,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.homeIndicatorArea}>
        <View style={styles.homeIndicator} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  tabs: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 48,
    paddingVertical: 4,
  },
  iconWrapper: {
    width: 40,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  icon: {
    fontSize: 19,
  },
  aiBadge: {
    position: 'absolute',
    top: 3,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  labelActive: {
    fontWeight: '700',
  },
  homeIndicatorArea: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIndicator: {
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
});
