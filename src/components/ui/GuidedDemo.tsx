import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from './Icon';
import {
  sintetizarTexto,
  reproducirAudioBase64,
  detenerAudioActual,
} from '../../services/FinnVozService';

// ─── Guion del recorrido ─────────────────────────────────────────────────────
export interface DemoStep {
  screen:    string;
  title:     string;
  caption:   string;
  dwellMs:   number;
  settleMs?: number;
}

export const DEMO_SCRIPT: DemoStep[] = [
  {
    screen: 'dashboard',
    title:  'Tu panel principal',
    caption: 'Este es tu panel. Aquí ves cuánto te queda este mes: lo que entra, menos lo que sale.',
    dwellMs: 4200,
  },
  {
    screen: 'dashboard',
    title:  'Registrar en segundos',
    caption: 'Con el botón más, en el centro, registras un gasto o un ingreso en segundos.',
    dwellMs: 3800,
    settleMs: 200,
  },
  {
    screen: 'estadisticas',
    title:  'Análisis con IA',
    caption: 'En Estadísticas, la inteligencia artificial revisa tus gastos por categoría y te muestra hacia dónde va tu plata.',
    dwellMs: 4600,
  },
  {
    screen: 'bot',
    title:  'Habla con Finn',
    caption: 'Este es Finn. Le preguntas lo que sea sobre tu dinero y te responde con tus datos reales, no con consejos genéricos.',
    dwellMs: 4600,
  },
  {
    screen: 'categorias',
    title:  'Presupuesto con semáforo',
    caption: 'Le pones un presupuesto a cada categoría y la app te avisa con un semáforo cuando te estás pasando.',
    dwellMs: 4200,
  },
  {
    screen: 'metas',
    title:  'Metas de ahorro',
    caption: 'Creas metas de ahorro, como un viaje, y ves cuánto te falta para lograrlas.',
    dwellMs: 3800,
  },
  {
    screen: 'gamificacion',
    title:  'Ahorrar es un juego',
    caption: 'Mientras cuidas tu plata, ganas experiencia y subes de nivel. Ahorrar se vuelve un juego.',
    dwellMs: 4000,
  },
  {
    screen: 'dashboard',
    title:  '¡Listo!',
    caption: 'Y eso es todo. Ya sabes moverte por FinancyAI. Empecemos.',
    dwellMs: 3400,
  },
];

// ─── Props ───────────────────────────────────────────────────────────────────
interface GuidedDemoProps {
  visible:      boolean;
  voiceEnabled: boolean;
  onNavigate:   (screen: string) => void;
  onFinish:     () => void;
  steps?:       DemoStep[];
}

