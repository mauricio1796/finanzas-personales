import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  TouchableOpacity,
  Modal,
  View,
  Text,
  FlatList,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import {
  procesarMensajeUsuario,
  type BotAccion,
  type CategoriaSugerida,
} from '../services/ai/AIService';
import {
  enviarMensajeAFinn,
  enviarMensajeAgenteAFinn,
  verificarConexionWorker,
  type MensajeChat,
} from '../services/RealAIService';
import { ejecutarHerramienta, previewEliminar, type FinnToolCall, type FinnToolResult } from '../services/AgentService';
import { VoiceButton } from '../components/ui/VoiceButton';
import { catalogoItemToCategory, CATALOGO_CATEGORIAS, getPaletaItem } from '../constants/catalogoCategorias';
import { THEME } from '../constants/theme';
import { reprogramarTodasLasNotificaciones } from '../services/NotificacionesService';

const { width: SCREEN_W } = Dimensions.get('window');

const PRIMARY      = '#6156E8';
const PRIMARY_SOFT = '#EEF0FF';
const BG           = '#F8F7FF';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface FinnAction {
  tool:        string;
  descripcion: string;
  exito:       boolean;
}

interface Message {
  id:          string;
  text:        string;
  sender:      'user' | 'bot';
  timestamp:   Date;
  accion?:     BotAccion;
  esError?:    boolean;
  accionFinn?: FinnAction;
}

interface PendingAction {
  toolCall: FinnToolCall;
  preview:  string;
}

interface BotIAProps {
  transactions:  any[];
  monthlySalary: number;
  onBack?:       () => void;
}

// ── Quick suggestions ─────────────────────────────────────────────────────────

const QUICK_SUGGESTIONS = [
  { label: 'Mis pagos',        emoji: '📋' },
  { label: 'Esta semana',      emoji: '📅' },
  { label: 'Mi mes',           emoji: '📊' },
  { label: 'Alertas',          emoji: '🚨' },
  { label: 'Mi nivel',         emoji: '🏆' },
  { label: 'Cómo ahorrar',     emoji: '💡' },
  { label: 'Agregar categoría',emoji: '➕' },
];

// ── FinnAvatar ────────────────────────────────────────────────────────────────

const FinnAvatar: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <View style={[st.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[st.avatarText, { fontSize: size * 0.38 }]}>FI</Text>
  </View>
);

// ── TypingIndicator ───────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue:  0, duration: 280, useNativeDriver: true }),
          Animated.delay(400),
        ]),
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 140);
    const a3 = anim(dot3, 280);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={st.typingBubble}>
      <Text style={st.typingLabel}>Finn está escribiendo</Text>
      <View style={st.dotsRow}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[st.dot, { transform: [{ translateY: dot }] }]} />
        ))}
      </View>
    </View>
  );
};

// ── ConfirmacionCategorias ────────────────────────────────────────────────────

interface ConfirmacionCategoriasProps {
  categorias:    CategoriaSugerida[];
  seleccionadas: Set<string>;
  onToggle:      (nombre: string) => void;
  onConfirmar:   () => void;
  onCancelar:    () => void;
}

