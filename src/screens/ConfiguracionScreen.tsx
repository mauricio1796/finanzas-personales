import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useTheme, ThemePreference } from '../state/ThemeContext';
import { useFinance } from '../state';
import { Icon } from '../components/ui/Icon';
import { useHaptics } from '../hooks/useHaptics';
import { Toast, useToast } from '../components/ui/Toast';
import { reprogramarTodasLasNotificaciones } from '../services/NotificacionesService';
import { verificarConexionWorker } from '../services/RealAIService';
import { THEME } from '../constants/theme';

interface ConfiguracionScreenProps {
  onBack:      () => void;
  onNavigate?: (screen: string) => void;
}

// ─── Mini preview card ────────────────────────────────────────────────────────
const PreviewCard = ({ isDark }: { isDark: boolean }) => {
  const bg        = isDark ? '#1C1C1F' : '#FFFFFF';
  const border    = isDark ? '#2E2E33' : '#E5E7EB';
  const textMain  = isDark ? '#F4F4F5' : '#111827';
  const textSub   = isDark ? '#A1A1AA' : '#6B7280';
  const balBg     = isDark ? '#1E1B4B' : '#EEF2FF';
  const balText   = isDark ? '#C7D2FE' : '#3730A3';
  const incomeC   = isDark ? '#34D399' : '#10B981';
  const expenseC  = isDark ? '#F87171' : '#EF4444';

  return (
    <View style={[styles.previewCard, { backgroundColor: bg, borderColor: border }]}>
      {/* Mini balance */}
      <View style={[styles.previewBalance, { backgroundColor: balBg }]}>
        <Text style={[styles.previewBalanceLabel, { color: textSub }]}>Balance disponible</Text>
        <Text style={[styles.previewBalanceValue, { color: balText }]}>$1.250.000</Text>
      </View>

      {/* Mock transactions */}
      <View style={[styles.previewTx, { borderBottomColor: border }]}>
        <View style={[styles.previewTxIcon, { backgroundColor: expenseC + '22' }]}>
          <Icon name="shopping-bag" size={12} color={expenseC} />
        </View>
        <Text style={[styles.previewTxLabel, { color: textMain }]}>Alimentación</Text>
        <Text style={[styles.previewTxAmount, { color: expenseC }]}>-$45.000</Text>
      </View>
      <View style={styles.previewTx}>
        <View style={[styles.previewTxIcon, { backgroundColor: incomeC + '22' }]}>
          <Icon name="briefcase" size={12} color={incomeC} />
        </View>
        <Text style={[styles.previewTxLabel, { color: textMain }]}>Salario</Text>
        <Text style={[styles.previewTxAmount, { color: incomeC }]}>+$2.600.000</Text>
      </View>
    </View>
  );
};

// ─── Split preview icon (system option) ──────────────────────────────────────
const SplitPreview = () => (
  <View style={styles.splitPreview}>
    <View style={styles.splitLeft} />
    <View style={styles.splitRight} />
    <View style={styles.splitDiag} />
  </View>
);

