import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Animated,
  StyleSheet, Modal, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { useSwipeBack } from '../hooks/useSwipeBack';
import {
  calcularResumenMensual,
  calificacionColor,
  calificacionEmoji,
  calificacionLabel,
  marcarResumenVisto,
  MESES_LABELS,
  ResumenMensual,
  LogroDesbloqueado,
} from '../utils/resumenMensualUtils';

const { width: SCREEN_W } = Dimensions.get('window');
const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

// ── Confetti ──────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#6366F1','#10B981','#F59E0B','#EF4444','#A855F7','#EC4899','#06B6D4'];

const ConfettiBurst: React.FC<{ active: boolean }> = ({ active }) => {
  const pieces = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      x:   new Animated.Value(0),
      y:   new Animated.Value(0),
      op:  new Animated.Value(0),
      rot: new Animated.Value(0),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      angle: (i / 18) * 2 * Math.PI,
    }))
  ).current;

  useEffect(() => {
    if (!active) return;
    const anims = pieces.map(p => {
      p.x.setValue(0); p.y.setValue(0); p.op.setValue(1); p.rot.setValue(0);
      const r = 80 + Math.random() * 60;
      return Animated.parallel([
        Animated.timing(p.x,  { toValue: Math.cos(p.angle) * r, duration: 700, useNativeDriver: true }),
        Animated.timing(p.y,  { toValue: Math.sin(p.angle) * r - 40, duration: 700, useNativeDriver: true }),
        Animated.timing(p.op, { toValue: 0, duration: 700, useNativeDriver: true }),
        Animated.timing(p.rot,{ toValue: 3, duration: 700, useNativeDriver: true }),
      ]);
    });
    Animated.stagger(20, anims).start();
  }, [active]);

  if (!active) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: p.op,
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              { rotate: p.rot.interpolate({ inputRange: [0,3], outputRange: ['0deg','540deg'] }) },
            ],
          }}
        />
      ))}
    </View>
  );
};

// ── Logro Modal ───────────────────────────────────────────────────────────────