const ConfirmacionCategorias: React.FC<ConfirmacionCategoriasProps> = ({
  categorias, seleccionadas, onToggle, onConfirmar, onCancelar,
}) => {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ marginTop: 8, marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {categorias.map(cat => {
          const activa = seleccionadas.has(cat.nombre);
          const paleta = getPaletaItem(cat.nombre, isDark);
          return (
            <TouchableOpacity
              key={cat.nombre}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onToggle(cat.nombre);
              }}
              activeOpacity={0.8}
              style={{
                width: '30%', aspectRatio: 1, borderRadius: 16,
                borderWidth: activa ? 1.5 : 0.5,
                borderColor: activa ? PRIMARY : colors.border,
                backgroundColor: activa ? PRIMARY_SOFT : colors.card,
                alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8,
              }}
            >
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: paleta.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={cat.icono as any} size={16} color={activa ? PRIMARY : paleta.color} />
              </View>
              <Text style={{ fontSize: 10, fontWeight: '500', color: activa ? PRIMARY : colors.textSecondary, textAlign: 'center' }} numberOfLines={2}>
                {cat.nombre}
              </Text>
              {cat.presupuestoSugerido > 0 && (
                <Text style={{ fontSize: 9, color: colors.textTertiary }}>
                  ${Math.round(cat.presupuestoSugerido / 1000)}k/mes
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={onCancelar}
          style={{ flex: 1, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border, padding: 10, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onConfirmar}
          disabled={seleccionadas.size === 0}
          style={{ flex: 2, borderRadius: 12, backgroundColor: seleccionadas.size > 0 ? PRIMARY : colors.cardSecondary, padding: 10, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 13, fontWeight: '500', color: seleccionadas.size > 0 ? '#fff' : colors.textTertiary }}>
            {seleccionadas.size > 0 ? `Agregar ${seleccionadas.size} categoría${seleccionadas.size > 1 ? 's' : ''}` : 'Selecciona categorías'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── BotIA ─────────────────────────────────────────────────────────────────────

export function BotIA({ transactions, monthlySalary, onBack }: BotIAProps) {
  const { colors } = useTheme();
  const { profile, goal, categories, addCategory, updateCategory, deleteCategory, addTransaction, deleteTransaction, updateTransaction, setGoal } = useFinance();
  const insets = useSafeAreaInsets();

  const [messages, setMessages]   = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping]   = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const scrollRef    = useRef<FlatList<Message>>(null);
  const historialRef = useRef<MensajeChat[]>([]);

  const [catsPendientes,    setCatsPendientes]    = useState<CategoriaSugerida[]>([]);
  const [catsSeleccionadas, setCatsSeleccionadas] = useState<Set<string>>(new Set());
  const [confirmacionId,    setConfirmacionId]    = useState<string | null>(null);
  const [pendingAction,     setPendingAction]     = useState<PendingAction | null>(null);

  // ── Ping Worker + saludo inicial ──────────────────────────────────────────
  useEffect(() => {
    verificarConexionWorker().then(ok => setWorkerStatus(ok ? 'online' : 'offline'));

    const genSaludo = async () => {
      setIsTyping(true);
      const resp = await enviarMensajeAFinn(
        'Salúdame brevemente por mi nombre y menciona UNA cosa concreta e interesante de mis finanzas actuales. Sé muy breve y amigable.',
        [],
        transactions as any, categories as any, profile, goal,
      );
      setIsTyping(false);
      const msg: Message = { id: 'inicial', text: resp.texto, sender: 'bot', timestamp: new Date() };
      setMessages([msg]);
      historialRef.current = [{ role: 'assistant', content: resp.texto }];
    };

    genSaludo();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isTyping]);

  // ── Confirmar categorías ──────────────────────────────────────────────────
  const confirmarCategorias = useCallback(() => {
    catsPendientes
      .filter(c => catsSeleccionadas.has(c.nombre))
      .forEach(cat => {
        const existe = (categories as any[]).find((c: any) => c.name === cat.nombre);
        if (existe) {
          if (!existe.isSelected) updateCategory(existe.id, { isSelected: true });
        } else {
          const item = CATALOGO_CATEGORIAS.find(c => c.nombre === cat.nombre);
          if (item) addCategory(catalogoItemToCategory(item, cat.presupuestoSugerido));
        }
      });

    reprogramarTodasLasNotificaciones(categories as any).catch(() => {});

    const n      = catsSeleccionadas.size;
    const nombres = [...catsSeleccionadas].join(', ');
    const conf: Message = {
      id: Date.now().toString(), sender: 'bot', timestamp: new Date(),
      text: `¡Listo! Agregué ${n} categoría${n > 1 ? 's' : ''}: ${nombres}. Ya podés verlas en Categorías.`,
    };
    setMessages(prev => [...prev, conf]);
    setCatsPendientes([]); setCatsSeleccionadas(new Set()); setConfirmacionId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [catsPendientes, catsSeleccionadas, categories, addCategory, updateCategory]);

  // ── Ejecutar acción confirmada ────────────────────────────────────────────
  const ejecutarAccionConfirmada = useCallback((action: PendingAction) => {
    const agentCtx = {
      transactions:    transactions as any,
      categories:      categories as any,
      goal:            goal as any,
      addTransaction, deleteTransaction, updateTransaction, updateCategory, addCategory, deleteCategory, setGoal,
    };
    const result: FinnToolResult = ejecutarHerramienta(action.toolCall, agentCtx);

    const accionMsg: Message = {
      id: Date.now().toString(), text: result.descripcion,
      sender: 'bot', timestamp: new Date(),
      accionFinn: { tool: action.toolCall.tool, descripcion: result.descripcion, exito: result.exito },
    };
    setMessages(prev => [...prev, accionMsg]);
    setPendingAction(null);
    Haptics.notificationAsync(
      result.exito ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    ).catch(() => {});
  }, [transactions, categories, goal, addTransaction, deleteTransaction, updateTransaction, updateCategory, addCategory, deleteCategory, setGoal]);

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  const handleSend = useCallback(async (texto?: string) => {
    const txt = (texto ?? inputText).trim();
    if (!txt || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), text: txt, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    const resp = await enviarMensajeAgenteAFinn(
      txt, historialRef.current,
      transactions as any, categories as any, profile, goal,
    );
    setIsTyping(false);

    if (resp.tipo === 'tool_call') {
      const toolCall: FinnToolCall = {
        tool: resp.tool, input: resp.input,
        toolUseId: resp.toolUseId, assistantMessage: resp.assistantMessage,
      };
      if (resp.tool === 'eliminar_transaccion') {
        const preview = previewEliminar(resp.input.id, transactions as any);
        setPendingAction({ toolCall, preview: `¿Eliminar ${preview}?` });
      } else {
        ejecutarAccionConfirmada({ toolCall, preview: '' });
      }
      historialRef.current = [
        ...historialRef.current,
        { role: 'user' as const, content: txt },
        { role: 'assistant' as const, content: `[Acción ejecutada: ${resp.tool}]` },
      ].slice(-20);
      return;
    }

    const botMsg: Message = {
      id: (Date.now() + 1).toString(), text: resp.texto,
      sender: 'bot', timestamp: new Date(), esError: !resp.exito,
    };
    setMessages(prev => [...prev, botMsg]);

    historialRef.current = [
      ...historialRef.current,
      { role: 'user' as const, content: txt },
      { role: 'assistant' as const, content: resp.texto },
    ].slice(-20);

    if (!resp.error || resp.error === 'fallback') {
      const localResp = procesarMensajeUsuario(txt, transactions as any, categories as any, profile as any, goal as any);
      if (localResp.accion?.tipo === 'sugerir_categorias') {
        setCatsPendientes(localResp.accion.categorias);
        setCatsSeleccionadas(new Set());
        setConfirmacionId(botMsg.id);
        setMessages(prev => prev.map(m => m.id === botMsg.id
          ? { ...m, text: localResp.text, accion: localResp.accion }
          : m,
        ));
      }
    }

    resp.exito
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [inputText, isTyping, transactions, categories, profile, goal, ejecutarAccionConfirmada]);

  // ── Render mensaje ────────────────────────────────────────────────────────
  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isUser           = item.sender === 'user';
    const showConfirmacion = !isUser && item.id === confirmacionId && catsPendientes.length > 0;
    const timeStr          = new Date(item.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    // Acción de Finn
    if (item.accionFinn) {
      return (
        <View style={[st.msgRow, st.msgBot]}>
          <FinnAvatar size={34} />
          <View style={st.accionBubble}>
            <View style={st.accionHeader}>
              <View style={st.accionBadge}>
                <Text style={st.accionBadgeText}>⚡ Finn actuó</Text>
              </View>
              <Text style={st.accionTime}>{timeStr}</Text>
            </View>
            <Text style={[st.accionText, { color: item.accionFinn.exito ? PRIMARY : THEME.colors.expense }]}>
              {item.accionFinn.exito ? '✓ ' : '✗ '}{item.accionFinn.descripcion}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[st.msgRow, isUser ? st.msgUser : st.msgBot]}>
        {!isUser && <FinnAvatar size={34} />}

        <View style={{ flex: isUser ? undefined : 1, maxWidth: '78%' }}>
          <View style={[
            st.bubble,
            isUser ? st.bubbleUser : st.bubbleBot,
            item.esError && !isUser && st.bubbleError,
          ]}>
            {!isUser && (
              <View style={st.bubbleAccent} />
            )}
            <View style={isUser ? undefined : st.bubbleInner}>
              <Text style={[st.bubbleText, isUser ? st.bubbleTextUser : st.bubbleTextBot]}>
                {item.text}
              </Text>
              <Text style={[st.bubbleTime, isUser ? st.bubbleTimeUser : st.bubbleTimeBot]}>
                {timeStr}
              </Text>
            </View>
          </View>

          {showConfirmacion && (
            <ConfirmacionCategorias
              categorias={catsPendientes}
              seleccionadas={catsSeleccionadas}
              onToggle={nombre => setCatsSeleccionadas(prev => {
                const next = new Set(prev);
                next.has(nombre) ? next.delete(nombre) : next.add(nombre);
                return next;
              })}
              onConfirmar={confirmarCategorias}
              onCancelar={() => { setCatsPendientes([]); setCatsSeleccionadas(new Set()); setConfirmacionId(null); }}
            />
          )}
        </View>

        {isUser && <View style={st.userSpacer} />}
      </View>
    );
  }, [confirmacionId, catsPendientes, catsSeleccionadas, confirmarCategorias]);

  // ── Status ────────────────────────────────────────────────────────────────
  const statusColor = workerStatus === 'online' ? '#1D9E75' : workerStatus === 'offline' ? '#F55B5B' : '#9CA3AF';
  const statusLabel = workerStatus === 'online' ? 'En línea · IA activa' : workerStatus === 'offline' ? 'Modo básico' : 'Conectando…';

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[st.root, { paddingTop: insets.top }]}
    >
      {/* Decorative blobs */}
      <View style={st.blobTop} />
      <View style={st.blobRight} />

      {/* ── Header ── */}
      <View style={st.header}>
        {onBack && (
          <Pressable onPress={onBack} style={st.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="arrow-left" size={20} color="#111827" />
          </Pressable>
        )}

        <View style={st.headerCenter}>
          <View style={st.headerAvatarWrap}>
            <View style={st.headerAvatar}>
              <Text style={st.headerAvatarText}>FI</Text>
            </View>
            <View style={[st.onlineDot, { backgroundColor: statusColor }]} />
          </View>
          <View>
            <Text style={st.headerName}>Finn</Text>
            <Text style={st.headerSub}>{statusLabel}</Text>
          </View>
        </View>

        {/* Placeholder right for layout balance */}
        <View style={{ width: 32 }} />
      </View>

      {/* ── Messages ── */}
      <FlatList
        ref={scrollRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={st.list}
        style={st.listBg}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          !isTyping ? (
            <View style={st.emptyState}>
              <View style={st.emptyAvatar}>
                <Text style={st.emptyAvatarText}>FI</Text>
              </View>
              <Text style={st.emptyTitle}>Hola, soy Finn</Text>
              <Text style={st.emptySub}>Tu asistente financiero personal.{'\n'}Pregúntame cualquier cosa sobre tus finanzas.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isTyping ? (
            <View style={[st.msgRow, st.msgBot]}>
              <FinnAvatar size={34} />
              <TypingIndicator />
            </View>
          ) : null
        }
      />

      {/* ── Quick suggestions ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.suggestionsScroll}
        contentContainerStyle={st.suggestionsContent}
      >
        {QUICK_SUGGESTIONS.map(s => (
          <Pressable
            key={s.label}
            style={({ pressed }) => [st.pill, pressed && { opacity: 0.7 }]}
            onPress={() => handleSend(`${s.emoji} ${s.label}`)}
            disabled={isTyping}
          >
            <Text style={st.pillEmoji}>{s.emoji}</Text>
            <Text style={st.pillText}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Delete confirmation modal ── */}
      <Modal
        transparent
        animationType="fade"
        visible={!!pendingAction}
        onRequestClose={() => setPendingAction(null)}
      >
        <View style={st.modalOverlay}>
          <View style={st.modalCard}>
            <View style={st.modalIconWrap}>
              <Text style={{ fontSize: 26 }}>🗑️</Text>
            </View>
            <Text style={st.modalTitle}>Confirmar eliminación</Text>
            <Text style={st.modalBody}>{pendingAction?.preview}</Text>
            <View style={st.modalBtns}>
              <TouchableOpacity style={st.modalBtnCancel} onPress={() => setPendingAction(null)}>
                <Text style={st.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={st.modalBtnDelete}
                onPress={() => pendingAction && ejecutarAccionConfirmada(pendingAction)}
              >
                <Text style={st.modalBtnDeleteText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Input bar ── */}
      <View style={[st.inputWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <VoiceButton
          size="small"
          onParsed={(tx) => {
            const txt = tx.descripcion
              ? `${tx.descripcion} — ${tx.tipo === 'expense' ? 'gasto' : 'ingreso'} de $${tx.monto.toLocaleString('es-CO').replace(/,/g, '.')} en ${tx.categoria}`
              : `Registra un ${tx.tipo === 'expense' ? 'gasto' : 'ingreso'} de $${tx.monto.toLocaleString('es-CO').replace(/,/g, '.')} en ${tx.categoria}`;
            setInputText(txt);
          }}
        />
        <View style={[st.inputPill, inputFocused && st.inputPillFocused]}>
          <TextInput
            style={st.input}
            placeholder="Pregunta a Finn…"
            placeholderTextColor="#BBBBC8"
            value={inputText}
            onChangeText={setInputText}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            multiline
            maxLength={300}
            editable={!isTyping}
          />
          <Pressable
            style={[st.sendBtn, (isTyping || !inputText.trim()) && st.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={isTyping || !inputText.trim()}
          >
            <Icon name="arrow-up" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: BG },
  listBg:  { backgroundColor: BG },

  // Decorative blobs
  blobTop: {
    position: 'absolute',
    width: SCREEN_W * 1.2,
    height: SCREEN_W * 0.6,
    borderRadius: SCREEN_W * 0.6,
    backgroundColor: 'rgba(97,86,232,0.07)',
    top: -SCREEN_W * 0.3,
    left: -SCREEN_W * 0.1,
  },
  blobRight: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(97,86,232,0.05)',
    top: 60,
    right: -40,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(97,86,232,0.12)',
    ...(Platform.OS !== 'web' ? {
      shadowColor: PRIMARY,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    } : {}),
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatarWrap: { position: 'relative' },
  headerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS !== 'web' ? {
      shadowColor: PRIMARY,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    } : {}),
  },
  headerAvatarText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerName: { fontSize: 17, fontWeight: '700', color: '#111827', letterSpacing: -0.3 },
  headerSub:  { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  // ── Message list ────────────────────────────────────────────────────────
  list: { paddingTop: 20, paddingBottom: 10, gap: 6, paddingHorizontal: 16 },
  msgRow:  { flexDirection: 'row', marginVertical: 3, alignItems: 'flex-end', gap: 8 },
  msgUser: { justifyContent: 'flex-end' },
  msgBot:  { justifyContent: 'flex-start' },
  userSpacer: { width: 34 },

  // ── Finn avatar in messages ─────────────────────────────────────────────
  avatar: {
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
    ...(Platform.OS !== 'web' ? {
      shadowColor: PRIMARY,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    } : {}),
  },
  avatarText: { fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },

  // ── Bubbles ─────────────────────────────────────────────────────────────
  bubble: {
    borderRadius: 20,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  bubbleUser: {
    borderBottomRightRadius: 5,
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-end',
    ...(Platform.OS !== 'web' ? {
      shadowColor: PRIMARY,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 4,
    } : {}),
  },
  bubbleBot: {
    borderBottomLeftRadius: 5,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 2,
    } : {}),
  },
  bubbleError: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: THEME.colors.expense,
  },
  bubbleAccent: {
    width: 3,
    backgroundColor: PRIMARY,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 5,
  },
  bubbleInner: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  bubbleText:     { fontSize: 14.5, lineHeight: 22, fontWeight: '500' },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTextBot:  { color: '#111827' },
  bubbleTime:     { fontSize: 10, marginTop: 4, fontWeight: '400' },
  bubbleTimeUser: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  bubbleTimeBot:  { color: '#9CA3AF' },

  // ── Typing indicator ────────────────────────────────────────────────────
  typingBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 2,
    } : {}),
  },
  typingLabel: { fontSize: 11, color: '#9CA3AF' },
  dotsRow:     { flexDirection: 'row', gap: 4, alignItems: 'center', marginLeft: 4 },
  dot:         { width: 7, height: 7, borderRadius: 3.5, backgroundColor: PRIMARY },

  // ── Empty state ─────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 14,
  },
  emptyAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    ...(Platform.OS !== 'web' ? {
      shadowColor: PRIMARY,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    } : {}),
  },
  emptyAvatarText: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  emptyTitle:      { fontSize: 22, fontWeight: '700', color: '#111827', letterSpacing: -0.5 },
  emptySub:        { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21, paddingHorizontal: 32 },

  // ── Suggestion chips ────────────────────────────────────────────────────
  suggestionsScroll:  {
    flexGrow: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(97,86,232,0.1)',
  },
  suggestionsContent: { flexDirection: 'row', gap: 8, paddingVertical: 10, paddingHorizontal: 16 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: PRIMARY_SOFT,
    borderWidth: 0.5,
    borderColor: 'rgba(97,86,232,0.3)',
  },
  pillEmoji: { fontSize: 13 },
  pillText:  { fontSize: 12, fontWeight: '600', color: PRIMARY },

  // ── Input bar ───────────────────────────────────────────────────────────
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(97,86,232,0.1)',
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F4F3F8',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 8,
  },
  inputPillFocused: {
    borderColor: PRIMARY,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    maxHeight: 100,
    paddingVertical: 6,
    padding: 0,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
    ...(Platform.OS !== 'web' ? {
      shadowColor: PRIMARY,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 4,
    } : {}),
  },
  sendBtnDisabled: { opacity: 0.3 },

  // ── Acción Finn ─────────────────────────────────────────────────────────
  accionBubble: {
    flex: 1,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 6,
    backgroundColor: '#F3F0FF',
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.4)',
  },
  accionHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accionBadge:     { backgroundColor: '#8B5CF6', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  accionBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  accionTime:      { fontSize: 10, color: '#8B5CF680' },
  accionText:      { fontSize: 14, fontWeight: '600', lineHeight: 20 },

  // ── Modal ───────────────────────────────────────────────────────────────
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:      { width: '100%', borderRadius: 28, padding: 28, alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF' },
  modalIconWrap:  { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  modalTitle:     { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalBody:      { fontSize: 14, textAlign: 'center', lineHeight: 20, color: '#6B7280' },
  modalBtns:      { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  modalBtnCancel: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  modalBtnDelete: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: THEME.colors.expense },
  modalBtnDeleteText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
