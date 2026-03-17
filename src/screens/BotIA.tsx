import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  TouchableOpacity,
  View,
  Text,
  FlatList,
  ScrollView,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Transaction } from '@/src/core/financeEngine';
import { useFinance } from '@/src/core/context/FinanceContext';
import {
  aiService,
  procesarMensajeUsuario,
  type BotAccion,
  type CategoriaSugerida,
} from '../services/ai/AIService';
import { catalogoItemToCategory, CATALOGO_CATEGORIAS, getPaletaItem } from '../constants/catalogoCategorias';
import { reprogramarTodasLasNotificaciones } from '../services/NotificacionesService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  accion?: BotAccion;
}

interface BotIAProps {
  transactions: Transaction[];
  monthlySalary: number;
  onBack?: () => void;
}

// ── Quick suggestions ─────────────────────────────────────────────────────────

const QUICK_SUGGESTIONS = [
  '📋 Mis pagos',
  '📅 Esta semana',
  '✅ Marcar pago',
  '📊 Mi mes',
  '🚨 Alertas',
  '🏆 Mi nivel',
  '➕ Agregar categoría',
];

// ── ConfirmacionCategorias ─────────────────────────────────────────────────────

interface ConfirmacionCategoriasProps {
  categorias: CategoriaSugerida[];
  seleccionadas: Set<string>;
  onToggle: (nombre: string) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
}

