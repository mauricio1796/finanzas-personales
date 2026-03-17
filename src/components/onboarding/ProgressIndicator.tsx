import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../state/ThemeContext';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[]; // kept for API compatibility, not displayed
}

/**
 * Ultra-thin full-width progress line.
 * No labels, no dots — pure minimalism.
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
}) => {
  const { colors } = useTheme();
  const progress = Math.min((currentStep / totalSteps) * 100, 100);

  return (
    <View style={[styles.track, { backgroundColor: colors.border }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${progress}%` as any,
            backgroundColor: colors.primary,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 2,
    width: '100%',
  },
  fill: {
    height: 2,
  },
});
