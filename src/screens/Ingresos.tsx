import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  View,
  ScrollView,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFinance, Transaction } from '@/src/core/context/FinanceContext';

interface IngresosProps {
  transactions: Transaction[];
  onAddIncome: (amount: number, category: string, date: Date) => void;
  onDeleteTransaction: (id: string) => void;
}

export function Ingresos({ transactions, onAddIncome, onDeleteTransaction }: IngresosProps) {
  const { width } = useWindowDimensions();
  const { user, updateUserSalary } = useFinance();
  const [monthlySalary, setMonthlySalary] = useState(user?.monthlySalary?.toString() || '');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Salario');
  const [error, setError] = useState('');

  const isSmallScreen = width < 768;

  const incomeCategories = ['Salario', 'Freelance', 'Inversiones', 'Bonus', 'Otros'];
  const incomeTransactions = transactions.filter(t => t.type === 'income');

  const validateAmount = (value: string): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  };

  const handleSaveSalary = () => {
    setError('');
    if (!monthlySalary.trim()) {
      setError('Ingresa tu salario mensual');
      return;
    }
    if (!validateAmount(monthlySalary)) {
      setError('El salario debe ser un número positivo');
      return;
    }
    updateUserSalary(parseFloat(monthlySalary));
    setError('');
  };

  const handleAddIncome = () => {
    setError('');

    if (!amount.trim()) {
      setError('Ingresa un monto');
      return;
    }

    if (!validateAmount(amount)) {
      setError('El monto debe ser un número positivo');
      return;
    }

    onAddIncome(parseFloat(amount), category, new Date());
    setAmount('');
    setCategory('Salario');
  };

  const renderIncomeItem = ({ item }: { item: Transaction }) => (
    <ThemedView style={styles.transactionItem}>
      <View style={styles.transactionInfo}>
        <ThemedText style={styles.transactionCategory}>{item.category}</ThemedText>
        <ThemedText style={styles.transactionDate}>
          {new Date(item.date).toLocaleDateString('es-ES')}
        </ThemedText>
      </View>
      <View style={styles.transactionAmount}>
        <ThemedText style={styles.incomeAmount}>+${item.amount.toFixed(2)}</ThemedText>
        <Pressable onPress={() => onDeleteTransaction(item.id)}>
          <ThemedText style={styles.deleteButton}>Eliminar</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingHorizontal: isSmallScreen ? 16 : 24 }]}>
      <ThemedText type="title" style={styles.title}>
        Registrar Ingresos
      </ThemedText>

      {/* Salario Mensual */}
      <ThemedView style={styles.salarySection}>
        <ThemedText style={styles.salaryTitle}>📊 Salario Mensual</ThemedText>
        <View style={styles.salaryInputContainer}>
          <TextInput
            style={styles.salaryInput}
            placeholder="Ingresa tu salario mensual"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
            value={monthlySalary}
            onChangeText={setMonthlySalary}
          />
          <Pressable style={styles.saveSalaryButton} onPress={handleSaveSalary}>
            <ThemedText style={styles.saveSalaryButtonText}>Guardar</ThemedText>
          </Pressable>
        </View>
        {user?.monthlySalary && (
          <ThemedText style={styles.salaryDisplay}>
            Salario actual: ${user.monthlySalary.toFixed(2)}
          </ThemedText>
        )}
      </ThemedView>

      {/* Registrar Ingreso */}
      <ThemedView style={styles.form}>
        {error ? (
          <ThemedView style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </ThemedView>
        ) : null}

        <View>
          <ThemedText style={styles.label}>Monto</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        <View>
          <ThemedText style={styles.label}>Categoría</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {incomeCategories.map(cat => (
              <Pressable
                key={cat}
                style={[
                  styles.categoryButton,
                  category === cat && styles.categoryButtonActive,
                ]}
                onPress={() => setCategory(cat)}
              >
                <ThemedText
                  style={[
                    styles.categoryButtonText,
                    category === cat && styles.categoryButtonTextActive,
                  ]}
                >
                  {cat}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Pressable style={styles.button} onPress={handleAddIncome}>
          <ThemedText style={styles.buttonText}>Agregar Ingreso</ThemedText>
        </Pressable>
      </ThemedView>

      <ThemedView style={styles.listContainer}>
        <ThemedText style={styles.listTitle}>Últimos Ingresos</ThemedText>
        {incomeTransactions.length > 0 ? (
          <FlatList
            data={incomeTransactions.sort((a, b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
            )}
            renderItem={renderIncomeItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        ) : (
          <ThemedText style={styles.emptyText}>No hay ingresos registrados</ThemedText>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingVertical: 28,
    gap: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 24,
    color: '#1f2937',
    letterSpacing: 0.3,
  },
  salarySection: {
    padding: 20,
    borderRadius: 12,
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#22c55e',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  salaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#15803d',
  },
  salaryInputContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  salaryInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#22c55e',
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#ffffff',
    fontWeight: '500',
  },
  saveSalaryButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveSalaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  salaryDisplay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803d',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#86efac',
  },
  form: {
    padding: 20,
    borderRadius: 12,
    gap: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    color: '#1f2937',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#ffffff',
    fontWeight: '500',
  },
  categoryScroll: {
    marginBottom: 4,
  },
  categoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: '#ffffff',
  },
  categoryButtonActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  categoryButtonTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1f2937',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionCategory: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    color: '#1f2937',
  },
  transactionDate: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  incomeAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#22c55e',
    marginBottom: 6,
  },
  deleteButton: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    paddingVertical: 24,
    fontWeight: '500',
  },
});