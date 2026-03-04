import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  stepLabels,
}) => {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            { width: `${progress}%` },
          ]}
        />
      </View>
      <View style={styles.stepInfo}>
        <Text style={styles.stepCount}>
          {currentStep} de {totalSteps}
        </Text>
        {stepLabels && stepLabels[currentStep - 1] && (
          <Text style={styles.stepLabel}>
            {stepLabels[currentStep - 1]}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: COLORS.background_secondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  stepInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepCount: {
    fontSize: 12,
    color: COLORS.text_secondary,
    fontWeight: '600',
  },
  stepLabel: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
