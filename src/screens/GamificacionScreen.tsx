import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Animated,
  StyleSheet, Modal, Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state';
import { AchievementCard } from '../components/gamification/AchievementCard';
import {
  calcularRachaActual, calcularMejorRacha, calcularDiasTotales,
  calcularRachaSemanal, getHabitos, getLeaderboard,
  getNivelActual, getNivelSiguiente, getProgresoNivel, getUnlocksDesbloqueados,
  LOGROS, NIVELES, evaluarLogros, calcularXPTotal,
  xpDeRetos, xpDeLecciones,
  XP_POR_ACCION, RARITY_STYLE,
} from '../services/GamificacionService';
import { THEME } from '../constants/theme';
import { useTheme } from '../state/ThemeContext';

const fmtK = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const TIPO_COLORS: Record<string, string> = {
  feature: '#6366F1', cosmetic: '#EC4899', ai: '#10B981', premium: '#F59E0B',
};
const TIPO_LABELS: Record<string, string> = {
  feature: 'Función', cosmetic: 'Cosmético', ai: 'IA', premium: 'Premium',
};

interface Props {
  onNavigate?: (screen: string) => void;
  onBack?:     () => void;
}

export function GamificacionScreen({ onNavigate, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const {
    transactions, categories, userLevel, leccionesCompletadas,
    retosCompletados, user, goal,
  } = useFinance();

  type Tab = 'progreso' | 'logros' | 'desbloqueos' | 'ranking';
  const [activeTab, setActiveTab]       = useState<Tab>('progreso');
  const [selectedLogro, setSelectedLogro] = useState<typeof LOGROS[0] | null>(null);
  const [newLogros, setNewLogros]       = useState<Set<string>>(new Set());
  const [prevUnlocked, setPrevUnlocked] = useState<Set<string>>(new Set());

  // ── Animations ──────────────────────────────────────────────────────────────
  const xpBarAnim   = useRef(new Animated.Value(0)).current;
  const tabFade     = useRef(new Animated.Value(1)).current;
  const dayAnims    = useRef(Array.from({ length: 7 }, () => new Animated.Value(0))).current;
  const habitAnims  = useRef(Array.from({ length: 4 }, () => new Animated.Value(0))).current;
  const headerScale = useRef(new Animated.Value(0.96)).current;

  // ── Core data ────────────────────────────────────────────────────────────────
  const categoriasPagadas = useMemo(() => categories.filter(c => c.pagado).length, [categories]);

  const logroData = useMemo(() => ({
    transactions,
    categories,
    rachaActual:          calcularRachaActual(transactions),
    mejorRacha:           calcularMejorRacha(transactions),
    leccionesCompletadas: leccionesCompletadas ?? [],
    retosCompletados:     retosCompletados ?? [],
    goal,
    xpTotal:              0,
    diasTotales:          calcularDiasTotales(transactions),
  }), [transactions, categories, leccionesCompletadas, retosCompletados, goal]);

  const unlockedIds = useMemo(() => evaluarLogros(logroData), [logroData]);

  const xpActual = useMemo(() => {
    const derivado = calcularXPTotal(
      transactions,
      categoriasPagadas,
      retosCompletados ?? [],
      leccionesCompletadas ?? [],
      unlockedIds,
    );
    // Coincide con el resto de la app (motor de gamificación) y es monótono.
    return Math.max(userLevel?.experience ?? 0, derivado);
  },
  [transactions, categoriasPagadas, retosCompletados, leccionesCompletadas, unlockedIds, userLevel?.experience]);

  const nivelActual   = useMemo(() => getNivelActual(xpActual),   [xpActual]);
  const nivelSiguiente = useMemo(() => getNivelSiguiente(xpActual), [xpActual]);
  const progreso      = useMemo(() => getProgresoNivel(xpActual),  [xpActual]);
  const unlocks       = useMemo(() => getUnlocksDesbloqueados(xpActual), [xpActual]);

  const rachaActual  = logroData.rachaActual;
  const mejorRacha   = logroData.mejorRacha;
  const diasTotales  = logroData.diasTotales;
  const rachaSemanal = useMemo(() => calcularRachaSemanal(transactions), [transactions]);

  const habitos = useMemo(
    () => getHabitos(transactions, categoriasPagadas, retosCompletados ?? [], leccionesCompletadas ?? []),
    [transactions, categoriasPagadas, retosCompletados, leccionesCompletadas],
  );

  const leaderboard = useMemo(
    () => getLeaderboard(user?.name ?? 'Tú', xpActual, nivelActual.level, nivelActual.title),
    [user?.name, xpActual, nivelActual],
  );

  const totalSaved = useMemo(() => {
    const inc = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return Math.max(0, inc - exp);
  }, [transactions]);

  const today   = new Date();
  const dow     = today.getDay();
  const todayIdx = dow === 0 ? 6 : dow - 1;
  const userPos  = leaderboard.findIndex(j => j.esUsuario);
  const xpToNext = userPos > 0 ? Math.max(0, leaderboard[userPos - 1].xp - xpActual) : 0;

  // ── Detect newly unlocked logros ─────────────────────────────────────────────
  useEffect(() => {
    const newOnes = new Set<string>();
    for (const id of unlockedIds) {
      if (!prevUnlocked.has(id)) newOnes.add(id);
    }
    if (newOnes.size > 0) setNewLogros(newOnes);
    setPrevUnlocked(new Set(unlockedIds));
  }, [unlockedIds.size]);

  // ── Animations ───────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(xpBarAnim,  { toValue: progreso, duration: 1000, delay: 300, useNativeDriver: false }),
    ]).start();

    Animated.stagger(50, dayAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true })
    )).start();

    Animated.parallel(habitos.map((h, i) =>
      Animated.timing(habitAnims[i], { toValue: h.progreso, duration: 700, delay: i * 80, useNativeDriver: false })
    )).start();
  }, []);

  const handleTabChange = (tab: Tab) => {
    tabFade.setValue(0);
    setActiveTab(tab);
    Animated.timing(tabFade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  };

  const initials = (user?.name ?? 'U')
    .split(' ').slice(0, 2).map(w => (w[0] ?? '').toUpperCase()).join('') || 'U';

  // XP breakdown for progress tab
  const xpBreakdown = [
    { label: 'Transacciones',    xp: transactions.length * XP_POR_ACCION.transaccion,                   icon: 'trending-down', color: '#6366F1' },
    { label: 'Pagos cumplidos',  xp: categoriasPagadas * XP_POR_ACCION.pago,                            icon: 'check-circle',  color: '#10B981' },
    { label: 'Retos completados',xp: xpDeRetos(retosCompletados ?? []),                                 icon: 'zap',           color: '#F59E0B' },
    { label: 'Lecciones',        xp: xpDeLecciones(leccionesCompletadas ?? []),                         icon: 'book-open',     color: '#8B5CF6' },
    { label: 'Logros',           xp: LOGROS.filter(l => unlockedIds.has(l.id)).reduce((s,l) => s+l.xp,0), icon: 'award', color: '#EF4444' },
  ].filter(b => b.xp > 0);

  const xpInLevel  = nivelSiguiente ? xpActual - nivelActual.xpRequired : 0;
  const xpNecesario = nivelSiguiente ? nivelSiguiente.xpRequired - nivelActual.xpRequired : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Animated.View style={[st.header, { paddingTop: insets.top + 8, backgroundColor: nivelActual.color, transform: [{ scale: headerScale }] }]}>
        <View style={st.headerTop}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={st.backBtn} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
          ) : <View style={{ width: 36 }} />}

          <View style={st.headerCenter}>
            <View style={st.avatarCircle}>
              <Text style={st.avatarText}>{initials}</Text>
            </View>
            <View style={st.levelPill}>
              <Text style={st.levelPillText}>Nivel {nivelActual.level}</Text>
            </View>
          </View>

          <View style={st.xpBubble}>
            <Text style={st.xpBubbleNum}>{fmtK(xpActual)}</Text>
            <Text style={st.xpBubbleLabel}>XP</Text>
          </View>
        </View>

        <Text style={st.headerTitle}>{nivelActual.title}</Text>

        {/* XP bar */}
        <View style={st.barWrap}>
          <View style={st.barTrack}>
            <Animated.View style={[st.barFill, { width: xpBarAnim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) as any }]} />
          </View>
          <Text style={st.barLabel}>
            {nivelSiguiente
              ? `${fmtK(xpInLevel)} / ${fmtK(xpNecesario)} XP → ${nivelSiguiente.title}`
              : '¡Nivel máximo! 🏆'}
          </Text>
        </View>

        {/* Level dots */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
          {NIVELES.map(n => (
            <View key={n.level} style={[st.levelDot, xpActual >= n.xpRequired ? st.levelDotDone : st.levelDotPending]}>
              <Text style={[st.levelDotText, xpActual >= n.xpRequired ? { color: '#fff' } : { color: 'rgba(255,255,255,0.4)' }]}>
                {n.level}
              </Text>
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <View style={[st.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {([
          { key: 'progreso',     label: 'Progreso',    icon: 'activity'  },
          { key: 'logros',       label: 'Logros',      icon: 'award'     },
          { key: 'desbloqueos',  label: 'Desbloqueos', icon: 'unlock'    },
          { key: 'ranking',      label: 'Ranking',     icon: 'users'     },
        ] as const).map(tab => (
          <TouchableOpacity key={tab.key} onPress={() => handleTabChange(tab.key as Tab)} style={[st.tabItem, activeTab === tab.key && { borderBottomColor: nivelActual.color }]} activeOpacity={0.8}>
            <Feather name={tab.icon} size={14} color={activeTab === tab.key ? nivelActual.color : colors.textTertiary} />
            <Text style={[st.tabText, { color: activeTab === tab.key ? nivelActual.color : colors.textTertiary }, activeTab === tab.key && { fontWeight: '700' }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <Animated.ScrollView style={{ flex: 1, opacity: tabFade }} contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

        {/* ════════════ PROGRESO ════════════ */}
        {activeTab === 'progreso' && (<>

          {/* XP Breakdown */}
          {xpBreakdown.length > 0 && (
            <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[st.cardTitle, { color: colors.textPrimary }]}>De dónde viene tu XP</Text>
              {xpBreakdown.map((b, i) => (
                <View key={b.label} style={[st.breakRow, i < xpBreakdown.length-1 && st.breakRowBorder]}>
                  <View style={[st.breakIcon, { backgroundColor: b.color + '20' }]}>
                    <Feather name={b.icon as any} size={14} color={b.color} />
                  </View>
                  <Text style={[st.breakLabel, { color: colors.textPrimary }]}>{b.label}</Text>
                  <View style={[st.breakBar, { flex: 1, marginHorizontal: 10, backgroundColor: colors.cardSecondary }]}>
                    <View style={[st.breakBarFill, { backgroundColor: b.color, width: `${Math.min((b.xp / Math.max(xpActual, 1)) * 100, 100)}%` }]} />
                  </View>
                  <Text style={[st.breakXP, { color: b.color }]}>+{fmtK(b.xp)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Racha semanal */}
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[st.cardTitle, { color: colors.textPrimary }]}>Racha semanal 🔥</Text>
            <View style={st.weekGrid}>
              {DAY_LABELS.map((lbl, i) => {
                const isToday = i === todayIdx;
                const hasTx   = rachaSemanal[i];
                const isPast  = i < todayIdx;
                return (
                  <Animated.View key={i} style={[st.dayCol, { opacity: dayAnims[i], transform: [{ translateY: dayAnims[i].interpolate({ inputRange:[0,1], outputRange:[8,0] }) }] }]}>
                    <View style={[
                      st.dayCell,
                      { backgroundColor: colors.cardSecondary },
                      isToday && hasTx  && { backgroundColor: nivelActual.color },
                      isToday && !hasTx && { borderColor: nivelActual.color, borderWidth: 2, backgroundColor: colors.card },
                      isPast  && hasTx  && { backgroundColor: nivelActual.color + '33' },
                    ]}>
                      {hasTx && <Feather name="check" size={13} color={isToday ? '#fff' : nivelActual.color} />}
                    </View>
                    <Text style={[st.dayLabel, isToday && { color: nivelActual.color, fontWeight: '700' }]}>{lbl}</Text>
                  </Animated.View>
                );
              })}
            </View>
            <View style={st.weekStats}>
              {[
                { val: rachaActual, label: 'Racha actual', unit: 'días' },
                { val: mejorRacha,  label: 'Mejor racha',  unit: 'días' },
                { val: diasTotales, label: 'Días activo',  unit: '' },
              ].map((s, i) => (
                <View key={i} style={st.weekStat}>
                  <Text style={[st.weekStatVal, { color: nivelActual.color }]}>{s.val}</Text>
                  <Text style={[st.weekStatLabel, { color: colors.textSecondary }]}>{s.label}</Text>
                  {s.unit ? <Text style={[st.weekStatUnit, { color: colors.textTertiary }]}>{s.unit}</Text> : null}
                </View>
              ))}
            </View>
          </View>

          {/* Hábitos */}
          <Text style={[st.sectionLabel, { color: colors.textTertiary }]}>Hábitos — XP acumulado</Text>
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {habitos.map((h, i) => (
              <View key={h.id} style={[st.habitRow, i < habitos.length-1 && st.habitBorder]}>
                <View style={[st.habitIcon, { backgroundColor: h.iconBg }]}>
                  <Feather name={h.iconName as any} size={15} color={h.iconColor} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[st.habitName, { color: colors.textPrimary }]}>{h.nombre}</Text>
                    <Text style={[st.habitXPEarned, { color: h.color }]}>+{fmtK(h.xpGanado)} / {fmtK(h.xpMax)} XP</Text>
                  </View>
                  <Text style={[st.habitDesc, { color: colors.textTertiary }]}>{h.descripcion}</Text>
                  <View style={[st.habitTrack, { backgroundColor: colors.cardSecondary }]}>
                    <Animated.View style={[st.habitFill, { backgroundColor: h.color, width: habitAnims[i].interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) as any }]} />
                  </View>
                  <Text style={st.habitProgress}>{h.progresoLabel}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Stats */}
          <Text style={[st.sectionLabel, { color: colors.textTertiary }]}>Tu historial</Text>
          <View style={st.statsRow}>
            {[
              { val: transactions.length, label: 'Transacciones' },
              { val: unlockedIds.size,    label: 'Logros' },
              { val: nivelActual.level,   label: 'Nivel actual' },
            ].map((s, i) => (
              <View key={i} style={[st.statCard, { backgroundColor: colors.card, borderColor: nivelActual.color + '30' }]}>
                <Text style={[st.statVal, { color: nivelActual.color }]}>{s.val}</Text>
                <Text style={[st.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </>)}

        {/* ════════════ LOGROS ════════════ */}
        {activeTab === 'logros' && (<>
          <View style={st.logroHeader}>
            <Text style={[st.logroHeaderTitle, { color: colors.textPrimary }]}>
              {unlockedIds.size} / {LOGROS.length} logros desbloqueados
            </Text>
            <View style={[st.logroXPTotal, { backgroundColor: nivelActual.color + '15' }]}>
              <Feather name="star" size={12} color={nivelActual.color} />
              <Text style={[st.logroXPTotalText, { color: nivelActual.color }]}>
                +{fmtK(LOGROS.filter(l => unlockedIds.has(l.id)).reduce((s,l) => s+l.xp, 0))} XP ganados
              </Text>
            </View>
          </View>

          {/* Logros por categoría */}
          {(['habitos','ahorro','retos','educacion','social'] as const).map(cat => {
            const catLogros = LOGROS.filter(l => l.categoria === cat);
            const catLabels: Record<string, string> = { habitos:'🔥 Hábitos', ahorro:'💰 Ahorro', retos:'⚡ Retos', educacion:'📚 Educación', social:'🌟 Nivel' };
            return (
              <View key={cat}>
                <Text style={[st.sectionLabel, { color: colors.textTertiary }]}>{catLabels[cat]}</Text>
                <View style={st.achGrid}>
                  {[...catLogros.filter(l => unlockedIds.has(l.id)), ...catLogros.filter(l => !unlockedIds.has(l.id))].map(logro => (
                    <AchievementCard
                      key={logro.id}
                      logro={logro}
                      unlocked={unlockedIds.has(logro.id)}
                      isNew={newLogros.has(logro.id)}
                      onPress={() => setSelectedLogro(logro)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </>)}

        {/* ════════════ DESBLOQUEOS ════════════ */}
        {activeTab === 'desbloqueos' && (<>
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[st.cardTitle, { color: colors.textPrimary }]}>Tu XP actual</Text>
            <Text style={[st.bigXP, { color: nivelActual.color }]}>{Math.round(xpActual).toLocaleString('es-CO')} XP</Text>
            <Text style={[st.bigXPSub, { color: colors.textSecondary }]}>Nivel {nivelActual.level} · {nivelActual.title}</Text>
            {nivelSiguiente && (
              <TouchableOpacity style={[st.earnBtn, { backgroundColor: nivelActual.color }]} onPress={() => onNavigate?.('retos')} activeOpacity={0.85}>
                <Feather name="zap" size={14} color="#fff" />
                <Text style={st.earnBtnText}>Ganar más XP</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[st.sectionLabel, { color: colors.textTertiary }]}>Ruta de desbloqueos</Text>
          {NIVELES.map((n, i) => {
            const desbloqueado = xpActual >= n.xpRequired;
            const esActual     = n.level === nivelActual.level;
            const esSiguiente  = nivelSiguiente?.level === n.level;
            const faltanXP     = Math.max(0, n.xpRequired - xpActual);
            const tcolor       = TIPO_COLORS[n.unlock.tipo];

            return (
              <View key={n.level} style={[st.unlockCard, desbloqueado ? { borderColor: n.color + '50', backgroundColor: colors.card } : { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
                {/* Level indicator line */}
                {i < NIVELES.length - 1 && <View style={[st.unlockLine, { backgroundColor: desbloqueado ? n.color : colors.border }]} />}

                <View style={st.unlockLeft}>
                  <View style={[st.unlockLevelCircle, { backgroundColor: desbloqueado ? n.color : colors.border }]}>
                    {desbloqueado
                      ? <Feather name="check" size={14} color="#fff" />
                      : <Text style={[st.unlockLevelNum, { color: colors.textTertiary }]}>{n.level}</Text>
                    }
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={st.unlockTopRow}>
                    <Text style={[st.unlockLevelTitle, { color: desbloqueado ? n.color : '#9CA3AF' }]}>{n.title}</Text>
                    <View style={[st.tipoBadge, { backgroundColor: tcolor + '20' }]}>
                      <Text style={[st.tipoText, { color: tcolor }]}>{TIPO_LABELS[n.unlock.tipo]}</Text>
                    </View>
                  </View>
                  <View style={st.unlockRow}>
                    <View style={[st.unlockIconBox, { backgroundColor: desbloqueado ? n.color + '20' : colors.cardSecondary }]}>
                      <Feather name={n.unlock.icono as any} size={16} color={desbloqueado ? n.color : '#D1D5DB'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.unlockName, { color: desbloqueado ? colors.textPrimary : colors.border }]}>{n.unlock.nombre}</Text>
                      <Text style={[st.unlockDesc, { color: desbloqueado ? colors.textSecondary : colors.border }]}>{n.unlock.descripcion}</Text>
                    </View>
                  </View>
                  {desbloqueado
                    ? <View style={[st.unlockStatusPill, { backgroundColor: n.color + '15' }]}>
                        <Feather name="unlock" size={11} color={n.color} />
                        <Text style={[st.unlockStatusText, { color: n.color }]}>Desbloqueado{esActual ? ' · Nivel actual' : ''}</Text>
                      </View>
                    : <View style={[st.unlockStatusPill, { backgroundColor: colors.cardSecondary }]}>
                        <Feather name="lock" size={11} color={colors.textTertiary} />
                        <Text style={[st.unlockStatusText, { color: colors.textTertiary }]}>
                          {esSiguiente
                            ? `Faltan ${Math.round(faltanXP).toLocaleString('es-CO')} XP`
                            : `Requiere ${Math.round(n.xpRequired).toLocaleString('es-CO')} XP`}
                        </Text>
                      </View>
                  }
                </View>
              </View>
            );
          })}
        </>)}

        {/* ════════════ RANKING ════════════ */}
        {activeTab === 'ranking' && (<>
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {leaderboard.map((j, i) => (
              <View key={j.id} style={[st.rankRow, j.esUsuario && { backgroundColor: nivelActual.color + '12', borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -4 }, i < leaderboard.length-1 && st.rankBorder]}>
                <Text style={[st.rankNum, i < 3 && { color: ['#EAB308','#94A3B8','#B45309'][i] }]}>{i+1}</Text>
                <View style={[st.rankAvatar, { backgroundColor: j.avatarBg }]}>
                  <Text style={[st.rankInitials, { color: j.avatarColor }]}>{j.iniciales}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[st.rankName, { color: colors.textPrimary }]}>{j.nombre}</Text>
                    {j.esUsuario && <View style={[st.youBadge, { backgroundColor: nivelActual.color }]}><Text style={st.youBadgeText}>Tú</Text></View>}
                  </View>
                  <Text style={[st.rankSub, { color: colors.textTertiary }]}>Nv.{j.nivel} · {j.titulo}</Text>
                </View>
                <Text style={[st.rankXP, { color: nivelActual.color }]}>{Math.round(j.xp).toLocaleString('es-CO')}</Text>
              </View>
            ))}
          </View>

          {userPos > 0 && xpToNext > 0 && (
            <View style={[st.rankPill, { backgroundColor: nivelActual.color + '15', borderColor: nivelActual.color + '30' }]}>
              <Feather name="trending-up" size={14} color={nivelActual.color} />
              <Text style={[st.rankPillText, { color: colors.textSecondary }]}>
                Gana <Text style={{ fontWeight: '700', color: nivelActual.color }}>{Math.round(xpToNext).toLocaleString('es-CO')} XP</Text> para subir al puesto {userPos}
              </Text>
            </View>
          )}
        </>)}

        <View style={{ height: insets.bottom + 32 }} />
      </Animated.ScrollView>

      {/* ── Logro detail modal ──────────────────────────────────────────── */}
      <Modal visible={!!selectedLogro} transparent animationType="fade" onRequestClose={() => setSelectedLogro(null)}>
        <Pressable style={st.modalBackdrop} onPress={() => setSelectedLogro(null)}>
          {selectedLogro && (() => {
            const r  = RARITY_STYLE[selectedLogro.rarity];
            const ul = unlockedIds.has(selectedLogro.id);
            return (
              <Pressable style={[st.modalCard, { backgroundColor: colors.card }]} onPress={() => {}}>
                <View style={[st.modalIconBox, { backgroundColor: ul ? r.bg : colors.cardSecondary }]}>
                  <Feather name={selectedLogro.icono as any} size={36} color={ul ? r.color : colors.border} />
                </View>
                <Text style={[st.modalTitle, { color: ul ? r.color : colors.textTertiary }]}>{selectedLogro.titulo}</Text>
                <View style={[st.rarityPill, { backgroundColor: r.bg }]}>
                  <Text style={[st.rarityPillText, { color: r.color }]}>{selectedLogro.rarity.charAt(0).toUpperCase() + selectedLogro.rarity.slice(1)}</Text>
                </View>
                <Text style={[st.modalDesc, { color: colors.textSecondary }]}>{selectedLogro.descripcion}</Text>
                <View style={[st.modalXPRow, { backgroundColor: '#FEF3C7' }]}>
                  <Feather name="star" size={14} color="#F59E0B" />
                  <Text style={st.modalXPText}>+{selectedLogro.xp} XP al desbloquear</Text>
                </View>
                <Text style={[st.modalStatus, { color: ul ? '#10B981' : '#9CA3AF' }]}>
                  {ul ? '✓ Logro desbloqueado' : '🔒 Pendiente de desbloquear'}
                </Text>
                <TouchableOpacity onPress={() => setSelectedLogro(null)} style={[st.modalClose, { backgroundColor: ul ? r.color : colors.border }]}>
                  <Text style={[st.modalCloseText, { color: ul ? '#fff' : colors.textSecondary }]}>Cerrar</Text>
                </TouchableOpacity>
              </Pressable>
            );
          })()}
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  // Header
  header:       { paddingHorizontal: 20, paddingBottom: 16 },
  headerTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', gap: 6 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText:   { fontSize: 18, fontWeight: '700', color: '#fff' },
  levelPill:    { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  levelPillText:{ fontSize: 11, fontWeight: '700', color: '#fff' },
  xpBubble:     { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, minWidth: 56 },
  xpBubbleNum:  { fontSize: 18, fontWeight: '800', color: '#fff' },
  xpBubbleLabel:{ fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  headerTitle:  { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 10, letterSpacing: -0.5 },
  barWrap:      { gap: 4, marginBottom: 6 },
  barTrack:     { height: 10, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 5, overflow: 'hidden' },
  barFill:      { height: '100%', backgroundColor: '#fff', borderRadius: 5 },
  barLabel:     { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  levelDot:     { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  levelDotDone: { backgroundColor: 'rgba(255,255,255,0.35)' },
  levelDotPending: { backgroundColor: 'rgba(255,255,255,0.1)' },
  levelDotText: { fontSize: 10, fontWeight: '700' },

  // Tabs
  tabBar:      { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem:     { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText:     { fontSize: 10, fontWeight: '500' },

  // Layout
  scroll:      { padding: 16, gap: 12 },
  card:        { borderRadius: 16, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle:   { fontSize: 13, fontWeight: '700', marginBottom: 12 },
  sectionLabel:{ fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4, marginBottom: 4 },

  // XP Breakdown
  breakRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  breakRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  breakIcon:   { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  breakLabel:  { fontSize: 12, fontWeight: '500', width: 110 },
  breakBar:    { height: 4, borderRadius: 2, overflow: 'hidden' },
  breakBarFill:{ height: '100%', borderRadius: 2 },
  breakXP:     { fontSize: 11, fontWeight: '700', width: 36, textAlign: 'right' },

  // Week
  weekGrid:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  dayCol:      { alignItems: 'center', gap: 4 },
  dayCell:     { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  dayLabel:    { fontSize: 9, color: '#9CA3AF', fontWeight: '500' },
  weekStats:   { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, justifyContent: 'space-around' },
  weekStat:    { alignItems: 'center', gap: 2 },
  weekStatVal: { fontSize: 22, fontWeight: '800' },
  weekStatLabel: { fontSize: 10, fontWeight: '500' },
  weekStatUnit:  { fontSize: 9 },

  // Habits
  habitRow:    { flexDirection: 'row', gap: 10, paddingVertical: 12, alignItems: 'flex-start' },
  habitBorder: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  habitIcon:   { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  habitName:   { fontSize: 13, fontWeight: '600' },
  habitXPEarned: { fontSize: 11, fontWeight: '700' },
  habitDesc:   { fontSize: 11 },
  habitTrack:  { height: 5, borderRadius: 3, overflow: 'hidden' },
  habitFill:   { height: '100%', borderRadius: 3 },
  habitProgress: { fontSize: 10, color: '#9CA3AF' },

  // Stats
  statsRow:    { flexDirection: 'row', gap: 10 },
  statCard:    { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1.5 },
  statVal:     { fontSize: 26, fontWeight: '800' },
  statLabel:   { fontSize: 10, textAlign: 'center', fontWeight: '500' },

  // Logros
  logroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  logroHeaderTitle: { fontSize: 13, fontWeight: '700' },
  logroXPTotal: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  logroXPTotalText: { fontSize: 11, fontWeight: '700' },
  achGrid:     { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },

  // Desbloqueos
  bigXP:       { fontSize: 40, fontWeight: '800', letterSpacing: -1, textAlign: 'center', marginBottom: 2 },
  bigXPSub:    { fontSize: 13, textAlign: 'center', marginBottom: 14 },
  earnBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  earnBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  unlockCard:  { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12, position: 'relative', overflow: 'hidden' },
  unlockLine:  { position: 'absolute', left: 30, bottom: -10, width: 2, height: 20, zIndex: 0 },
  unlockLeft:  { alignItems: 'center', paddingTop: 2 },
  unlockLevelCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  unlockLevelNum: { fontSize: 13, fontWeight: '800' },
  unlockTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  unlockLevelTitle: { fontSize: 13, fontWeight: '700' },
  tipoBadge:   { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  tipoText:    { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  unlockRow:   { flexDirection: 'row', gap: 10, marginBottom: 8 },
  unlockIconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  unlockName:  { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  unlockDesc:  { fontSize: 11, lineHeight: 16 },
  unlockStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  unlockStatusText: { fontSize: 11, fontWeight: '600' },

  // Ranking
  rankRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rankBorder:  { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  rankNum:     { fontSize: 14, fontWeight: '700', color: '#9CA3AF', width: 22, textAlign: 'center' },
  rankAvatar:  { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rankInitials:{ fontSize: 12, fontWeight: '700' },
  rankName:    { fontSize: 13, fontWeight: '600' },
  rankSub:     { fontSize: 11 },
  rankXP:      { fontSize: 13, fontWeight: '700' },
  youBadge:    { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  youBadgeText:{ fontSize: 9, fontWeight: '800', color: '#fff' },
  rankPill:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, padding: 12 },
  rankPillText:{ fontSize: 13, flex: 1 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard:   { borderRadius: 24, padding: 24, alignItems: 'center', width: '100%', gap: 10 },
  modalIconBox:{ width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  modalTitle:  { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  rarityPill:  { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4 },
  rarityPillText: { fontSize: 12, fontWeight: '700' },
  modalDesc:   { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  modalXPRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6 },
  modalXPText: { fontSize: 13, fontWeight: '700', color: '#B45309' },
  modalStatus: { fontSize: 13, fontWeight: '600' },
  modalClose:  { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, marginTop: 4 },
  modalCloseText: { fontSize: 15, fontWeight: '700' },
});
