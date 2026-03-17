import React, { useRef, useEffect } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Animated,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';

interface OnboardingShellProps {
  step: number;
  totalSteps: number;
  onBack?: () => void;
  children: React.ReactNode;
  showProgress?: boolean;
  keyboardAvoiding?: boolean;
  scrollable?: boolean;
}

export const OnboardingShell: React.FC<OnboardingShellProps> = ({
  step,
  totalSteps,
  onBack,
  children,
  showProgress = true,
  keyboardAvoiding = true,
  scrollable = false,
}) => {
  const { colors } = useTheme();

  // Animate progress fill for active segment
  const fillAnim = useRef(new Animated.Value(step)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: step,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step]);

  const content = scrollable ? (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={s.flex}>{children}</View>
  );

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Top bar: back + progress */}
      {showProgress && (
        <View style={s.topBar}>
          {onBack ? (
            <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="chevron-left" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={s.backPlaceholder} />
          )}

          <View style={s.progressRow}>
            {Array.from({ length: totalSteps }).map((_, i) => {
              const isActive = i < step;
              const isCurrent = i === step - 1;
              return (
                <View
                  key={i}
                  style={[
                    s.segment,
                    {
                      backgroundColor: isActive ? colors.primary : isCurrent ? colors.primary : colors.border,
                      opacity: isCurrent ? 1 : isActive ? 1 : 0.35,
                    },
                  ]}
                />
              );
            })}
          </View>

          <View style={s.backPlaceholder} />
        </View>
      )}

      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root:            { flex: 1 },
  flex:            { flex: 1 },
  topBar:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn:         { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  backPlaceholder: { width: 36 },
  progressRow:     { flex: 1, flexDirection: 'row', gap: 6 },
  segment:         { flex: 1, height: 3, borderRadius: 2 },
  scroll:          { flex: 1 },
  scrollContent:   { paddingBottom: 32 },
});
