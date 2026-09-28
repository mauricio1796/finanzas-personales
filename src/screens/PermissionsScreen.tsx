/**
 * PermissionsScreen — permisos del dispositivo en el primer arranque.
 *
 * Diseñado para pasar revisión en App Store y Google Play:
 * - Un permiso por paso, explicando para qué sirve ANTES del diálogo nativo.
 * - El botón dice "Continuar" y abre SIEMPRE el diálogo del sistema: la
 *   decisión (Permitir / No permitir) la toma el usuario ahí. No hay "Omitir"
 *   antes del diálogo (Apple 5.1.1 rechaza pre-permisos que lo evitan).
 * - Los permisos ya decididos se saltan. Cámara y Face ID se piden en
 *   contexto, cuando el usuario usa esa función.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated, Image,
  Linking, Platform, AccessibilityInfo, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { useTheme } from '../state/ThemeContext';
import { storageService } from '../services/storage/StorageService';
import { Icon, type FeatherName } from '../components/ui/Icon';
import {
  estadoPermisoNotificaciones, solicitarPermisoNotificaciones, enviarNotificacionBienvenida,
  type EstadoPermisoNotif,
} from '../services/NotificacionesService';

const APP_ICON = require('../../assets/images/icon.png');
const FINN_AVATAR = require('../../assets/images/finn-avatar.png');

// ── Permisos ──────────────────────────────────────────────────────────────────

type PermKey = 'notificaciones' | 'microfono';
type Estado = EstadoPermisoNotif;

async function estadoMicrofono(): Promise<Estado> {
  if (Platform.OS === 'web') return 'no_disponible';
  const p = await getRecordingPermissionsAsync();
  if (p.granted) return 'concedido';
  if (p.status === 'undetermined') return 'sin_preguntar';
  return p.canAskAgain ? 'denegado' : 'bloqueado';
}

async function solicitarMicrofono(): Promise<Estado> {
  await requestRecordingPermissionsAsync();
  return estadoMicrofono();
}

const leer: Record<PermKey, () => Promise<Estado>> = {
  notificaciones: estadoPermisoNotificaciones,
  microfono:      estadoMicrofono,
};

const pedir: Record<PermKey, () => Promise<Estado>> = {
  notificaciones: solicitarPermisoNotificaciones,
  microfono:      solicitarMicrofono,
};

/** Solo se muestran los pasos que el sistema todavía puede preguntar. */
const sePuedePreguntar = (e: Estado) => e === 'sin_preguntar' || e === 'denegado';

interface PasoInfo {
  badge:     FeatherName;
  titulo:    string;
  subtitulo: string;
  beneficios: { icon: FeatherName; texto: string }[];
  nota:      string;
}

const PASOS: Record<PermKey, PasoInfo> = {
  notificaciones: {
    badge: 'bell',
    titulo: 'Deja que Finn te avise a tiempo',
    subtitulo: 'Te escribiré solo cuando valga la pena: nada de spam.',
    beneficios: [
      { icon: 'calendar',     texto: 'Recordatorios antes de que venza un pago' },
      { icon: 'alert-circle', texto: 'Alertas cuando una categoría se acerca a su límite' },
      { icon: 'bar-chart-2',  texto: 'Tu resumen de la semana y el cierre de mes' },
    ],
    nota: 'En la pantalla de bloqueo no se muestran montos. Puedes elegir qué avisos recibir en Configuración.',
  },
  microfono: {
    badge: 'mic',
    titulo: 'Háblale a Finn',
    subtitulo: 'Di "gasté 18 mil en almuerzo" y queda registrado.',
    beneficios: [
      { icon: 'zap',        texto: 'Registra gastos e ingresos en segundos' },
      { icon: 'mic',        texto: 'Solo escucho mientras mantienes el botón de voz' },
      { icon: 'shield',     texto: 'Nunca grabo en segundo plano' },
    ],
    nota: 'Si prefieres escribir, puedes usar la app sin micrófono.',
  },
};

// ── Vista previa de notificación ──────────────────────────────────────────────

const NotifPreview: React.FC<{ titulo: string; grupo: string; cuerpo: string; hace: string; dim?: boolean }> = ({ titulo, grupo, cuerpo, hace, dim }) => {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        s.notif,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF', borderColor: colors.border, opacity: dim ? 0.55 : 1 },
        dim && { transform: [{ scale: 0.94 }], marginTop: -10 },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={APP_ICON} style={s.notifIcon} />
      <View style={{ flex: 1 }}>
        <View style={s.notifTop}>
          <Text style={[s.notifApp, { color: colors.textTertiary }]}>FINANCYAI</Text>
          <Text style={[s.notifApp, { color: colors.textTertiary }]}>{hace}</Text>
        </View>
        <Text style={[s.notifTitle, { color: colors.textPrimary }]} numberOfLines={1}>{titulo}</Text>
        <Text style={[s.notifGroup, { color: colors.textPrimary }]} numberOfLines={1}>{grupo}</Text>
        <Text style={[s.notifBody, { color: colors.textSecondary }]} numberOfLines={2}>{cuerpo}</Text>
      </View>
    </View>
  );
};

