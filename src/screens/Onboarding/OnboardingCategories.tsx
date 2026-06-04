import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Keyboard, Animated, useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon, FeatherName } from '../../components/ui/Icon';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { CATALOGO_CATEGORIAS } from '../../constants/catalogoCategorias';
import { THEME } from '../../constants/theme';
import { inyectarSubcategoriasDefecto } from '../../models/Category';

interface Props { onNext: () => void; onBack: () => void; }

// Mapa id → nombre canónico en CATALOGO_CATEGORIAS
const ID_CATALOG: Record<string, string> = {
  alimentacion:    'Alimentación',
  transporte:      'Transporte',
  vivienda:        'Vivienda',
  salud:           'Salud',
  educacion:       'Educación',
  entretenimiento: 'Entretenimiento',
  ropa:            'Ropa',
  servicios:       'Servicios',
  gym:             'Gym / Sport',
  mascotas:        'Mascotas',
  ahorro:          'Ahorro',
  otros:           'Otros',
};

const CATEGORIAS: { id: string; name: string; icon: FeatherName; color: string }[] = [
  { id: 'alimentacion',    name: 'Alimentación',    icon: 'shopping-cart',   color: '#EF4444' },
  { id: 'transporte',      name: 'Transporte',      icon: 'map-pin',         color: '#3B82F6' },
  { id: 'vivienda',        name: 'Vivienda',        icon: 'home',            color: '#92400E' },
  { id: 'salud',           name: 'Salud',           icon: 'heart',           color: '#10B981' },
  { id: 'educacion',       name: 'Educación',       icon: 'book-open',       color: '#F59E0B' },
  { id: 'entretenimiento', name: 'Entretenimiento', icon: 'tv',              color: '#A855F7' },
  { id: 'ropa',            name: 'Ropa',            icon: 'shopping-bag',    color: '#EC4899' },
  { id: 'servicios',       name: 'Servicios',       icon: 'zap',             color: '#06B6D4' },
  { id: 'gym',             name: 'Gym / Sport',     icon: 'activity',        color: '#F97316' },
  { id: 'mascotas',        name: 'Mascotas',        icon: 'feather',         color: '#D97706' },
  { id: 'ahorro',          name: 'Ahorro',          icon: 'dollar-sign',     color: '#059669' },
  { id: 'otros',           name: 'Otros',           icon: 'more-horizontal', color: '#6B7280' },
];

interface CardProps {
  cat: typeof CATEGORIAS[0];
  isSelected: boolean;
  onPress: () => void;
  delay: number;
  cardSize: number;
}

