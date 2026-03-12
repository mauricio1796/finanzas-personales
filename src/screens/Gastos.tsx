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
import { Transaction } from '@/src/core/financeEngine';
import { useFinance } from '@/src/core/context/FinanceContext';
import { SwipeableRow } from '@/src/components/ui/SwipeableRow';
import { Icon, getCategoryIcon } from '@/src/components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const formatCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

interface GastosProps {
  transactions: Transaction[];
  onAddExpense: (amount: number, category: string, date: Date, description?: string) => void;
  onDeleteTransaction: (id: string) => void;
}

export function Gastos({ transactions, onAddExpense, onDeleteTransaction }: GastosProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { categories } = useFinance();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categories[0]?.id || null);
  const [error, setError] = useState('');
  const [showCategoryList, setShowCategoryList] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

  const isSmall = width < 768;
  const expenseTransactions = transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
  const selectedCategoryName = selectedCategoryObj
    ? `${selectedCategoryObj.icon} ${selectedCategoryObj.name}`
    : 'Seleccionar categoría';

  const validate = (v: string) => parseInt(v.replace(/\./g, ''), 10) > 0;

  const handleAddExpense = () => {
    setError('');
    if (!amount.trim() || !validate(amount)) { setError('Ingresa un monto válido'); return; }
    if (!selectedCategory) { setError('Selecciona una categoría'); return; }
    onAddExpense(parseInt(amount.replace(/\./g, ''), 10), selectedCategory, new Date(), description);
    setAmount('');
    setDescription('');
    setShowCategoryList(false);
  };

  const renderItem = ({ item, index }: { item: Transaction; index: number }) => {
    const cat = categories.find(c => c.id === item.category);
    return (
      <SwipeableRow onDelete={() => onDeleteTransaction(item.id)}>
        <View style={[styles.txItem, index < expenseTransactions.length - 1 && styles.txItemBorder]}>
          <View style={styles.txLeft}>
            <View style={styles.txIconCircle}>
              <Icon name={getCategoryIcon(item.category)} size={16} color="#EF4444" />
            </View>
            <View>
              <Text style={styles.txCategory}>{cat?.name ?? item.category}</Text>
              {item.description ? (
                <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
              ) : null}
              <Text style={styles.txDate}>{new Date(item.date).toLocaleDateString('es-CO')}</Text>
            </View>
          </View>
          <View style={styles.txRight}>
            <Text style={styles.expenseAmount}>-{formatCOP(item.amount)}</Text>
          </View>
        </View>
      </SwipeableRow>
    );
  };

  return (
    <ScrollView
      style={[styles.scroll, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingHorizontal: isSmall ? 20 : 28 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>FINANZAS</Text>
        <Text style={styles.headerTitle}>Registrar Gastos</Text>
      </View>

      {/* Form card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nuevo Gasto</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.fieldLabel}>MONTO</Text>
        <TextInput
          style={[styles.input, amountFocused && styles.inputFocused]}
          placeholder="Ej: 1.250.000"
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
          placeholder="Ej: Supermercado, Netflix, Gasolina..."
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          onFocus={() => setDescFocused(true)}
          onBlur={() => setDescFocused(false)}
          maxLength={80}
        />

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>CATEGORÍA</Text>
        <Pressable
          style={[styles.categorySelector, showCategoryList && styles.categorySelectorOpen]}
          onPress={() => setShowCategoryList(!showCategoryList)}
        >
          <Text style={styles.categorySelectorText}>{selectedCategoryName}</Text>
          <Text style={styles.dropdownIcon}>{showCategoryList ? '▲' : '▼'}</Text>
        </Pressable>

        {showCategoryList && (
          <View style={styles.categoryList}>
            {categories.map((cat, i) => (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryOption,
                  i < categories.length - 1 && styles.categoryOptionBorder,
                  selectedCategory === cat.id && styles.categoryOptionActive,
                ]}
                onPress={() => { setSelectedCategory(cat.id); setShowCategoryList(false); }}
              >
                <Text style={[
                  styles.categoryOptionText,
                  selectedCategory === cat.id && styles.categoryOptionTextActive,
                ]}>
                  {cat.icon} {cat.name}
                </Text>
                {selectedCategory === cat.id && (
                  <Text style={styles.categoryCheckmark}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        <Pressable style={styles.addBtn} onPress={handleAddExpense}>
          <Text style={styles.addBtnText}>+ Agregar Gasto</Text>
        </Pressable>
      </View>

      {/* List */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Últimos Gastos</Text>
        {expenseTransactions.length > 0 ? (
          <FlatList
            data={expenseTransactions}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.emptyText}>No hay gastos registrados</Text>
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
    borderColor: '#EF4444',
    borderWidth: 2,
  },

  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  categorySelectorOpen: {
    borderColor: '#EF4444',
    borderWidth: 2,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  categorySelectorText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  dropdownIcon: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  categoryList: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#EF4444',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#FFFFFF',
    maxHeight: 280,
    overflow: 'hidden',
    marginBottom: 4,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  categoryOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryOptionActive: {
    backgroundColor: '#FEF2F2',
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  categoryOptionTextActive: {
    color: '#EF4444',
  },
  categoryCheckmark: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '700',
  },

  addBtn: {
    backgroundColor: '#EF4444',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#EF4444',
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
    backgroundColor: '#FEF2F2',
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
  expenseAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EF4444',
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
