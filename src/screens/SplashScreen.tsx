import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Icon } from '../components/ui/Icon';

const { width, height } = Dimensions.get('window');

const PRIMARY       = '#6156E8';
const PRIMARY_LIGHT = '#EEF0FF';
const PRIMARY_MID   = 'rgba(97,86,232,0.08)';

interface SplashScreenProps {
  onDone: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone }) => {
  const logoScale    = useRef(new Animated.Value(0.78)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const tagOpacity   = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const ring1Scale   = useRef(new Animated.Value(0.6)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale   = useRef(new Animated.Value(0.6)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo entra con spring
    Animated.parallel([
      Animated.spring(logoScale,   { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => {

      // Anillos de pulse
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ring1Scale,   { toValue: 1.4,  duration: 600, useNativeDriver: true }),
          Animated.timing(ring1Opacity, { toValue: 1,    duration: 300, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ring1Opacity, { toValue: 0,    duration: 300, useNativeDriver: true }),
          Animated.timing(ring2Scale,   { toValue: 1.75, duration: 600, useNativeDriver: true }),
          Animated.timing(ring2Opacity, { toValue: 1,    duration: 300, useNativeDriver: true }),
        ]),
        Animated.timing(ring2Opacity,   { toValue: 0,    duration: 350, useNativeDriver: true }),
      ]).start();

      // Tagline → badge → espera → fade out
      Animated.timing(tagOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
        Animated.timing(badgeOpacity, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => {
          setTimeout(() => {
            Animated.timing(logoOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(onDone);
          }, 900);
        });
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.container}>

      {/* Círculos decorativos de fondo — azul suave */}
      <View style={s.circle1} />
      <View style={s.circle2} />
      <View style={s.circle3} />

      {/* Partículas */}
      <View style={[s.particle, { top: height * 0.13, left: width * 0.1  }]} />
      <View style={[s.particle, s.particleSm, { top: height * 0.21, right: width * 0.14 }]} />
      <View style={[s.particle, s.particleLg, { bottom: height * 0.26, left: width * 0.09 }]} />
      <View style={[s.particle, s.particleSm, { bottom: height * 0.17, right: width * 0.11 }]} />

      {/* Logo central */}
      <Animated.View style={[s.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>

        {/* Anillos */}
        <Animated.View style={[s.ring, s.ring1, { transform: [{ scale: ring1Scale }], opacity: ring1Opacity }]} />
        <Animated.View style={[s.ring, s.ring2, { transform: [{ scale: ring2Scale }], opacity: ring2Opacity }]} />

        {/* Ícono contenedor */}
        <View style={s.logoMark}>
          <Icon name="trending-up" size={40} color="#FFFFFF" />
        </View>

        {/* Wordmark */}
        <View style={s.wordmark}>
          <Text style={s.wordmarkFinancy}>Financy</Text>
          <Text style={s.wordmarkAI}>AI</Text>
        </View>

        {/* Tagline */}
        <Animated.Text style={[s.tagline, { opacity: tagOpacity }]}>
          Tu dinero, inteligentemente gestionado
        </Animated.Text>

        {/* Badge */}
        <Animated.View style={[s.badge, { opacity: badgeOpacity }]}>
          <View style={s.badgeDot} />
          <Text style={s.badgeText}>Potenciado por IA</Text>
        </Animated.View>
      </Animated.View>

    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // ── Fondos decorativos ──────────────────────────────────────────────────────
  circle1: {
    position: 'absolute',
    width: width * 1.1,
    height: width * 1.1,
    borderRadius: width * 0.55,
    backgroundColor: PRIMARY_MID,
    top: -width * 0.5,
    left: -width * 0.05,
  },
  circle2: {
    position: 'absolute',
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: width * 0.375,
    backgroundColor: 'rgba(97,86,232,0.05)',
    bottom: -width * 0.3,
    right: -width * 0.2,
  },
  circle3: {
    position: 'absolute',
    width: width * 0.45,
    height: width * 0.45,
    borderRadius: width * 0.225,
    backgroundColor: 'rgba(97,86,232,0.04)',
    bottom: height * 0.15,
    left: -width * 0.12,
  },

  // ── Partículas ──────────────────────────────────────────────────────────────
  particle: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PRIMARY,
    opacity: 0.18,
  },
  particleSm: { width: 4, height: 4, borderRadius: 2, opacity: 0.12 },
  particleLg: { width: 10, height: 10, borderRadius: 5, opacity: 0.1 },

  // ── Logo wrapper ────────────────────────────────────────────────────────────
  logoWrap: {
    alignItems: 'center',
    gap: 18,
  },

  // ── Anillos pulse — azul claro ──────────────────────────────────────────────
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  ring1: { width: 128, height: 128, opacity: 0.2 },
  ring2: { width: 128, height: 128, opacity: 0.1 },

  // ── Logo mark — cuadro azul sólido ──────────────────────────────────────────
  logoMark: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 14,
  },

  // ── Wordmark ────────────────────────────────────────────────────────────────
  wordmark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  wordmarkFinancy: {
    fontSize: 40,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1.5,
    lineHeight: 46,
  },
  wordmarkAI: {
    fontSize: 28,
    fontWeight: '900',
    color: PRIMARY,
    letterSpacing: -0.5,
    lineHeight: 40,
    marginBottom: 2,
  },

  // ── Tagline ─────────────────────────────────────────────────────────────────
  tagline: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '400',
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // ── Badge ───────────────────────────────────────────────────────────────────
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: PRIMARY_LIGHT,
    borderWidth: 1,
    borderColor: 'rgba(97,86,232,0.2)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  badgeText: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
