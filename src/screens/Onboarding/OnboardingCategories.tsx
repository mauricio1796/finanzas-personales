import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Animated,
} from 'react-native';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { ChatBubble, ProgressIndicator } from '../../components/onboarding';

// ─── Minimalist icons (geometric Unicode) ──────────────────────────────
const COL_CATEGORIES = [
  { id: 'arriendo',        label: 'Arriendo',          icon: '⌂', color: '#92400E', bg: '#FEF3C7' },
  { id: 'transporte',      label: 'Transporte',         icon: '▷', color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'alimentacion',    label: 'Alimentacion',       icon: '⊕', color: '#EF4444', bg: '#FEF2F2' },
  { id: 'servicios',       label: 'Servicios',          icon: '◈', color: '#06B6D4', bg: '#ECFEFF' },
  { id: 'telefonia',       label: 'Telefonia',          icon: '□', color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'salud',           label: 'Salud',              icon: '+',       color: '#10B981', bg: '#ECFDF5' },
  { id: 'educacion',       label: 'Educacion',          icon: '△', color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'ropa',            label: 'Ropa',               icon: '◇', color: '#EC4899', bg: '#FDF2F8' },
  { id: 'entretenimiento', label: 'Entrete.',           icon: '▶', color: '#A855F7', bg: '#FAF5FF' },
  { id: 'deudas',          label: 'Deudas',             icon: '⊖', color: '#6366F1', bg: '#EEF2FF' },
  { id: 'mascotas',        label: 'Mascotas',           icon: '○', color: '#D97706', bg: '#FFFBEB' },
  { id: 'otro',            label: 'Otro',               icon: '⊞', color: '#6B7280', bg: '#F9FAFB' },
];

// ─── Single animated card ───────────────────────────────────────────────
interface CardProps {
  cat: typeof COL_CATEGORIES[0];
  isSelected: boolean;
  onPress: () => void;
  delay: number;
  primary: string;
}

const CategoryCard: React.FC<CardProps> = ({ cat, isSelected, onPress, delay, primary }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Entrance animation (staggered)
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 340, delay, useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0, delay, friction: 7, tension: 80, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Press feedback
  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.93, friction: 6, tension: 200, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,    friction: 6, tension: 200, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View
      style={[
        cs.cardWrap,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[
          cs.card,
          {
            backgroundColor: isSelected ? primary + '12' : '#FFFFFF',
            borderColor: isSelected ? primary : '#E5E7EB',
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
        onPress={handlePress}
        activeOpacity={1}
      >
        {/* Icon */}
        <View style={[cs.iconWrap, { backgroundColor: isSelected ? primary + '18' : cat.bg }]}>
          <Text style={[cs.icon, { color: isSelected ? primary : cat.color }]}>{cat.icon}</Text>
        </View>

        {/* Label */}
        <Text
          style={[cs.label, { color: isSelected ? primary : '#374151' }]}
          numberOfLines={1}
        >
          {cat.label}
        </Text>

        {/* Check badge */}
        {isSelected && (
          <View style={[cs.checkBadge, { backgroundColor: primary }]}>
            <Text style={cs.checkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export const OnboardingCategories: React.FC = () => {
  const { updateOnboardingStep, setCategories, categories } = useFinance();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { Keyboard.dismiss(); }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleContinue = () => {
    const selectedCats = COL_CATEGORIES.filter(c => selected.has(c.id));
    const newCats = selectedCats.map(c => ({
      id: c.id,
      name: c.label,
      icon: c.icon,
      color: c.color,
      presupuesto: 0,
      tipo: 'fijo',
    }));
    const existingIds = new Set(newCats.map(c => c.id));
    const merged = [...categories.filter(c => !existingIds.has(c.id)), ...newCats];
    setCategories(merged);
    updateOnboardingStep(3);
  };

  const canContinue = selected.size > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressContainer}>
        <ProgressIndicator currentStep={2} totalSteps={5} />
      </View>

      <ChatBubble
        message="Cual es tu tipo de gastos fijos cada mes? Elige las categorias que apliquen"
        isUser={false}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {COL_CATEGORIES.map((cat, i) => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            isSelected={selected.has(cat.id)}
            onPress={() => toggle(cat.id)}
            delay={i * 45}
            primary={colors.primary}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={[styles.countText, { color: colors.text_secondary }]}>
          {selected.size > 0
            ? `${selected.size} categoria${selected.size !== 1 ? 's' : ''} seleccionada${selected.size !== 1 ? 's' : ''}`
            : 'Selecciona al menos una categoria'}
        </Text>
        <TouchableOpacity
          style={[
            styles.btn,
            { backgroundColor: colors.primary },
            !canContinue && styles.btnDisabled,
          ]}
          onPress={handleContinue}
          disabled={!canContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const cs = StyleSheet.create({
  cardWrap: { width: '48%' },
  card: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    minHeight: 90,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 22, fontWeight: '300' },
  label: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  checkBadge: {
    position: 'absolute', top: 7, right: 7,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  checkText: { fontSize: 10, color: '#FFFFFF', fontWeight: '900' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 20 },
  progressContainer: { marginBottom: 16 },
  scroll: { flex: 1, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 16 },
  footer: { paddingVertical: 16, gap: 10 },
  countText: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
  btn: { paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
