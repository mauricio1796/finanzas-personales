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
      { key: 'resumenSemanal',  label: 'Resumen semanal', icon: 'bar-chart-2'   },
      { key: 'resumenMensual', label: 'Cierre de mes',   icon: 'calendar'       },
      { key: 'simulador',      label: 'Simulador',       icon: 'cpu'            },
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
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowing(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -DRAWER_W, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => setShowing(false));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const xpPct = ((userLevel?.experience ?? 0) % 1000) / 10;
  const initials = (user?.name ?? 'U')
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <Modal
      visible={showing}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dim overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: overlayAnim, backgroundColor: 'rgba(0,0,0,0.45)' }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Slide-in panel */}
      <Animated.View style={[s.panel, { transform: [{ translateX: slideAnim }] }]}>
        {/* ── Header ── */}
        <View style={[s.header, { paddingTop: insets.top + 20 }]}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarLetter}>{initials}</Text>
          </View>
          <Text style={s.userName} numberOfLines={1}>
            {user?.name ?? 'Usuario'}
          </Text>
          <Text style={s.userSub}>
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
          {SECTIONS.map((section, si) => (
            <View key={section.title}>
              {/* Separator between sections */}
              {si > 0 && <View style={s.separator} />}

              <Text style={s.sectionTitle}>{section.title}</Text>

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
                  <Icon name={item.icon} size={20} color="#9CA3AF" />
                  <Text style={s.itemLabel}>{item.label}</Text>
                  <Icon name="chevron-right" size={14} color="#E5E7EB" />
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
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },

  // Header — light, violet accent
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#F8F7FF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6156E8',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  userSub: {
    fontSize: 13,
    color: '#6B7280',
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
    color: '#9CA3AF',
  },
  xpTrack: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpFill: {
    height: 4,
    backgroundColor: '#6156E8',
    borderRadius: 2,
  },

  // Nav
  scrollContent: {
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  separator: {
    height: 0.5,
    backgroundColor: '#F4F3F8',
    marginVertical: 8,
    marginHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#9CA3AF',
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 1,
  },
  itemLabel: {
    flex: 1,
    fontSize: 15,
    color: '#6B7280',
  },
});
