import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';
import type { FeatherName } from '../ui/Icon';

// ── Config ────────────────────────────────────────────────────────────────────

const DRAWER_W = 290;

interface DrawerItem {
  key: string;
  label: string;
  icon: FeatherName;
}

interface DrawerSection {
  title: string;
  items: DrawerItem[];
}

const SECTIONS: DrawerSection[] = [
  {
    title: 'PRINCIPAL',
    items: [
      { key: 'bot',            label: 'Finn IA',         icon: 'message-circle' },
      { key: 'explorar',       label: 'Explorar',        icon: 'compass'        },
      { key: 'historial',      label: 'Historial',       icon: 'clock'          },
      { key: 'resumenSemanal',  label: 'Resumen semanal', icon: 'bar-chart-2' },
      { key: 'resumenMensual', label: 'Cierre de mes',  icon: 'calendar'     },
      { key: 'simulador',     label: 'Simulador',       icon: 'cpu'          },
    ],
  },
  {
    title: 'MÓDULOS',
    items: [
      { key: 'gamificacion', label: 'Gamificación', icon: 'award'       },
      { key: 'retos',        label: 'Retos',        icon: 'zap'         },
      { key: 'academia',     label: 'Academia',     icon: 'book-open'   },
      { key: 'proyecciones', label: 'Proyecciones', icon: 'trending-up' },
      { key: 'metas',        label: 'Mis Metas',    icon: 'target'      },
      { key: 'deudas',       label: 'Deudas',       icon: 'credit-card' },
      { key: 'recurrentes',  label: 'Recurrentes',  icon: 'repeat'      },
    ],
  },
  {
    title: 'CUENTA',
    items: [
      { key: 'exportar',      label: 'Exportar PDF',     icon: 'file-text' },
      { key: 'widget',        label: 'Widget de inicio', icon: 'layout'    },
      { key: 'configuracion', label: 'Apariencia',       icon: 'moon'      },
      { key: 'perfil',        label: 'Mi perfil',        icon: 'user'      },
    ],
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DrawerMenu: React.FC<DrawerMenuProps> = ({ visible, onClose, onNavigate }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, userLevel } = useFinance();

  const slideAnim   = useRef(new Animated.Value(-DRAWER_W)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  // Keep modal mounted until close animation finishes
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowing(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_W,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => setShowing(false));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const xpPct = ((userLevel?.experience ?? 0) % 1000) / 10; // 0–100

  return (
    <Modal
      visible={showing}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dim overlay — tapping it closes the drawer */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: overlayAnim, backgroundColor: 'rgba(0,0,0,0.5)' }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Slide-in panel */}
      <Animated.View
        style={[
          s.panel,
          { backgroundColor: colors.card, transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* ── Header ── */}
        <View style={[s.header, { backgroundColor: colors.primary, paddingTop: insets.top + 16 }]}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarLetter}>
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </Text>
          </View>
          <Text style={s.userName} numberOfLines={1}>
            {user?.name ?? 'Usuario'}
          </Text>
          <Text style={s.userLevel}>
            Nivel {userLevel?.level ?? 1} · {userLevel?.title ?? 'Principiante'}
          </Text>

          {/* XP bar */}
          <View style={s.xpWrap}>
            <View style={s.xpRow}>
              <Text style={s.xpLabel}>Progreso XP</Text>
              <Text style={s.xpLabel}>{(userLevel?.experience ?? 0) % 1000} / 1000</Text>
            </View>
            <View style={s.xpTrack}>
              <View style={[s.xpFill, { width: `${xpPct}%` as any }]} />
            </View>
          </View>
        </View>

        {/* ── Nav sections ── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {SECTIONS.map(section => (
            <View key={section.title} style={s.section}>
              <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>
                {section.title}
              </Text>
              {section.items.map(item => (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    onNavigate(item.key);
                  }}
                  style={s.item}
                  activeOpacity={0.7}
                >
                  <View style={[s.itemIcon, { backgroundColor: colors.primaryLight }]}>
                    <Icon name={item.icon} size={17} color={colors.primary} />
                  </View>
                  <Text style={[s.itemLabel, { color: colors.textPrimary }]}>
                    {item.label}
                  </Text>
                  <Icon name="chevron-right" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_W,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  userLevel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 14,
  },
  xpWrap: {},
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  xpLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  xpTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpFill: {
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },

  // Nav
  scrollContent: {
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  section: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 2,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    flex: 1,
    fontSize: 14,
  },
});
