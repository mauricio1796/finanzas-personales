import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface SplashScreenProps {
  onDone: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone }) => {
  const scale   = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const tagOp   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Phase 1: logo enters (800ms)
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start(() => {
      // Phase 2: tagline fades in (400ms)
      Animated.timing(tagOp, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
        // Phase 3: wait 800ms, then fade out and call onDone
        setTimeout(() => {
          Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(onDone);
        }, 800);
      });
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoBox, { opacity, transform: [{ scale }] }]}>
        <View style={styles.orbRing}>
          <View style={styles.orb}>
            <Text style={styles.orbIcon}>✦</Text>
          </View>
        </View>
        <Text style={styles.appName}>FinancyAI</Text>
        <Animated.Text style={[styles.tagline, { opacity: tagOp }]}>
          Tu dinero, inteligente
        </Animated.Text>
      </Animated.View>

      {/* Subtle bottom wave */}
      <View style={styles.bottomAccent} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D4EDE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    alignItems: 'center',
    gap: 16,
  },
  orbRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A5C3A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  orbIcon: {
    fontSize: 32,
    color: '#2D7A50',
    fontWeight: '700',
  },
  appName: {
    fontSize: 36,
    fontWeight: '900',
    color: '#1A3D28',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: '#2D7A50',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  bottomAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: 'rgba(45,122,80,0.2)',
  },
});
