import { Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFinance } from '@/src/context/FinanceContext';

const AVAILABLE_CATEGORIES = [
  { id: '1', name: 'Comida', icon: '🍔' },
  { id: '2', name: 'Transporte', icon: '🚗' },
  { id: '3', name: 'Arriendo', icon: '🏠' },
  { id: '4', name: 'Servicios', icon: '💡' },
  { id: '5', name: 'Ocio', icon: '🎮' },
  { id: '6', name: 'Salud', icon: '⚕️' },
  { id: '7', name: 'Educación', icon: '📚' },
];

export default function CategoriesScreen() {
  const { categories, setCategories } = useFinance();

  const toggleCategory = (availableCategory: typeof AVAILABLE_CATEGORIES[0]) => {
    const exists = categories.find(c => c.id === availableCategory.id);

    if (exists) {
      setCategories(categories.filter(c => c.id !== availableCategory.id));
    } else {
      setCategories([
        ...categories,
        {
          id: availableCategory.id,
          name: availableCategory.name,
          icon: availableCategory.icon,
        },
      ]);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Categorías del mes</ThemedText>

      {AVAILABLE_CATEGORIES.map(cat => {
        const active = categories.some(c => c.id === cat.id);

        return (
          <Pressable
            key={cat.id}
            style={[styles.category, active && styles.active]}
            onPress={() => toggleCategory(cat)}
          >
            <ThemedText>
              {cat.icon} {cat.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
    gap: 12,
  },
  category: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#1E293B',
  },
  active: {
    backgroundColor: '#2563EB',
  },
});

