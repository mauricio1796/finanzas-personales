import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  GestureResponderEvent,
} from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { SPACING } from '../../constants';

interface OptionButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  isSelected?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: React.ReactNode;
}

/**
 * Minimalist option card.
 * Outline: clean card with subtle border — arrow on right.
 * Selected: teal text + teal border + ✦ mark.
 * Primary: solid teal CTA button.
 */
export const OptionButton: React.FC<OptionButtonProps> = ({
  label,
  onPress,
  isSelected = false,
  variant = 'outline',
  icon,
}) => {
  const { colors } = useTheme();

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={[styles.primaryText, { color: colors.textInverse }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.outlineBtn,
        {
          backgroundColor: isSelected
            ? `${colors.primary}12`
            : colors.card,
          borderColor: isSelected ? colors.primary : colors.border,
          borderLeftWidth: isSelected ? 3 : 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text
        style={[
          styles.outlineText,
          { color: isSelected ? colors.primary : colors.textPrimary },
        ]}
      >
        {label}
      </Text>
      {isSelected ? (
        <Text style={[styles.selectedMark, { color: colors.primary }]}>✦</Text>
      ) : (
        <Text style={[styles.arrow, { color: colors.textTertiary }]}>›</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  primaryBtn: {
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 4,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
    gap: 12,
  },
  icon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  selectedMark: {
    fontSize: 13,
    fontWeight: '700',
  },
  arrow: {
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 24,
  },
});