// ─── Theme option card ────────────────────────────────────────────────────────
const ThemeOption = ({
  label,
  subtitle,
  value,
  current,
  onSelect,
  colors,
  showBadge,
}: {
  label: string;
  subtitle: string;
  value: ThemePreference;
  current: ThemePreference;
  onSelect: (v: ThemePreference) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  showBadge?: boolean;
}) => {
  const isActive = value === current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }),
    ]).start();
    onSelect(value);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={[
        styles.themeOption,
        {
          backgroundColor: colors.card,
          borderColor: isActive ? colors.primary : colors.border,
          borderWidth: isActive ? 1.5 : 0.5,
        },
        { transform: [{ scale: scaleAnim }] },
      ]}>
        {/* Preview thumbnail */}
        {value === 'light' && (
          <View style={styles.previewThumb}>
            <View style={[styles.thumbBg, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
              <View style={[styles.thumbLine, { backgroundColor: '#E5E7EB' }]} />
              <View style={[styles.thumbDot,  { backgroundColor: '#6366F1' }]} />
            </View>
          </View>
        )}
        {value === 'dark' && (
          <View style={styles.previewThumb}>
            <View style={[styles.thumbBg, { backgroundColor: '#1C1C1F', borderColor: '#2E2E33' }]}>
              <View style={[styles.thumbLine, { backgroundColor: '#3F3F46' }]} />
              <View style={[styles.thumbDot,  { backgroundColor: '#818CF8' }]} />
            </View>
          </View>
        )}
        {value === 'system' && (
          <View style={styles.previewThumb}>
            <SplitPreview />
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{label}</Text>
            {showBadge && (
              <View style={[styles.recBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.recBadgeText, { color: colors.primaryText }]}>Recomendado</Text>
              </View>
            )}
          </View>
          <Text style={[styles.optionSub, { color: colors.textTertiary }]}>{subtitle}</Text>
        </View>

        {/* Radio */}
        <View style={[
          styles.radio,
          { borderColor: isActive ? colors.primary : colors.border },
          isActive && { backgroundColor: colors.primary },
        ]}>
          {isActive && <View style={styles.radioInner} />}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── Notif toggle switch (animated) ────────────────────────────────────────────
const NotifToggle = ({
  active,
  disabled,
  onPress,
  colors,
}: {
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  colors: any;
}) => {
  const thumbAnim  = useRef(new Animated.Value(active ? 1 : 0)).current;
  const trackColor = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(thumbAnim,  { toValue: active ? 1 : 0, useNativeDriver: true }),
      Animated.timing(trackColor, { toValue: active ? 1 : 0, duration: 150, useNativeDriver: false }),
    ]).start();
  }, [active]);

  const translateX = thumbAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });
  const bg = trackColor.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.primary] });

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      <Animated.View style={[styles.notifTrack, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }]}>
        <Animated.View style={[styles.notifThumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export function ConfiguracionScreen({ onBack, onNavigate }: ConfiguracionScreenProps) {
  const insets = useSafeAreaInsets();
  const { isDark, colors, preference, setPreference, toggle } = useTheme();
  const { categories, transactions, profile } = useFinance();
  const haptics = useHaptics();
  const { toast, mostrar: mostrarToast, ocultar: ocultarToast } = useToast();

  const previewFade = useRef(new Animated.Value(1)).current;
  const thumbAnim   = useRef(new Animated.Value(isDark ? 1 : 0)).current;
  const [trackColor] = useState(new Animated.Value(isDark ? 1 : 0));

  // ── IA state ─────────────────────────────────────────────────────────────
  const [estadoIA, setEstadoIA] = useState<'verificando' | 'conectado' | 'error'>('verificando');

  useEffect(() => {
    verificarConexionWorker().then(ok => setEstadoIA(ok ? 'conectado' : 'error'));
  }, []);

  // ── Notification state ───────────────────────────────────────────────────
  const [permisosNotif, setPermisosNotif] = useState(false);
  const [notifConfig, setNotifConfig] = useState({
    pagos:       true,
    presupuesto: true,
    racha:       true,
    semanal:     true,
    inusual:     true,
  });

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPermisosNotif(status === 'granted');
    });
    AsyncStorage.getItem('@financy_notif_config').then(raw => {
      if (raw) setNotifConfig(JSON.parse(raw));
    });
  }, []);

  const toggleNotif = async (key: keyof typeof notifConfig) => {
    const nueva = { ...notifConfig, [key]: !notifConfig[key] };
    setNotifConfig(nueva);
    await AsyncStorage.setItem('@financy_notif_config', JSON.stringify(nueva));
    haptics.selection();
  };

  // Animate preview when theme changes
  useEffect(() => {
    previewFade.setValue(0);
    Animated.timing(previewFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [isDark]);

  // Animate toggle thumb
  useEffect(() => {
    Animated.spring(thumbAnim, { toValue: isDark ? 1 : 0, useNativeDriver: true }).start();
    Animated.timing(trackColor, { toValue: isDark ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [isDark]);

  const thumbTranslate = thumbAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 30] });
  const trackBg = trackColor.interpolate({
    inputRange:  [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Icon name="arrow-left" size={20} color={colors.headerIcon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Apariencia</Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>

        {/* ── Sección tema ── */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>TEMA DE LA APP</Text>

        <ThemeOption
          label="Claro"
          subtitle="Siempre modo claro"
          value="light"
          current={preference}
          onSelect={setPreference}
          colors={colors}
        />
        <ThemeOption
          label="Oscuro"
          subtitle="Siempre modo oscuro"
          value="dark"
          current={preference}
          onSelect={setPreference}
          colors={colors}
        />
        <ThemeOption
          label="Sistema"
          subtitle="Sigue el teléfono"
          value="system"
          current={preference}
          onSelect={setPreference}
          colors={colors}
          showBadge
        />

        {/* ── Personalización ── */}
        {onNavigate && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 20 }]}>
              PERSONALIZACIÓN
            </Text>
            <TouchableOpacity
              style={[styles.personalizacionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => onNavigate('personalizacion')}
              activeOpacity={0.75}
            >
              <View style={[styles.personalizacionIcon, { backgroundColor: colors.primaryLight }]}>
                <Icon name="sliders" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.personalizacionTitle, { color: colors.textPrimary }]}>
                  Color, tipografía y formato
                </Text>
                <Text style={[styles.personalizacionSub, { color: colors.textTertiary }]}>
                  Personaliza cada detalle visual de la app
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          </>
        )}

        {/* ── Vista previa ── */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 20 }]}>VISTA PREVIA</Text>
        <Animated.View style={{ opacity: previewFade }}>
          <PreviewCard isDark={isDark} />
        </Animated.View>

        {/* ── Toggle rápido ── */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 20 }]}>CAMBIO RÁPIDO</Text>
        <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>
              {isDark ? 'Modo oscuro activo' : 'Modo claro activo'}
            </Text>
            <Text style={[styles.toggleSub, { color: colors.textTertiary }]}>
              Toca para cambiar
            </Text>
          </View>
          <TouchableOpacity onPress={toggle} activeOpacity={0.9}>
            <Animated.View style={[styles.toggleTrack, { backgroundColor: trackBg }]}>
              <Animated.View style={[
                styles.toggleThumb,
                { transform: [{ translateX: thumbTranslate }] },
              ]}>
                <Icon
                  name={isDark ? 'moon' : 'sun'}
                  size={12}
                  color={isDark ? '#000' : colors.warning}
                />
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* ── Notificaciones ── */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 24 }]}>
          NOTIFICACIONES
        </Text>

        <View style={[styles.notifCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Estado de permisos */}
          <View style={styles.notifStatusRow}>
            <View style={[
              styles.notifStatusIcon,
              { backgroundColor: permisosNotif ? colors.incomeLight : colors.expenseLight },
            ]}>
              <Icon
                name={permisosNotif ? 'bell' : 'bell-off'}
                size={18}
                color={permisosNotif ? colors.income : colors.expense}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifStatusTitle, { color: colors.textPrimary }]}>
                {permisosNotif ? 'Notificaciones activas' : 'Notificaciones desactivadas'}
              </Text>
              <Text style={[styles.notifStatusSub, { color: colors.textSecondary }]}>
                {permisosNotif
                  ? 'Recibes alertas financieras inteligentes'
                  : 'Activaelas para no perder pagos importantes'}
              </Text>
            </View>
            {!permisosNotif && (
              <TouchableOpacity
                onPress={() => {
                  haptics.medium();
                  Notifications.requestPermissionsAsync().then(({ status }) => {
                    setPermisosNotif(status === 'granted');
                  });
                }}
                style={[styles.notifActivateBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.notifActivateBtnTxt}>Activar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Toggles por tipo */}
          {(
            [
              { key: 'pagos',       label: 'Pagos proximos y vencidos', icon: 'calendar',    desc: 'Alertas 3 dias antes y el dia del vencimiento' },
              { key: 'presupuesto', label: 'Limites de presupuesto',    icon: 'alert-circle', desc: 'Cuando llegas al 80% y 100% de una categoria'  },
              { key: 'racha',       label: 'Racha en riesgo',           icon: 'zap',          desc: 'Si no registras actividad en el dia'           },
              { key: 'semanal',     label: 'Resumen semanal',           icon: 'bar-chart-2',  desc: 'Cada lunes a las 9am'                          },
              { key: 'inusual',     label: 'Gastos inusuales',          icon: 'trending-up',  desc: 'Cuando un gasto supera 2.5x tu promedio'       },
            ] as const
          ).map(item => (
            <View
              key={item.key}
              style={[styles.notifItem, { borderTopColor: colors.borderSubtle }]}
            >
              <Icon name={item.icon as any} size={16} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifItemLabel, { color: colors.textPrimary }]}>
                  {item.label}
                </Text>
                <Text style={[styles.notifItemDesc, { color: colors.textTertiary }]}>
                  {item.desc}
                </Text>
              </View>
              <NotifToggle
                active={notifConfig[item.key] && permisosNotif}
                disabled={!permisosNotif}
                onPress={() => toggleNotif(item.key)}
                colors={colors}
              />
            </View>
          ))}
        </View>

        {/* Reprogramar manualmente */}
        {/* ── Sección Finn IA ────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 24 }]}>
          FINN IA
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Estado de conexión */}
          <View style={styles.iaRow}>
            <View style={[styles.iaIcon, {
              backgroundColor: estadoIA === 'conectado' ? colors.incomeLight
                : estadoIA === 'error' ? colors.expenseLight
                : colors.inputBg,
            }]}>
              <Icon
                name={estadoIA === 'conectado' ? 'cpu' : estadoIA === 'error' ? 'wifi-off' : 'loader'}
                size={18}
                color={estadoIA === 'conectado' ? colors.income : estadoIA === 'error' ? colors.expense : colors.textTertiary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.iaTitle, { color: colors.textPrimary }]}>
                {estadoIA === 'conectado' ? 'Finn IA conectado'
                  : estadoIA === 'error' ? 'Sin conexión a Finn IA'
                  : 'Verificando conexión…'}
              </Text>
              <Text style={[styles.iaSub, { color: colors.textSecondary }]}>
                {estadoIA === 'conectado'
                  ? 'Usando claude-haiku-4-5 via Cloudflare Worker'
                  : 'Modo básico con respuestas locales'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEstadoIA('verificando');
                verificarConexionWorker().then(ok => setEstadoIA(ok ? 'conectado' : 'error'));
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="refresh-cw" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Nota informativa */}
          <View style={[styles.iaNota, { borderTopColor: colors.border }]}>
            <Text style={[styles.iaNotaText, { color: colors.textSecondary }]}>
              Finn analiza tus finanzas en tiempo real. Tus datos se envían de forma segura al asistente y nunca se almacenan en servidores externos.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={async () => {
            haptics.medium();
            await reprogramarTodasLasNotificaciones(
              categories, transactions, profile?.monthlySalary ?? 0,
            );
            mostrarToast('Notificaciones actualizadas', 'success');
          }}
          style={[styles.notifReprogramBtn, { borderColor: colors.border }]}
        >
          <Icon name="refresh-cw" size={14} color={colors.textSecondary} />
          <Text style={[styles.notifReprogramTxt, { color: colors.textSecondary }]}>
            Reprogramar notificaciones
          </Text>
        </TouchableOpacity>

      </ScrollView>

      <Toast
        visible={toast.visible}
        mensaje={toast.mensaje}
        tipo={toast.tipo}
        onHide={ocultarToast}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
  },
  scroll: {
    padding: 16,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },

  // Theme option
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    gap: 12,
    marginBottom: 8,
  },
  previewThumb: {
    width: 48,
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbBg: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 4,
    gap: 4,
    justifyContent: 'center',
  },
  thumbLine: {
    height: 3,
    borderRadius: 2,
    width: '70%',
  },
  thumbDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  splitPreview: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  splitLeft: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0, right: '50%',
    backgroundColor: '#FFFFFF',
  },
  splitRight: {
    position: 'absolute',
    top: 0, left: '50%', bottom: 0, right: 0,
    backgroundColor: '#1C1C1F',
  },
  splitDiag: {
    position: 'absolute',
    top: 0, bottom: 0,
    left: '45%',
    width: 10,
    backgroundColor: '#ccc',
    transform: [{ skewX: '-8deg' }],
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionSub: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  recBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.surface,
  },

  // Preview card
  previewCard: {
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 12,
    gap: 10,
  },
  previewBalance: {
    borderRadius: 10,
    padding: 10,
  },
  previewBalanceLabel: {
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 2,
  },
  previewBalanceValue: {
    fontSize: 18,
    fontWeight: '500',
  },
  previewTx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
  },
  previewTxIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTxLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
  },
  previewTxAmount: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Notif toggle switch (module-level)
  notifCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  notifStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  notifStatusIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifStatusTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  notifStatusSub: {
    fontSize: 12,
    marginTop: 1,
  },
  notifActivateBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  notifActivateBtnTxt: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderTopWidth: 0.5,
  },
  notifItemLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  notifItemDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  notifTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  notifThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: THEME.colors.surface,
  },
  // IA section
  card: {
    borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 8,
  },
  iaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
  },
  iaIcon: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  iaTitle: { fontSize: 14, fontWeight: '600' },
  iaSub:   { fontSize: 12, marginTop: 1 },
  iaNota:  { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  iaNotaText: { fontSize: 12, lineHeight: 18 },

  notifReprogramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 12,
    marginBottom: 8,
  },
  notifReprogramTxt: {
    fontSize: 13,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
    gap: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleSub: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  toggleTrack: {
    width: 56,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    position: 'relative',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  personalizacionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 4,
  },
  personalizacionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalizacionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  personalizacionSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '400',
  },
});
