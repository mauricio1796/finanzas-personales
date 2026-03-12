import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  View,
  Text,
  FlatList,
  ScrollView,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Transaction, calculateBalance, calculateTotalExpenses } from '@/src/core/financeEngine';
import { useFinance } from '@/src/core/context/FinanceContext';
import { aiService } from '../services/ai/AIService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface BotIAProps {
  transactions: Transaction[];
  monthlySalary: number;
}

const QUICK_SUGGESTIONS = [
  '📋 Mis pagos',
  '📅 Esta semana',
  '✅ Marcar pago',
  '📊 Mi mes',
  '🚨 Alertas',
  '🏆 Mi nivel',
];

export function BotIA({ transactions, monthlySalary }: BotIAProps) {
  const { width } = useWindowDimensions();
  const { profile, goal, categories } = useFinance();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const scrollViewRef = useRef<FlatList<Message>>(null);
  const isSmallScreen = width < 768;

  // Generate real AI greeting on mount
  useEffect(() => {
    const greeting = profile
      ? aiService.generateDailyInsight(transactions as any, profile as any, monthlySalary || 2000)
      : null;

    const initialText = greeting
      ? `${greeting.title}\n\n${greeting.message}\n\n¿En qué más puedo ayudarte?`
      : '¡Hola! Soy tu asistente financiero IA ✦\n\nPuedo ayudarte con recomendaciones de ahorro, análisis de gastos, metas financieras y retos personalizados. ¿Qué necesitas?';

    setMessages([
      {
        id: '0',
        text: initialText,
        sender: 'bot',
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const getBotResponse = (userMessage: string): string => {
    const msg = userMessage.toLowerCase();
    const totalExpenses = calculateTotalExpenses(transactions);
    const balance = calculateBalance(transactions);
    const savingRate = monthlySalary > 0 ? (balance / monthlySalary) * 100 : 0;

    // Wire to real AIService methods
    if (msg.includes('ahorro') || msg.includes('ahorr') || msg.includes('meta') || msg.includes('objetivo') || msg.includes('🤔')) {
      if (goal && profile) {
        const insight = aiService.analyzeGoalProgress(transactions as any, goal as any, monthlySalary);
        return `${insight.title}\n\n${insight.message}`;
      }
      return `Tu tasa de ahorro actual es ${savingRate.toFixed(1)}%. ${
        savingRate >= 20
          ? '¡Excelente! Estás por encima del 20% recomendado.'
          : 'Te recomiendo aumentar tu tasa de ahorro al 20% de tus ingresos.'
      }`;
    }

    if (msg.includes('presupuesto') || msg.includes('budget') || msg.includes('distribu') || msg.includes('📊')) {
      if (profile) {
        const budget = aiService.generateAutomaticBudget(monthlySalary, profile as any);
        const fCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
        return `Presupuesto recomendado (regla 50-30-20):\n\n• Necesidades: ${fCOP(budget.necessities)}\n• Entretenimiento: ${fCOP(budget.entertainment)}\n• Ahorros: ${fCOP(budget.savings)}\n\nActualmente gastas ${fCOP(totalExpenses)} de ${fCOP(monthlySalary)} disponibles.`;
      }
      const recommendedBudget = monthlySalary * 0.65;
      const fCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
      return `Para un salario de ${fCOP(monthlySalary)}, te recomiendo un presupuesto de gastos de ${fCOP(recommendedBudget)} (65% de ingresos).\n\nActualmente llevas ${fCOP(totalExpenses)} gastados.`;
    }

    if (msg.includes('reto') || msg.includes('desafio') || msg.includes('desafío') || msg.includes('challenge') || msg.includes('⚡')) {
      if (profile) {
        const challenge = aiService.generatePersonalizedChallenge(transactions as any, profile as any);
        return `${challenge.title}\n\n${challenge.description}\n\nDuración: ${challenge.days} días. ¡Tú puedes lograrlo!`;
      }
      return 'Para un reto personalizado necesito conocer más sobre tu perfil. Completa el onboarding para obtener retos adaptados a ti.';
    }

    if (msg.includes('gasto') || msg.includes('gastos') || msg.includes('analiz') || msg.includes('🔍')) {
      return `Tus gastos totales son $${totalExpenses.toFixed(0)}.\n\nRepresentan el ${
        monthlySalary > 0 ? ((totalExpenses / monthlySalary) * 100).toFixed(0) : '—'
      }% de tus ingresos.\n\nTip: Intenta mantener los gastos entre el 60-70% de tu ingreso mensual.`;
    }

    if (msg.includes('nivel') || msg.includes('experiencia') || msg.includes('progreso') || msg.includes('mi nivel') || msg.includes('🏆')) {
      const level = aiService.calculateUserLevel(transactions.length, balance, 0);
      return `🏆 Tu nivel actual: ${level.title} (Nivel ${level.level})\n\nProgreso al siguiente nivel: ${level.nextLevelProgress.toFixed(0)}%\n\nSigue registrando tus transacciones para subir de nivel. ¡Tú puedes!`;
    }

    if (msg.includes('alerta') || msg.includes('alertas') || msg.includes('🚨') || msg.includes('anomal') || msg.includes('gasto alto') || msg.includes('inusual')) {
      const anomalies = aiService.detectAnomalies(transactions as any);
      if (anomalies.length === 0) {
        return '🚨 Sin alertas activas\n\nNo detecté gastos anómalos. Tus patrones de gasto parecen consistentes. ¡Sigue así!';
      }
      return '🚨 Alertas detectadas:\n\n' + anomalies
        .slice(0, 3)
        .map(a => `⚠️ ${a.title}: ${a.message}`)
        .join('\n\n');
    }

    if (msg.includes('qué tal') || msg.includes('cómo estoy') || msg.includes('mi estado') || msg.includes('resumen')) {
      const fCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
      return `Resumen financiero:\n\n• Balance: ${fCOP(balance)}\n• Gastos totales: ${fCOP(totalExpenses)}\n• Tasa de ahorro: ${savingRate.toFixed(1)}%\n\n${
        savingRate >= 20 ? '¡Vas muy bien! Mantén este ritmo.' : 'Hay oportunidad de mejorar tu tasa de ahorro.'
      }`;
    }

    if (msg.includes('consejo') || msg.includes('recomendación') || msg.includes('recomendacion') || msg.includes('tip')) {
      return 'Mis recomendaciones principales:\n\n1. Mantén un fondo de emergencia (3-6 meses de gastos)\n2. Automatiza tu ahorro: transfiere el 20% al inicio de cada mes\n3. Revisa tus suscripciones activas\n4. Identifica tu categoría de mayor gasto y busca reducirla 10%\n5. Usa la regla 50-30-20 para distribuir tus ingresos';
    }

    if (msg.includes('mis pagos') || msg.includes('pendiente') || msg.includes('compromisos') || msg.includes('📋')) {
      const pending = categories.filter((cat: any) => !cat.pagado && cat.tipo);
      if (pending.length === 0) return '¡Todos tus compromisos del mes estan pagados! Excelente gestion.';
      const fCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
      return 'Compromisos pendientes este mes:\n\n' + pending.map((c: any) => '• ' + c.name + (c.diaPago ? ' — vence dia ' + c.diaPago : '') + (c.presupuesto ? ' — ' + fCOP(c.presupuesto) : '')).join('\n');
    }
    if (msg.includes('esta semana') || msg.includes('📅')) {
      const hoy = new Date().getDate();
      const prox = categories.filter((c: any) => c.tipo && !c.pagado && c.diaPago && c.diaPago >= hoy && c.diaPago <= hoy + 7);
      if (prox.length === 0) return 'No tienes pagos que venzan en los proximos 7 dias. Bien organizado!';
      const fCOP2 = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
      return 'Pagos esta semana:\n\n' + prox.map((c: any) => '• ' + c.name + ' — dia ' + c.diaPago + (c.presupuesto ? ' — ' + fCOP2(c.presupuesto) : '')).join('\n');
    }
    if (msg.includes('marcar pago') || msg.includes('✅')) {
      return 'Para marcar pago: Finanzas > Presupuesto > Pagar';
    }
    if (msg.includes('mi mes') || msg.includes('📊')) {
      const fCOP3 = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
      const budgetCats = categories.filter((c: any) => c.tipo || (c.presupuesto ?? 0) > 0);
      const totalComp = budgetCats.reduce((s: number, c: any) => s + (c.presupuesto ?? 0), 0);
      const pagados = budgetCats.filter((c: any) => c.pagado).reduce((s: number, c: any) => s + (c.presupuesto ?? 0), 0);
      const pendiente = totalComp - pagados;
      const disponible = monthlySalary - totalComp;
      return 'Resumen de tu mes:\n\n• Comprometido: ' + fCOP3(totalComp) + '\n• Pagado: ' + fCOP3(pagados) + '\n• Pendiente: ' + fCOP3(pendiente) + '\n• Disponible real: ' + fCOP3(disponible);
    }
    return 'Puedo ayudarte con: pagos pendientes, esta semana, mi mes, alertas, nivel y mas.';
  };
  const handleSendMessage = async (text?: string) => {
    const messageText = text ?? inputText;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getBotResponse(messageText),
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botResponse]);
      setLoading(false);
    }, 600);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.botMessage]}>
        {!isUser && (
          <View style={styles.botAvatar}>
            <Text style={styles.botAvatarIcon}>✦</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.botBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.botText]}>
            {item.text}
          </Text>
          <Text style={[styles.messageTime, isUser && styles.userTime]}>
            {new Date(item.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarIcon}>✦</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Finn</Text>
            <Text style={styles.headerSub}>Tu asistente de pagos</Text>
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
        contentContainerStyle={[
          styles.messagesList,
          { paddingHorizontal: isSmallScreen ? 20 : 28 },
        ]}
        scrollEnabled
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          loading ? (
            <View style={[styles.botMessage, styles.messageContainer]}>
              <View style={styles.botAvatar}>
                <Text style={styles.botAvatarIcon}>✦</Text>
              </View>
              <View style={styles.typingBubble}>
                <Text style={styles.typingDots}>• • •</Text>
              <Text style={styles.typingLabel}>Finn esta analizando...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Quick suggestions */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.suggestionsScroll}
        contentContainerStyle={[
          styles.suggestionsContent,
          { paddingHorizontal: isSmallScreen ? 20 : 28 },
        ]}
      >
        {QUICK_SUGGESTIONS.map(s => (
          <Pressable
            key={s}
            style={styles.suggestionPill}
            onPress={() => handleSendMessage(s)}
            disabled={loading}
          >
            <Text style={styles.suggestionText}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Input */}
      <View
        style={[
          styles.inputContainer,
          { paddingHorizontal: isSmallScreen ? 16 : 20 },
        ]}
      >
        <TextInput
          style={[styles.input, inputFocused && styles.inputFocused]}
          placeholder="Escribe a Finn..."
          placeholderTextColor="#9CA3AF"
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
          style={[styles.sendButton, (loading || !inputText.trim()) && styles.sendButtonDisabled]}
          onPress={() => handleSendMessage()}
          disabled={loading || !inputText.trim()}
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    } : {}),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarIcon: {
    fontSize: 16,
    color: '#6366F1',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerSub: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 1,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },

  // Messages
  messagesList: {
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
    gap: 8,
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  botMessage: {
    justifyContent: 'flex-start',
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    flexShrink: 0,
  },
  botAvatarIcon: {
    fontSize: 12,
    color: '#6366F1',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    } : {}),
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  userText: {
    color: '#FFFFFF',
  },
  botText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 5,
    fontWeight: '400',
  },
  userTime: {
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'right',
  },

  // Typing indicator
  typingBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  typingDots: {
    fontSize: 16,
    color: '#9CA3AF',
    letterSpacing: 3,
  },
  typingLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  suggestionsScroll: {
    flexGrow: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  suggestionsContent: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 10,
  },
  suggestionPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: "600",
    color: '#374151',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    maxHeight: 100,
  },
  inputFocused: {
    borderColor: '#6366F1',
    borderWidth: 2,
  },  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
});
