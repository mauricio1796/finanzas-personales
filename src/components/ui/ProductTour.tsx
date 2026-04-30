import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { TourRegistry, TourMeasure } from '../../utils/TourRegistry';
import { THEME } from '../../constants/theme';

// ─── Step definition ──────────────────────────────────────────────────
export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetKey?: string | null;
  tooltipPosition?: 'top' | 'bottom' | 'center';
  padding?: number;
}

// ─── Default app tour steps ───────────────────────────────────────────
export const APP_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: '¡Bienvenido a FinancyAI! 🎉',
    description: 'Te guiaré por las funciones principales en menos de un minuto. ¡Comencemos!',
    targetKey: null,
    tooltipPosition: 'center',
  },
  {
    id: 'hero',
    title: 'Tu Balance en Tiempo Real 💰',
    description: 'Aquí ves tu dinero disponible, ingresos y gastos del mes. Se actualiza automáticamente con cada movimiento que registres.',
    targetKey: 'hero_card',
    tooltipPosition: 'bottom',
    padding: 10,
  },
  {
    id: 'nav_inicio',
    title: 'Inicio 🏠',
    description: 'Tu resumen financiero diario. Siempre que abras la app empezarás aquí con todo al alcance.',
    targetKey: 'tab_dashboard',
    tooltipPosition: 'top',
    padding: 10,
  },
  {
    id: 'nav_ia',
    title: 'Asistente IA 🤖',
    description: 'Tu asesor financiero personal disponible 24/7. Pregúntale sobre ahorros, presupuesto, metas o cualquier duda financiera.',
    targetKey: 'tab_bot',
    tooltipPosition: 'top',
    padding: 10,
  },
  {
    id: 'nav_finanzas',
    title: 'Finanzas 💸',
    description: 'Registra ingresos y gastos, gestiona tus categorías y lleva el control mensual de tu dinero.',
    targetKey: 'tab_ingresos',
    tooltipPosition: 'top',
    padding: 10,
  },
  {
    id: 'nav_explorar',
    title: 'Explorar 🧭',
    description: 'Estadísticas avanzadas, cursos de educación financiera y retos personalizados para mejorar tus finanzas.',
    targetKey: 'tab_explorar',
    tooltipPosition: 'top',
    padding: 10,
  },
  {
    id: 'nav_perfil',
    title: 'Mi Perfil 👤',
    description: 'Configura tu cuenta, revisa tus logros, tu nivel y personaliza toda la experiencia.',
    targetKey: 'tab_perfil',
    tooltipPosition: 'top',
    padding: 10,
  },
  {
    id: 'done',
    title: '¡Todo listo! 🚀',
    description: '¡Ya conoces lo esencial! Empieza registrando tu primer movimiento. Si necesitas el tour otra vez, encuéntralo en tu Perfil.',
    targetKey: null,
    tooltipPosition: 'center',
  },
];

// ─── Component ────────────────────────────────────────────────────────
interface ProductTourProps {
  steps?: TourStep[];
  visible: boolean;
  onFinish: () => void;
}

interface SpotRect { x: number; y: number; width: number; height: number; }

