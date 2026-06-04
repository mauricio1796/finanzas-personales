import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { useFinance } from '../../state';
import { Icon } from '../../components/ui/Icon';
import type { FeatherName } from '../../components/ui/Icon';

const { width } = Dimensions.get('window');

const PRIMARY       = '#6156E8';
const PRIMARY_LIGHT = '#EEF0FF';
const PRIMARY_MID   = 'rgba(97,86,232,0.12)';

// ── Escenas ───────────────────────────────────────────────────────────────────

interface Scene {
  id: number;
  hold: number;
  render: () => React.ReactNode;
}

const FEATURES: { icon: FeatherName; label: string; color: string }[] = [
  { icon: 'message-circle', label: 'Finn IA',      color: '#6156E8' },
  { icon: 'bar-chart-2',    label: 'Analytics',    color: '#3B82F6' },
  { icon: 'target',         label: 'Metas',        color: '#1D9E75' },
  { icon: 'award',          label: 'Gamificación', color: '#F59E0B' },
];

const SCENES: Scene[] = [
  // 0 — Headline
  {
    id: 0,
    hold: 1800,
    render: () => (
      <View style={s.sceneCenter}>
        <Text style={s.headlineTop}>El dinero no tiene</Text>
        <Text style={s.headlineTop}>que ser</Text>
        <Text style={s.headlineBig}>complicado.</Text>
      </View>
    ),
  },
  // 2 — 4 features juntas
  {
    id: 2,
    hold: 2200,
    render: () => (
      <View style={s.sceneCenter}>
        <Text style={s.featuresHeading}>¿Qué puedes hacer?</Text>
        <View style={s.featuresGrid}>
          {FEATURES.map(f => (
            <View key={f.label} style={s.featureCell}>
              <View style={[s.featureIconBox, { backgroundColor: f.color + '18' }]}>
                <Icon name={f.icon} size={26} color={f.color} />
              </View>
              <Text style={[s.featureLabel, { color: f.color }]}>{f.label}</Text>
            </View>
          ))}
        </View>
      </View>
    ),
  },
  // 3 — Cierre
  {
    id: 3,
    hold: 1700,
    render: () => (
      <View style={s.sceneCenter}>
        <Text style={s.closingTop}>Toma el control</Text>
        <Text style={s.closingBig}>de tu dinero 💸</Text>
        <View style={s.closingBadge}>
          <Text style={s.closingBadgeText}>Gratis · Sin tarjeta · Con IA</Text>
        </View>
      </View>
    ),
  },
];

const FADE_IN  = 360;
const FADE_OUT = 280;

// ── Component ─────────────────────────────────────────────────────────────────

export function OnboardingWelcome({ onNext }: { onNext: () => void }) {
  const { updateOnboardingStep } = useFinance();
  const [sceneIdx, setSceneIdx] = useState(0);
  const opacity  = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    playScene(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playScene = (idx: number) => {
    if (idx >= SCENES.length) {
      updateOnboardingStep(1);
      onNext();
      return;
    }

    const scene = SCENES[idx];
    progress.setValue(0);

    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration: scene.hold,
        useNativeDriver: false,
      }).start();

      setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_OUT,
          useNativeDriver: true,
        }).start(() => {
          setSceneIdx(idx + 1);
          playScene(idx + 1);
        });
      }, scene.hold);
    });
  };

  const current = SCENES[sceneIdx] ?? SCENES[SCENES.length - 1];

  return (
    <View style={s.root} testID="onboarding-welcome">
      {/* Decoración de fondo */}
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />

      {/* Barra de progreso */}
      <View style={s.progressTrack}>
        <Animated.View
          style={[
            s.progressFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Escena */}
      <Animated.View style={[s.sceneWrap, { opacity }]}>
        {current.render()}
      </Animated.View>

      {/* Dots indicadores */}
      <View style={s.dotsRow}>
        {SCENES.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i === sceneIdx && s.dotActive,
              i < sceneIdx  && s.dotPast,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Fondo decorativo
  bgCircle1: {
    position: 'absolute',
    width: width * 1.1,
    height: width * 1.1,
    borderRadius: width * 0.55,
    backgroundColor: PRIMARY_MID,
    top: -width * 0.55,
    left: -width * 0.05,
  },
  bgCircle2: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: 'rgba(97,86,232,0.06)',
    bottom: -width * 0.25,
    right: -width * 0.15,
  },

  // Barra de progreso
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(97,86,232,0.1)',
  },
  progressFill: {
    height: 3,
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },

  // Escena
  sceneWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  sceneCenter: {
    alignItems: 'center',
    gap: 14,
  },

  // ── Escena 0: Logo ──────────────────────────────────────────────────────────
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  logoWord: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1,
  },
  logoAI: {
    color: PRIMARY,
    fontWeight: '900',
  },
  logoSub: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '400',
    marginTop: 2,
  },

  // ── Escena 1: Headline ──────────────────────────────────────────────────────
  headlineTop: {
    fontSize: 28,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  headlineBig: {
    fontSize: 54,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -2,
    lineHeight: 58,
    marginTop: -2,
  },

  // ── Escena 2: Features ──────────────────────────────────────────────────────
  featuresHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'center',
    width: '100%',
  },
  featureCell: {
    width: (width - 56 - 14) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  featureIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── Escena 3: Cierre ────────────────────────────────────────────────────────
  closingTop: {
    fontSize: 28,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  closingBig: {
    fontSize: 42,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -1.5,
    lineHeight: 48,
    marginTop: -4,
  },
  closingBadge: {
    marginTop: 8,
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  closingBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
    letterSpacing: 0.2,
  },

  // ── Dots ────────────────────────────────────────────────────────────────────
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 52,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(97,86,232,0.15)',
  },
  dotActive: {
    width: 22,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  dotPast: {
    backgroundColor: 'rgba(97,86,232,0.35)',
  },
});
