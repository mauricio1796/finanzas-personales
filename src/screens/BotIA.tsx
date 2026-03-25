import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  TouchableOpacity,
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
  verificarConexionWorker,
  type MensajeChat,
} from '../services/RealAIService';
import { catalogoItemToCategory, CATALOGO_CATEGORIAS, getPaletaItem } from '../constants/catalogoCategorias';
import { reprogramarTodasLasNotificaciones } from '../services/NotificacionesService';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Message {
  id:        string;
  text:      string;
  sender:    'user' | 'bot';
  timestamp: Date;
  accion?:   BotAccion;
  esError?:  boolean;
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
    <View style={[st.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[st.typingLabel, { color: colors.textTertiary }]}>Finn está escribiendo</Text>
      <View style={st.dotsRow}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[st.dot, { backgroundColor: colors.primary, transform: [{ translateY: dot }] }]}
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
  const { profile, goal, categories, addCategory, updateCategory } = useFinance();
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

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  const handleSend = useCallback(async (texto?: string) => {
    const txt = (texto ?? inputText).trim();
    if (!txt || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), text: txt, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    const resp = await enviarMensajeAFinn(
      txt, historialRef.current,
      transactions as any, categories as any, profile, goal,
    );

    setIsTyping(false);

    const botMsg: Message = {
      id:        (Date.now() + 1).toString(),
      text:      resp.texto,
      sender:    'bot',
      timestamp: new Date(),
      esError:   !resp.exito,
    };
    setMessages(prev => [...prev, botMsg]);

    // Actualizar historial
    historialRef.current = [
      ...historialRef.current,
      { role: 'user'      as const, content: txt        },
      { role: 'assistant' as const, content: resp.texto },
    ].slice(-20);

    // Detectar si la respuesta local sugiere categorías
    if (!resp.error || resp.error === 'fallback') {
      const localResp = procesarMensajeUsuario(txt, transactions as any, categories as any, profile as any, goal as any);
      if (localResp.accion?.tipo === 'sugerir_categorias') {
        setCatsPendientes(localResp.accion.categorias);
        setCatsSeleccionadas(new Set());
        setConfirmacionId(botMsg.id);
        // Update the bot message with the local action text instead
        setMessages(prev => prev.map(m => m.id === botMsg.id
          ? { ...m, text: localResp.text, accion: localResp.accion }
          : m,
        ));
      }
    }

    resp.exito
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [inputText, isTyping, transactions, categories, profile, goal]);

  // ── Render mensaje ────────────────────────────────────────────────────────
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isUser          = item.sender === 'user';
    const showConfirmacion = !isUser && item.id === confirmacionId && catsPendientes.length > 0;

    return (
      <View style={[st.msgRow, isUser ? st.msgUser : st.msgBot]}>
        {!isUser && (
          <View style={[st.botAvatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[st.botAvatarText, { color: colors.primary }]}>✦</Text>
          </View>
        )}
        <View style={{ flex: isUser ? undefined : 1, maxWidth: isUser ? '80%' : undefined }}>
          <View style={[
            st.bubble,
            isUser
              ? [st.bubbleUser, { backgroundColor: colors.primary }]
              : [st.bubbleBot, {
                  backgroundColor: item.esError ? colors.expenseLight : colors.card,
                  borderColor: item.esError ? colors.expense : colors.border,
                }],
          ]}>
            <Text style={[st.bubbleText, isUser ? { color: '#FFFFFF' } : { color: colors.textPrimary }]}>
              {item.text}
            </Text>
            <Text style={[st.bubbleTime, isUser ? { color: 'rgba(255,255,255,0.65)', textAlign: 'right' } : { color: colors.textTertiary }]}>
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
  const statusColor = workerStatus === 'online' ? colors.income
    : workerStatus === 'offline' ? colors.expense
    : colors.warning;
  const statusLabel = workerStatus === 'online'   ? 'IA en línea'
    : workerStatus === 'offline'  ? 'Modo básico'
    : 'Conectando…';

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[st.root, { paddingTop: insets.top, backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[st.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ paddingRight: 8 }}>
            <Icon name="arrow-left" size={20} color={colors.textPrimary} />
          </Pressable>
        )}
        <View style={st.headerLeft}>
          <View style={[st.headerAvatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[st.headerAvatarText, { color: colors.primary }]}>✦</Text>
          </View>
          <View>
            <Text style={[st.headerTitle, { color: colors.textPrimary }]}>Finn</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={[st.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[st.statusLabel, { color: colors.textTertiary }]}>{statusLabel}</Text>
            </View>
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
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          isTyping ? (
            <View style={[st.msgRow, st.msgBot]}>
              <View style={[st.botAvatar, { backgroundColor: colors.primaryLight }]}>
                <Text style={[st.botAvatarText, { color: colors.primary }]}>✦</Text>
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
        style={[st.suggestionsScroll, { backgroundColor: colors.card, borderTopColor: colors.borderSubtle }]}
        contentContainerStyle={st.suggestionsContent}
      >
        {QUICK_SUGGESTIONS.map(s => (
          <Pressable
            key={s}
            style={[st.pill, { backgroundColor: colors.inputBg }]}
            onPress={() => handleSend(s)}
            disabled={isTyping}
          >
            <Text style={[st.pillText, { color: colors.textSecondary }]}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={[st.inputWrap, {
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 10,
        backgroundColor: colors.card,
        borderTopColor: colors.border,
      }]}>
        <TextInput
          style={[
            st.input,
            { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.textPrimary },
            inputFocused && { borderColor: colors.primary, borderWidth: 2 },
          ]}
          placeholder="Escribe a Finn…"
          placeholderTextColor={colors.textTertiary}
          value={inputText}
          onChangeText={setInputText}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          multiline
          maxLength={300}
          editable={!isTyping}
        />
        <Pressable
          style={[st.sendBtn, { backgroundColor: colors.primary }, (isTyping || !inputText.trim()) && { opacity: 0.4 }]}
          onPress={() => handleSend()}
          disabled={isTyping || !inputText.trim()}
        >
          <Icon name="arrow-up" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, paddingTop: 20, borderBottomWidth: 1,
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 } : {}),
  },
  headerLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerAvatar:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText:{ fontSize: 16 },
  headerTitle:     { fontSize: 16, fontWeight: '700' },
  statusDot:       { width: 6, height: 6, borderRadius: 3 },
  statusLabel:     { fontSize: 11 },

  list: { paddingTop: 16, paddingBottom: 8, gap: 4, paddingHorizontal: 16 },
  msgRow: { flexDirection: 'row', marginVertical: 4, alignItems: 'flex-end', gap: 8 },
  msgUser: { justifyContent: 'flex-end' },
  msgBot:  { justifyContent: 'flex-start' },

  botAvatar:     { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2, flexShrink: 0 },
  botAvatarText: { fontSize: 12 },

  bubble:     { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleBot:  {
    borderBottomLeftRadius: 4, borderWidth: 1,
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 } : {}),
  },
  bubbleText: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
  bubbleTime: { fontSize: 11, marginTop: 5, fontWeight: '400' },

  typingBubble: {
    borderWidth: 1, borderRadius: 16, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10, gap: 4,
  },
  typingLabel:  { fontSize: 11 },
  dotsRow:      { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot:          { width: 6, height: 6, borderRadius: 3 },

  suggestionsScroll:   { flexGrow: 0, borderTopWidth: 1 },
  suggestionsContent:  { flexDirection: 'row', gap: 8, paddingVertical: 10, paddingHorizontal: 16 },
  pill:                { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  pillText:            { fontSize: 13, fontWeight: '600' },

  inputWrap: { borderTopWidth: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 10 },
  input:     { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
