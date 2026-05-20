import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';
import type { FeatherName } from '../ui/Icon';


// ── Nav items ─────────────────────────────────────────────────────────────────

interface NavItem {
  key:   string;
  icon:  FeatherName;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',    icon: 'home',        label: 'Inicio'       },
  { key: 'categorias',   icon: 'tag',         label: 'Categorías'   },
  { key: 'estadisticas', icon: 'bar-chart-2', label: 'Estadísticas' },
  { key: 'historial',    icon: 'clock',       label: 'Historial'    },
  { key: 'bot',          icon: 'message-circle', label: 'Finn IA'   },
  { key: 'metas',        icon: 'award',       label: 'Metas'        },
  { key: 'proyecciones', icon: 'trending-up', label: 'Proyecciones' },
  { key: 'perfil',       icon: 'user',        label: 'Perfil'       },
];

// ── SideNavItem ───────────────────────────────────────────────────────────────

const SideNavItem: React.FC<{
  item:     NavItem;
  active:   boolean;
  onPress:  () => void;
}> = ({ item, active, onPress }) => {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1} style={st.navItem}>
      <Animated.View style={[
        st.navInner,
        { transform: [{ scale }] },
        active && { backgroundColor: colors.primaryLight },
      ]}>
        <Icon
          name={item.icon}
          size={20}
          color={active ? colors.primary : colors.textTertiary}
        />
        <Text style={[
          st.navLabel,
          { color: active ? colors.primary : colors.textSecondary },
          active && { fontWeight: '700' },
        ]}>
          {item.label}
        </Text>
        {active && <View style={[st.activeDot, { backgroundColor: colors.primary }]} />}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface WebSidebarProps {
  currentScreen: string;
  onNavigate:   (screen: string) => void;
  onQuickAdd:   () => void;
  userName?:    string;
  children:     React.ReactNode;
}

// ── WebSidebar ────────────────────────────────────────────────────────────────

export const WebSidebar: React.FC<WebSidebarProps> = ({
  currentScreen,
  onNavigate,
  onQuickAdd,
  userName,
  children,
}) => {
  const { colors, isDark } = useTheme();

  if (Platform.OS !== 'web') return <>{children}</>;

  const activeTab = NAV_ITEMS.find(n => n.key === currentScreen)?.key ?? 'dashboard';

  return (
    <View style={[st.root, { backgroundColor: colors.background }]}>

      {/* ── Sidebar ── */}
      <View style={[st.sidebar, {
        backgroundColor: isDark ? colors.card : '#FFFFFF',
        borderRightColor: colors.border,
      }]}>

        {/* Logo */}
        <View style={st.logo}>
          <View style={[st.logoIcon, { backgroundColor: colors.primaryLight }]}>
            <Text style={[st.logoText, { color: colors.primary }]}>Fi</Text>
          </View>
          <View>
            <Text style={[st.logoName, { color: colors.textPrimary }]}>FinancyAI</Text>
            <Text style={[st.logoSub,  { color: colors.textTertiary }]}>
              {userName ? `Hola, ${userName.split(' ')[0]}` : 'Tu dinero, inteligente'}
            </Text>
          </View>
        </View>

        {/* Botón agregar */}
        <TouchableOpacity
          onPress={onQuickAdd}
          style={[st.addBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          <Icon name="plus" size={18} color="#FFF" />
          <Text style={st.addBtnText}>Agregar transacción</Text>
        </TouchableOpacity>

        {/* Nav items */}
        <View style={st.nav}>
          {NAV_ITEMS.map(item => (
            <SideNavItem
              key={item.key}
              item={item}
              active={activeTab === item.key}
              onPress={() => onNavigate(item.key)}
            />
          ))}
        </View>

        {/* Footer sidebar */}
        <View style={[st.sideFooter, { borderTopColor: colors.border }]}>
          <View style={[st.finnBadge, { backgroundColor: colors.primaryLight }]}>
            <Text style={{ fontSize: 16 }}>✦</Text>
            <Text style={[st.finnText, { color: colors.primary }]}>Finn está activo</Text>
          </View>
        </View>
      </View>

      {/* ── Content area ── */}
      <View style={st.content}>
        {children}
      </View>

    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    minHeight: '100vh' as any,
  },

  // Sidebar
  sidebar: {
    width: 220,
    flexShrink: 0,
    borderRightWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 14,
    justifyContent: 'flex-start',
    minHeight: '100vh' as any,
    overflowY: 'auto' as any,
  } as any,

  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  logoName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  logoSub:  { fontSize: 11, marginTop: 1 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  nav: { flex: 1, gap: 2 },

  navItem: { borderRadius: 12, overflow: 'hidden' },
  navInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    position: 'relative',
  },
  navLabel: { fontSize: 14, fontWeight: '500', flex: 1 },
  activeDot: {
    width: 6, height: 6, borderRadius: 3,
    position: 'absolute', right: 12,
  },

  sideFooter: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 16,
  },
  finnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  finnText: { fontSize: 13, fontWeight: '600' },

  // Content
  content: {
    flex: 1,
    overflow: 'hidden' as any,
  },
});
