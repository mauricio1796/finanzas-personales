import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Animated, Linking, Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { useTheme } from '../state/ThemeContext';
import { storageService } from '../services/storage/StorageService';

// ── Tipos ──────────────────────────────────────────────────────────────────────

type PermStatus = 'idle' | 'granted' | 'denied' | 'loading';

interface PermItem {
  key: 'notifications' | 'microphone';
  icon: string;
  title: string;
  description: string;
  why: string;
  optional: boolean;
}

const PERMISSIONS: PermItem[] = [
  {
    key: 'notifications',
    icon: '🔔',
    title: 'Notificaciones',
    description: 'Recordatorios de pagos, alertas de presupuesto y resúmenes financieros.',
    why: 'Para avisarte cuando un pago se acerca, cuando superas tu presupuesto o cuando alcanzas una meta.',
    optional: false,
  },
  {
    key: 'microphone',
    icon: '🎤',
    title: 'Micrófono',
    description: 'Registra gastos e ingresos con tu voz en segundos.',
    why: 'Solo se activa cuando presionas el botón de voz. Nunca grabamos en segundo plano.',
    optional: true,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

async function checkNotifications(): Promise<PermStatus> {
  if (Platform.OS === 'web') return 'granted';
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'idle';
}

async function checkMicrophone(): Promise<PermStatus> {
  if (Platform.OS === 'web') return 'granted';
  const { status } = await Audio.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'idle';
}

async function requestNotifications(): Promise<PermStatus> {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return status === 'granted' ? 'granted' : 'denied';
}

async function requestMicrophone(): Promise<PermStatus> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

// ── Componente de tarjeta de permiso ──────────────────────────────────────────

interface CardProps {
  item: PermItem;
  status: PermStatus;
  onRequest: () => void;
}

function PermissionCard({ item, status, onRequest }: CardProps) {
  const { colors } = useTheme();

  const openSettings = () => Linking.openSettings();

  const statusLabel = () => {
    switch (status) {
      case 'granted': return '✓ Permitido';
      case 'denied':  return 'Bloqueado';
      case 'loading': return 'Solicitando…';
      default:        return item.optional ? 'Opcional' : 'Requerido';
    }
  };

  const statusColor = () => {
    switch (status) {
      case 'granted': return '#10B981';
      case 'denied':  return '#EF4444';
      default:        return item.optional ? '#9CA3AF' : '#F59E0B';
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: status === 'granted' ? '#ECFDF5' : '#EEF2FF' }]}>
          <Text style={styles.iconText}>{item.icon}</Text>
        </View>
        <View style={styles.cardTitles}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor() + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor() }]}>{statusLabel()}</Text>
          </View>
        </View>
      </View>

      {/* Descripción */}
      <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{item.description}</Text>

      {/* Por qué */}
      <View style={[styles.whyBox, { backgroundColor: colors.background }]}>
        <Text style={[styles.whyLabel, { color: colors.textSecondary }]}>¿Por qué?</Text>
        <Text style={[styles.whyText, { color: colors.textSecondary }]}>{item.why}</Text>
      </View>

      {/* Acción */}
      {status === 'idle' && (
        <Pressable
          style={[styles.allowBtn, { backgroundColor: '#6156E8' }]}
          onPress={onRequest}
        >
          <Text style={styles.allowBtnText}>Permitir acceso</Text>
        </Pressable>
      )}
      {status === 'granted' && (
        <View style={styles.grantedRow}>
          <Text style={styles.grantedText}>✓ Listo</Text>
        </View>
      )}
      {status === 'denied' && (
        <Pressable
          style={[styles.allowBtn, { backgroundColor: '#6B7280' }]}
          onPress={openSettings}
        >
          <Text style={styles.allowBtnText}>Abrir Configuración</Text>
        </Pressable>
      )}
      {status === 'loading' && (
        <View style={[styles.allowBtn, { backgroundColor: '#6156E820' }]}>
          <Text style={[styles.allowBtnText, { color: '#6156E8' }]}>Solicitando…</Text>
        </View>
      )}
    </View>
  );
}

// ── Pantalla principal ─────────────────────────────────────────────────────────

interface Props {
  onDone: () => void;
}

export function PermissionsScreen({ onDone }: Props) {
  const { colors } = useTheme();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const [statuses, setStatuses] = useState<Record<string, PermStatus>>({
    notifications: 'idle',
    microphone: 'idle',
  });

  // Verificar permisos ya otorgados al montar
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    (async () => {
      const [notif, mic] = await Promise.all([checkNotifications(), checkMicrophone()]);
      setStatuses({ notifications: notif, microphone: mic });
    })();
  }, []);

  const handleRequest = async (key: 'notifications' | 'microphone') => {
    setStatuses(prev => ({ ...prev, [key]: 'loading' }));
    const result = key === 'notifications'
      ? await requestNotifications()
      : await requestMicrophone();
    setStatuses(prev => ({ ...prev, [key]: result }));
  };

  const handleContinue = async () => {
    await storageService.setPermissionsShown(true);
    onDone();
  };

  // El botón continuar siempre está disponible (los permisos opcionales no bloquean)
  const requiredGranted = statuses.notifications !== 'idle';

  return (
    <Animated.View style={[styles.root, { backgroundColor: colors.background, opacity: fadeAnim }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Text style={styles.heroIcon}>🔐</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Permisos de la app
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            FinancyAI necesita acceso a algunos servicios del dispositivo para funcionar correctamente. Tú decides qué permitir.
          </Text>
        </View>

        {/* Cards */}
        <View style={styles.cards}>
          {PERMISSIONS.map(item => (
            <PermissionCard
              key={item.key}
              item={item}
              status={statuses[item.key]}
              onRequest={() => handleRequest(item.key)}
            />
          ))}
        </View>

        {/* Nota de privacidad */}
        <View style={[styles.privacyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.privacyIcon}>🛡️</Text>
          <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
            Nunca vendemos ni compartimos tus datos. Los permisos se usan únicamente para las funciones descritas arriba. Puedes revocarlos en cualquier momento desde Configuración del dispositivo.
          </Text>
        </View>

        {/* Botón continuar */}
        <Pressable
          style={[
            styles.continueBtn,
            { backgroundColor: requiredGranted ? '#6156E8' : '#6156E860' },
          ]}
          onPress={handleContinue}
        >
          <Text style={styles.continueBtnText}>
            {requiredGranted ? 'Continuar →' : 'Omitir por ahora'}
          </Text>
        </Pressable>

        {!requiredGranted && (
          <Text style={[styles.skipNote, { color: colors.textSecondary }]}>
            Podrás activar los permisos más tarde desde Configuración
          </Text>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },

  // Hero
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroIcon: {
    fontSize: 36,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },

  // Cards
  cards: {
    gap: 12,
    marginBottom: 20,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 22,
  },
  cardTitles: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  whyBox: {
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
  whyLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  whyText: {
    fontSize: 12,
    lineHeight: 17,
  },
  allowBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  allowBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  grantedRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  grantedText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 14,
  },

  // Privacidad
  privacyBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  privacyIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },

  // Continuar
  continueBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  skipNote: {
    fontSize: 12,
    textAlign: 'center',
  },
});
