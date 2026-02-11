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
            placeholderTextColor="#999"
            value={newCategoryName}
            onChangeText={setNewCategoryName}
          />
        </View>

        <View>
          <ThemedText style={styles.label}>Presupuesto (Opcional)</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Monto máximo a gastar"
            placeholderTextColor="#999"
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
            placeholderTextColor="#999"
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
    color: '#1f2937',
    letterSpacing: 0.3,
  },
  selectedInfo: {
    padding: 14,
    borderRadius: 10,
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
  emojiScroll: {
    marginTop: 10,
    marginBottom: 8,
  },
  emojiButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
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
    backgroundColor: '#0ea5e9',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelButton: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: 'white',
    fontSize: 15,
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
  categoriesList: {
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
  listContent: {
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
    gap: 12,
  },
  selectCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  checkbox: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
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
    color: '#1f2937',
  },
  budgetDisplay: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
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
    color: '#0ea5e9',
    fontWeight: '700',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButton: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '700',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  budgetModal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 10,
  },
  budgetInput: {
    borderWidth: 1,
    borderColor: '#fcd34d',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    color: '#1f2937',
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
    backgroundColor: '#d1d5db',
  },
  budgetActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
});