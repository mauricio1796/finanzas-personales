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
  toolCall:   FinnToolCall;
  preview:    string;
}

interface BotIAProps {
  transactions:  any[];
  monthlySalary: number;
  onBack?:       () => void;
}

// ── Quick suggestions ─────────────────────────────────────────────────────────

const QUICK_SUGGESTIONS = [
  '📋 Mis pagos',
  '📅 Esta semana',
  '📊 Mi mes',
  '🚨 Alertas',
  '🏆 Mi nivel',
  '💡 Cómo ahorrar',
  '➕ Agregar categoría',
];

// ── TypingIndicator ───────────────────────────────────────────────────────────

const TypingIndicator: React.FC<{ colors: any }> = ({ colors }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -5, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue:  0, duration: 300, useNativeDriver: true }),
          Animated.delay(500),
        ]),
      );

    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 150);
    const a3 = anim(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={st.typingBubble}>
      <Text style={st.typingLabel}>Finn está escribiendo</Text>
      <View style={st.dotsRow}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[st.dot, { transform: [{ translateY: dot }] }]}
          />
        ))}
      </View>
    </View>
  );
};

// ── ConfirmacionCategorias ────────────────────────────────────────────────────

interface ConfirmacionCategoriasProps {
  categorias:     CategoriaSugerida[];
  seleccionadas:  Set<string>;
  onToggle:       (nombre: string) => void;
  onConfirmar:    () => void;
  onCancelar:     () => void;
}

