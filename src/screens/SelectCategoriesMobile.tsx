import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
  Pressable,
  FlatList,
  TextInput,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFinance, Category } from '@/src/core/context/FinanceContext';
import { THEME } from '../constants/theme';

interface SelectCategoriesMobileProps {
  onComplete: (selectedIds: string[]) => void;
}

export function SelectCategoriesMobile({ onComplete }: SelectCategoriesMobileProps) {
  const { categories, updateCategory } = useFinance();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [budgets, setBudgets] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'select' | 'budget'>('select');

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSelectContinue = () => {
    if (selectedCategories.length > 0) {
      setStep('budget');
    }
  };

  const handleBudgetComplete = () => {
    // Actualizar contexto con categorías seleccionadas y presupuestos
    selectedCategories.forEach(id => {
      const budget = budgets[id] ? parseFloat(budgets[id]) : undefined;
      updateCategory(id, { isSelected: true, budget });
    });
    
    onComplete(selectedCategories);
  };

  const selectedCategoriesData = categories.filter(c => selectedCategories.includes(c.id));

  const renderCategoryItem = ({ item }: { item: Category }) => {
    const isSelected = selectedCategories.includes(item.id);
    return (
      <Pressable
        style={[styles.categoryButton, isSelected && styles.categoryButtonSelected]}
        onPress={() => toggleCategory(item.id)}
      >
        <ThemedText style={styles.categoryEmoji}>{item.icon}</ThemedText>
        <ThemedText
          style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}
          numberOfLines={2}
        >
          {item.name}
        </ThemedText>
        {isSelected && <ThemedText style={styles.checkmark}>✓</ThemedText>}
      </Pressable>
    );
  };

  if (step === 'select') {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.header}>
          <ThemedText style={styles.title}>Selecciona tus Categorías</ThemedText>
          <ThemedText style={styles.subtitle}>
            Elige las categorías que usarás para registrar tus gastos e ingresos
          </ThemedText>
        </ThemedView>

        <ScrollView 
          style={styles.listContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          <FlatList
            data={categories}
            numColumns={3}
            scrollEnabled={false}
            columnWrapperStyle={styles.columnWrapper}
            renderItem={renderCategoryItem}
            keyExtractor={item => item.id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>No hay categorías disponibles</ThemedText>
              </View>
            }
          />
        </ScrollView>

        <ThemedView style={styles.footer}>
          <ThemedText style={styles.selectedCount}>
            {selectedCategories.length} seleccionada{selectedCategories.length !== 1 ? 's' : ''}
          </ThemedText>
          <Pressable
            style={[
              styles.continueButton,
              selectedCategories.length === 0 && styles.continueButtonDisabled,
            ]}
            onPress={handleSelectContinue}
            disabled={selectedCategories.length === 0}
          >
            <ThemedText style={styles.continueButtonText}>Continuar</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    );
  }

  // Budget input step
  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText style={styles.title}>Presupuestos</ThemedText>
        <ThemedText style={styles.subtitle}>
          Ingresa el presupuesto mensual para cada categoría (opcional)
        </ThemedText>
      </ThemedView>

      <ScrollView 
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {selectedCategoriesData.map(category => (
          <ThemedView key={category.id} style={styles.budgetItem}>
            <View style={styles.budgetItemHeader}>
              <ThemedText style={styles.budgetItemIcon}>{category.icon}</ThemedText>
              <ThemedText style={styles.budgetItemName}>{category.name}</ThemedText>
            </View>
            <View style={styles.budgetInputContainer}>
              <ThemedText style={styles.currencySymbol}>$</ThemedText>
              <TextInput
                style={styles.budgetInput}
                placeholder="0.00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
                value={budgets[category.id] || ''}
                onChangeText={text => setBudgets(prev => ({ ...prev, [category.id]: text }))}
              />
            </View>
          </ThemedView>
        ))}
      </ScrollView>

      <ThemedView style={styles.footer}>
        <Pressable
          style={[styles.continueButton, styles.backButton]}
          onPress={() => setStep('select')}
        >
          <ThemedText style={styles.continueButtonText}>Atrás</ThemedText>
        </Pressable>
        <Pressable
          style={styles.continueButton}
          onPress={handleBudgetComplete}
        >
          <ThemedText style={styles.continueButtonText}>Finalizar</ThemedText>
        </Pressable>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceSecondary,
  },
  header: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
    lineHeight: 21,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.border,
    shadowColor: THEME.colors.textPrimary,
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  categoryButtonSelected: {
    backgroundColor: THEME.colors.primaryLight,
    borderColor: THEME.colors.primary,
    borderWidth: 2,
  },
  categoryEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  categoryLabelSelected: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 20,
    color: THEME.colors.primary,
    fontWeight: '800',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textTertiary,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  selectedCount: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: THEME.colors.textPrimary,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  continueButtonDisabled: {
    backgroundColor: THEME.colors.border,
    opacity: 0.6,
  },
  continueButtonText: {
    color: THEME.colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  budgetItem: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  budgetItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  budgetItemIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  budgetItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  budgetInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.background,
    paddingHorizontal: 10,
  },
  currencySymbol: {
    color: THEME.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  budgetInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  backButton: {
    backgroundColor: THEME.colors.textTertiary,
    marginBottom: 10,
  },
});
