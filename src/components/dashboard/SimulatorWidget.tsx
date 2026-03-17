import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, SPACING } from '../../constants';

interface SimulatorWidgetProps {
  currentBudget: number;
  currentSpent: number;
  onSimulate?: (amount: number, result: string) => void;
}

export const SimulatorWidget: React.FC<SimulatorWidgetProps> = ({
  currentBudget,
  currentSpent,
  onSimulate,
}) => {
  const [simulatedAmount, setSimulatedAmount] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const remaining = currentBudget - currentSpent;

  const handleSimulate = () => {
    const amount = parseFloat(simulatedAmount);

    if (isNaN(amount) || amount < 0) {
      Alert.alert('Error', 'Por favor ingresa una cantidad válida');
      return;
    }

    setIsSimulating(true);

    const totalAfterSimulation = currentSpent + amount;
    const newRemaining = currentBudget - totalAfterSimulation;

    if (newRemaining < 0) {
      const exceedAmount = Math.abs(newRemaining);
      setResult(
        `⚠️ Excederías tu presupuesto en $${exceedAmount.toFixed(2)}`
      );
      onSimulate?.(amount, 'exceeded');
    } else if (newRemaining < currentBudget * 0.05) {
      setResult(
        `⚠️ Te quedarían solo $${newRemaining.toFixed(2)}. ¡Cuidado!`
      );
      onSimulate?.(amount, 'warning');
    } else {
      setResult(
        `✅ Después gastos, te quedarían $${newRemaining.toFixed(2)}`
      );
      onSimulate?.(amount, 'ok');
    }

    setIsSimulating(false);
  };

  const handleClear = () => {
    setSimulatedAmount('');
    setResult(null);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Simulador de Gastos</Text>
          <Text style={styles.subtitle}>
            Verifica cuánto te quedará disponible
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <StatCard
            label="Presupuesto"
            value={`$${currentBudget.toFixed(2)}`}
            color={COLORS.primary}
          />
          <StatCard
            label="Gastado"
            value={`$${currentSpent.toFixed(2)}`}
            color="#FF6B6B"
          />
          <StatCard
            label="Disponible"
            value={`$${remaining.toFixed(2)}`}
            color={remaining > 0 ? '#10B981' : '#EF4444'}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Cantidad a Simular</Text>
          <TextInput
            style={styles.input}
            placeholder="$0.00"
            placeholderTextColor={COLORS.textSecondary}
            value={simulatedAmount}
            onChangeText={setSimulatedAmount}
            keyboardType="decimal-pad"
            editable={!isSimulating}
          />
        </View>

        {result && (
          <View
            style={[
              styles.resultContainer,
              result.includes('⚠️') && styles.resultWarning,
              result.includes('✅') && styles.resultSuccess,
            ]}
          >
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            disabled={isSimulating}
            activeOpacity={0.7}
          >
            <Text style={styles.clearButtonText}>Limpiar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSimulate}
            style={styles.simulateButton}
            disabled={isSimulating || !simulatedAmount}
            activeOpacity={0.7}
          >
            <Text style={styles.simulateButtonText}>Simular</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => (
  <View style={styles.statCard}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardSecondary,
    borderRadius: 12,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  header: {
    gap: SPACING.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputContainer: {
    gap: SPACING.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  resultContainer: {
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#ECFDF5',
  },
  resultSuccess: {
    backgroundColor: '#ECFDF5',
  },
  resultWarning: {
    backgroundColor: '#FEF2F2',
  },
  resultText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  clearButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  clearButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  simulateButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  simulateButtonText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: '600',
  },
});