const LogroModal: React.FC<{
  logro: LogroDesbloqueado;
  onClose: () => void;
}> = ({ logro, onClose }) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(opAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Modal transparent animationType="none">
      <Animated.View style={[lm.overlay, { opacity: opAnim }]}>
        <Animated.View
          style={[
            lm.card,
            { backgroundColor: colors.card, borderColor: colors.border, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <ConfettiBurst active />
          <View style={[lm.iconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Icon name={logro.icono as any} size={32} color="#D97706" />
          </View>
          <Text style={[lm.title, { color: colors.textPrimary }]}>{logro.titulo}</Text>
          <Text style={[lm.desc, { color: colors.textSecondary }]}>{logro.descripcion}</Text>
          <View style={[lm.xpBadge, { backgroundColor: colors.primaryLight }]}>
            <Text style={[lm.xpText, { color: colors.primary }]}>+{logro.xp} XP</Text>
          </View>
          <TouchableOpacity
            style={[lm.btn, { backgroundColor: colors.primary }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={lm.btnText}>¡Genial!</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const lm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  card:    { width: SCREEN_W - 60, borderRadius: 24, borderWidth: 1, padding: 28, alignItems: 'center', overflow: 'hidden' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:   { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  desc:    { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  xpBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 20 },
  xpText:  { fontSize: 16, fontWeight: '700' },
  btn:     { borderRadius: 14, paddingVertical: 13, paddingHorizontal: 40 },
  btnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
  mesOverride?: { mes: number; año: number };
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'categorias' | 'proyeccion';
const TABS: { key: Tab; label: string }[] = [
  { key: 'resumen',    label: 'Resumen'     },
  { key: 'categorias', label: 'Categorías'  },
  { key: 'proyeccion', label: 'Proyección'  },
];

// ── Main Screen ───────────────────────────────────────────────────────────────

export const ResumenMensualScreen: React.FC<Props> = ({ onBack, onNavigate, mesOverride }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { transactions, categories, profile, userLevel, setUserLevel } = useFinance();

  const monthlySalary = profile?.monthlySalary ?? 0;

  const ahora = new Date();
  const mes = mesOverride?.mes ?? ahora.getMonth();
  const año = mesOverride?.año ?? ahora.getFullYear();

  const resumen: ResumenMensual = useMemo(
    () => calcularResumenMensual(transactions, categories, monthlySalary, mes, año),
    [transactions.length, categories.length, monthlySalary, mes, año],
  );

  const calColor = calificacionColor(resumen.calificacion);
  const { panResponder: swipePR, translateX: swipeX } = useSwipeBack(onBack);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const tabFadeAnim = useRef(new Animated.Value(1)).current;

  // State
  const [tabActivo, setTabActivo] = useState<Tab>('resumen');
  const [showLogro, setShowLogro] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Header entrance
    Animated.spring(headerAnim, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }).start();

    // Confetti for good months
    if (resumen.calificacion === 'excelente' || resumen.calificacion === 'bueno') {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 1400);
      return () => clearTimeout(t);
    }
  }, []);

  // Show logro modal after 600ms if there's one
  useEffect(() => {
    if (!resumen.logroDesbloqueado) return;
    const t = setTimeout(() => {
      setShowLogro(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, []);

  // Mark as seen on mount
  useEffect(() => {
    marcarResumenVisto(año, mes).catch(() => {});
  }, [mes, año]);

  const handleCloseLogro = () => {
    setShowLogro(false);
    // Grant XP
    if (resumen.logroDesbloqueado && userLevel) {
      setUserLevel({ ...userLevel, experience: userLevel.experience + resumen.logroDesbloqueado.xp });
    }
  };

  const switchTab = (tab: Tab) => {
    if (tab === tabActivo) return;
    Animated.timing(tabFadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setTabActivo(tab);
      Animated.timing(tabFadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const headerTranslate = headerAnim.interpolate({ inputRange: [0,1], outputRange: [-30, 0] });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[s.root, { backgroundColor: colors.background, transform: [{ translateX: swipeX }] }]}
      {...swipePR.panHandlers}
    >
      {showConfetti && <ConfettiBurst active />}
      {showLogro && resumen.logroDesbloqueado && (
        <LogroModal logro={resumen.logroDesbloqueado} onClose={handleCloseLogro} />
      )}

      {/* ── Header ── */}
      <Animated.View
        style={[
          s.header,
          {
            backgroundColor: calColor,
            paddingTop: insets.top + 12,
            opacity: headerAnim,
            transform: [{ translateY: headerTranslate }],
          },
        ]}
      >
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="chevron-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerSub}>{MESES_LABELS[mes]} {año}</Text>
        <Text style={s.headerEmoji}>{calificacionEmoji(resumen.calificacion)}</Text>
        <Text style={s.headerTitle}>{calificacionLabel(resumen.calificacion)}</Text>

        {/* 3-segment bar */}
        <View style={s.segRow}>
          <View style={[s.seg, { flex: resumen.metricas.porcentajeGastado, backgroundColor: 'rgba(255,255,255,0.9)' }]} />
          <View style={[s.seg, { flex: resumen.metricas.porcentajePendiente, backgroundColor: 'rgba(255,255,255,0.45)' }]} />
          <View style={[s.seg, { flex: resumen.metricas.porcentajeLibre, backgroundColor: 'rgba(255,255,255,0.15)' }]} />
        </View>
        <View style={s.segLabels}>
          <Text style={s.segLabel}>{resumen.metricas.porcentajeGastado}% gastado</Text>
          <Text style={s.segLabel}>{fmtCOP(resumen.metricas.ingresoEfectivo)}</Text>
        </View>
      </Animated.View>

      {/* ── Tab bar ── */}
      <View style={[s.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => switchTab(t.key)}
            style={[s.tabItem, tabActivo === t.key && { borderBottomColor: calColor, borderBottomWidth: 2 }]}
            activeOpacity={0.7}
          >
            <Text style={[s.tabLabel, { color: tabActivo === t.key ? calColor : colors.textSecondary }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab content ── */}
      <Animated.ScrollView
        style={{ flex: 1, opacity: tabFadeAnim }}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {tabActivo === 'resumen'    && <TabResumen    resumen={resumen} colors={colors} calColor={calColor} />}
        {tabActivo === 'categorias' && <TabCategorias resumen={resumen} colors={colors} calColor={calColor} />}
        {tabActivo === 'proyeccion' && <TabProyeccion resumen={resumen} colors={colors} calColor={calColor} onNavigate={onNavigate} />}
      </Animated.ScrollView>
    </Animated.View>
  );
};

// ── Tab: Resumen ──────────────────────────────────────────────────────────────

const TabResumen: React.FC<{ resumen: ResumenMensual; colors: any; calColor: string }> = ({ resumen, colors, calColor }) => {
  const { metricas, comparativa, topCategorias } = resumen;

  const mejoro = comparativa.cambioPct < 0;

  return (
    <View style={{ gap: 16 }}>
      {/* Comparativa card */}
      <View style={[r.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Comparativa mensual</Text>
        <View style={r.compareRow}>
          <View style={r.compareCol}>
            <Text style={[r.compareLabel, { color: colors.textTertiary }]}>{comparativa.mesAnteriorLabel}</Text>
            <Text style={[r.compareAmt, { color: colors.textSecondary }]}>{fmtCOP(comparativa.gastadoAnterior)}</Text>
          </View>
          <View style={[r.badge, { backgroundColor: mejoro ? '#DCFCE7' : '#FEE2E2' }]}>
            <Icon name={mejoro ? 'trending-down' : 'trending-up'} size={14} color={mejoro ? '#16A34A' : '#DC2626'} />
            <Text style={[r.badgeText, { color: mejoro ? '#16A34A' : '#DC2626' }]}>
              {mejoro ? '' : '+'}{comparativa.cambioPct}%
            </Text>
          </View>
          <View style={r.compareCol}>
            <Text style={[r.compareLabel, { color: colors.textTertiary }]}>{comparativa.mesActualLabel}</Text>
            <Text style={[r.compareAmt, { color: colors.textPrimary, fontWeight: '700' }]}>{fmtCOP(comparativa.gastadoActual)}</Text>
          </View>
        </View>

        {/* Ahorro comparison */}
        <View style={[r.ahorroRow, { borderTopColor: colors.border }]}>
          <View style={r.ahorroItem}>
            <Text style={[r.ahorroLabel, { color: colors.textTertiary }]}>Ahorro {comparativa.mesAnteriorLabel}</Text>
            <Text style={[r.ahorroVal, { color: colors.textSecondary }]}>{fmtCOP(comparativa.ahorroAnterior)}</Text>
          </View>
          <View style={r.ahorroItem}>
            <Text style={[r.ahorroLabel, { color: colors.textTertiary }]}>Ahorro {comparativa.mesActualLabel}</Text>
            <Text style={[r.ahorroVal, { color: calColor }]}>{fmtCOP(comparativa.ahorroActual)}</Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={r.statsRow}>
        {[
          { label: 'Total gastado', value: fmtCOP(metricas.totalGastado), color: '#EF4444' },
          { label: 'Pendiente', value: fmtCOP(metricas.totalPendiente), color: '#F59E0B' },
          { label: 'Ahorro',     value: fmtCOP(metricas.ahorroProyectado), color: '#10B981' },
        ].map((item, i) => (
          <View key={i} style={[r.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[r.statVal, { color: item.color }]}>{item.value}</Text>
            <Text style={[r.statLabel, { color: colors.textTertiary }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Top 5 categorías */}
      {topCategorias.length > 0 && (
        <View style={[r.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Top gastos</Text>
          {topCategorias.map((cat, i) => (
            <View key={i} style={r.catRow}>
              <View style={[r.catRankDot, { backgroundColor: calColor + '20' }]}>
                <Text style={[r.catRank, { color: calColor }]}>{i + 1}</Text>
              </View>
              <Text style={[r.catName, { color: colors.textPrimary }]} numberOfLines={1}>{cat.nombre}</Text>
              <View style={r.catRight}>
                <Text style={[r.catPct, { color: colors.textTertiary }]}>{cat.porcentaje}%</Text>
                <Text style={[r.catAmt, { color: colors.textPrimary }]}>{fmtCOP(cat.monto)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const r = StyleSheet.create({
  card:        { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle:   { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  compareRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compareCol:  { alignItems: 'center', flex: 1 },
  compareLabel:{ fontSize: 11, fontWeight: '500', marginBottom: 4 },
  compareAmt:  { fontSize: 15, fontWeight: '600' },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText:   { fontSize: 12, fontWeight: '700' },
  ahorroRow:   { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12, gap: 12 },
  ahorroItem:  { flex: 1, alignItems: 'center' },
  ahorroLabel: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
  ahorroVal:   { fontSize: 14, fontWeight: '700' },
  statsRow:    { flexDirection: 'row', gap: 8 },
  statCard:    { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  statVal:     { fontSize: 13, fontWeight: '700' },
  statLabel:   { fontSize: 10, fontWeight: '500', textAlign: 'center' },
  catRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  catRankDot:  { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  catRank:     { fontSize: 12, fontWeight: '700' },
  catName:     { flex: 1, fontSize: 13, fontWeight: '500' },
  catRight:    { alignItems: 'flex-end', gap: 2 },
  catPct:      { fontSize: 10, fontWeight: '500' },
  catAmt:      { fontSize: 13, fontWeight: '700' },
});

// ── Tab: Categorías ───────────────────────────────────────────────────────────

const TabCategorias: React.FC<{ resumen: ResumenMensual; colors: any; calColor: string }> = ({ resumen, colors, calColor }) => {
  const { topCategorias, metricas } = resumen;
  const total = metricas.totalGastado;

  return (
    <View style={{ gap: 12 }}>
      {/* Donut-like bar summary */}
      <View style={[rc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[rc.cardTitle, { color: colors.textPrimary }]}>Distribución del gasto</Text>
        <View style={rc.barTrack}>
          {topCategorias.map((cat, i) => (
            <View
              key={i}
              style={[
                rc.barSlice,
                {
                  flex: cat.monto,
                  backgroundColor: PALETTE[i % PALETTE.length],
                },
              ]}
            />
          ))}
          {total > 0 && (
            <View style={[rc.barSlice, { flex: Math.max(0, metricas.ingresoEfectivo - total), backgroundColor: colors.border }]} />
          )}
        </View>
        {/* Legend */}
        <View style={rc.legend}>
          {topCategorias.map((cat, i) => (
            <View key={i} style={rc.legendItem}>
              <View style={[rc.legendDot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
              <Text style={[rc.legendLabel, { color: colors.textSecondary }]} numberOfLines={1}>{cat.nombre}</Text>
              <Text style={[rc.legendPct, { color: colors.textTertiary }]}>{cat.porcentaje}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Category list */}
      <View style={[rc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[rc.cardTitle, { color: colors.textPrimary }]}>Detalle por categoría</Text>
        {topCategorias.map((cat, i) => {
          const pct = total > 0 ? Math.round((cat.monto / total) * 100) : 0;
          return (
            <View key={i} style={rc.catItem}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={rc.catHeader}>
                  <View style={[rc.catDot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
                  <Text style={[rc.catName, { color: colors.textPrimary }]}>{cat.nombre}</Text>
                  <Text style={[rc.catAmt, { color: colors.textPrimary }]}>{fmtCOP(cat.monto)}</Text>
                </View>
                <View style={[rc.miniTrack, { backgroundColor: colors.border }]}>
                  <View style={[rc.miniFill, { width: `${pct}%` as any, backgroundColor: PALETTE[i % PALETTE.length] }]} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const PALETTE = ['#6366F1','#10B981','#F59E0B','#EF4444','#A855F7'];

const rc = StyleSheet.create({
  card:        { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle:   { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  barTrack:    { height: 12, flexDirection: 'row', borderRadius: 6, overflow: 'hidden' },
  barSlice:    { height: '100%' },
  legend:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11 },
  legendPct:   { fontSize: 10, fontWeight: '600' },
  catItem:     { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  catHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catDot:      { width: 10, height: 10, borderRadius: 5 },
  catName:     { flex: 1, fontSize: 13, fontWeight: '500' },
  catAmt:      { fontSize: 13, fontWeight: '700' },
  miniTrack:   { height: 4, borderRadius: 2, overflow: 'hidden' },
  miniFill:    { height: '100%', borderRadius: 2 },
});

// ── Tab: Proyección ───────────────────────────────────────────────────────────

const TabProyeccion: React.FC<{
  resumen: ResumenMensual;
  colors: any;
  calColor: string;
  onNavigate?: (screen: string) => void;
}> = ({ resumen, colors, calColor, onNavigate }) => {
  const { proyeccion, metricas } = resumen;
  const ingreso = metricas.ingresoEfectivo;

  // 50-30-20 breakdown
  const necesidades = Math.round(ingreso * 0.5);
  const deseos      = Math.round(ingreso * 0.3);
  const ahorros     = Math.round(ingreso * 0.2);

  return (
    <View style={{ gap: 16 }}>
      {/* Finn advice */}
      <View style={[rp.finnRow]}>
        <View style={[rp.finnAvatar, { backgroundColor: calColor }]}>
          <Text style={rp.finnLetter}>F</Text>
        </View>
        <View style={[rp.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[rp.bubbleText, { color: colors.textPrimary }]}>{proyeccion.consejo}</Text>
        </View>
      </View>

      {/* Ahorro proyectado */}
      <View style={[rp.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[rp.cardTitle, { color: colors.textPrimary }]}>Potencial de ahorro</Text>
        <Text style={[rp.bigAmt, { color: calColor }]}>{fmtCOP(proyeccion.ahorroMesSiguiente)}</Text>
        <Text style={[rp.sub, { color: colors.textTertiary }]}>disponible este mes</Text>
        {proyeccion.metaPropuesta > 0 && (
          <View style={[rp.metaRow, { backgroundColor: colors.primaryLight }]}>
            <Icon name="crosshair" size={14} color={colors.primary} />
            <Text style={[rp.metaText, { color: colors.primary }]}>
              Meta sugerida: {fmtCOP(proyeccion.metaPropuesta)} (30% del excedente)
            </Text>
          </View>
        )}
      </View>

      {/* 50-30-20 */}
      <View style={[rp.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[rp.cardTitle, { color: colors.textPrimary }]}>Regla 50-30-20</Text>
        <Text style={[rp.cardSub, { color: colors.textTertiary }]}>Distribución recomendada de {fmtCOP(ingreso)}</Text>
        {[
          { label: 'Necesidades', pct: 50, amt: necesidades, color: '#6366F1' },
          { label: 'Deseos',      pct: 30, amt: deseos,      color: '#F59E0B' },
          { label: 'Ahorro',      pct: 20, amt: ahorros,     color: '#10B981' },
        ].map((item, i) => (
          <View key={i} style={rp.ruleRow}>
            <View style={[rp.ruleDot, { backgroundColor: item.color }]} />
            <Text style={[rp.ruleLabel, { color: colors.textPrimary }]}>{item.label}</Text>
            <Text style={[rp.rulePct, { color: colors.textTertiary }]}>{item.pct}%</Text>
            <Text style={[rp.ruleAmt, { color: item.color }]}>{fmtCOP(item.amt)}</Text>
          </View>
        ))}
      </View>

      {/* Action buttons */}
      <View style={{ gap: 10 }}>
        <TouchableOpacity
          style={[rp.actionBtn, { backgroundColor: calColor }]}
          onPress={() => onNavigate?.('bot')}
          activeOpacity={0.85}
        >
          <Icon name="message-circle" size={18} color="#FFFFFF" />
          <Text style={rp.actionBtnText}>Hablar con Finn IA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[rp.actionBtnOutline, { borderColor: calColor }]}
          onPress={() => onNavigate?.('estadisticas')}
          activeOpacity={0.85}
        >
          <Icon name="bar-chart-2" size={18} color={calColor} />
          <Text style={[rp.actionBtnOutlineText, { color: calColor }]}>Ver estadísticas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[rp.actionBtnOutline, { borderColor: calColor }]}
          onPress={() => onNavigate?.('exportar')}
          activeOpacity={0.85}
        >
          <Icon name="file-text" size={18} color={calColor} />
          <Text style={[rp.actionBtnOutlineText, { color: calColor }]}>Exportar como PDF</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const rp = StyleSheet.create({
  finnRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  finnAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  finnLetter: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  bubble:     { flex: 1, borderRadius: 14, borderTopLeftRadius: 4, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  card:       { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  cardTitle:  { fontSize: 15, fontWeight: '700' },
  cardSub:    { fontSize: 12 },
  bigAmt:     { fontSize: 28, fontWeight: '800' },
  sub:        { fontSize: 12, marginTop: -4 },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, padding: 10 },
  metaText:   { fontSize: 13, fontWeight: '500', flex: 1 },
  ruleRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  ruleDot:    { width: 10, height: 10, borderRadius: 5 },
  ruleLabel:  { flex: 1, fontSize: 13, fontWeight: '500' },
  rulePct:    { fontSize: 12, fontWeight: '600', width: 32, textAlign: 'right' },
  ruleAmt:    { fontSize: 14, fontWeight: '700', width: 90, textAlign: 'right' },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 13, borderWidth: 1.5 },
  actionBtnOutlineText: { fontSize: 15, fontWeight: '600' },
});

// ── Root styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { paddingHorizontal: 20, paddingBottom: 20, gap: 6 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  headerEmoji: { fontSize: 36 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  segRow:      { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8, gap: 1 },
  seg:         { height: '100%', borderRadius: 2 },
  segLabels:   { flexDirection: 'row', justifyContent: 'space-between' },
  segLabel:    { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  tabBar:      { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem:     { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel:    { fontSize: 13, fontWeight: '600' },
  scrollContent: { padding: 16, gap: 0 },
});