const ConfirmacionCategorias: React.FC<ConfirmacionCategoriasProps> = ({
  categorias, seleccionadas, onToggle, onConfirmar, onCancelar,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ marginTop: 8, marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {categorias.map(cat => {
          const activa  = seleccionadas.has(cat.nombre);
          const paleta  = getPaletaItem(cat.nombre, isDark);
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
                borderColor: activa ? colors.primary : colors.border,
                backgroundColor: activa ? colors.primaryLight : colors.card,
                alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8,
              }}
            >
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: paleta.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={cat.icono as any} size={16} color={activa ? colors.primary : paleta.color} />
              </View>
              <Text style={{ fontSize: 10, fontWeight: '500', color: activa ? colors.primary : colors.textSecondary, textAlign: 'center' }} numberOfLines={2}>
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
          style={{ flex: 2, borderRadius: 12, backgroundColor: seleccionadas.size > 0 ? colors.primary : colors.cardSecondary, padding: 10, alignItems: 'center' }}
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
  const { profile, goal, categories, addCategory, updateCategory, addTransaction, deleteTransaction, updateTransaction, setGoal } = useFinance();
  const insets = useSafeAreaInsets();

  const [messages, setMessages]   = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping]   = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const scrollRef    = useRef<FlatList<Message>>(null);
  const historialRef = useRef<MensajeChat[]>([]);

  // ── Category confirmation state ───────────────────────────────────────────
  const [catsPendientes,    setCatsPendientes]    = useState<CategoriaSugerida[]>([]);
  const [catsSeleccionadas, setCatsSeleccionadas] = useState<Set<string>>(new Set());
  const [confirmacionId,    setConfirmacionId]    = useState<string | null>(null);

  // ── Agentic action state ──────────────────────────────────────────────────
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

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

  // ── Confirmar categorías ─────────────────────────────────────────────────
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
      transactions:      transactions as any,
      categories:        categories as any,
      goal:              goal as any,
      addTransaction,
      deleteTransaction,
      updateTransaction,
      updateCategory,
      addCategory,
      setGoal,
    };
    const result: FinnToolResult = ejecutarHerramienta(action.toolCall, agentCtx);

    const accionMsg: Message = {
      id:          Date.now().toString(),
      text:        result.descripcion,
      sender:      'bot',
      timestamp:   new Date(),
      accionFinn:  { tool: action.toolCall.tool, descripcion: result.descripcion, exito: result.exito },
    };
    setMessages(prev => [...prev, accionMsg]);
    setPendingAction(null);
    Haptics.notificationAsync(
      result.exito ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    ).catch(() => {});
  }, [transactions, categories, goal, addTransaction, deleteTransaction, updateTransaction, updateCategory, addCategory, setGoal]);

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

    // ── Tool call: Finn quiere ejecutar una acción ─────────────────────────
    if (resp.tipo === 'tool_call') {
      const toolCall: FinnToolCall = {
        tool:             resp.tool,
        input:            resp.input,
        toolUseId:        resp.toolUseId,
        assistantMessage: resp.assistantMessage,
      };

      if (resp.tool === 'eliminar_transaccion') {
        // Requiere confirmación del usuario
        const preview = previewEliminar(resp.input.id, transactions as any);
        setPendingAction({ toolCall, preview: `¿Eliminar ${preview}?` });
      } else {
        // Ejecutar inmediatamente
        ejecutarAccionConfirmada({ toolCall, preview: '' });
      }

      // Actualizar historial con resumen de la acción
      historialRef.current = [
        ...historialRef.current,
        { role: 'user' as const, content: txt },
        { role: 'assistant' as const, content: `[Acción ejecutada: ${resp.tool}]` },
      ].slice(-20);

      return;
    }

    // ── Respuesta de texto normal ─────────────────────────────────────────
    const botMsg: Message = {
      id:        (Date.now() + 1).toString(),
      text:      resp.texto,
      sender:    'bot',
      timestamp: new Date(),
      esError:   !resp.exito,
    };
    setMessages(prev => [...prev, botMsg]);

    historialRef.current = [
      ...historialRef.current,
      { role: 'user'      as const, content: txt       },
      { role: 'assistant' as const, content: resp.texto },
    ].slice(-20);

    // Detectar si la respuesta local sugiere categorías
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
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isUser           = item.sender === 'user';
    const showConfirmacion = !isUser && item.id === confirmacionId && catsPendientes.length > 0;

    if (item.accionFinn) {
      return (
        <View style={[st.msgRow, st.msgBot]}>
          <View style={st.botAvatar}>
            <Text style={st.botAvatarText}>FI</Text>
          </View>
          <View style={[st.accionBubble, { borderColor: '#8B5CF6' }]}>
            <View style={st.accionHeader}>
              <View style={st.accionBadge}>
                <Text style={st.accionBadgeText}>Finn actuó</Text>
              </View>
              <Text style={[st.bubbleTime, { color: '#8B5CF680' }]}>
                {new Date(item.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={[st.accionText, { color: item.accionFinn.exito ? '#8B5CF6' : colors.expense }]}>
              {item.accionFinn.exito ? '✓ ' : '✗ '}{item.accionFinn.descripcion}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[st.msgRow, isUser ? st.msgUser : st.msgBot]}>
        {!isUser && (
          <View style={st.botAvatar}>
            <Text style={st.botAvatarText}>FI</Text>
          </View>
        )}
        <View style={{ flex: isUser ? undefined : 1, maxWidth: isUser ? '78%' : '78%' }}>
          <View style={[
            st.bubble,
            isUser
              ? st.bubbleUser
              : [st.bubbleBot, item.esError && { backgroundColor: THEME.colors.expenseLight, borderColor: THEME.colors.expense }],
          ]}>
            <Text style={[st.bubbleText, isUser ? { color: '#FFFFFF' } : { color: '#111827' }]}>
              {item.text}
            </Text>
            <Text style={[st.bubbleTime, isUser ? { color: 'rgba(255,255,255,0.65)', textAlign: 'right' } : { color: '#9CA3AF' }]}>
              {new Date(item.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </Text>
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
      </View>
    );
  }, [colors, confirmacionId, catsPendientes, catsSeleccionadas, confirmarCategorias]);

  // ── Status dot ────────────────────────────────────────────────────────────
  const statusColor = workerStatus === 'online'  ? '#1D9E75'
    : workerStatus === 'offline' ? '#F55B5B'
    : '#9CA3AF';
  const statusLabel = workerStatus === 'online'  ? 'IA en línea'
    : workerStatus === 'offline' ? 'Modo básico'
    : 'Conectando…';

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[st.root, { paddingTop: insets.top, backgroundColor: '#F8F7FF' }]}
    >
      {/* Header */}
      <View style={st.header}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ paddingRight: 8 }}>
            <Icon name="arrow-left" size={20} color="#111827" />
          </Pressable>
        )}
        <View style={st.headerLeft}>
          {/* Avatar + badge */}
          <View>
            <View style={st.headerAvatar}>
              <Text style={st.headerAvatarText}>FI</Text>
            </View>
            <View style={[st.statusBadge, { backgroundColor: statusColor }]} />
          </View>
          <View>
            <Text style={st.headerTitle}>Finn</Text>
            <Text style={st.statusLabel}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={scrollRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={st.list}
        style={{ backgroundColor: '#F8F7FF' }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          isTyping ? (
            <View style={[st.msgRow, st.msgBot]}>
              <View style={st.botAvatar}>
                <Text style={st.botAvatarText}>FI</Text>
              </View>
              <TypingIndicator colors={colors} />
            </View>
          ) : null
        }
      />

      {/* Quick suggestions */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.suggestionsScroll}
        contentContainerStyle={st.suggestionsContent}
      >
        {QUICK_SUGGESTIONS.map(s => (
          <Pressable
            key={s}
            style={st.pill}
            onPress={() => handleSend(s)}
            disabled={isTyping}
          >
            <Text style={st.pillText}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Delete confirmation modal */}
      <Modal
        transparent
        animationType="fade"
        visible={!!pendingAction}
        onRequestClose={() => setPendingAction(null)}
      >
        <View style={st.modalOverlay}>
          <View style={st.modalCard}>
            <View style={[st.modalIconWrap, { backgroundColor: '#8B5CF620' }]}>
              <Text style={{ fontSize: 24 }}>🗑️</Text>
            </View>
            <Text style={st.modalTitle}>Confirmar eliminación</Text>
            <Text style={st.modalBody}>{pendingAction?.preview}</Text>
            <View style={st.modalBtns}>
              <TouchableOpacity
                style={[st.modalBtn, { borderColor: '#E5E7EB', borderWidth: 1 }]}
                onPress={() => setPendingAction(null)}
              >
                <Text style={[st.modalBtnText, { color: '#6B7280' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.modalBtn, { backgroundColor: THEME.colors.expense }]}
                onPress={() => pendingAction && ejecutarAccionConfirmada(pendingAction)}
              >
                <Text style={[st.modalBtnText, { color: '#FFFFFF' }]}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Input */}
      <View style={[st.inputWrap, { paddingBottom: insets.bottom + 10 }]}>
        <VoiceButton
          size="small"
          onParsed={(tx) => {
            const txt = tx.descripcion
              ? `${tx.descripcion} — ${tx.tipo === 'expense' ? 'gasto' : 'ingreso'} de $${tx.monto.toLocaleString('es-CO').replace(/,/g, '.')} en ${tx.categoria}`
              : `Registra un ${tx.tipo === 'expense' ? 'gasto' : 'ingreso'} de $${tx.monto.toLocaleString('es-CO').replace(/,/g, '.')} en ${tx.categoria}`;
            setInputText(txt);
          }}
        />
        <TextInput
          style={[st.input, { color: '#111827' }]}
          placeholder="Escribe a Finn…"
          placeholderTextColor="#9CA3AF"
          value={inputText}
          onChangeText={setInputText}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          multiline
          maxLength={300}
          editable={!isTyping}
        />
        <Pressable
          style={[st.sendBtn, (isTyping || !inputText.trim()) && { opacity: 0.4 }]}
          onPress={() => handleSend()}
          disabled={isTyping || !inputText.trim()}
        >
          <Icon name="arrow-up" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1 },

  // Header — white, light shadow
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingTop: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 } : {}),
  },
  headerLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerAvatar:    {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6156E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  statusBadge:      {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: '#111827' },
  statusLabel:  { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  // Message list
  list:    { paddingTop: 16, paddingBottom: 8, gap: 4, paddingHorizontal: 16 },
  msgRow:  { flexDirection: 'row', marginVertical: 4, alignItems: 'flex-end', gap: 8 },
  msgUser: { justifyContent: 'flex-end' },
  msgBot:  { justifyContent: 'flex-start' },

  // Finn mini avatar in messages
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6156E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    flexShrink: 0,
  },
  botAvatarText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  // Bubbles
  bubble:     { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleUser: {
    borderBottomRightRadius: 4,
    backgroundColor: '#6156E8',
    alignSelf: 'flex-end',
  },
  bubbleBot: {
    borderBottomLeftRadius: 4,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    } : {}),
  },
  bubbleText: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
  bubbleTime: { fontSize: 10, marginTop: 3, fontWeight: '400' },

  // Typing indicator — Finn bubble style
  typingBubble: {
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    } : {}),
  },
  typingLabel:  { fontSize: 11, color: '#9CA3AF' },
  dotsRow:      { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9CA3AF' },

  // Suggestion chips
  suggestionsScroll:  { flexGrow: 0, backgroundColor: '#FFFFFF', borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
  suggestionsContent: { flexDirection: 'row', gap: 8, paddingVertical: 10, paddingHorizontal: 16 },
  pill: {
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#EEF0FF',
    borderWidth: 0.5,
    borderColor: '#6156E8',
  },
  pillText: { fontSize: 12, fontWeight: '600', color: '#6156E8' },

  // Input bar
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 100,
    paddingHorizontal: 16,
    fontSize: 15,
    backgroundColor: '#F4F3F8',
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6156E8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Action bubble — Finn actuó
  accionBubble: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#F3F0FF',
    borderColor: '#8B5CF6',
  },
  accionHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accionBadge:     { backgroundColor: '#8B5CF6', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  accionBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  accionText:      { fontSize: 14, fontWeight: '600', lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:    { width: '100%', borderRadius: 24, padding: 24, alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF' },
  modalIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  modalTitle:   { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalBody:    { fontSize: 14, textAlign: 'center', lineHeight: 20, color: '#6B7280' },
  modalBtns:    { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  modalBtn:     { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
});