// ─── Component ───────────────────────────────────────────────────────────────
export function GuidedDemo({
  visible,
  voiceEnabled,
  onNavigate,
  onFinish,
  steps = DEMO_SCRIPT,
}: GuidedDemoProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [idx,     setIdx]     = useState(0);
  const [paused,  setPaused]  = useState(false);
  const [showCap, setShowCap] = useState(false);

  const cancelled  = useRef(false);
  const pausedRef  = useRef(false);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioStop  = useRef<() => Promise<void>>(async () => {});
  const runIdRef   = useRef(0);           // invalida corridas viejas

  // Callbacks del padre en refs → el motor nunca usa closures obsoletos
  const navRef    = useRef(onNavigate);
  const finishRef = useRef(onFinish);
  navRef.current    = onNavigate;
  finishRef.current = onFinish;

  const capAnim  = useRef(new Animated.Value(0)).current;
  const progAnim = useRef(new Animated.Value(0)).current;

  const total = steps.length;

  // sleep simple, NO rastreado (no lo cancela stopEverything)
  const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

  const alive = (runId: number) => !cancelled.current && runId === runIdRef.current;

  const stopEverything = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    try { await audioStop.current(); } catch { /* noop */ }
    audioStop.current = async () => {};
    try { await detenerAudioActual(); } catch { /* noop */ }
  }, []);

  const finish = useCallback(async () => {
    cancelled.current = true;
    runIdRef.current++;
    await stopEverything();
    navRef.current('dashboard');
    finishRef.current();
  }, [stopEverything]);

  // Corre un paso completo: navega → asienta → caption → (voz) → espera → siguiente
  const runStep = useCallback(async (i: number, runId: number) => {
    if (!alive(runId)) return;
    if (i >= total) { finish(); return; }

    const step = steps[i];
    setIdx(i);
    setShowCap(false);
    capAnim.setValue(0);

    Animated.timing(progAnim, {
      toValue: (i + 1) / total,
      duration: 400,
      useNativeDriver: false,
    }).start();

    navRef.current(step.screen);
    // espera a que asiente la pantalla (respeta pausa)
    for (let w = 0; w < (step.settleMs ?? 800); w += 120) {
      await sleep(120);
      if (!alive(runId)) return;
      while (pausedRef.current && alive(runId)) await sleep(150);
    }
    if (!alive(runId)) return;

    setShowCap(true);
    Animated.timing(capAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();

    let holdMs = step.dwellMs;

    if (voiceEnabled && Platform.OS !== 'web') {
      try {
        const b64 = await sintetizarTexto(step.caption);
        if (b64 && alive(runId)) {
          await new Promise<void>(resolve => {
            let done = false;
            const finishOnce = () => { if (!done) { done = true; resolve(); } };
            reproducirAudioBase64(b64, finishOnce)
              .then(cl => { audioStop.current = cl; })
              .catch(finishOnce);
            timerRef.current = setTimeout(finishOnce, 16_000); // salvavidas
          });
          holdMs = 600;
        }
      } catch { /* sigue con dwellMs */ }
    }

    if (!alive(runId)) return;

    // Mantiene el caption en pantalla holdMs, sin contar el tiempo en pausa
    let held = 0;
    while (held < holdMs) {
      if (!alive(runId)) return;
      await sleep(150);
      if (!pausedRef.current) held += 150;
    }

    runStep(i + 1, runId);
  }, [steps, total, voiceEnabled, finish, capAnim, progAnim]);

  // Arranque / limpieza
  useEffect(() => {
    if (!visible) return;
    cancelled.current = false;
    pausedRef.current = false;
    setPaused(false);
    const runId = ++runIdRef.current;
    runStep(0, runId);
    return () => {
      cancelled.current = true;
      runIdRef.current++;
      stopEverything();
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  const step = steps[idx];

  const togglePause = () => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (next) stopEverything();   // corta la narración; el resto se pausa solo
  };

  const skip = async () => {
    await stopEverything();
    const runId = ++runIdRef.current;
    pausedRef.current = false;
    setPaused(false);
    runStep(Math.min(idx + 1, total), runId);
  };

  const replay = async () => {
    await stopEverything();
    const runId = ++runIdRef.current;
    pausedRef.current = false;
    setPaused(false);
    runStep(0, runId);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Captura de toques: evita que el usuario navegue durante el demo.
          Un toque pausa/reanuda. */}
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,12,24,0.04)' }]}
        onPress={togglePause}
      />

      {/* Pill superior */}
      <View style={[s.topPill, { top: insets.top + 10 }]}>
        <View style={s.dot} />
        <Text style={s.topPillText}>MODO DEMO</Text>
      </View>

      {/* Barra de subtítulos */}
      <Animated.View
        style={[
          s.captionWrap,
          { paddingBottom: insets.bottom + 14, opacity: showCap ? capAnim : 0.35 },
        ]}
      >
        <LinearGradient
          colors={[colors.heroGradientFrom, colors.heroGradientTo]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.captionCard}
        >
          {/* Progreso */}
          <View style={s.progressTrack}>
            <Animated.View
              style={[
                s.progressFill,
                { width: progAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>

          <View style={s.captionBody}>
            <View style={s.finnAvatar}>
              <Icon name="zap" size={15} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.captionTitle}>
                {step.title}
                <Text style={s.captionCount}>   {idx + 1}/{total}</Text>
              </Text>
              <Text style={s.captionText}>{step.caption}</Text>
            </View>
          </View>

          {/* Controles */}
          <View style={s.controls}>
            <Pressable onPress={replay} style={s.ctrlBtn} hitSlop={8}>
              <Icon name="rotate-ccw" size={17} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <Pressable onPress={togglePause} style={[s.ctrlBtn, s.ctrlMain]} hitSlop={8}>
              <Icon name={paused ? 'play' : 'pause'} size={19} color="#fff" />
            </Pressable>
            <Pressable onPress={skip} style={s.ctrlBtn} hitSlop={8}>
              <Icon name="skip-forward" size={17} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={finish} style={s.exitBtn} hitSlop={8}>
              <Text style={s.exitText}>Salir</Text>
              <Icon name="x" size={14} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  topPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10,12,24,0.82)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F87171' },
  topPillText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  captionWrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 14,
  },
  captionCard: {
    borderRadius: 22,
    padding: 16,
    gap: 12,
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 14,
  },

  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: '#fff' },

  captionBody: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  finnAvatar: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  captionTitle: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  captionCount: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' },
  captionText: { color: 'rgba(255,255,255,0.82)', fontSize: 13.5, lineHeight: 19, marginTop: 3 },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctrlBtn: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctrlMain: { backgroundColor: 'rgba(255,255,255,0.20)' },
  exitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7,
  },
  exitText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
});

export default GuidedDemo;