// ── Pantalla ──────────────────────────────────────────────────────────────────

interface Props {
  onDone: () => void;
}

export function PermissionsScreen({ onDone }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [pasos, setPasos]       = useState<PermKey[] | null>(null);
  const [idx, setIdx]           = useState(0);
  const [pidiendo, setPidiendo] = useState(false);
  const [resultados, setResultados] = useState<Partial<Record<PermKey, Estado>>>({});

  const anim = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(v => { reduceMotion.current = v; }).catch(() => {});
    (async () => {
      const keys: PermKey[] = ['notificaciones', 'microfono'];
      const estados = await Promise.all(keys.map(k => leer[k]().catch(() => 'no_disponible' as Estado)));
      setResultados(Object.fromEntries(keys.map((k, i) => [k, estados[i]])));
      const pendientes = keys.filter((_, i) => sePuedePreguntar(estados[i]));
      if (pendientes.length === 0) { terminar(); return; }
      setPasos(pendientes);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Entrada de cada paso
  useEffect(() => {
    if (!pasos) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1, duration: reduceMotion.current ? 0 : 320, useNativeDriver: true,
    }).start();
  }, [idx, pasos, anim]);

  const terminar = async () => {
    await storageService.setPermissionsShown(true);
    onDone();
  };

  const esResumen = pasos !== null && idx >= pasos.length;
  const pasoActual = pasos && !esResumen ? pasos[idx] : null;

  const continuar = async () => {
    if (!pasoActual || pidiendo) return;
    setPidiendo(true);
    try {
      const estado = await pedir[pasoActual]();
      setResultados(r => ({ ...r, [pasoActual]: estado }));
      if (pasoActual === 'notificaciones' && estado === 'concedido') {
        enviarNotificacionBienvenida().catch(() => {});
      }
    } catch {
      // Si el sistema falla, se sigue: el usuario puede activarlo en Configuración.
    } finally {
      setPidiendo(false);
      setIdx(i => i + 1);
    }
  };

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  if (!pasos) {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Progreso */}
        {!esResumen && pasos.length > 1 && (
          <View style={s.dots} accessibilityLabel={`Paso ${idx + 1} de ${pasos.length}`}>
            {pasos.map((_, i) => (
              <View
                key={i}
                style={[s.dot, { backgroundColor: i <= idx ? colors.primary : colors.border, width: i === idx ? 22 : 8 }]}
              />
            ))}
          </View>
        )}

        <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
          {pasoActual ? (
            <PasoView paso={pasoActual} />
          ) : (
            <Resumen resultados={resultados} />
          )}
        </Animated.View>
      </ScrollView>

      {/* Acción */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        {pasoActual ? (
          <>
            <Pressable
              onPress={continuar}
              disabled={pidiendo}
              style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed || pidiendo ? 0.85 : 1 }]}
              accessibilityRole="button"
            >
              {pidiendo
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.primaryBtnText}>Continuar</Text>}
            </Pressable>
            <Text style={[s.footNote, { color: colors.textTertiary }]}>
              A continuación verás el aviso del sistema para elegir.
            </Text>
          </>
        ) : (
          <Pressable
            onPress={terminar}
            style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            accessibilityRole="button"
          >
            <Text style={s.primaryBtnText}>Empezar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Paso ──────────────────────────────────────────────────────────────────────

const PasoView: React.FC<{ paso: PermKey }> = ({ paso }) => {
  const { colors } = useTheme();
  const info = PASOS[paso];
  return (
    <View>
      <View style={s.hero}>
        <View>
          <Image source={FINN_AVATAR} style={s.avatar} accessibilityLabel="Finn" />
          <View style={[s.avatarBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
            <Icon name={info.badge} size={14} color="#fff" />
          </View>
        </View>
        <Text style={[s.title, { color: colors.textPrimary }]} accessibilityRole="header">{info.titulo}</Text>
        <Text style={[s.subtitle, { color: colors.textSecondary }]}>{info.subtitulo}</Text>
      </View>

      {paso === 'notificaciones' && (
        <View style={s.previews}>
          <NotifPreview
            hace="ahora"
            titulo="Arriendo vence en 3 días"
            grupo="Finn · Pagos"
            cuerpo="El día 5 vence Arriendo. Si ya lo pagaste, márcalo y dejo de recordártelo."
          />
          <NotifPreview
            dim
            hace="lun"
            titulo="Tu semana en números 📈"
            grupo="Finn · Resumen"
            cuerpo="Ya preparé tu resumen semanal."
          />
        </View>
      )}

      <View style={[s.benefits, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {info.beneficios.map(b => (
          <View key={b.texto} style={s.benefitRow}>
            <View style={[s.benefitIcon, { backgroundColor: colors.primary + '14' }]}>
              <Icon name={b.icon} size={15} color={colors.primary} />
            </View>
            <Text style={[s.benefitText, { color: colors.textPrimary }]}>{b.texto}</Text>
          </View>
        ))}
      </View>

      <View style={s.noteRow}>
        <Icon name="lock" size={13} color={colors.textTertiary} />
        <Text style={[s.note, { color: colors.textTertiary }]}>{info.nota}</Text>
      </View>
    </View>
  );
};

// ── Resumen ───────────────────────────────────────────────────────────────────

const Resumen: React.FC<{ resultados: Partial<Record<PermKey, Estado>> }> = ({ resultados }) => {
  const { colors } = useTheme();
  const filas = useMemo(() => ([
    { key: 'notificaciones' as const, label: 'Notificaciones', icon: 'bell' as FeatherName },
    { key: 'microfono' as const,      label: 'Micrófono',      icon: 'mic' as FeatherName },
  ]).filter(f => resultados[f.key] && resultados[f.key] !== 'no_disponible'), [resultados]);

  const algunoNo = filas.some(f => resultados[f.key] !== 'concedido');

  return (
    <View>
      <View style={s.hero}>
        <Image source={FINN_AVATAR} style={s.avatar} accessibilityLabel="Finn" />
        <Text style={[s.title, { color: colors.textPrimary }]} accessibilityRole="header">¡Todo listo!</Text>
        <Text style={[s.subtitle, { color: colors.textSecondary }]}>
          Así quedaron tus permisos. Puedes cambiarlos cuando quieras.
        </Text>
      </View>

      <View style={[s.benefits, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {filas.map(f => {
          const ok = resultados[f.key] === 'concedido';
          return (
            <View key={f.key} style={s.benefitRow}>
              <View style={[s.benefitIcon, { backgroundColor: (ok ? colors.income : colors.textTertiary) + '18' }]}>
                <Icon name={f.icon} size={15} color={ok ? colors.income : colors.textTertiary} />
              </View>
              <Text style={[s.benefitText, { color: colors.textPrimary }]}>{f.label}</Text>
              <Text style={[s.statusText, { color: ok ? colors.income : colors.textTertiary }]}>
                {ok ? 'Activado' : 'Desactivado'}
              </Text>
            </View>
          );
        })}
        <View style={s.benefitRow}>
          <View style={[s.benefitIcon, { backgroundColor: colors.primary + '14' }]}>
            <Icon name="camera" size={15} color={colors.primary} />
          </View>
          <Text style={[s.benefitText, { color: colors.textSecondary }]}>
            Cámara y {Platform.OS === 'ios' ? 'Face ID' : 'huella'} te los pediré cuando uses esas funciones.
          </Text>
        </View>
      </View>

      {algunoNo && (
        <Pressable onPress={() => Linking.openSettings()} style={s.settingsLink} accessibilityRole="link">
          <Icon name="settings" size={13} color={colors.primary} />
          <Text style={[s.settingsText, { color: colors.primary }]}>Abrir ajustes del dispositivo</Text>
        </Pressable>
      )}
    </View>
  );
};

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 20 },
  dot:  { height: 8, borderRadius: 4 },

  hero:     { alignItems: 'center', marginBottom: 22 },
  avatar:   { width: 96, height: 96, borderRadius: 48, marginBottom: 18 },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: 14, width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3,
  },
  title:    { fontSize: 25, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14.5, lineHeight: 21, textAlign: 'center', maxWidth: 320 },

  previews: { marginBottom: 20 },
  notif: {
    flexDirection: 'row', gap: 10, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 12,
    shadowColor: '#0B1220', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3,
  },
  notifIcon:  { width: 36, height: 36, borderRadius: 9 },
  notifTop:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  notifApp:   { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.4 },
  notifTitle: { fontSize: 13.5, fontWeight: '700' },
  notifGroup: { fontSize: 12.5, fontWeight: '600', opacity: 0.85 },
  notifBody:  { fontSize: 12.5, lineHeight: 17, marginTop: 1 },

  benefits:    { borderRadius: 20, borderWidth: 1, padding: 16, gap: 14 },
  benefitRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  benefitText: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '500' },
  statusText:  { fontSize: 12.5, fontWeight: '700' },

  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 14, paddingHorizontal: 4 },
  note:    { flex: 1, fontSize: 12, lineHeight: 17 },

  settingsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, padding: 8 },
  settingsText: { fontSize: 13, fontWeight: '700' },

  footer:     { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  primaryBtn: { borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  footNote:   { fontSize: 11.5, textAlign: 'center' },
});
