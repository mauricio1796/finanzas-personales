import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { SPACING } from '../../constants';

interface ChatBubbleProps {
  message: string;
  isUser?: boolean;
  timestamp?: string;
}

/**
 * Minimalist AI question header.
 * AI messages: clean label + large bold text — no bubbles, no borders.
 * User messages: subtle teal pill on the right.
 */
export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isUser = false,
  timestamp,
}) => {
  const { colors } = useTheme();

  if (isUser) {
    return (
      <View style={styles.userContainer}>
        <View style={[styles.userBubble, { backgroundColor: colors.primary }]}>
          <Text style={[styles.userText, { color: colors.text_light }]}>{message}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.aiContainer}>
      <Text style={[styles.aiLabel, { color: colors.primary }]}>FinancyAI ·</Text>
      <Text style={[styles.aiMessage, { color: colors.text_primary }]}>{message}</Text>
      {timestamp && (
        <Text style={[styles.timestamp, { color: colors.text_tertiary }]}>{timestamp}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  aiContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    gap: 10,
  },
  aiLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  aiMessage: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  userContainer: {
    paddingHorizontal: SPACING.lg,
    alignItems: 'flex-end',
    marginVertical: SPACING.sm,
  },
  userBubble: {
    maxWidth: '70%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  userText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
