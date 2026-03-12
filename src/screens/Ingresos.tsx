import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  View,
  Text,
  ScrollView,
  FlatList,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useFinance, Transaction } from '@/src/core/context/FinanceContext';
import { SwipeableRow } from '@/src/components/ui/SwipeableRow';
import { Icon, getCategoryIcon } from '@/src/components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const formatCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

interface IngresosProps {
  transactions: Transaction[];
  onAddIncome: (amount: number, category: string, date: Date, description?: string) => void;
  onDeleteTransaction: (id: string) => void;
}

export function Ingresos({ transactions, onAddIncome, onDeleteTransaction }: IngresosProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, updateUserSalary } = useFinance();
  const [monthlySalary, setMonthlySalary] = useState(user?.monthlySalary ? Math.round(user.monthlySalary).toLocaleString('es-CO').replace(/,/g, '.') : '');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Salario');
  const [error, setError] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [salaryFocused, setSalaryFocused] = useState(false);

  const isSmall = width < 768;
  const incomeCategories = ['Salario', 'Freelance', 'Inversiones', 'Bonus', 'Otros'];
  const incomeTransactions = transactions
    .filter(t => t.type === 'income')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const validate = (v: string) => parseInt(v.replace(/\./g, ''), 10) > 0;

  const handleSaveSalary = () => {
    setError('');
    if (!monthlySalary.trim() || !validate(monthlySalary)) {
      setError('Ingresa un salario mensual válido');
      return;
    }
    updateUserSalary(parseInt(monthlySalary.replace(/\./g, ''), 10));
  };

  const handleAddIncome = () => {
    setError('');
    if (!amount.trim() || !validate(amount)) {
      setError('Ingresa un monto válido');
      return;
    }
    onAddIncome(parseInt(amount.replace(/\./g, ''), 10), category, new Date(), description);
    setAmount('');
    setDescription('');
    setCategory('Salario');
  };

  const renderItem = ({ item, index }: { item: Transaction; index: number }) => (
    <SwipeableRow onDelete={() => onDeleteTransaction(item.id)}>
      <View style={[styles.txItem, index < incomeTransactions.length - 1 && styles.txItemBorder]}>
        <View style={styles.txLeft}>
          <View style={styles.txIconCircle}>
              <Icon name={getCategoryIcon(item.category)} size={16} color="#10B981" />
          </View>
          <View>
            <Text style={styles.txCategory}>{item.category}</Text>
            {item.description ? (
              <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
            ) : null}
            <Text style={styles.txDate}>
              {new Date(item.date).toLocaleDateString('es-CO')}
            </Text>
          </View>
        </View>
        <View style={styles.txRight}>
          <Text style={styles.incomeAmount}>+{formatCOP(item.amount)}</Text>
        </View>
      </View>
    </SwipeableRow>
  );

  return (
    <ScrollView
      style={[styles.scroll, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingHorizontal: isSmall ? 20 : 28 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>FINANZAS</Text>
        <Text style={styles.headerTitle}>Registrar Ingresos</Text>
      </View>

      {/* Salary card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Salario Mensual</Text>
        <View style={styles.salaryRow}>
          <TextInput
            style={[styles.input, salaryFocused && styles.inputFocused, { flex: 1 }]}
            placeholder="Ej: 3.000.000"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            value={monthlySalary}
            onChangeText={(txt) => { const d = txt.replace(/\./g, '').replace(/[^0-9]/g, ''); const n = parseInt(d, 10); setMonthlySalary(isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.')); }}
            onFocus={() => setSalaryFocused(true)}
            onBlur={() => setSalaryFocused(false)}
          />
          <Pressable style={styles.saveBtn} onPress={handleSaveSalary}>
            <Text style={styles.saveBtnText}>Guardar</Text>
          </Pressable>
        </View>
        {user?.monthlySalary ? (
          <Text style={styles.currentSalary}>
            Salario actual: {formatCOP(user.monthlySalary)}
          </Text>
        ) : null}
      </View>

      {/* Add income form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nuevo Ingreso</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.fieldLabel}>MONTO</Text>
        <TextInput
          style={[styles.input, amountFocused && styles.inputFocused]}
          placeholder="Ej: 500.000"
          placeholderTextColor="#9CA3AF"
          keyboardType="numeric"
          value={amount}
          onChangeText={(txt) => { const d = txt.replace(/\./g, '').replace(/[^0-9]/g, ''); const n = parseInt(d, 10); setAmount(isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.')); }}
          onFocus={() => setAmountFocused(true)}
          onBlur={() => setAmountFocused(false)}
        />

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>DESCRIPCIÓN (opcional)</Text>
        <TextInput
          style={[styles.input, descFocused && styles.inputFocused]}
          placeholder="Ej: Pago quincena, Proyecto cliente..."
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          onFocus={() => setDescFocused(true)}
          onBlur={() => setDescFocused(false)}
          maxLength={80}
        />

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>CATEGORÍA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {incomeCategories.map(cat => (
            <Pressable
              key={cat}
              style={[styles.catPill, category === cat && styles.catPillActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.catPillText, category === cat && styles.catPillTextActive]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable style={styles.addBtn} onPress={handleAddIncome}>
          <Text style={styles.addBtnText}>+ Agregar Ingreso</Text>
        </Pressable>
      </View>

      {/* List */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Últimos Ingresos</Text>
        {incomeTransactions.length > 0 ? (
          <FlatList
            data={incomeTransactions}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.emptyText}>No hay ingresos registrados</Text>
        )}
      </View>

      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    paddingTop: 20,
    gap: 16,
  },

  // Header
  header: {
    marginBottom: 4,
  },
  headerLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    } : {}),
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },

  // Salary row
  salaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 18,
    borderRadius: 10,
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  currentSalary: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 10,
  },

  // Fields
  fieldLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  inputFocused: {
    borderColor: '#6366F1',
    borderWidth: 2,
  },

  // Category pills
  catScroll: {
    marginBottom: 4,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  catPillActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  catPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  catPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Add button
  addBtn: {
    backgroundColor: '#10B981',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    } : {}),
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // Error
  errorBox: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    marginBottom: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },

  // Transaction list
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  txItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  txIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  txDesc: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 1,
  },
  txDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  incomeAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
  },
  deleteBtn: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    paddingVertical: 20,
  },
});
