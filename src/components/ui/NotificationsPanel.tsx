import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Modal,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificacionInApp } from '../../services/NotificacionesInAppService';
import { NotifTipo } from '../../services/NotificacionesService';
import { THEME } from '../../constants/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCREEN_H = Dimensions.get('window').height;

function tiempoRelativo(fechaISO: string): string {
  const diff = Date.now() - new Date(fechaISO).getTime();
  const min  = Math.floor(diff / 60_000);
  const h    = Math.floor(diff / 3_600_000);
  const d    = Math.floor(diff / 86_400_000);

  if (min < 1)  return 'Ahora';
  if (min < 60) return `Hace ${min} min`;
  if (h < 24)   return `Hace ${h}h`;
  if (d === 1)  return 'Ayer';
  return `Hace ${d} días`;
}

// ─── Icon + color per notification type ──────────────────────────────────────

interface TipoMeta {
  icono:  string;
  color:  string;
  etiqueta: string;
}

const TIPO_META: Record<NotifTipo, TipoMeta> = {
  pago_proximo:         { icono: '📅', color: '#F59E0B', etiqueta: 'Pago próximo'       },
  pago_vencido:         { icono: '⚠️', color: '#EF4444', etiqueta: 'Pago vencido'       },
  presupuesto_limite:   { icono: '📊', color: '#F97316', etiqueta: 'Presupuesto'        },
  resumen_semanal:      { icono: '📈', color: '#6156E8', etiqueta: 'Resumen semanal'    },
  cierre_mes:           { icono: '🗓',  color: '#6156E8', etiqueta: 'Cierre de mes'     },
  racha_riesgo:         { icono: '🔥', color: '#F97316', etiqueta: 'Racha en riesgo'   },
  meta_alcanzada:       { icono: '🏆', color: '#1D9E75', etiqueta: 'Meta alcanzada'    },
  ingreso_no_registrado:{ icono: '💰', color: '#1D9E75', etiqueta: 'Ingreso pendiente'  },
  gasto_inusual:        { icono: '🔍', color: '#EF4444', etiqueta: 'Gasto inusual'     },
  dia_sin_gastar:       { icono: '✅', color: '#1D9E75', etiqueta: 'Día verde'          },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface NotificationsPanelProps {
  visible:       boolean;
  items:         NotificacionInApp[];
  onClose:       () => void;
  onNavigate:    (screen: string) => void;
  onEliminar:    (id: string) => void;
  onLimpiarTodo: () => void;
  onMarcarLeidas: () => void;
}

// ─── Single row ───────────────────────────────────────────────────────────────

const NotifRow: React.FC<{
  item:       NotificacionInApp;
  onPress:    () => void;
  onEliminar: () => void;
}> = ({ item, onPress, onEliminar }) => {
  const meta  = TIPO_META[item.tipo] ?? { icono: '🔔', color: '#6156E8', etiqueta: 'Notificación' };

  return (
    <TouchableOpacity
      style={[s.row, !item.leida && s.rowUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Unread indicator */}
      {!item.leida && <View style={s.unreadDot} />}

      {/* Icon bubble */}
      <View style={[s.iconBubble, { backgroundColor: meta.color + '18' }]}>
        <Text style={s.iconEmoji}>{meta.icono}</Text>
      </View>

      {/* Content */}
      <View style={s.rowContent}>
        <View style={s.rowTopRow}>
          <Text style={[s.tipoLabel, { color: meta.color }]}>{meta.etiqueta}</Text>
          <Text style={s.tiempoText}>{tiempoRelativo(item.fecha)}</Text>
        </View>
        <Text style={s.tituloText} numberOfLines={1}>{item.titulo}</Text>
        <Text style={s.cuerpoText}  numberOfLines={2}>{item.cuerpo}</Text>
      </View>

      {/* Delete */}
      <TouchableOpacity
        style={s.deleteBtn}
        onPress={onEliminar}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
      >
        <Text style={s.deleteBtnText}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

// ─── Main panel ──────────────────────────────────────────────────────────────

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  visible,
  items,
  onClose,
  onNavigate,
  onEliminar,
  onLimpiarTodo,
  onMarcarLeidas,
}) => {
  const insets      = useSafeAreaInsets();
  const translateY  = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOp  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Mark as read when panel opens
      onMarcarLeidas();

      Animated.parallel([
        Animated.timing(backdropOp, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOp, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const noLeidas = items.filter(n => !n.leida).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.backdrop, { opacity: backdropOp }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          {
            transform: [{ translateY }],
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        {/* Handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerTitle}>Notificaciones</Text>
            {noLeidas > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{noLeidas}</Text>
              </View>
            )}
          </View>

          <View style={s.headerActions}>
            {items.length > 0 && (
              <TouchableOpacity
                style={s.headerBtn}
                onPress={onLimpiarTodo}
              >
                <Text style={s.headerBtnText}>Limpiar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Finn sub-header */}
        <View style={s.finnBar}>
          <View style={s.finnAvatar}>
            <Text style={s.finnAvatarText}>FI</Text>
          </View>
          <Text style={s.finnBarText}>
            {items.length === 0
              ? 'Sin alertas por ahora. Tu situación financiera está al día.'
              : `${items.length} alerta${items.length > 1 ? 's' : ''} de tu asesor financiero.`}
          </Text>
        </View>

        {/* List */}
        {items.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>🔔</Text>
            <Text style={s.emptyTitle}>Todo en orden</Text>
            <Text style={s.emptyBody}>
              Aquí aparecerán alertas de presupuesto, pagos próximos, gastos inusuales y logros financieros.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={s.list}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
          >
            {items.map(item => (
              <NotifRow
                key={item.id}
                item={item}
                onPress={() => {
                  onClose();
                  setTimeout(() => onNavigate(item.screen), 260);
                }}
                onEliminar={() => onEliminar(item.id)}
              />
            ))}

            <Text style={s.footerNote}>
              Las notificaciones se eliminan automáticamente después de 30 días.
            </Text>
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const PANEL_MAX_H = SCREEN_H * 0.78;

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,20,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: PANEL_MAX_H,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },

  // ── Finn bar ──
  finnBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8F7FF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9FE',
  },
  finnAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6156E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finnAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  finnBarText: {
    flex: 1,
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 17,
    fontWeight: '500',
  },

  // ── List ──
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },

  // ── Row ──
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    gap: 12,
    position: 'relative',
  },
  rowUnread: {
    backgroundColor: '#FAFAFE',
  },
  unreadDot: {
    position: 'absolute',
    top: 20,
    left: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6156E8',
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: {
    fontSize: 19,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  tipoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  tiempoText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  tituloText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 18,
  },
  cuerpoText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
    marginTop: 1,
  },
  deleteBtn: {
    paddingTop: 2,
    paddingLeft: 4,
    flexShrink: 0,
  },
  deleteBtnText: {
    fontSize: 12,
    color: '#D1D5DB',
    fontWeight: '600',
  },

  // ── Empty state ──
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 44,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Footer ──
  footerNote: {
    fontSize: 11,
    color: '#D1D5DB',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 24,
    lineHeight: 16,
  },
});
