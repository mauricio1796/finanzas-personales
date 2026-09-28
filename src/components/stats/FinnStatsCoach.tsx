/**
 * Finn dentro de Estadísticas.
 *
 * - FinnPulseCard: lectura en vivo del mes (pulso 0–100 + señales). Se calcula
 *   localmente y se actualiza en cuanto cambia un movimiento, sin llamar a la IA.
 * - FinnChartButton: botón "Finn" en la cabecera de cada gráfica.
 * - FinnStatsSheet: chat con Finn que recibe la descripción de la pantalla
 *   (pestaña, gráfica en foco y sus números) en cada mensaje.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, Animated, AccessibilityInfo,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../state/ThemeContext';
import { useFinance } from '../../state';
import { Icon, type FeatherName } from '../ui/Icon';
import { enviarMensajeAFinn, type MensajeChat } from '../../services/RealAIService';
import { consentService } from '../../services/ConsentService';
import {
  TAB_LABELS, CHART_LABELS, preguntasSugeridas, preguntaDeGrafica, respuestaLocalStats,
  type AnalisisStats, type ProyeccionMes, type StatsTab, type StatsChartId, type EstadoPulso, type TipoSenal,
} from '../../utils/statsCoach';

// ── Helpers visuales ──────────────────────────────────────────────────────────

function useEstadoColor(estado: EstadoPulso): string {
  const { colors } = useTheme();
  switch (estado) {
    case 'saludable': return colors.income;
    case 'estable':   return colors.primary;
    case 'riesgo':    return colors.warning;
    case 'critico':   return colors.danger;
    default:          return colors.textTertiary;
  }
}

function useSenalEstilo(tipo: TipoSenal): { icon: FeatherName; color: string } {
  const { colors } = useTheme();
  switch (tipo) {
    case 'alerta':   return { icon: 'alert-octagon',  color: colors.danger };
    case 'atencion': return { icon: 'alert-triangle', color: colors.warning };
    case 'positivo': return { icon: 'check-circle',   color: colors.income };
    default:         return { icon: 'info',           color: colors.primary };
  }
}

const limpiarMarkdown = (t: string) => t.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^#+\s*/gm, '');

const FinnAvatar: React.FC<{ size?: number }> = ({ size = 38 }) => {
  const { colors } = useTheme();
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, shadowColor: colors.primary }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.36 }]}>FI</Text>
    </View>
  );
};

/** Punto "en vivo" con latido suave; estático si el sistema pide reducir movimiento. */
const LiveDot: React.FC<{ color: string }> = ({ color }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancel = false;
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (reduce || cancel) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]));
      loop.start();
    }).catch(() => {});
    return () => { cancel = true; loop?.stop(); };
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  return (
    <View style={s.liveDotWrap}>
      <Animated.View style={[s.liveDotHalo, { backgroundColor: color, opacity, transform: [{ scale }] }]} />
      <View style={[s.liveDot, { backgroundColor: color }]} />
    </View>
  );
};

const ScoreRing: React.FC<{ score: number | null; color: string; track: string; textColor: string }> = ({ score, color, track, textColor }) => {
  const SIZE = 58, STROKE = 6, R = (SIZE - STROKE) / 2, C = 2 * Math.PI * R;
  const frac = score === null ? 0 : Math.max(0, Math.min(1, score / 100));
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={track} strokeWidth={STROKE} fill="none" />
        {frac > 0 && (
          <Circle
            cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={color} strokeWidth={STROKE} fill="none"
            strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </Svg>
      <Text style={{ fontSize: 17, fontWeight: '800', color: textColor, letterSpacing: -0.5 }}>{score ?? '—'}</Text>
    </View>
  );
};

const SenalRow: React.FC<{ tipo: TipoSenal; texto: string }> = ({ tipo, texto }) => {
  const { colors } = useTheme();
  const est = useSenalEstilo(tipo);
  return (
    <View style={s.senalRow}>
      <View style={[s.senalIcon, { backgroundColor: est.color + '1A' }]}>
        <Icon name={est.icon} size={12} color={est.color} />
      </View>
      <Text style={[s.senalText, { color: colors.textSecondary }]}>{texto}</Text>
    </View>
  );
};

// ── Cierre estimado ───────────────────────────────────────────────────────────

const fmtShort = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1_000_000 ? `$${(a / 1_000_000).toFixed(1).replace('.', ',')}M`
    : a >= 1_000 ? `$${Math.round(a / 1_000)}k` : `$${Math.round(a)}`;
  return n < 0 ? `-${s}` : s;
};

