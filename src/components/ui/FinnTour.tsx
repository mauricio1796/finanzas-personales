import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import { TourRegistry, TourMeasure } from '../../utils/TourRegistry';
import { THEME } from '../../constants/theme';

// ─── Step definition ─────────────────────────────────────────────────────────
export interface FinnTourStep {
  id: string;
  title: string;
  body: string;
  targetKey?: string | null;
  tooltipPosition?: 'top' | 'bottom' | 'center';
  padding?: number;
}

// ─── Steps — professional financial advisor tone ──────────────────────────────
export const FINN_TOUR_STEPS: FinnTourStep[] = [
  {
    id: 'welcome',
    title: 'Hola, soy Finn',
    body: 'Tu asesor financiero personal. En los próximos segundos te mostraré las herramientas que tienes disponibles para tomar el control de tus finanzas.',
    targetKey: null,
    tooltipPosition: 'center',
  },
  {
    id: 'hero',
    title: 'Tu posición financiera',
    body: 'Este panel refleja tu balance neto del mes: ingresos menos gastos. Es el indicador más directo de si estás generando o consumiendo capital.',
    targetKey: 'hero_card',
    tooltipPosition: 'bottom',
    padding: 10,
  },
  {
    id: 'nav_inicio',
    title: 'Panel principal',
    body: 'Tu centro de mando diario. Aquí consolido tu flujo de caja, alertas de presupuesto y el estado de tus metas en una sola vista.',
    targetKey: 'tab_dashboard',
    tooltipPosition: 'top',
    padding: 10,
  },
  {
    id: 'nav_ia',
    title: 'Asesoría con Finn',
    body: 'Puedes consultarme sobre estrategias de ahorro, análisis de gastos o proyecciones. Respondo con base en tus datos reales, no en generalidades.',
    targetKey: 'tab_bot',
    tooltipPosition: 'top',
    padding: 10,
  },
  {
    id: 'nav_finanzas',
    title: 'Registro de movimientos',
    body: 'Registra ingresos y gastos con categorías personalizadas. La consistencia en el registro es la base de cualquier decisión financiera bien fundamentada.',
    targetKey: 'tab_ingresos',
    tooltipPosition: 'top',
    padding: 10,
  },
  {
    id: 'nav_explorar',
    title: 'Análisis y educación',
    body: 'Estadísticas detalladas, proyecciones de flujo y contenido de educación financiera. Aquí conviertes datos en conocimiento accionable.',
    targetKey: 'tab_explorar',
    tooltipPosition: 'top',
    padding: 10,
  },
  {
    id: 'nav_perfil',
    title: 'Tu perfil financiero',
    body: 'Gestiona tu cuenta, revisa tus avances y configura las preferencias de la aplicación. Tu progreso queda registrado aquí.',
    targetKey: 'tab_perfil',
    tooltipPosition: 'top',
    padding: 10,
  },
  {
    id: 'done',
    title: 'Listo para comenzar',
    body: 'Tienes todo lo necesario para gestionar tus finanzas de forma inteligente. Mi recomendación: empieza registrando tus ingresos y gastos de hoy.',
    targetKey: null,
    tooltipPosition: 'center',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface FinnTourProps {
  steps?: FinnTourStep[];
  visible: boolean;
  onFinish: () => void;
}

interface SpotRect { x: number; y: number; width: number; height: number; }

// ─── Finn Avatar ──────────────────────────────────────────────────────────────
const FinnAvatar: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <View style={[av.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
    <View style={av.inner}>
      <Text style={[av.monogram, { fontSize: size * 0.38 }]}>FI</Text>
    </View>
    <View style={av.dot} />
  </View>
);

const av = StyleSheet.create({
  wrap: {
    backgroundColor: '#6156E8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6156E8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1D9E75',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});

// ─── Component ────────────────────────────────────────────────────────────────
export const FinnTour: React.FC<FinnTourProps> = ({
  steps = FINN_TOUR_STEPS,
  visible,
  onFinish,
}) => {
  const { width: W, height: H } = useWindowDimensions();
  const [stepIndex, setStepIndex] = useState(0);
  const [spot, setSpot] = useState<SpotRect | null>(null);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslate = useRef(new Animated.Value(80)).current;
  const panelOpacity   = useRef(new Animated.Value(0)).current;
  const pulseScale     = useRef(new Animated.Value(1)).current;
  const pulseOpacity   = useRef(new Animated.Value(0.7)).current;
  const progressAnim   = useRef(new Animated.Value(0)).current;

  const currentStep = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast  = stepIndex === steps.length - 1;
  const progress = (stepIndex + 1) / steps.length;

  // Overlay fade
  useEffect(() => {
    if (visible) {
      setStepIndex(0);
      Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  // Measure spotlight + animate panel per step
  const measureAndAnimate = useCallback(async (step: FinnTourStep) => {
    panelOpacity.setValue(0);
    panelTranslate.setValue(40);

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

    Animated.parallel([
      Animated.timing(panelOpacity,   { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.spring(panelTranslate, { toValue: 0, friction: 8, tension: 90, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!visible || !currentStep) return;
    measureAndAnimate(currentStep);

    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [stepIndex, visible]);

  // Spotlight pulse
  useEffect(() => {
    if (!spot) return;
    pulseScale.setValue(1);
    pulseOpacity.setValue(0.55);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale,   { toValue: 1.04, duration: 950, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.9,  duration: 950, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale,   { toValue: 1,    duration: 950, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.55, duration: 950, useNativeDriver: true }),
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

  // ── Panel positioning ─────────────────────────────────────────────────────
  // When the spotlight is in the bottom half of the screen, anchor panel to top.
  // Otherwise (or center steps), anchor to bottom.
  const PANEL_HEIGHT = 220;
  const BOTTOM_SAFE = Platform.OS === 'ios' ? 34 : 16;

  let panelAnchor: any;
  if (spot && spot.y < H * 0.45) {
    // Spotlight is in the upper half — show panel below
    panelAnchor = { top: spot.y + spot.height + 16, left: 16, right: 16 };
  } else {
    // Default: panel pinned to bottom
    panelAnchor = { bottom: BOTTOM_SAFE, left: 16, right: 16 };
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onFinish}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}>

        {/* ── Spotlight overlay ─── */}
        {spot ? (
          <>
            <View style={[s.panel, { top: 0, left: 0, right: 0, height: Math.max(spot.y, 0) }]} />
            <View style={[s.panel, { top: spot.y + spot.height, left: 0, right: 0, bottom: 0 }]} />
            <View style={[s.panel, { top: spot.y, left: 0, width: Math.max(spot.x, 0), height: spot.height }]} />
            <View style={[s.panel, { top: spot.y, left: spot.x + spot.width, right: 0, height: spot.height }]} />

            <Animated.View
              pointerEvents="none"
              style={[
                s.spotBorder,
                {
                  top: spot.y, left: spot.x,
                  width: spot.width, height: spot.height,
                  borderRadius: 14,
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />
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
          <View style={[s.panel, StyleSheet.absoluteFill]} />
        )}

        {/* ── Finn Panel ─── */}
        <Animated.View
          style={[
            s.panel_card,
            panelAnchor,
            { opacity: panelOpacity, transform: [{ translateY: panelTranslate }] },
          ]}
        >
          {/* Header row */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <FinnAvatar size={44} />
              <View style={s.headerMeta}>
                <Text style={s.headerName}>Finn</Text>
                <Text style={s.headerRole}>Asesor Financiero IA</Text>
              </View>
            </View>

            {/* Skip */}
            <TouchableOpacity
              style={s.skipBtn}
              onPress={onFinish}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.skipText}>Saltar</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={s.divider} />

          {/* Step label */}
          <Text style={s.stepLabel}>Paso {stepIndex + 1} de {steps.length}</Text>

          {/* Title */}
          <Text style={s.title}>{currentStep?.title}</Text>

          {/* Body */}
          <Text style={s.body}>{currentStep?.body}</Text>

          {/* Progress bar */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth }]} />
          </View>

          {/* Navigation */}
          <View style={s.nav}>
            {!isFirst ? (
              <TouchableOpacity style={s.prevBtn} onPress={goPrev}>
                <Text style={s.prevText}>Anterior</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <TouchableOpacity
              style={[s.nextBtn, isLast && s.nextBtnFinish]}
              onPress={goNext}
            >
              <Text style={s.nextText}>
                {isLast ? 'Comenzar' : 'Siguiente'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    backgroundColor: 'rgba(10,10,20,0.74)',
  },
  spotBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#6156E8',
    shadowColor: '#6156E8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 0,
  },
  cornerDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#6156E8',
  },

  // ── Main card ──
  panel_card: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerMeta: {
    gap: 1,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.2,
  },
  headerRole: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.2,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 14,
  },

  // ── Content ──
  stepLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6156E8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.4,
    marginBottom: 8,
    lineHeight: 23,
  },
  body: {
    fontSize: 13.5,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 18,
    fontWeight: '400',
  },

  // ── Progress ──
  progressTrack: {
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 18,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#6156E8',
    borderRadius: 2,
  },

  // ── Navigation ──
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  prevBtn: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  prevText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  nextBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#6156E8',
    alignItems: 'center',
    shadowColor: '#6156E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  nextBtnFinish: {
    backgroundColor: '#1D9E75',
    shadowColor: '#1D9E75',
  },
  nextText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
