import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Animated,
  StyleSheet, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state';
import { Icon } from '../components/ui/Icon';
import {
  calcularRachaActual, calcularMejorRacha, calcularDiasTotales,
  calcularRachaSemanal, getRecompensas, getNodosHabilidades,
  getLeaderboard, getHabitos,
} from '../services/GamificacionService';
import { THEME } from '../constants/theme';

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

const LEVEL_TITLES = ['', 'Principiante', 'Aprendiz', 'Gestor', 'Experto', 'Inversionista'];
const XP_PER_LEVEL = 1000;
const DAY_LABELS    = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// ─── Achievement definitions ──────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: 'primer_paso',       title: 'Primer paso',           description: 'Registra tu primera transacción',         rarity: 'common',    iconName: 'check' },
  { id: 'racha_7',           title: 'Racha 7 días',          description: 'Usa la app 7 días seguidos',               rarity: 'rare',      iconName: 'zap' },
  { id: 'heroe_presupuesto', title: 'Héroe del presupuesto', description: '3 meses sin pasarte del presupuesto',      rarity: 'epic',      iconName: 'shield' },
  { id: 'genio_financiero',  title: 'Genio financiero',      description: 'Completa todos los módulos de academia',   rarity: 'legendary', iconName: 'award' },
  { id: 'sin_deudas',        title: 'Sin deudas',            description: 'Liquida todas tus deudas registradas',     rarity: 'epic',      iconName: 'dollar-sign' },
  { id: 'meta_ahorro',       title: 'Meta de ahorro',        description: 'Alcanza tu primera meta de ahorro',        rarity: 'rare',      iconName: 'target' },
] as const;

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

const RARITY: Record<Rarity, { bg: string; color: string }> = {
  common:    { bg: THEME.colors.surfaceSecondary, color: THEME.colors.textSecondary },
  rare:      { bg: '#DBEAFE', color: '#1E40AF' },
  epic:      { bg: '#EDE9FE', color: '#5B21B6' },
  legendary: { bg: '#FEF3C7', color: '#92400E' },
};