const CatCard: React.FC<CardProps> = ({ cat, isSelected, onPress, delay, cardSize }) => {
  const { colors } = useTheme();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, delay, friction: 8, tension: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toVal = isSelected ? 1.04 : 0.94;
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: toVal, friction: 6, tension: 200, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,     friction: 6, tension: 200, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }], width: cardSize, aspectRatio: 1 }}>
      <TouchableOpacity
        style={[
          s.card,
          {
            width: cardSize, height: cardSize,
            backgroundColor: isSelected ? colors.primaryLight : colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 1.5 : 0.5,
          },
        ]}
        onPress={handlePress}
        activeOpacity={1}
      >
        <Icon name={cat.icon} size={24} color={isSelected ? colors.primary : colors.textSecondary} />
        <Text style={[s.cardLabel, { color: isSelected ? colors.primary : colors.textSecondary }]} numberOfLines={2}>
          {cat.name}
        </Text>
        {isSelected && (
          <View style={[s.checkDot, { backgroundColor: colors.primary }]}>
            <Icon name="check" size={9} color={'#fff'} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export const OnboardingCategories: React.FC<Props> = ({ onNext, onBack }) => {
  const { setCategories, categories, profile } = useFinance();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(categories.map(c => c.id))
  );
  const counterAnim = useRef(new Animated.Value(1)).current;
  const bubbleAnim  = useRef(new Animated.Value(0)).current;

  const COLS = 3;
  const GAP  = 10;
  const PAD  = 32;
  const cardSize = Math.floor((width - PAD - GAP * (COLS - 1)) / COLS);

  useEffect(() => {
    Keyboard.dismiss();
    Animated.spring(bubbleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      Animated.sequence([
        Animated.spring(counterAnim, { toValue: 1.3, friction: 5, tension: 200, useNativeDriver: true }),
        Animated.spring(counterAnim, { toValue: 1,   friction: 5, tension: 200, useNativeDriver: true }),
      ]).start();
      return next;
    });
  };

  const handleNext = () => {
    if (selected.size < 3) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const salary: number = (profile as any)?.monthlySalary ?? 0;

    const newCats = CATEGORIAS
      .filter(c => selected.has(c.id))
      .map(c => {
        const catalogNombre = ID_CATALOG[c.id];
        const catalogItem = CATALOGO_CATEGORIAS.find(ci => ci.nombre === catalogNombre);
        // Presupuesto sugerido basado en el salario del perfil
        const budget =
          catalogItem && salary > 0
            ? Math.round((salary * catalogItem.pctSugerido) / 10000 / 10000) * 10000
            : 0;
        return {
          id: c.id,
          name: catalogNombre ?? c.name,        // nombre canónico (con tildes)
          icon: catalogItem?.icono ?? c.icon,
          tipo: (catalogItem?.tipo ?? 'gasto') as 'gasto' | 'ingreso',
          isSelected: true,                      // ← aparece en CategoriasScreen
          budget,                                // ← se descuenta del salario
          pagado: false,
          fechaCreacion: new Date().toISOString(),
        };
      });

    const existingIds = new Set(newCats.map(c => c.id));
    const merged = [...categories.filter(c => !existingIds.has(c.id)), ...newCats];
    setCategories(inyectarSubcategoriasDefecto(merged));
    onNext();
  };

  const bubbleSlide = {
    opacity: bubbleAnim,
    transform: [{ translateX: bubbleAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
  };
  const canContinue = selected.size >= 3;

  return (
    <OnboardingShell step={3} totalSteps={5} onBack={onBack} keyboardAvoiding={false}>
      {/* Finn bubble + counter badge */}
      <View style={[s.topArea, { paddingHorizontal: 16 }]}>
        <View style={s.finnRow}>
          <View style={[s.finnAvatar, { backgroundColor: colors.primary }]}>
            <Text style={s.finnLetter}>F</Text>
          </View>
          <Animated.View style={[s.bubble, { backgroundColor: colors.card, borderColor: colors.border }, bubbleSlide]}>
            <Text style={[s.bubbleText, { color: colors.textPrimary }]}>
              Elige las categorias donde gastas normalmente
            </Text>
            <Text style={[s.bubbleSub, { color: colors.textTertiary }]}>Puedes cambiarlas despues</Text>
          </Animated.View>
        </View>

        <Animated.View style={[s.counterBadge, { backgroundColor: selected.size > 0 ? colors.primaryLight : colors.cardSecondary, transform: [{ scale: counterAnim }] }]}>
          <Text style={[s.counterText, { color: selected.size > 0 ? colors.primary : colors.textTertiary }]}>
            {selected.size} seleccionadas
          </Text>
        </Animated.View>
      </View>

      {/* Grid */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.grid, { paddingHorizontal: 16, paddingBottom: 16, gap: GAP }]} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          {CATEGORIAS.map((cat, i) => (
            <CatCard
              key={cat.id}
              cat={cat}
              isSelected={selected.has(cat.id)}
              onPress={() => toggle(cat.id)}
              delay={i * 30}
              cardSize={cardSize}
            />
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingHorizontal: 16, paddingBottom: 16 }]}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: colors.primary, opacity: canContinue ? 1 : 0.4 }]}
          onPress={handleNext}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>
            {canContinue ? 'Continuar con ' + selected.size + ' categorias' : 'Selecciona al menos 3'}
          </Text>
        </TouchableOpacity>
      </View>
    </OnboardingShell>
  );
};

const s = StyleSheet.create({
  topArea:      { paddingTop: 8, gap: 10, marginBottom: 8 },
  finnRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  finnAvatar:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  finnLetter:   { fontSize: 16, fontWeight: '600', color: '#fff' },
  bubble:       { flex: 1, borderRadius: 14, borderTopLeftRadius: 4, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText:   { fontSize: 15, lineHeight: 22 },
  bubbleSub:    { fontSize: 12, marginTop: 2 },
  counterBadge: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 5, borderRadius: THEME.radius.pill },
  counterText:  { fontSize: 12, fontWeight: '700' },
  grid:         { paddingTop: 4 },
  card:         { borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative' },
  cardLabel:    { fontSize: 11, fontWeight: '500', textAlign: 'center', paddingHorizontal: 4 },
  checkDot:     { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  footer:       { paddingTop: 8 },
  btn:          { borderRadius: THEME.radius.lg, padding: 16, alignItems: 'center' },
  btnText:      { fontSize: 16, fontWeight: '500', color: '#fff' },
});
