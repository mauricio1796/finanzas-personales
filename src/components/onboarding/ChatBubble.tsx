import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants';

interface ChatBubbleProps {
  message: string;
  isUser?: boolean;
  timestamp?: string;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isUser = false,
  timestamp,
}) => {
  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.aiContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.aiBubble,
        ]}
      >
        <Text
          style={[
            styles.message,
            isUser ? styles.userText : styles.aiText,
          ]}
        >
          {message}
        </Text>
        {timestamp && (
          <Text
            style={[
              styles.timestamp,
              isUser ? styles.userTimestamp : styles.aiTimestamp,
            ]}
          >
            {timestamp}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  aiContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: COLORS.background_secondary,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.gray,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: COLORS.background,
  },
  aiText: {
    color: COLORS.text_primary,
  },
  timestamp: {
    fontSize: 11,
    marginTop: SPACING.xs,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  aiTimestamp: {
    color: COLORS.text_secondary,
  },
});
