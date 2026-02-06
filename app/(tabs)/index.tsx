import { StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import {
  Transaction,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateBalance,
  expensesByCategory,
} from '@/src/core/financeEngine';

export default function HomeScreen() {

  // 🔢 Datos de prueba (luego vienen de BD)
  const transactions: Transaction[] = [
    {
      id: '1',
      amount: 2500000,
      category: 'salario',
      date: new Date(),
      type: 'income',
    },
    {
      id: '2',
      amount: 400000,
      category: 'comida',
      date: new Date(),
      type: 'expense',
    },
    {
      id: '3',
      amount: 200000,
      category: 'transporte',
      date: new Date(),
      type: 'expense',
    },
  ];

  // 🧮 Calculos financieros
  const totalIncome = calculateTotalIncome(transactions);
  const totalExpenses = calculateTotalExpenses(transactions);
  const balance = calculateBalance(transactions);
  const expensesCategory = expensesByCategory(transactions);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Resumen financiero</ThemedText>

      <ThemedText>Ingresos: ${totalIncome}</ThemedText>
      <ThemedText>Gastos: ${totalExpenses}</ThemedText>
      <ThemedText>Balance: ${balance}</ThemedText>

      <ThemedText style={styles.subtitle}>
        Gastos por categoria
      </ThemedText>

      {Object.entries(expensesCategory).map(([category, value]) => (
        <ThemedText key={category}>
          {category}: ${value}
        </ThemedText>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 6,
  },
  subtitle: {
    marginTop: 10,
    fontWeight: 'bold',
  },
});
