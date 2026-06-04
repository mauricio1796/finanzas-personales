import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SPACING } from '../../constants';
import { THEME } from '../../constants/theme';
import { useTheme } from '../../state/ThemeContext';

interface SimulatorWidgetProps {
  currentBudget: number;
  currentSpent:  number;
  onSimulate?:   (amount: number, result: string) => void;
}

export const SimulatorWidget: React.FC<SimulatorWidgetProps> = ({
  currentBudget, currentSpent, onSimulate,
}) => {
  const { colors } = useTheme();
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
      setResult(`⚠️ Excederías tu presupuesto en $${Math.abs(newRemaining).toFixed(2)}`);
      onSimulate?.(amount, 'exceeded');
    } else if (newRemaining < currentBudget * 0.05) {
      setResult(`⚠️ Te quedarían solo $${newRemaining.toFixed(2)}. ¡Cuidado!`);
      onSimulate?.(amount, 'warning');
    } else {
      setResult(`✅ Después gastos, te quedarían $${newRemaining.toFixed(2)}`);
      onSimulate?.(amount, 'ok');
    }
    setIsSimulating(false);
  };

  const handleClear = () => { setSimulatedAmount(''); setResult(null); };

  const resultBg = result
    ? result.includes('✅') ? colors.incomeLight : colors.expenseLight
    : colors.incomeLight;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: colors.cardSecondary }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Simulador de Gastos</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Verifica cuánto te quedará disponible</Text>
        </View>

        <View style={styles.statsContainer}>
          <StatCard label="Presupuesto" value={`$${currentBudget.toFixed(2)}`} color={colors.primary} bg={colors.background} textSec={colors.textSecondary} />
          <StatCard label="Gastado"     value={`$${currentSpent.toFixed(2)}`}  color={colors.expense}  bg={colors.background} textSec={colors.textSecondary} />
          <StatCard label="Disponible"  value={`$${remaining.toFixed(2)}`}     color={remaining > 0 ? colors.income : colors.expense} bg={colors.background} textSec={colors.textSecondary} />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Cantidad a Simular</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="$0.00"
            placeholderTextColor={colors.textSecondary}
            value={simulatedAmount}
            onChangeText={setSimulatedAmount}
            keyboardType="decimal-pad"
            editable={!isSimulating}
          />
        </View>

        {result && (
          <View style={[styles.resultContainer, { backgroundColor: resultBg }]}>
            <Text style={[styles.resultText, { color: colors.textPrimary }]}>{result}</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleClear}
            style={[styles.clearButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            disabled={isSimulating}
            activeOpacity={0.7}
          >
            <Text style={[styles.clearButtonText, { color: colors.textPrimary }]}>Limpiar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSimulate}
            style={[styles.simulateButton, { backgroundColor: colors.primary }]}
            disabled={isSimulating || !simulatedAmount}
            activeOpacity={0.7}
          >
            <Text style={[styles.simulateButtonText, { color: '#fff' }]}>Simular</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

interface StatCardProps { label: string; value: string; color: string; bg: string; textSec: string; }
const StatCard: React.FC<StatCardProps> = ({ label, value, color, bg, textSec }) => (
  <View style={[styles.statCard, { backgroundColor: bg }]}>
    <Text style={[styles.statLabel, { color: textSec }]}>{label}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container:       { borderRadius: THEME.radius.md, padding: SPACING.lg, gap: SPACING.md },
  header:          { gap: SPACING.xs },
  title:           { fontSize: 16, fontWeight: '700' },
  subtitle:        { fontSize: 12 },
  statsContainer:  { flexDirection: 'row', gap: SPACING.sm },
  statCard:        { flex: 1, borderRadius: THEME.radius.sm, padding: SPACING.md, alignItems: 'center', gap: SPACING.xs },
  statLabel:       { fontSize: 11, fontWeight: '500' },
  statValue:       { fontSize: 14, fontWeight: '700' },
  inputContainer:  { gap: SPACING.sm },
  label:           { fontSize: 13, fontWeight: '600' },
  input:           { borderWidth: 1, borderRadius: THEME.radius.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, fontSize: 14 },
  resultContainer: { borderRadius: THEME.radius.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  resultText:      { fontSize: 13, fontWeight: '600' },
  buttonContainer: { flexDirection: 'row', gap: SPACING.md },
  clearButton:     { flex: 1, borderWidth: 1, borderRadius: THEME.radius.sm, paddingVertical: SPACING.sm, alignItems: 'center' },
  clearButtonText: { fontSize: 13, fontWeight: '600' },
  simulateButton:  { flex: 1, borderRadius: THEME.radius.sm, paddingVertical: SPACING.sm, alignItems: 'center' },
  simulateButtonText: { fontSize: 13, fontWeight: '600' },
});