/**
 * Barra: lo gastado a hoy (sólido) + lo que falta según la proyección (suave),
 * con una marca donde está el ingreso del mes.
 */
const ProyeccionBar: React.FC<{ p: ProyeccionMes }> = ({ p }) => {
  const { colors, isDark } = useTheme();
  const escala = Math.max(p.ingreso, p.total, 1);
  const pctHoy = Math.min(100, (p.gastadoHoy / escala) * 100);
  const pctTotal = Math.min(100, (p.total / escala) * 100);
  const pctIngreso = Math.min(100, (p.ingreso / escala) * 100);
  const color = p.margen < 0 ? colors.danger
    : p.margen < p.ingreso * 0.1 ? colors.warning
      : colors.income;
  const nota = p.confianza === 'baja' ? ' · estimación temprana'
    : p.pesoHistorial >= 0.4 ? ' · según tu historial' : '';

  return (
    <View
      style={[s.proyBox, { backgroundColor: isDark ? '#FFFFFF08' : '#0B12200A' }]}
      accessibilityLabel={`Cierre estimado del mes ${fmtShort(p.total)} de ${fmtShort(p.ingreso)} de ingreso`}
    >
      <View style={s.proyHeader}>
        <Text style={[s.proyLabel, { color: colors.textTertiary }]}>CIERRE ESTIMADO</Text>
        <Text style={[s.proyValue, { color: colors.textPrimary }]}>
          {fmtShort(p.total)}
          <Text style={{ color: colors.textTertiary, fontWeight: '500' }}> de {fmtShort(p.ingreso)}</Text>
        </Text>
      </View>
      <View style={[s.proyTrack, { backgroundColor: isDark ? '#2A2A35' : '#E9E8F5' }]}>
        <View style={[s.proyFill, { width: `${pctTotal}%`, backgroundColor: color, opacity: 0.3 }]} />
        <View style={[s.proyFill, { width: `${pctHoy}%`, backgroundColor: color }]} />
        {p.ingreso > 0 && pctIngreso < 100 && (
          <View style={[s.proyMark, { left: `${pctIngreso}%`, backgroundColor: colors.textPrimary }]} />
        )}
      </View>
      <Text style={[s.proyNote, { color: colors.textSecondary }]}>
        <Text style={{ color, fontWeight: '700' }}>
          {p.margen >= 0 ? `Te sobrarían ~${fmtShort(p.margen)}` : `Te faltarían ~${fmtShort(-p.margen)}`}
        </Text>
        {` · llevas ${fmtShort(p.gastadoHoy)}${nota}`}
      </Text>
    </View>
  );
};

// ── FinnPulseCard ─────────────────────────────────────────────────────────────

interface PulseCardProps {
  analisis: AnalisisStats;
  tab:      StatsTab;
  mesLabel: string;
  onAsk:    (pregunta?: string) => void;
}