export const ProductTour: React.FC<ProductTourProps> = ({
  steps = APP_TOUR_STEPS,
  visible,
  onFinish,
}) => {
  const { width: W, height: H } = useWindowDimensions();
  const [stepIndex, setStepIndex] = useState(0);
  const [spot, setSpot] = useState<SpotRect | null>(null);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const tipOpacity    = useRef(new Animated.Value(0)).current;
  const tipTranslate  = useRef(new Animated.Value(18)).current;
  const pulseScale    = useRef(new Animated.Value(1)).current;
  const pulseOpacity  = useRef(new Animated.Value(0.7)).current;

  const currentStep = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast  = stepIndex === steps.length - 1;

  // ── Fade overlay in/out when visible changes ──────────────────────
  useEffect(() => {
    if (visible) {
      setStepIndex(0);
      Animated.timing(overlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    } else {
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);

  // ── Measure target and animate tooltip on step change ────────────
  const measureAndAnimate = useCallback(async (step: TourStep) => {
    // Reset tooltip
    tipOpacity.setValue(0);
    tipTranslate.setValue(18);

    // Measure target
    let measured: TourMeasure | null = null;
    if (step.targetKey) {
      measured = await TourRegistry.measure(step.targetKey);
    }

    if (measured) {
      const pad = step.padding ?? 10;
      setSpot({
        x: measured.x - pad,
        y: measured.y - pad,
        width: measured.width + pad * 2,
        height: measured.height + pad * 2,
      });
    } else {
      setSpot(null);
    }

    // Animate tooltip in
    Animated.parallel([
      Animated.timing(tipOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(tipTranslate, { toValue: 0, friction: 7, tension: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!visible || !currentStep) return;
    measureAndAnimate(currentStep);
  }, [stepIndex, visible]);

  // ── Pulse animation on the spotlight border ───────────────────────
  useEffect(() => {
    if (!spot) return;
    pulseScale.setValue(1);
    pulseOpacity.setValue(0.6);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale,   { toValue: 1.05, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale,   { toValue: 1,   duration: 900, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [spot]);

  const goNext = () => {
    if (isLast) { onFinish(); return; }
    setStepIndex(i => i + 1);
  };

  const goPrev = () => {
    if (!isFirst) setStepIndex(i => i - 1);
  };

  if (!visible) return null;

  // ── Tooltip position ─────────────────────────────────────────────
  const TOOLTIP_MAX_W = Math.min(W - 48, 340);
  let tooltipStyle: any = {};

  if (!spot || currentStep?.tooltipPosition === 'center') {
    // Centered on screen
    tooltipStyle = { top: H * 0.5 - 110, left: 24, right: 24 };
  } else if (currentStep?.tooltipPosition === 'top' || spot.y > H * 0.55) {
    // Tooltip ABOVE the spotlight
    tooltipStyle = { bottom: H - spot.y + 16, left: 24, right: 24 };
  } else {
    // Tooltip BELOW the spotlight
    tooltipStyle = { top: spot.y + spot.height + 16, left: 24, right: 24 };
  }

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onFinish}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}>

        {/* ── Spotlight: 4-panel dark overlay ── */}
        {spot ? (
          <>
            {/* Top panel */}
            <View style={[s.panel, { top: 0, left: 0, right: 0, height: Math.max(spot.y, 0) }]} />
            {/* Bottom panel */}
            <View style={[s.panel, { top: spot.y + spot.height, left: 0, right: 0, bottom: 0 }]} />
            {/* Left panel */}
            <View style={[s.panel, { top: spot.y, left: 0, width: Math.max(spot.x, 0), height: spot.height }]} />
            {/* Right panel */}
            <View style={[s.panel, { top: spot.y, left: spot.x + spot.width, right: 0, height: spot.height }]} />

            {/* Pulsing indigo border around spotlight */}
            <Animated.View
              pointerEvents="none"
              style={[
                s.spotBorder,
                {
                  top: spot.y,
                  left: spot.x,
                  width: spot.width,
                  height: spot.height,
                  borderRadius: 16,
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />

            {/* Corner dots */}
            {([
              { top: spot.y - 4,               left: spot.x - 4 },
              { top: spot.y - 4,               left: spot.x + spot.width - 8 },
              { top: spot.y + spot.height - 8, left: spot.x - 4 },
              { top: spot.y + spot.height - 8, left: spot.x + spot.width - 8 },
            ] as any[]).map((pos, i) => (
              <View key={i} style={[s.cornerDot, pos]} pointerEvents="none" />
            ))}
          </>
        ) : (
          // No target: full dark overlay
          <View style={[s.panel, StyleSheet.absoluteFill]} />
        )}

        {/* ── Tooltip bubble ── */}
        <Animated.View
          style={[
            s.tooltip,
            tooltipStyle,
            {
              opacity: tipOpacity,
              transform: [{ translateY: tipTranslate }],
              maxWidth: TOOLTIP_MAX_W,
            },
          ]}
        >
          {/* Progress dots + skip */}
          <View style={s.tipHeader}>
            <View style={s.dots}>
              {steps.map((_, i) => (
                <Animated.View
                  key={i}
                  style={[s.dot, i === stepIndex && s.dotActive]}
                />
              ))}
            </View>
            <TouchableOpacity onPress={onFinish} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
              <Text style={s.skipText}>Saltar</Text>
            </TouchableOpacity>
          </View>

          {/* Counter */}
          <Text style={s.counter}>{stepIndex + 1} / {steps.length}</Text>

          {/* Content */}
          <Text style={s.tipTitle}>{currentStep?.title}</Text>
          <Text style={s.tipDesc}>{currentStep?.description}</Text>

          {/* Navigation */}
          <View style={s.tipNav}>
            {!isFirst ? (
              <TouchableOpacity style={s.prevBtn} onPress={goPrev}>
                <Text style={s.prevBtnText}>← Atrás</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <TouchableOpacity style={[s.nextBtn, isLast && s.nextBtnFinish]} onPress={goNext}>
              <Text style={s.nextBtnText}>{isLast ? '¡Empezar! 🚀' : 'Siguiente →'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────
const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  spotBorder: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: THEME.colors.primary,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 0,
  },
  cornerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 22,
    ...THEME.shadow.card,
    elevation: 24,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    flex: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: THEME.colors.primary,
    borderRadius: 3,
  },
  skipText: {
    fontSize: 13,
    color: THEME.colors.textTertiary,
    fontWeight: '600',
  },
  counter: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tipTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
    lineHeight: 24,
  },
  tipDesc: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    lineHeight: 21,
    marginBottom: 22,
  },
  tipNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  prevBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceSecondary,
  },
  prevBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  nextBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
  },
  nextBtnFinish: {
    backgroundColor: THEME.colors.income,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.surface,
  },
});
