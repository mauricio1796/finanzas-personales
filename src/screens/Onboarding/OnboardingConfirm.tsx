import React, { useEffect, useRef } from 'react';
import {
  Animated, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../../components/ui/Icon';

interface Props { onDone: () => void; }

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
const CONFETTI_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const N = 18;

export const OnboardingConfirm: React.FC<Props> = ({ onDone }) => {
  const { setIsOnboarded, categories, profile } = useFinance();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const nombre        = profile?.mainFinancialConcern ?? '';
  const totalBudget   = categories.reduce((s, c) => s + (c.budget ?? 0), 0);
  const sal           = profile?.monthlySalary ?? 0;
  const pct           = sal > 0 ? Math.min((totalBudget / sal) * 100, 100) : 0;

  // Animations
  const finnAnim   = useRef(new Animated.Value(0)).current;
  const finnScale  = useRef(new Animated.Value(0.5)).current;
  const titleAnim  = useRef(new Animated.Value(0)).current;
  const card1Anim  = useRef(new Animated.Value(0)).current;
  const card2Anim  = useRef(new Animated.Value(0)).current;
  const card3Anim  = useRef(new Animated.Value(0)).current;
  const msgAnim    = useRef(new Animated.Value(0)).current;
  const btnAnim    = useRef(new Animated.Value(0)).current;
  const barAnim    = useRef(new Animated.Value(0)).current;

  // Confetti
  const confettiAnims = useRef(
    Array.from({ length: N }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      op: new Animated.Value(0),
      rot: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(finnScale, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
        Animated.timing(finnAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(50),
    ]).start(() => {
      // Confetti burst
      const bursts = confettiAnims.map(a => {
        const dx = (Math.random() - 0.5) * 240;
        const dy = -(Math.random() * 200 + 80);
        a.op.setValue(1);
        return Animated.parallel([
          Animated.timing(a.x,   { toValue: dx, duration: 900, useNativeDriver: true }),
          Animated.timing(a.y,   { toValue: dy, duration: 900, useNativeDriver: true }),
          Animated.timing(a.op,  { toValue: 0,  duration: 900, useNativeDriver: true }),
          Animated.timing(a.rot, { toValue: Math.random() * 4 - 2, duration: 900, useNativeDriver: true }),
        ]);
      });
      Animated.stagger(25, bursts).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Stagger in UI
      Animated.stagger(150, [
        Animated.timing(titleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(card1Anim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(card2Anim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(card3Anim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(msgAnim,   { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(btnAnim,   { toValue: 1, tension: 50, friction: 9, useNativeDriver: true }),
      ]).start();

      Animated.timing(barAnim, { toValue: pct / 100, duration: 800, useNativeDriver: false }).start();
    });
  }, []);

  const slideUp = (a: Animated.Value) => ({
    opacity: a,
    transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  });

  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const empLabels: Record<string, string> = {
    employed: 'Empleado', freelance: 'Freelancer', business: 'Empresario', student: 'Estudiante',
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
      {/* Confetti */}
      <View style={s.confettiLayer} pointerEvents="none">
        {confettiAnims.map((a, i) => (
          <Animated.View
            key={i}
            style={[
              s.confettiPiece,
              {
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                opacity: a.op,
                transform: [
                  { translateX: a.x },
                  { translateY: a.y },
                  { rotate: a.rot.interpolate({ inputRange: [-2, 2], outputRange: ['-180deg', '180deg'] }) },
                ],
              },
            ]}
          />
        ))}
      </View>

      <View style={[s.inner, { paddingHorizontal: 24 }]}>
        {/* Finn avatar */}
        <Animated.View style={[s.finnWrap, { opacity: finnAnim, transform: [{ scale: finnScale }] }]}>
          <View style={[s.finn, { backgroundColor: colors.primary }]}>
            <Text style={s.finnLetter}>F</Text>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.Text style={[s.title, { color: colors.textPrimary }, slideUp(titleAnim)]}>
          {nombre ? 'Todo listo, ' + nombre.trim().split(' ')[0] + '!' : 'Todo listo!'}
        </Animated.Text>

        {/* Summary cards */}
        <Animated.View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }, slideUp(card1Anim)]}>
          <Icon name="user" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: colors.textTertiary }]}>Perfil</Text>
            <Text style={[s.cardBody, { color: colors.textPrimary }]}>
              {[nombre, empLabels[profile?.employmentType ?? ''] ?? '', sal > 0 ? fmtCOP(sal) + '/mes' : ''].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }, slideUp(card2Anim)]}>
          <Icon name="grid" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: colors.textTertiary }]}>Categorias</Text>
            <Text style={[s.cardBody, { color: colors.textPrimary }]}>
              {categories.length + ' activas'}{categories.length > 0 ? ' · ' + categories.slice(0, 3).map(c => c.name).join(', ') + (categories.length > 3 ? '...' : '') : ''}
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }, slideUp(card3Anim)]}>
          <Icon name="dollar-sign" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: colors.textTertiary }]}>Presupuesto</Text>
            <Text style={[s.cardBody, { color: colors.textPrimary }]}>Total asignado: {fmtCOP(totalBudget)}</Text>
            {sal > 0 && (
              <View style={[s.miniTrack, { backgroundColor: colors.border, marginTop: 6 }]}>
                <Animated.View style={[s.miniFill, { width: barWidth, backgroundColor: colors.primary }]} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Finn motivational bubble */}
        <Animated.View style={[s.msgBubble, { backgroundColor: colors.primaryLight, borderColor: colors.primary }, slideUp(msgAnim)]}>
          <Text style={[s.msgText, { color: colors.primaryText }]}>
            Tu perfil financiero esta listo. Empecemos a construir el futuro que mereces {'🚀'}
          </Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <Animated.View style={slideUp(btnAnim)}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setIsOnboarded(true);
              onDone();
            }}
            activeOpacity={0.85}
          >
            <Text style={s.btnText}>Ir al Dashboard</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root:          { flex: 1 },
  inner:         { flex: 1, paddingTop: 8, gap: 12 },
  confettiLayer: { position: 'absolute', top: '25%', left: '50%', width: 0, height: 0, zIndex: 100 },
  confettiPiece: { position: 'absolute', width: 8, height: 8, borderRadius: 2 },
  finnWrap:      { alignItems: 'center', marginBottom: 4 },
  finn:          { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  finnLetter:    { fontSize: 26, fontWeight: '500', color: '#FFFFFF' },
  title:         { fontSize: 26, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  summaryCard:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 0.5, padding: 14 },
  cardTitle:     { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' as any, letterSpacing: 0.5, marginBottom: 2 },
  cardBody:      { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  miniTrack:     { height: 4, borderRadius: 2, overflow: 'hidden' },
  miniFill:      { height: '100%', borderRadius: 2 },
  msgBubble:     { borderRadius: 14, borderWidth: 1, padding: 16 },
  msgText:       { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  btn:           { borderRadius: 16, padding: 16, alignItems: 'center' },
  btnText:       { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
});