const ConfirmacionCategorias: React.FC<ConfirmacionCategoriasProps> = ({
  categorias,
  seleccionadas,
  onToggle,
  onConfirmar,
  onCancelar,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ marginTop: 8, marginBottom: 4 }}>
      {/* Grid — 3 columnas */}
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
                width: '30%',
                aspectRatio: 1,
                borderRadius: 16,
                borderWidth: activa ? 1.5 : 0.5,
                borderColor: activa ? colors.primary : colors.border,
                backgroundColor: activa ? colors.primaryLight : colors.card,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: 8,
              }}
            >
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: paleta.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name={cat.icono as any} size={16} color={activa ? colors.primary : paleta.color} />
              </View>
              <Text style={{
                fontSize: 10,
                fontWeight: '500',
                color: activa ? colors.primary : colors.textSecondary,
                textAlign: 'center',
              }} numberOfLines={2}>
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

      {/* Botones */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={onCancelar}
          style={{
            flex: 1,
            borderRadius: 12,
            borderWidth: 0.5,
            borderColor: colors.border,
            padding: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onConfirmar}
          disabled={seleccionadas.size === 0}
          style={{
            flex: 2,
            borderRadius: 12,
            backgroundColor: seleccionadas.size > 0 ? colors.primary : colors.cardSecondary,
            padding: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{
            fontSize: 13,
            fontWeight: '500',
            color: seleccionadas.size > 0 ? '#fff' : colors.textTertiary,
          }}>
            {seleccionadas.size > 0
              ? `Agregar ${seleccionadas.size} categoría${seleccionadas.size > 1 ? 's' : ''}`
              : 'Selecciona categorías'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── BotIA ──────────────────────────────────────────────────────────────────────

export function BotIA({ transactions, monthlySalary, onBack }: BotIAProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { profile, goal, categories, addCategory, updateCategory } = useFinance();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const scrollViewRef = useRef<FlatList<Message>>(null);
  const isSmallScreen = width < 768;

  // ── Category confirmation state ────────────────────────────────────────────
  const [categoriasPendientes, setCategoriasPendientes] = useState<CategoriaSugerida[]>([]);
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<Set<string>>(new Set());
  const [confirmacionId, setConfirmacionId] = useState<string | null>(null);

  // ── Greeting ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const greeting = profile
      ? aiService.generateDailyInsight(transactions as any, profile as any, monthlySalary || 2000)
      : null;

    const initialText = greeting
      ? `${greeting.title}\n\n${greeting.message}\n\n¿En qué más puedo ayudarte?`
      : '¡Hola! Soy Finn, tu asistente financiero.\n\nPuedo ayudarte con recomendaciones de ahorro, análisis de gastos, metas financieras y agregar categorías a tu presupuesto. ¿Qué necesitas?';

    setMessages([{ id: '0', text: initialText, sender: 'bot', timestamp: new Date() }]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (messages.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // ── Routing no-categorías (preservado intacto) ────────────────────────────
  // ── Confirmar categorías seleccionadas ────────────────────────────────────
  const confirmarCategorias = () => {
    categoriasPendientes
      .filter(c => categoriasSeleccionadas.has(c.nombre))
      .forEach(cat => {
        const yaExiste = (categories as any[]).some((c: any) => c.name === cat.nombre);
        if (yaExiste) {
          const existente = (categories as any[]).find((c: any) => c.name === cat.nombre);
          if (existente && !existente.isSelected) {
            updateCategory(existente.id, { isSelected: true });
          }
        } else {
          const catalogItem = CATALOGO_CATEGORIAS.find(c => c.nombre === cat.nombre);
          if (catalogItem) {
            addCategory(catalogoItemToCategory(catalogItem, cat.presupuestoSugerido));
          }
        }
      });

    reprogramarTodasLasNotificaciones(categories as any).catch(() => {});

    const nombres = [...categoriasSeleccionadas].join(', ');
    const n = categoriasSeleccionadas.size;
    const msgConf: Message = {
      id: Date.now().toString(),
      sender: 'bot',
      timestamp: new Date(),
      text: `¡Listo! Agregué ${n} categoría${n > 1 ? 's' : ''} a tu presupuesto: ${nombres}. Ya puedes verlas en la sección de Categorías.`,
    };
    setMessages(prev => [...prev, msgConf]);
    setCategoriasPendientes([]);
    setCategoriasSeleccionadas(new Set());
    setConfirmacionId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  // ── Enviar mensaje ─────────────────────────────────────────────────────────
  const handleSendMessage = (text?: string) => {
    const messageText = text ?? inputText;
    if (!messageText.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    setTimeout(() => {
      const resp = procesarMensajeUsuario(
        messageText,
        transactions as any,
        categories as any,
        profile as any,
        goal as any,
      );

      const botId = (Date.now() + 1).toString();
      const botText   = resp.text;
      const botAccion = resp.accion;

      const botMsg: Message = {
        id: botId,
        text: botText,
        sender: 'bot',
        timestamp: new Date(),
        accion: botAccion,
      };
      setMessages(prev => [...prev, botMsg]);

      if (botAccion?.tipo === 'sugerir_categorias') {
        setCategoriasPendientes(botAccion.categorias);
        setCategoriasSeleccionadas(new Set());
        setConfirmacionId(botId);
      }

      setLoading(false);
    }, 600);
  };

  // ── Render de mensaje ──────────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    const showConfirmacion =
      !isUser &&
      item.id === confirmacionId &&
      categoriasPendientes.length > 0;

    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.botMessage]}>
        {!isUser && (
          <View style={[styles.botAvatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.botAvatarIcon, { color: colors.primary }]}>✦</Text>
          </View>
        )}
        <View style={{ flex: isUser ? undefined : 1, maxWidth: isUser ? '80%' : undefined }}>
          <View style={[
            styles.messageBubble,
            isUser
              ? [styles.userBubble, { backgroundColor: colors.primary }]
              : [styles.botBubble, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}>
            <Text style={[styles.messageText, isUser ? styles.userText : { color: colors.textPrimary }]}>
              {item.text}
            </Text>
            <Text style={[styles.messageTime, isUser && styles.userTime, !isUser && { color: colors.textTertiary }]}>
              {new Date(item.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {showConfirmacion && (
            <ConfirmacionCategorias
              categorias={categoriasPendientes}
              seleccionadas={categoriasSeleccionadas}
              onToggle={nombre => {
                setCategoriasSeleccionadas(prev => {
                  const next = new Set(prev);
                  next.has(nombre) ? next.delete(nombre) : next.add(nombre);
                  return next;
                });
              }}
              onConfirmar={confirmarCategorias}
              onCancelar={() => {
                setCategoriasPendientes([]);
                setCategoriasSeleccionadas(new Set());
                setConfirmacionId(null);
              }}
            />
          )}
        </View>
      </View>
    );
  };

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ paddingRight: 8 }}>
            <Icon name="arrow-left" size={20} color={colors.textPrimary} />
          </Pressable>
        ) : null}
        <View style={styles.headerLeft}>
          <View style={[styles.headerAvatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.headerAvatarIcon, { color: colors.primary }]}>✦</Text>
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Finn</Text>
            <Text style={[styles.headerSub, { color: colors.textTertiary }]}>Tu asistente financiero</Text>
          </View>
        </View>
        <View style={styles.onlineDot} />
      </View>

      {/* Messages */}
      <FlatList
        ref={scrollViewRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.messagesList, { paddingHorizontal: isSmallScreen ? 16 : 28 }]}
        scrollEnabled
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          loading ? (
            <View style={[styles.botMessage, styles.messageContainer]}>
              <View style={[styles.botAvatar, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.botAvatarIcon, { color: colors.primary }]}>✦</Text>
              </View>
              <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.typingDots, { color: colors.textTertiary }]}>• • •</Text>
                <Text style={[styles.typingLabel, { color: colors.textTertiary }]}>Finn está analizando...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Quick suggestions */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.suggestionsScroll, { backgroundColor: colors.card, borderTopColor: colors.borderSubtle }]}
        contentContainerStyle={[styles.suggestionsContent, { paddingHorizontal: isSmallScreen ? 16 : 28 }]}
      >
        {QUICK_SUGGESTIONS.map(s => (
          <Pressable
            key={s}
            style={[styles.suggestionPill, { backgroundColor: colors.inputBg }]}
            onPress={() => handleSendMessage(s)}
            disabled={loading}
          >
            <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={[
        styles.inputContainer,
        { paddingHorizontal: isSmallScreen ? 16 : 20, paddingBottom: insets.bottom + 10, backgroundColor: colors.card, borderTopColor: colors.border },
      ]}>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.textPrimary },
            inputFocused && { borderColor: colors.primary, borderWidth: 2 },
          ]}
          placeholder="Escribe a Finn..."
          placeholderTextColor={colors.textTertiary}
          value={inputText}
          onChangeText={setInputText}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          multiline
          maxLength={200}
          editable={!loading}
          onSubmitEditing={() => handleSendMessage()}
        />
        <Pressable
          style={[styles.sendButton, { backgroundColor: colors.primary }, (loading || !inputText.trim()) && styles.sendButtonDisabled]}
          onPress={() => handleSendMessage()}
          disabled={loading || !inputText.trim()}
        >
          <Icon name="arrow-up" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingTop: 20,
    borderBottomWidth: 1,
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 } : {}),
  },
  headerLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerAvatar:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerAvatarIcon:{ fontSize: 16 },
  headerTitle:     { fontSize: 16, fontWeight: '700' },
  headerSub:       { fontSize: 12, fontWeight: '500', marginTop: 1 },
  onlineDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },

  messagesList:    { paddingTop: 16, paddingBottom: 8, gap: 4 },
  messageContainer:{ flexDirection: 'row', marginVertical: 4, alignItems: 'flex-end', gap: 8 },
  userMessage:     { justifyContent: 'flex-end' },
  botMessage:      { justifyContent: 'flex-start' },
  botAvatar:       { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2, flexShrink: 0 },
  botAvatarIcon:   { fontSize: 12 },

  messageBubble:   { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  userBubble:      { borderBottomRightRadius: 4 },
  botBubble:       {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 } : {}),
  },
  messageText:     { fontSize: 14, lineHeight: 21, fontWeight: '500' },
  userText:        { color: '#FFFFFF' },
  messageTime:     { fontSize: 11, marginTop: 5, fontWeight: '400' },
  userTime:        { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },

  typingBubble:    { borderWidth: 1, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 12 },
  typingDots:      { fontSize: 16, letterSpacing: 3 },
  typingLabel:     { fontSize: 11, marginTop: 4 },

  suggestionsScroll:   { flexGrow: 0, borderTopWidth: 1 },
  suggestionsContent:  { flexDirection: 'row', gap: 8, paddingVertical: 10 },
  suggestionPill:      { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  suggestionText:      { fontSize: 13, fontWeight: '600' },

  inputContainer:  { borderTopWidth: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 10 },
  input:           { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendButton:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.4 },
});
