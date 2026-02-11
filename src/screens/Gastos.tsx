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
import { Transaction } from '@/src/core/financeEngine';
import { useFinance } from '@/src/core/context/FinanceContext';

interface GastosProps {
  transactions: Transaction[];
  onAddExpense: (amount: number, category: string, date: Date) => void;
  onDeleteTransaction: (id: string) => void;
}

export function Gastos({ transactions, onAddExpense, onDeleteTransaction }: GastosProps) {
  const { width } = useWindowDimensions();
  const { categories } = useFinance();
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categories[0]?.id || null);
  const [error, setError] = useState('');
  const [showCategoryList, setShowCategoryList] = useState(false);

  const isSmallScreen = width < 768;

  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const selectedCategoryName = categories.find(c => c.id === selectedCategory)?.name || 'Seleccionar';

  const validateAmount = (value: string): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  };

  const handleAddExpense = () => {
    setError('');

    if (!amount.trim()) {
      setError('Ingresa un monto');
      return;
    }

    if (!validateAmount(amount)) {
      setError('El monto debe ser un número positivo');
      return;
    }

    if (!selectedCategory) {
      setError('Selecciona una categoría');
      return;
    }

    onAddExpense(parseFloat(amount), selectedCategory, new Date());
    setAmount('');
    setShowCategoryList(false);
  };

  const renderExpenseItem = ({ item }: { item: Transaction }) => {
    const cat = categories.find(c => c.id === item.category);
    return (
      <ThemedView style={styles.transactionItem}>
        <View style={styles.transactionInfo}>
          <ThemedText style={styles.transactionCategory}>
            {cat?.icon} {cat?.name || item.category}
          </ThemedText>
          <ThemedText style={styles.transactionDate}>
            {new Date(item.date).toLocaleDateString('es-ES')}
          </ThemedText>
        </View>
        <View style={styles.transactionAmount}>
          <ThemedText style={styles.expenseAmount}>-${item.amount.toFixed(2)}</ThemedText>
          <Pressable onPress={() => onDeleteTransaction(item.id)}>
            <ThemedText style={styles.deleteButton}>Eliminar</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingHorizontal: isSmallScreen ? 16 : 24 }]}>
      <ThemedText type="title" style={styles.title}>
        Registrar Gastos
      </ThemedText>

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
          <Pressable
            style={styles.categorySelector}
            onPress={() => setShowCategoryList(!showCategoryList)}
          >
            <ThemedText style={styles.categorySelectorText}>
              {selectedCategoryName}
            </ThemedText>
            <ThemedText style={styles.dropdownIcon}>▼</ThemedText>
          </Pressable>

          {showCategoryList && (
            <ThemedView style={styles.categoryList}>
              {categories.map(cat => (
                <Pressable
                  key={cat.id}
                  style={[
                    styles.categoryOption,
                    selectedCategory === cat.id && styles.categoryOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat.id);
                    setShowCategoryList(false);
                  }}
                >
                  <ThemedText style={styles.categoryOptionText}>
                    {cat.icon} {cat.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          )}
        </View>

        <Pressable style={styles.button} onPress={handleAddExpense}>
          <ThemedText style={styles.buttonText}>Agregar Gasto</ThemedText>
        </Pressable>
      </ThemedView>

      <ThemedView style={styles.listContainer}>
        <ThemedText style={styles.listTitle}>Últimos Gastos</ThemedText>
        {expenseTransactions.length > 0 ? (
          <FlatList
            data={expenseTransactions.sort((a, b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
            )}
            renderItem={renderExpenseItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        ) : (
          <ThemedText style={styles.emptyText}>No hay gastos registrados</ThemedText>
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
  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  categorySelectorText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#6b7280',
  },
  categoryList: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    maxHeight: 300,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  categoryOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  categoryOptionActive: {
    backgroundColor: '#dbeafe',
  },
  categoryOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  button: {
    backgroundColor: '#dc2626',
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
  expenseAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#dc2626',
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