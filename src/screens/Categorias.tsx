import React, { useState } from 'react'; // Fixed: removed duplicate code
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
import { useFinance, Category } from '@/src/core/context/FinanceContext';
import { THEME } from '@/src/constants/theme';

interface CategoriasProps {
  onCategoryUpdate?: () => void;
}

export function Categorias({ onCategoryUpdate }: CategoriasProps) {
  const { width } = useWindowDimensions();
  const { categories, setCategories, updateCategory } = useFinance();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [newCategoryBudget, setNewCategoryBudget] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedBudgetId, setExpandedBudgetId] = useState<string | null>(null);

  const isSmallScreen = width < 768;

  const emojiSuggestions = ['🍔', '🚗', '🏠', '💡', '🎮', '⚕️', '📚', '👕', '🐕', '🛡️', '📺', '💪', '🍽️', '🎬', '✈️', '🎁', '💇', '💳', '🏦', '📦'];

  const validateCategory = (name: string): boolean => {
    if (!name.trim()) {
      setError('El nombre de la categoría es requerido');
      return false;
    }
    if (name.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres');
      return false;
    }
    const exists = categories.some((c: Category) => c.name.toLowerCase() === name.toLowerCase() && c.id !== editingId);
    if (exists) {
      setError('Esta categoría ya existe');
      return false;
    }
    return true;
  };

  const handleAddCategory = () => {
    setError('');
    if (!validateCategory(newCategoryName)) return;

    const newCategory: Category = {
      id: editingId || Date.now().toString(),
      name: newCategoryName,
      icon: newCategoryIcon || '📦',
      budget: newCategoryBudget ? parseFloat(newCategoryBudget) : undefined,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      isSelected: editingId ? categories.find(c => c.id === editingId)?.isSelected : false,
    };

    if (editingId) {
      setCategories(categories.map(c => (c.id === editingId ? { ...c, ...newCategory } : c)));
      setEditingId(null);
    } else {
      setCategories([...categories, newCategory]);
    }

    setNewCategoryName('');
    setNewCategoryIcon('');
    setNewCategoryBudget('');
    onCategoryUpdate?.();
  };

  const handleDeleteCategory = (id: string) => {
    setCategories(categories.filter(c => c.id !== id));
    onCategoryUpdate?.();
  };

  const handleEditCategory = (category: Category) => {
    setEditingId(category.id);
    setNewCategoryName(category.name);
    setNewCategoryIcon(category.icon || '');
    setNewCategoryBudget(category.budget?.toString() || '');
  };

  const handleToggleSelection = (id: string) => {
    const category = categories.find(c => c.id === id);
    if (category) {
      updateCategory(id, { isSelected: !category.isSelected });
    }
  };

  const handleSaveBudget = (id: string, budget: string) => {
    if (budget && !isNaN(parseFloat(budget))) {
      updateCategory(id, { budget: parseFloat(budget) });
      setExpandedBudgetId(null);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setNewCategoryName('');
    setNewCategoryIcon('');
    setNewCategoryBudget('');
    setError('');
  };

  const selectedCount = categories.filter(c => c.isSelected).length;

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <ThemedView style={[styles.categoryCard, { borderLeftColor: item.color, borderLeftWidth: 4 }]}>
      <Pressable
        style={styles.selectCheckbox}
        onPress={() => handleToggleSelection(item.id)}
      >
        <ThemedText style={styles.checkbox}>
          {item.isSelected ? '✓' : ''}
        </ThemedText>
      </Pressable>
      <View style={styles.categoryInfo}>
        <ThemedText style={styles.categoryIcon}>{item.icon}</ThemedText>
        <View style={styles.categoryDetails}>
          <ThemedText style={styles.categoryName}>{item.name}</ThemedText>
          {item.budget && (
            <ThemedText style={styles.budgetDisplay}>
              Presupuesto: ${item.budget.toFixed(2)}
            </ThemedText>
          )}
        </View>
      </View>
      <View style={styles.categoryActions}>
        <Pressable
          style={styles.actionButton}
          onPress={() => setExpandedBudgetId(expandedBudgetId === item.id ? null : item.id)}
        >
          <ThemedText style={styles.budgetButton}>💰</ThemedText>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => handleEditCategory(item)}
        >
          <ThemedText style={styles.editButton}>Editar</ThemedText>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => handleDeleteCategory(item.id)}
        >
          <ThemedText style={styles.deleteButton}>Eliminar</ThemedText>
        </Pressable>
      </View>
      {expandedBudgetId === item.id && (
        <BudgetInputModal
          currentBudget={item.budget?.toString() || ''}
          onSave={(budget) => handleSaveBudget(item.id, budget)}
          onCancel={() => setExpandedBudgetId(null)}
        />
      )}
    </ThemedView>
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingHorizontal: isSmallScreen ? 16 : 24 }]}>
      <ThemedText type="title" style={styles.title}>
        Categorías
      </ThemedText>

      {selectedCount > 0 && (
        <ThemedView style={styles.selectedInfo}>
          <ThemedText style={styles.selectedText}>
            ✨ {selectedCount} categoría{selectedCount !== 1 ? 's' : ''} seleccionada{selectedCount !== 1 ? 's' : ''}
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.form}>
        {error && (
          <ThemedView style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </ThemedView>
        )}

        <View>
          <ThemedText style={styles.label}>Nombre de la Categoría</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="ej: Cine, Deportes, etc."
            placeholderTextColor={THEME.colors.textTertiary}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
          />
        </View>

        <View>
          <ThemedText style={styles.label}>Presupuesto (Opcional)</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Monto máximo a gastar"
            placeholderTextColor={THEME.colors.textTertiary}
            keyboardType="decimal-pad"
            value={newCategoryBudget}
            onChangeText={setNewCategoryBudget}
          />
        </View>

        <View>
          <ThemedText style={styles.label}>Emoji (Opcional)</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Pega un emoji"
            placeholderTextColor={THEME.colors.textTertiary}
            value={newCategoryIcon}
            onChangeText={setNewCategoryIcon}
            maxLength={2}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.emojiScroll}
          >
            {emojiSuggestions.map(emoji => (
              <Pressable
                key={emoji}
                style={styles.emojiButton}
                onPress={() => setNewCategoryIcon(emoji)}
              >
                <ThemedText style={styles.emoji}>{emoji}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.buttonGroup}>
          <Pressable style={styles.button} onPress={handleAddCategory}>
            <ThemedText style={styles.buttonText}>
              {editingId ? 'Actualizar' : 'Agregar'} Categoría
            </ThemedText>
          </Pressable>
          {editingId && (
            <Pressable style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
              <ThemedText style={styles.buttonText}>Cancelar</ThemedText>
            </Pressable>
          )}
        </View>
      </ThemedView>

      <ThemedView style={styles.categoriesList}>
        <ThemedText style={styles.listTitle}>Tus Categorías ({categories.length})</ThemedText>
        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={item => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
        />
      </ThemedView>
    </ScrollView>
  );
}

// Componente para ingresar presupuesto
const BudgetInputModal = ({ currentBudget, onSave, onCancel }: { currentBudget: string; onSave: (budget: string) => void; onCancel: () => void }) => {
  const [budget, setBudget] = useState(currentBudget);

  return (
    <View style={styles.budgetModal}>
      <TextInput
        style={styles.budgetInput}
        placeholder="Ingresa el presupuesto"
        keyboardType="decimal-pad"
        value={budget}
        onChangeText={setBudget}
      />
      <View style={styles.budgetActions}>
        <Pressable style={[styles.budgetActionBtn, styles.budgetSaveBtn]} onPress={() => onSave(budget)}>
          <ThemedText style={styles.budgetActionText}>Guardar</ThemedText>
        </Pressable>
        <Pressable style={[styles.budgetActionBtn, styles.budgetCancelBtn]} onPress={onCancel}>
          <ThemedText style={styles.budgetActionText}>Cancelar</ThemedText>
        </Pressable>
      </View>
    </View>
  );
};

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
    color: THEME.colors.textPrimary,
    letterSpacing: 0.3,
  },
  selectedInfo: {
    padding: 14,
    borderRadius: THEME.radius.md,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    marginBottom: 16,
  },
  selectedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  form: {
    padding: 20,
    borderRadius: THEME.radius.md,
    gap: 20,
    backgroundColor: THEME.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: '#0B1220',
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    color: THEME.colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 14,
    borderRadius: THEME.radius.sm,
    fontSize: 16,
    color: THEME.colors.textPrimary,
    backgroundColor: THEME.colors.surface,
    fontWeight: '500',
  },
  emojiScroll: {
    marginTop: 10,
    marginBottom: 8,
  },
  emojiButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  emoji: {
    fontSize: 28,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    backgroundColor: THEME.colors.primary,
    padding: 16,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    shadowColor: '#0B1220',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 2,
  },
  cancelButton: {
    backgroundColor: THEME.colors.textTertiary,
  },
  buttonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  errorContainer: {
    backgroundColor: THEME.colors.expenseLight,
    padding: 14,
    borderRadius: THEME.radius.sm,
    borderLeftWidth: 4,
    borderLeftColor: THEME.colors.expense,
  },
  errorText: {
    color: THEME.colors.expense,
    fontSize: 14,
    fontWeight: '600',
  },
  categoriesList: {
    padding: 20,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: THEME.colors.textPrimary,
  },
  listContent: {
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: THEME.radius.sm,
    marginBottom: 8,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: '#0B1220',
    shadowOpacity: 0.02,
    shadowRadius: 24,
    elevation: 1,
    gap: 12,
  },
  selectCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSecondary,
  },
  checkbox: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.income,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  categoryDetails: {
    flex: 1,
  },
  categoryIcon: {
    fontSize: 28,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  budgetDisplay: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  budgetButton: {
    fontSize: 16,
  },
  editButton: {
    fontSize: 12,
    color: THEME.colors.primary,
    fontWeight: '700',
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButton: {
    fontSize: 12,
    color: THEME.colors.expense,
    fontWeight: '700',
    backgroundColor: THEME.colors.expenseLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  budgetModal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    gap: 10,
  },
  budgetInput: {
    borderWidth: 1,
    borderColor: '#fcd34d',
    padding: 12,
    borderRadius: THEME.radius.sm,
    fontSize: 14,
    color: THEME.colors.textPrimary,
    backgroundColor: '#fffbeb',
    fontWeight: '500',
  },
  budgetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  budgetActionBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  budgetSaveBtn: {
    backgroundColor: '#fbbf24',
  },
  budgetCancelBtn: {
    backgroundColor: THEME.colors.border,
  },
  budgetActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.surface,
  },
});