// ─── AchievementCard ──────────────────────────────────────────────────────────
const AchievementCard = ({
  ach,
  unlocked,
}: {
  ach: (typeof ACHIEVEMENTS)[number];
  unlocked: boolean;
}) => {
  const r = RARITY[ach.rarity];
  return (
    <View style={[styles.achCard, !unlocked && { opacity: 0.45 }]}>
      <View style={[styles.achIconBox, { backgroundColor: r.bg }]}>
        <Icon name={ach.iconName as any} size={18} color={r.color} />
      </View>
      <Text style={styles.achTitle}>{ach.title}</Text>
      <Text style={styles.achDesc}>{ach.description}</Text>
      <View style={[styles.achBadge, { backgroundColor: r.bg }]}>
        <Text style={[styles.achBadgeText, { color: r.color }]}>{ach.rarity}</Text>
      </View>
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
interface GamificacionScreenProps {
  onNavigate?: (screen: string) => void;
  onBack?: () => void;
}

export function GamificacionScreen({ onNavigate, onBack }: GamificacionScreenProps) {
  const insets = useSafeAreaInsets();
  const { transactions, categories, userLevel, leccionesCompletadas, retosCompletados, user, goal } = useFinance();

  type Tab = 'progreso' | 'logros' | 'ranking' | 'tienda';
  const [activeTab, setActiveTab] = useState<Tab>('progreso');
  const [canjeadas, setCanjeadas] = useState<string[]>([]);

  // Animations
  const xpBarAnim  = useRef(new Animated.Value(0)).current;
  const tabFade    = useRef(new Animated.Value(1)).current;
  const dayAnims   = useRef(Array.from({ length: 7 }, () => new Animated.Value(0))).current;
  const habitAnims = useRef(Array.from({ length: 4 }, () => new Animated.Value(0))).current;
  const nodeAnims  = useRef(Array.from({ length: 4 }, () => new Animated.Value(0))).current;

  // Core data
  const xpActual  = userLevel?.experience ?? 0;
  const level     = userLevel?.level ?? 1;
  const title     = userLevel?.title ?? 'Principiante';
  const xpInLevel = xpActual % XP_PER_LEVEL;
  const xpPct     = xpInLevel / XP_PER_LEVEL;
  const nextLevel = Math.min(level + 1, 5);

  const rachaActual  = useMemo(() => calcularRachaActual(transactions),  [transactions]);
  const mejorRacha   = useMemo(() => calcularMejorRacha(transactions),   [transactions]);
  const diasTotales  = useMemo(() => calcularDiasTotales(transactions),  [transactions]);
  const rachaSemanal = useMemo(() => calcularRachaSemanal(transactions), [transactions]);

  const categoriasPagadas = useMemo(() => categories.filter(c => c.pagado).length, [categories]);

  const habitos = useMemo(
    () => getHabitos(transactions, categoriasPagadas, retosCompletados, leccionesCompletadas),
    [transactions, categoriasPagadas, retosCompletados, leccionesCompletadas],
  );

  const nodos = useMemo(
    () => getNodosHabilidades(xpActual, leccionesCompletadas),
    [xpActual, leccionesCompletadas],
  );

  const recompensas = useMemo(
    () => getRecompensas(xpActual, canjeadas),
    [xpActual, canjeadas],
  );

  const leaderboard = useMemo(
    () => getLeaderboard(user?.name ?? 'Tú', xpActual, level, title),
    [user?.name, xpActual, level, title],
  );

  const unlockedIds = useMemo(() => {
    const ids = new Set<string>();
    if (transactions.length > 0) ids.add('primer_paso');
    if (rachaActual >= 7) ids.add('racha_7');
    if (leccionesCompletadas.length >= 12) ids.add('genio_financiero');
    if (goal?.targetAmount && goal.currentAmount >= goal.targetAmount) ids.add('meta_ahorro');
    return ids;
  }, [transactions, rachaActual, leccionesCompletadas, goal]);

  const totalSaved = useMemo(() => {
    const inc = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return Math.max(0, inc - exp);
  }, [transactions]);

  const mesesActivo = useMemo(() => {
    if (transactions.length === 0) return 0;
    const oldest = Math.min(...transactions.map(t => new Date(t.date).getTime()));
    return Math.max(1, Math.ceil((Date.now() - oldest) / (30 * 24 * 3600 * 1000)));
  }, [transactions]);

  const today        = new Date();
  const dow          = today.getDay();
  const todayIdx     = dow === 0 ? 6 : dow - 1;
  const activeNode   = nodos.find(n => n.estado === 'active');
  const nextLocked   = nodos.find(n => n.estado === 'locked');
  const userPos      = leaderboard.findIndex(j => j.esUsuario);
  const xpToNext     = userPos > 0 ? Math.max(0, leaderboard[userPos - 1].xp - xpActual) : 0;

  // Load canjeadas
  useEffect(() => {
    AsyncStorage.getItem('@financy_recompensas_canjeadas').then(v => {
      if (v) setCanjeadas(JSON.parse(v));
    }).catch(() => {});
  }, []);

  // Animate XP bar
  useEffect(() => {
    Animated.timing(xpBarAnim, { toValue: xpPct, duration: 800, delay: 200, useNativeDriver: false }).start();
  }, []);

  // Animate streak days
  useEffect(() => {
    Animated.stagger(40, dayAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true })
    )).start();
  }, []);

  // Animate habit bars
  useEffect(() => {
    Animated.parallel(habitos.map((h, i) =>
      Animated.timing(habitAnims[i], { toValue: h.progreso, duration: 600, delay: i * 100, useNativeDriver: false })
    )).start();
  }, []);

  // Animate skill nodes
  useEffect(() => {
    Animated.stagger(80, nodeAnims.map(a =>
      Animated.spring(a, { toValue: 1, useNativeDriver: true })
    )).start();
  }, []);

  const handleTabChange = (tab: Tab) => {
    tabFade.setValue(0);
    setActiveTab(tab);
    Animated.timing(tabFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const canjearRecompensa = async (id: string) => {
    const updated = [...canjeadas, id];
    setCanjeadas(updated);
    await AsyncStorage.setItem('@financy_recompensas_canjeadas', JSON.stringify(updated));
    Alert.alert('¡Canjeada!', 'Tu recompensa ha sido desbloqueada.');
  };

  const initials = (user?.name ?? 'U')
    .split(' ').slice(0, 2).map(w => (w[0] ?? '').toUpperCase()).join('') || 'U';

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.background }}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={styles.userCircle}>
            <Text style={styles.userInitials}>{initials}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Nivel {level}</Text>
            </View>
            <Text style={styles.xpSubLabel}>{Math.round(xpInLevel)} / {XP_PER_LEVEL} XP</Text>
          </View>
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ width: 40, alignItems: 'center' }}>
              <Icon name="arrow-left" size={20} color={THEME.colors.surface} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <Text style={styles.headerTitle}>{title}</Text>

        <View style={styles.xpLabelRow}>
          <Text style={styles.xpProgressLabel}>Progreso al Nivel {nextLevel} · {LEVEL_TITLES[nextLevel]}</Text>
          <Text style={styles.xpProgressLabel}>{Math.round(xpPct * 100)}%</Text>
        </View>
        <View style={styles.xpTrack}>
          <Animated.View style={[
            styles.xpFill,
            { width: xpBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) as any },
          ]} />
        </View>

        <View style={styles.milestones}>
          {[1, 2, 3, 4, 5].map(lv => (
            <Text key={lv} style={[styles.milestone, lv <= level ? styles.milestoneDone : styles.milestonePending]}>
              Nv.{lv}
            </Text>
          ))}
        </View>
      </View>

      {/* ── Tab Bar ── */}
      <View style={styles.tabBar}>
        {(['progreso', 'logros', 'ranking', 'tienda'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => handleTabChange(tab)}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Content ── */}
      <Animated.View style={{ flex: 1, opacity: tabFade }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ════ PROGRESO ════ */}
          {activeTab === 'progreso' && (
            <>
              {/* A) Racha semanal */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Racha semanal</Text>
                <View style={styles.weekGrid}>
                  {DAY_LABELS.map((lbl, i) => {
                    const isToday = i === todayIdx;
                    const hasTx   = rachaSemanal[i];
                    const isPast  = i < todayIdx;

                    let cellStyle: object = styles.cellEmpty;
                    let showCheck = false;
                    let checkColor = THEME.colors.primary;

                    if (isToday && hasTx)       { cellStyle = styles.cellTodayFull; showCheck = true; checkColor = THEME.colors.surface; }
                    else if (isToday && !hasTx)  { cellStyle = styles.cellTodayEmpty; }
                    else if (isPast && hasTx)    { cellStyle = styles.cellDone; showCheck = true; }

                    return (
                      <Animated.View
                        key={i}
                        style={[
                          styles.dayCol,
                          {
                            opacity: dayAnims[i],
                            transform: [{ translateY: dayAnims[i].interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
                          },
                        ]}
                      >
                        <View style={[styles.dayCell, cellStyle]}>
                          {showCheck && <Icon name="check" size={14} color={checkColor} />}
                        </View>
                        <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{lbl}</Text>
                      </Animated.View>
                    );
                  })}
                </View>

                <View style={styles.weekFooter}>
                  {[
                    { value: Math.round(rachaActual), label: 'Racha actual', sub: 'días' },
                    { value: Math.round(mejorRacha),  label: 'Mejor racha',  sub: 'días' },
                    { value: Math.round(diasTotales), label: 'Días totales', sub: ' ' },
                    { value: '+50', label: 'Bonus hoy', sub: 'XP', accent: true },
                  ].map((s, i) => (
                    <View key={i} style={styles.weekStat}>
                      <Text style={[styles.weekStatVal, s.accent && { color: THEME.colors.primary }]}>{s.value}</Text>
                      <Text style={styles.weekStatLbl}>{s.label}</Text>
                      <Text style={[styles.weekStatSub, s.accent && { color: THEME.colors.primary }]}>{s.sub}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* B) Hábitos */}
              <Text style={styles.sectionLabel}>Hábitos financieros</Text>
              <View style={styles.card}>
                {habitos.map((h, i) => (
                  <View key={h.id} style={[styles.habitRow, i < habitos.length - 1 && styles.habitRowBorder]}>
                    <View style={[styles.habitIcon, { backgroundColor: h.iconBg }]}>
                      <Icon name={h.iconName as any} size={16} color={h.iconColor} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.habitName}>{h.nombre}</Text>
                      <Text style={styles.habitDesc}>{h.descripcion}</Text>
                      <View style={styles.habitTrack}>
                        <Animated.View style={[
                          styles.habitFill,
                          {
                            backgroundColor: h.color,
                            width: habitAnims[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) as any,
                          },
                        ]} />
                      </View>
                      <Text style={styles.habitProgress}>{h.progresoLabel}</Text>
                    </View>
                    <Text style={[styles.habitXP, { color: h.color }]}>+{h.xpPorAccion} XP</Text>
                  </View>
                ))}
              </View>

              {/* C) Mapa de habilidades */}
              <Text style={styles.sectionLabel}>Mapa de habilidades</Text>
              <View style={styles.card}>
                <View style={styles.skillRow}>
                  {nodos.map((nodo, i) => {
                    const done   = nodo.estado === 'done';
                    const active = nodo.estado === 'active';
                    const next   = nodos[i + 1];
                    const connDone = done && next?.estado === 'done';

                    return (
                      <React.Fragment key={nodo.id}>
                        <View style={styles.skillNodeWrapper}>
                          <Animated.View style={[
                            styles.skillNode,
                            done   && styles.skillNodeDone,
                            active && styles.skillNodeActive,
                            !done && !active && styles.skillNodeLocked,
                            { transform: [{ scale: nodeAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] },
                          ]}>
                            <Icon
                              name={nodo.iconName as any}
                              size={20}
                              color={done ? THEME.colors.surface : active ? THEME.colors.primary : THEME.colors.border}
                            />
                          </Animated.View>
                          <Text style={[styles.skillLabel, done ? styles.skillLabelDone : styles.skillLabelOther]} numberOfLines={2}>
                            {nodo.label}
                          </Text>
                        </View>
                        {i < nodos.length - 1 && (
                          <View style={[styles.skillConnector, connDone && styles.skillConnectorDone]} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>

                {activeNode && (
                  <View style={styles.skillPill}>
                    <View style={styles.skillPillDot} />
                    <Text style={styles.skillPillText}>
                      {'Próximo: completa '}
                      <Text style={{ fontWeight: '500', color: THEME.colors.textPrimary }}>{activeNode.label}</Text>
                      {nextLocked && (
                        <>
                          {' para desbloquear '}
                          <Text style={{ fontWeight: '500', color: THEME.colors.textPrimary }}>{nextLocked.label}</Text>
                        </>
                      )}
                    </Text>
                  </View>
                )}
              </View>

              {/* D) Stats globales */}
              <Text style={styles.sectionLabel}>Estadísticas globales</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{Math.round(transactions.length)}</Text>
                  <Text style={styles.statLabel}>Total transacciones</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{fmtCOP(totalSaved)}</Text>
                  <Text style={styles.statLabel}>Total ahorrado</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{Math.round(mesesActivo)}</Text>
                  <Text style={styles.statLabel}>Meses activo</Text>
                </View>
              </View>
            </>
          )}

          {/* ════ LOGROS ════ */}
          {activeTab === 'logros' && (
            <>
              <Text style={styles.achHeader}>
                Desbloqueados ({unlockedIds.size} / {ACHIEVEMENTS.length})
              </Text>
              <View style={styles.achGrid}>
                {[
                  ...ACHIEVEMENTS.filter(a => unlockedIds.has(a.id)),
                  ...ACHIEVEMENTS.filter(a => !unlockedIds.has(a.id)),
                ].map(a => (
                  <AchievementCard key={a.id} ach={a} unlocked={unlockedIds.has(a.id)} />
                ))}
              </View>
            </>
          )}

          {/* ════ RANKING ════ */}
          {activeTab === 'ranking' && (
            <>
              <View style={styles.card}>
                {leaderboard.map((j, i) => (
                  <View key={j.id} style={[
                    styles.rankRow,
                    j.esUsuario && styles.rankRowUser,
                    i < leaderboard.length - 1 && styles.rankRowBorder,
                  ]}>
                    <Text style={[styles.rankNum, i < 3 && styles.rankNumTop]}>{i + 1}</Text>
                    <View style={[styles.rankAvatar, { backgroundColor: j.avatarBg }]}>
                      <Text style={[styles.rankInitials, { color: j.avatarColor }]}>{j.iniciales}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.rankName}>{j.nombre}</Text>
                        {j.esUsuario && (
                          <View style={styles.rankYouBadge}>
                            <Text style={styles.rankYouText}>Tú</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.rankTitle}>{j.titulo} · Nv.{j.nivel}</Text>
                    </View>
                    <Text style={styles.rankXP}>{Math.round(j.xp).toLocaleString('es-CO')} XP</Text>
                  </View>
                ))}
              </View>

              {userPos > 0 && xpToNext > 0 && (
                <View style={styles.rankPill}>
                  <Text style={styles.rankPillText}>
                    {'Gana '}
                    <Text style={{ fontWeight: '500', color: THEME.colors.textPrimary }}>
                      {Math.round(xpToNext).toLocaleString('es-CO')} XP más
                    </Text>
                    {` para subir al puesto ${userPos}`}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* ════ TIENDA ════ */}
          {activeTab === 'tienda' && (
            <>
              <View style={styles.balanceCard}>
                <View>
                  <Text style={styles.balanceLabel}>Tus monedas</Text>
                  <Text style={styles.balanceValue}>{Math.round(xpActual).toLocaleString('es-CO')} XP</Text>
                </View>
                <TouchableOpacity
                  style={styles.earnBtn}
                  onPress={() => onNavigate?.('retos')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.earnBtnText}>Ganar más XP</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>Recompensas disponibles</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rewardsRow}>
                {recompensas.map(r => {
                  const active = r.disponible && !r.canjeada;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.rewardCard, active ? styles.rewardActive : styles.rewardLocked]}
                      onPress={() => {
                        if (!active) return;
                        Alert.alert(
                          '¿Canjear?',
                          `¿Quieres canjear "${r.nombre}" por ${r.costoXP} XP?`,
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Canjear', onPress: () => canjearRecompensa(r.id) },
                          ],
                        );
                      }}
                      activeOpacity={active ? 0.8 : 1}
                    >
                      <View style={[styles.rewardIconBox, { backgroundColor: r.iconBg }]}>
                        <Icon name={r.iconName as any} size={18} color={active ? r.iconColor : THEME.colors.textTertiary} />
                      </View>
                      <Text style={styles.rewardName}>{r.nombre}</Text>
                      {r.canjeada ? (
                        <Text style={styles.rewardCanjeada}>✓ Canjeada</Text>
                      ) : r.disponible ? (
                        <Text style={styles.rewardCosto}>{Math.round(r.costoXP).toLocaleString('es-CO')} XP</Text>
                      ) : (
                        <>
                          <Text style={styles.rewardCostoLocked}>{Math.round(r.costoXP).toLocaleString('es-CO')} XP</Text>
                          <Text style={styles.rewardFaltan}>Faltan {Math.round(r.costoXP - xpActual).toLocaleString('es-CO')} XP</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.sectionLabel}>Cómo ganar XP</Text>
              <View style={styles.card}>
                {[
                  { icon: 'trending-down', bg: THEME.colors.primaryLight, label: 'Registrar gasto',   xp: '+10 XP' },
                  { icon: 'check-circle',  bg: '#D1FAE5', label: 'Pagar categoría',   xp: '+50 XP' },
                  { icon: 'star',          bg: '#FEF3C7', label: 'Completar reto',    xp: '+100 XP' },
                  { icon: 'book-open',     bg: '#EDE9FE', label: 'Completar lección', xp: '+30 XP' },
                ].map((row, i, arr) => (
                  <View key={row.label} style={[styles.xpRow, i < arr.length - 1 && styles.xpRowBorder]}>
                    <View style={[styles.xpRowIcon, { backgroundColor: row.bg }]}>
                      <Icon name={row.icon as any} size={16} color={THEME.colors.primary} />
                    </View>
                    <Text style={styles.xpRowLabel}>{row.label}</Text>
                    <Text style={styles.xpRowValue}>{row.xp}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header
  header: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitials: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME.colors.primary,
  },
  levelBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 2,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.surface,
  },
  xpSubLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: THEME.colors.surface,
    marginTop: 8,
    marginBottom: 12,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  xpProgressLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '400',
  },
  xpTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  xpFill: {
    height: '100%',
    backgroundColor: THEME.colors.surface,
    borderRadius: 6,
  },
  milestones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  milestone: {
    fontSize: 10,
    fontWeight: '400',
  },
  milestoneDone: {
    color: 'rgba(255,255,255,0.75)',
  },
  milestonePending: {
    color: 'rgba(255,255,255,0.4)',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.colors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: THEME.colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '400',
    color: THEME.colors.textTertiary,
  },
  tabTextActive: {
    color: THEME.colors.primary,
    fontWeight: '500',
  },

  // Layout
  scroll: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 0.5,
    borderColor: THEME.colors.border,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 6,
  },

  // Streak week grid
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dayCol: {
    alignItems: 'center',
    gap: 4,
  },
  dayCell: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDone: {
    backgroundColor: THEME.colors.primaryLight,
  },
  cellTodayFull: {
    backgroundColor: THEME.colors.primary,
  },
  cellTodayEmpty: {
    backgroundColor: THEME.colors.primaryLight,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  cellEmpty: {
    backgroundColor: THEME.colors.background,
    borderWidth: 0.5,
    borderColor: THEME.colors.border,
  },
  dayLabel: {
    fontSize: 9,
    color: THEME.colors.textTertiary,
    fontWeight: '400',
  },
  dayLabelToday: {
    color: THEME.colors.primary,
    fontWeight: '500',
  },

  // Week footer
  weekFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: THEME.colors.surfaceSecondary,
    paddingTop: 12,
  },
  weekStat: {
    alignItems: 'center',
    gap: 2,
  },
  weekStatVal: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  weekStatLbl: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
    fontWeight: '400',
  },
  weekStatSub: {
    fontSize: 9,
    color: THEME.colors.textTertiary,
    fontWeight: '400',
  },

  // Habits
  habitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
  },
  habitRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.colors.background,
  },
  habitIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitName: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  habitDesc: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    fontWeight: '400',
  },
  habitTrack: {
    height: 4,
    backgroundColor: THEME.colors.surfaceSecondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  habitFill: {
    height: '100%',
    borderRadius: 2,
  },
  habitProgress: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
    fontWeight: '400',
  },
  habitXP: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },

  // Skill map
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  skillNodeWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  skillNode: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  skillNodeDone: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  skillNodeActive: {
    backgroundColor: THEME.colors.primaryLight,
    borderColor: THEME.colors.primary,
  },
  skillNodeLocked: {
    backgroundColor: THEME.colors.background,
    borderColor: THEME.colors.border,
  },
  skillLabel: {
    fontSize: 10,
    textAlign: 'center',
    maxWidth: 60,
    lineHeight: 14,
    fontWeight: '400',
  },
  skillLabelDone: {
    color: THEME.colors.primary,
    fontWeight: '500',
  },
  skillLabelOther: {
    color: THEME.colors.textSecondary,
  },
  skillConnector: {
    flex: 1,
    height: 2,
    backgroundColor: THEME.colors.border,
    marginBottom: 24,
  },
  skillConnectorDone: {
    backgroundColor: THEME.colors.primary,
  },
  skillPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.radius.sm,
    padding: 10,
    gap: 8,
  },
  skillPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
    marginTop: 3,
  },
  skillPillText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '400',
    lineHeight: 18,
  },

  // Global stats
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.radius.md,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
    fontWeight: '400',
    textAlign: 'center',
  },

  // Achievements
  achHeader: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  achGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  achCard: {
    width: '48%',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 0.5,
    borderColor: THEME.colors.border,
    padding: 12,
    gap: 6,
  },
  achIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  achDesc: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
    fontWeight: '400',
    lineHeight: 14,
  },
  achBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  achBadgeText: {
    fontSize: 9,
    fontWeight: '500',
  },

  // Ranking
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  rankRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.colors.background,
  },
  rankRowUser: {
    backgroundColor: THEME.colors.primaryLight,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 8,
    marginHorizontal: -4,
  },
  rankNum: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textTertiary,
    width: 20,
    textAlign: 'center',
  },
  rankNumTop: {
    color: '#F59E0B', // gold for top rank — intentional
  },
  rankAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankInitials: {
    fontSize: 12,
    fontWeight: '500',
  },
  rankName: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  rankTitle: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    fontWeight: '400',
  },
  rankXP: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.primary,
  },
  rankYouBadge: {
    backgroundColor: THEME.colors.primaryLight,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  rankYouText: {
    fontSize: 10,
    fontWeight: '500',
    color: THEME.colors.primary,
  },
  rankPill: {
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.radius.md,
    padding: 12,
    alignItems: 'center',
  },
  rankPillText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '400',
    textAlign: 'center',
  },

  // Tienda
  balanceCard: {
    backgroundColor: THEME.colors.primaryLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.primary,
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: 22,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  earnBtn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  earnBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.surface,
  },
  rewardsRow: {
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  rewardCard: {
    minWidth: 110,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  rewardActive: {
    backgroundColor: THEME.colors.primaryLight,
    borderWidth: 0.5,
    borderColor: THEME.colors.primary,
  },
  rewardLocked: {
    backgroundColor: THEME.colors.background,
    borderWidth: 0.5,
    borderColor: THEME.colors.border,
  },
  rewardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardName: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  rewardCosto: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.primary,
  },
  rewardCostoLocked: {
    fontSize: 11,
    fontWeight: '400',
    color: THEME.colors.textTertiary,
  },
  rewardFaltan: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
    fontWeight: '400',
  },
  rewardCanjeada: {
    fontSize: 11,
    color: THEME.colors.income,
    fontWeight: '500',
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  xpRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.colors.background,
  },
  xpRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpRowLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: THEME.colors.textPrimary,
  },
  xpRowValue: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.primary,
  },
});