export const FinnPulseCard: React.FC<PulseCardProps> = ({ analisis, tab, mesLabel, onAsk }) => {
  const { colors, isDark } = useTheme();
  const { pulso, senales } = analisis;
  const color = useEstadoColor(pulso.estado);
  const chips = preguntasSugeridas(tab);

  return (
    <View
      style={[s.pulseCard, { backgroundColor: colors.card, borderColor: colors.primary + '30' }]}
      accessibilityLabel={`Finn en vivo. Pulso financiero ${pulso.score ?? 'sin datos'} de 100, ${pulso.etiqueta}`}
    >
      <View style={s.pulseHeader}>
        <FinnAvatar />
        <View style={{ flex: 1 }}>
          <View style={s.pulseTitleRow}>
            <Text style={[s.pulseTitle, { color: colors.textPrimary }]}>Finn</Text>
            <View style={[s.livePill, { backgroundColor: colors.income + '18' }]}>
              <LiveDot color={colors.income} />
              <Text style={[s.liveText, { color: colors.income }]}>EN VIVO</Text>
            </View>
          </View>
          <Text style={[s.pulseSub, { color: colors.textTertiary }]} numberOfLines={1}>
            Leyendo: {TAB_LABELS[tab]} · {mesLabel}
          </Text>
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <ScoreRing score={pulso.score} color={color} track={isDark ? '#2A2A35' : '#F1F0FF'} textColor={colors.textPrimary} />
          <Text style={[s.estadoLabel, { color }]}>{pulso.etiqueta}</Text>
        </View>
      </View>

      <Text style={[s.pulseResumen, { color: colors.textPrimary }]}>{pulso.resumen}</Text>

      {analisis.proyeccion && analisis.proyeccion.ingreso > 0 && <ProyeccionBar p={analisis.proyeccion} />}

      {senales.length > 0 && (
        <View style={s.senalesList}>
          {senales.slice(0, 3).map((sn, i) => <SenalRow key={i} tipo={sn.tipo} texto={sn.texto} />)}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow} style={{ marginHorizontal: -18 }}>
        {chips.map(q => (
          <TouchableOpacity
            key={q}
            onPress={() => onAsk(q)}
            style={[s.chip, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
          >
            <Text style={[s.chipText, { color: colors.primary }]}>{q}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        onPress={() => onAsk()}
        style={[s.askBtn, { backgroundColor: colors.primary }]}
        accessibilityRole="button"
      >
        <Icon name="message-circle" size={15} color="#fff" />
        <Text style={s.askBtnText}>Pregúntale a Finn sobre tus gráficas</Text>
      </TouchableOpacity>
    </View>
  );
};

// ── FinnChartButton ───────────────────────────────────────────────────────────

export const FinnChartButton: React.FC<{ chart: StatsChartId; onPress: (chart: StatsChartId) => void }> = ({ chart, onPress }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onPress(chart)}
      hitSlop={8}
      style={[s.chartBtn, { backgroundColor: colors.primary + '14' }]}
      accessibilityRole="button"
      accessibilityLabel={`Pedirle a Finn que explique ${CHART_LABELS[chart]}`}
    >
      <Icon name="message-circle" size={11} color={colors.primary} />
      <Text style={[s.chartBtnText, { color: colors.primary }]}>Finn</Text>
    </TouchableOpacity>
  );
};

// ── FinnStatsSheet ────────────────────────────────────────────────────────────

export interface FinnStatsRequest {
  /** Cambia en cada apertura para disparar la pregunta inicial. */
  id:        number;
  pregunta?: string;
  chart?:    StatsChartId;
}

interface SheetProps {
  request:        FinnStatsRequest | null;
  onClose:        () => void;
  analisis:       AnalisisStats;
  tab:            StatsTab;
  mesLabel:       string;
  /** Construye la descripción de la pantalla en el momento de enviar. */
  buildContexto:  (chart?: StatsChartId | null) => string;
  onNavigate?:    (screen: string) => void;
}

interface MsgStats {
  id:     string;
  role:   'user' | 'finn' | 'vista';
  text:   string;
  local?: boolean;
}

export const FinnStatsSheet: React.FC<SheetProps> = ({
  request, onClose, analisis, tab, mesLabel, buildContexto, onNavigate,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { transactions, categories, profile, goal, user, metas, deudas, userLevel } = useFinance();

  const [mensajes, setMensajes] = useState<MsgStats[]>([]);
  const [input, setInput]       = useState('');
  const [cargando, setCargando] = useState(false);
  const [aiConsent, setAiConsent] = useState<boolean | null>(null);

  const historialRef = useRef<MensajeChat[]>([]);
  const vistaRef     = useRef<string>('');
  const scrollRef    = useRef<ScrollView>(null);
  const mountedRef   = useRef(true);

  const visible = request !== null;
  const chart = request?.chart ?? null;
  const vistaLabel = `${TAB_LABELS[tab]} · ${mesLabel}`;

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    consentService.hasAIConsent().then(ok => mountedRef.current && setAiConsent(ok));
    return consentService.subscribe(st => setAiConsent(st.ai_processing?.granted === true));
  }, []);

  // Cada apertura: saludo o separador de contexto, y pregunta inicial si la hay.
  useEffect(() => {
    if (!request) return;
    const nuevos: MsgStats[] = [];
    if (vistaRef.current === '') {
      const p = analisis.pulso;
      nuevos.push({
        id: `intro-${request.id}`, role: 'finn', local: true,
        text: p.estado === 'sin_datos'
          ? `Estoy viendo tus estadísticas de ${mesLabel}. ${p.resumen}`
          : `Estoy viendo tus estadísticas de ${mesLabel}. Tu pulso financiero va en ${p.score}/100 (${p.etiqueta.toLowerCase()}). Pregúntame por cualquier gráfica y te la explico con tus números.`,
      });
    } else if (vistaRef.current !== vistaLabel) {
      nuevos.push({ id: `vista-${request.id}`, role: 'vista', text: `Ahora viendo: ${vistaLabel}` });
    }
    vistaRef.current = vistaLabel;
    if (nuevos.length) setMensajes(prev => [...prev, ...nuevos]);
    if (request.pregunta) enviar(request.pregunta);
  }, [request?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (visible) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [mensajes, cargando, visible]);

  const enviar = async (textoRaw?: string) => {
    const texto = (textoRaw ?? input).trim();
    if (!texto) return;
    // Si Finn aún responde, la pregunta queda escrita en vez de perderse.
    if (cargando) { setInput(texto); return; }
    setInput('');
    setMensajes(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: texto }]);
    setCargando(true);

    let respuesta = respuestaLocalStats(analisis);
    let local = true;
    if (await consentService.hasAIConsent()) {
      const r = await enviarMensajeAFinn(
        texto, historialRef.current,
        transactions as any, categories as any, profile, goal,
        {
          metas, deudas, userLevel, userId: user?.id,
          contextoPantalla: buildContexto(chart),
        },
      );
      if (r.exito && r.error !== 'fallback') {
        respuesta = limpiarMarkdown(r.texto);
        local = false;
      }
    }
    if (!mountedRef.current) return;

    if (!local) {
      historialRef.current = [
        ...historialRef.current,
        { role: 'user' as const, content: texto },
        { role: 'assistant' as const, content: respuesta },
      ].slice(-12);
    }
    setMensajes(prev => [...prev, { id: `f-${Date.now()}`, role: 'finn', text: respuesta, local }]);
    setCargando(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const activarIA = () => {
    const msg = 'Para explicarte tus gráficas con IA, Finn envía a su proveedor (Anthropic) un resumen de tus estadísticas y tu mensaje, sin tu nombre, correo ni identificadores. Puedes desactivarlo cuando quieras en Perfil › Privacidad y mis datos.';
    const conceder = () => consentService.record([{ type: 'ai_processing', granted: true }], 'finn', user?.id);
    if (Platform.OS === 'web') {
      if (window.confirm(`${msg}\n\n¿Activar Finn IA?`)) conceder();
      return;
    }
    Alert.alert('Activar Finn IA', msg, [
      { text: 'Ahora no', style: 'cancel' },
      { text: 'Ver aviso', onPress: () => { onClose(); onNavigate?.('legal-ia'); } },
      { text: 'Activar', onPress: conceder },
    ]);
  };

  const chips = [
    ...(chart ? [preguntaDeGrafica(chart)] : []),
    ...preguntasSugeridas(tab),
  ];
  const isWeb = Platform.OS === 'web';
  const sheetH = Math.round(Dimensions.get('window').height * 0.8);

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={[s.overlay, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Cerrar">
          <Pressable
            onPress={() => {}}
            accessibilityViewIsModal
            style={[
              s.sheet,
              { backgroundColor: colors.background, height: sheetH, maxHeight: '94%', paddingBottom: Math.max(insets.bottom, 10) },
              isWeb && s.sheetWeb,
            ]}
          >
            <View style={[s.handle, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={[s.sheetHeader, { borderBottomColor: colors.border }]}>
              <FinnAvatar size={36} />
              <View style={{ flex: 1 }}>
                <Text style={[s.sheetTitle, { color: colors.textPrimary }]}>Finn · Estadísticas</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <LiveDot color={colors.income} />
                  <Text style={[s.sheetSub, { color: colors.textTertiary }]} numberOfLines={1}>
                    Viendo: {chart ? CHART_LABELS[chart] : vistaLabel}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12} style={[s.closeBtn, { backgroundColor: colors.cardSecondary }]} accessibilityLabel="Cerrar chat">
                <Icon name="x" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {aiConsent === false && (
              <View style={[s.consentBanner, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
                <Text style={[s.consentText, { color: colors.textSecondary }]}>
                  Sin IA te doy una lectura básica. Actívala para que te explique cada gráfica a fondo.
                </Text>
                <TouchableOpacity onPress={activarIA} style={[s.consentBtn, { backgroundColor: colors.primary }]}>
                  <Text style={s.consentBtnText}>Activar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Mensajes */}
            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.msgList} keyboardShouldPersistTaps="handled">
              {mensajes.map(m => {
                if (m.role === 'vista') {
                  return (
                    <View key={m.id} style={s.vistaRow}>
                      <View style={[s.vistaLine, { backgroundColor: colors.border }]} />
                      <Text style={[s.vistaText, { color: colors.textTertiary }]}>{m.text}</Text>
                      <View style={[s.vistaLine, { backgroundColor: colors.border }]} />
                    </View>
                  );
                }
                const isUser = m.role === 'user';
                return (
                  <View key={m.id} style={[s.bubbleRow, isUser && { justifyContent: 'flex-end' }]}>
                    <View style={[
                      s.bubble,
                      isUser
                        ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
                        : { backgroundColor: colors.card, borderBottomLeftRadius: 6 },
                    ]}>
                      <Text style={[s.bubbleText, { color: isUser ? '#fff' : colors.textPrimary }]}>{m.text}</Text>
                      {m.local && !isUser && m.id.startsWith('f-') && (
                        <Text style={[s.localTag, { color: colors.textTertiary }]}>Lectura sin IA</Text>
                      )}
                    </View>
                  </View>
                );
              })}
              {cargando && (
                <View style={s.bubbleRow}>
                  <View style={[s.bubble, s.typing, { backgroundColor: colors.card }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[s.typingText, { color: colors.textTertiary }]}>Finn está leyendo tus gráficas…</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Sugerencias */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.chipsRow, { paddingVertical: 8 }]} style={{ flexGrow: 0 }}>
              {chips.map(q => (
                <TouchableOpacity
                  key={q}
                  disabled={cargando}
                  onPress={() => enviar(q)}
                  style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border, opacity: cargando ? 0.5 : 1 }]}
                >
                  <Text style={[s.chipText, { color: colors.textSecondary }]}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Input */}
            <View style={[s.inputRow, { borderTopColor: colors.border }]}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Pregunta sobre tus gráficas…"
                placeholderTextColor={colors.textTertiary}
                style={[s.input, { backgroundColor: colors.inputBg ?? colors.card, color: colors.textPrimary }]}
                onSubmitEditing={() => enviar()}
                returnKeyType="send"
                maxLength={300}
                editable={!cargando}
              />
              <TouchableOpacity
                onPress={() => enviar()}
                disabled={!input.trim() || cargando}
                style={[s.sendBtn, { backgroundColor: input.trim() && !cargando ? colors.primary : colors.cardSecondary }]}
                accessibilityLabel="Enviar"
              >
                <Icon name="send" size={16} color={input.trim() && !cargando ? '#fff' : colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  avatar: {
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  avatarText: { color: '#fff', fontWeight: '800', letterSpacing: 0.5 },

  liveDotWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  liveDotHalo: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  liveDot:     { width: 6, height: 6, borderRadius: 3 },

  // Pulse card
  pulseCard: {
    borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1, gap: 12,
    shadowColor: '#0B1220', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05, shadowRadius: 24, elevation: 3,
  },
  pulseHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pulseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseTitle:    { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  pulseSub:      { fontSize: 11.5, marginTop: 2 },
  livePill:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  liveText:      { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  estadoLabel:   { fontSize: 10, fontWeight: '700' },
  pulseResumen:  { fontSize: 14, fontWeight: '600', lineHeight: 20 },

  proyBox:    { borderRadius: 16, padding: 12, gap: 8 },
  proyHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  proyLabel:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  proyValue:  { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  proyTrack:  { height: 10, borderRadius: 5, overflow: 'visible', justifyContent: 'center' },
  proyFill:   { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5 },
  proyMark:   { position: 'absolute', width: 2, top: -3, bottom: -3, borderRadius: 1, marginLeft: -1 },
  proyNote:   { fontSize: 12, lineHeight: 17 },

  senalesList: { gap: 8 },
  senalRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  senalIcon:   { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  senalText:   { flex: 1, fontSize: 12.5, lineHeight: 18, paddingTop: 2 },

  chipsRow: { paddingHorizontal: 18, gap: 8, flexDirection: 'row' },
  chip:     { borderRadius: 100, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 12, fontWeight: '600' },

  askBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 12 },
  askBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },

  chartBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 4 },
  chartBtnText: { fontSize: 11, fontWeight: '700' },

  // Sheet
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  sheet:    { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  sheetWeb: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  handle:   { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetTitle:  { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.3 },
  sheetSub:    { fontSize: 11.5, flexShrink: 1 },
  closeBtn:    { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  consentBanner:  { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, marginBottom: 0, padding: 12, borderRadius: 14, borderWidth: 1 },
  consentText:    { flex: 1, fontSize: 12, lineHeight: 17 },
  consentBtn:     { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  consentBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  msgList:   { padding: 16, gap: 10 },
  bubbleRow: { flexDirection: 'row' },
  bubble:    { maxWidth: '86%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  localTag:  { fontSize: 10, marginTop: 6, fontWeight: '600' },
  typing:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { fontSize: 12.5 },

  vistaRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  vistaLine: { flex: 1, height: StyleSheet.hairlineWidth },
  vistaText: { fontSize: 11, fontWeight: '600' },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input:    { flex: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 14 },
  sendBtn:  { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
