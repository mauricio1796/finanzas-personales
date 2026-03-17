import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../state/ThemeContext';
import { Icon, FeatherName } from '../../components/ui/Icon';

interface Props {
  onNext: () => void;
  onSkip?: () => void;
}

const VALUE_CARDS: { icon: FeatherName; label: string; colorKey: 'primary' | 'income' | 'warning' }[] = [
  { icon: 'bar-chart-2', label: 'Controla\ntus gastos',   colorKey: 'primary' },
  { icon: 'target',      label: 'Alcanza\ntus metas',     colorKey: 'income'  },
  { icon: 'zap',         label: 'Con IA\npersonalizada',  colorKey: 'warning' },
];

export const OnboardingWelcome: React.FC<Props> = ({ onNext, onSkip }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const finnOpacity = useRef(new Animated.Value(0)).current;
  const finnScale   = useRef(new Animated.Value(0.3)).current;
  const text1       = useRef(new Animated.Value(0)).current;
  const text2       = useRef(new Animated.Value(0)).current;
  const text3       = useRef(new Animated.Value(0)).current;
  const card1       = useRef(new Animated.Value(0)).current;
  const card2       = useRef(new Animated.Value(0)).current;
  const card3       = useRef(new Animated.Value(0)).current;
  const ctaAnim     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(finnScale,   { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(finnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.stagger(180, [
        Animated.timing(text1, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(text2, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(text3, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.delay(300),
      Animated.stagger(80, [
        Animated.timing(card1, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(card2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(card3, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.spring(ctaAnim, { toValue: 1, tension: 50, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  const textStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  });

  const cardStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  });

  const cardAnims = [card1, card2, card3];

  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      {/* Finn avatar */}
      <Animated.View
        style={[
          s.finnWrap,
          { marginTop: height * 0.08 },
          { opacity: finnOpacity, transform: [{ scale: finnScale }] },
        ]}
      >
        <View style={[s.finn, { backgroundColor: colors.primary }]}>
          <Text style={s.finnLetter}>F</Text>
        </View>
      </Animated.View>

      {/* Welcome text */}
      <View style={s.textBlock}>
        <Animated.Text style={[s.line1, { color: colors.textPrimary }, textStyle(text1)]}>
          Hola, soy Finn
        </Animated.Text>
        <Animated.Text style={[s.line2, { color: colors.textSecondary }, textStyle(text2)]}>
          Tu asistente financiero
        </Animated.Text>
        <Animated.Text style={[s.line2, { color: colors.textSecondary }, textStyle(text3)]}>
          personal en Colombia
        </Animated.Text>
      </View>

      {/* Value cards */}
      <View style={[s.cardsRow, { paddingHorizontal: 24, marginTop: 32 }]}>
        {VALUE_CARDS.map((c, i) => (
          <Animated.View
            key={c.icon}
            style={[
              s.valueCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              cardStyle(cardAnims[i]),
            ]}
          >
            <Icon name={c.icon} size={20} color={colors[c.colorKey]} />
            <Text style={[s.cardLabel, { color: colors.textSecondary }]}>{c.label}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* CTA area */}
      <Animated.View
        style={[
          s.ctaWrap,
          { paddingHorizontal: 24, paddingBottom: insets.bottom + 24 },
          {
            opacity: ctaAnim,
            transform: [{ translateY: ctaAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          },
        ]}
      >
        <TouchableOpacity
          style={[s.cta, { backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onNext();
          }}
          activeOpacity={0.85}
        >
          <Text style={s.ctaText}>Comenzar</Text>
        </TouchableOpacity>

        {onSkip && (
          <TouchableOpacity onPress={onSkip} style={s.skipBtn} activeOpacity={0.7}>
            <Text style={[s.skipText, { color: colors.textTertiary }]}>Ya tengo cuenta</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
};

const s = StyleSheet.create({
  root:      { flex: 1, alignItems: 'center' },
  finnWrap:  { alignItems: 'center', marginBottom: 24 },
  finn:      { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  finnLetter:{ fontSize: 32, fontWeight: '500', color: '#FFFFFF' },
  textBlock: { alignItems: 'center', gap: 8 },
  line1:     { fontSize: 28, fontWeight: '500', textAlign: 'center' },
  line2:     { fontSize: 18, fontWeight: '400', textAlign: 'center' },
  cardsRow:  { flexDirection: 'row', gap: 10, width: '100%' },
  valueCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 8 },
  cardLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center', lineHeight: 16 },
  ctaWrap:   { width: '100%', gap: 12 },
  cta:       { borderRadius: 16, padding: 16, alignItems: 'center' },
  ctaText:   { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
  skipBtn:   { alignItems: 'center', paddingVertical: 4 },
  skipText:  { fontSize: 13 },
});
