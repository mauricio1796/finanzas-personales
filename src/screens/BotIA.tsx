import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  View,
  FlatList,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Transaction, calculateBalance, calculateTotalExpenses } from '@/src/core/financeEngine';

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

export function BotIA({ transactions, monthlySalary }: BotIAProps) {
  const { width } = useWindowDimensions();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      text: '¡Hola! Soy tu asistente financiero IA. Puedo ayudarte con recomendaciones de ahorro, análisis de gastos y consejos financieros. ¿Qué necesitas?',
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<FlatList<Message>>(null);
  const isSmallScreen = width < 768;

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const getBotResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();
    const totalExpenses = calculateTotalExpenses(transactions);
    const balance = calculateBalance(transactions);
const savingRateValue = monthlySalary > 0 ? (balance / monthlySalary) * 100 : 0;
const savingRateFormatted = savingRateValue.toFixed(2);

if (message.includes('ahorro') || message.includes('ahorr')) {
  return `Basado en tus datos: Tu tasa de ahorro actual es ${savingRateFormatted}%. Te recomiendo mantener un ahorro del 20% de tus ingresos. Actualmente estás ahorrando ${savingRateFormatted}%, ${savingRateValue >= 20 ? '¡excelente!' : 'intenta aumentar tus ahorros.'}`;
}

    if (message.includes('gasto') || message.includes('gastos')) {
      return `Tus gastos totales son $${totalExpenses.toFixed(2)}. Si tu salario mensual es $${monthlySalary}, tus gastos representan el ${((totalExpenses / monthlySalary) * 100).toFixed(1)}% de tus ingresos. Intenta mantenerlos entre 60-70% de tu ingreso.`;
    }

    if (message.includes('consejo') || message.includes('recomendación')) {
      return 'Mis principales recomendaciones: 1) Crea una categoría para ahorros, 2) Revisa tus gastos mensuales, 3) Identifica categorías donde puedas reducir gastos, 4) Mantén un fondo de emergencia.';
    }

    if (message.includes('presupuesto') || message.includes('budget')) {
      const recommendedBudget = monthlySalary * 0.65;
      return `Para un salario de $${monthlySalary}, recomiendo un presupuesto total de gastos de $${recommendedBudget.toFixed(2)} (65% de ingresos). Actualmente utilizas $${totalExpenses.toFixed(2)}.`;
    }

    if (message.includes('qué tal') || message.includes('cómo estoy') || message.includes('mi estado')) {
      return `Tu balance actual es $${balance.toFixed(2)}. Tasa de ahorro: ${savingRateFormatted}%. Gastos totales: $${totalExpenses.toFixed(2)}. ¡Sigue adelante con tu control financiero!`;
    }

    return 'Puedo ayudarte con: ahorro, gastos, presupuesto, consejos financieros y análisis de tu situación. ¿Qué quieres saber?';
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getBotResponse(inputText),
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botResponse]);
      setLoading(false);
    }, 500);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageContainer, item.sender === 'user' ? styles.userMessage : styles.botMessage]}>
      <ThemedView
        style={[
          styles.messageBubble,
          item.sender === 'user' ? styles.userBubble : styles.botBubble,
        ]}
      >
        <ThemedText style={styles.messageText}>{item.text}</ThemedText>
        <ThemedText style={styles.messageTime}>
          {new Date(item.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </ThemedText>
      </ThemedView>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>🤖 Asistente IA</ThemedText>
        <ThemedText style={styles.subtitle}>Asesoría financiera inteligente</ThemedText>
      </View>

      <FlatList
        ref={scrollViewRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        scrollEnabled
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      />

      <ThemedView style={[styles.inputContainer, { paddingHorizontal: isSmallScreen ? 12 : 16 }]}>
        <TextInput
          style={styles.input}
          placeholder="Escribe tu pregunta..."
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={200}
          editable={!loading}
        />
        <Pressable
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={loading || !inputText.trim()}
        >
          <ThemedText style={styles.sendButtonText}>{loading ? '...' : '↑'}</ThemedText>
        </Pressable>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    color: '#1f2937',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  messageContainer: {
    marginVertical: 6,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  botMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: '#0ea5e9',
    borderBottomRightRadius: 2,
  },
  botBubble: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    color: 'inherit',
    fontWeight: '500',
  },
  messageTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 100,
    color: '#1f2937',
    fontWeight: '500',
    backgroundColor: '#f9fafb',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '800',
  },
});