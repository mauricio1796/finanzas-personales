import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon, getCategoryIcon } from '../../components/ui/Icon';
import { getPaletaItem } from '../../constants/catalogoCategorias';
import { generarInsightDiario } from '../../services/RealAIService';
import { calcularMetricasFinancieras } from '../../utils/ingresoUtils';
import { QuickAddSheet } from '../../components/ui/QuickAddSheet';
import { SwipeableRow } from '../../components/ui/SwipeableRow';
import { DrawerMenu } from '../../components/layout/DrawerMenu';
import { Transaction } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCOP = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

function getSaludo(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12)  return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getNombreMes(mes: number): string {
  return new Date(2025, mes, 1).toLocaleDateString('es-CO', { month: 'long' });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface FinancialFeedProps {
  onNavigate: (screen: string) => void;
  onOpenBot?: (initialMessage?: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const FinancialFeed: React.FC<FinancialFeedProps> = ({ onNavigate, onOpenBot }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const {
    user, transactions, categories, profile, goal, userLevel,
    addTransaction: ctxAdd, deleteTransaction: ctxDelete,
  } = useFinance();

  // ── Date constants ──────────────────────────────────────────────────────────
  const now = useMemo(() => new Date(), []);
  const mesActual  = now.getMonth();
  const añoActual  = now.getFullYear();
  const diaHoy     = now.getDate();

  // ── Month selector ──────────────────────────────────────────────────────────
  const [mesSeleccionado, setMesSeleccionado] = useState({ mes: mesActual, año: añoActual });

  const meses = useMemo(() =>
    Array.from({ length: 4 }, (_, i) => {
      const d = new Date(añoActual, mesActual - (3 - i), 1);
      return {
        label: capitalize(d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')),
        mes: d.getMonth(),
        año: d.getFullYear(),
        activo: i === 3,
      };
    }),
  [mesActual, añoActual]);

  // ── Transaction calculations ────────────────────────────────────────────────
  const txMesSel = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === mesSeleccionado.mes && d.getFullYear() === mesSeleccionado.año;
    }),
  [transactions, mesSeleccionado]);

  const metricas = useMemo(
    () => calcularMetricasFinancieras(transactions, categories as any, profile?.monthlySalary ?? 0, mesActual, añoActual),
    [transactions, categories, profile?.monthlySalary, mesActual, añoActual],
  );

  const gastosPorCatSel = useMemo(() => {
    return txMesSel
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
  }, [txMesSel]);

  // ── Today / Yesterday transactions ─────────────────────────────────────────
  const hoyStr  = now.toDateString();
  const ayerDate = new Date(now);
  ayerDate.setDate(now.getDate() - 1);
  const ayerStr = ayerDate.toDateString();

  const txHoy  = useMemo(() => transactions.filter(t => new Date(t.date).toDateString() === hoyStr),  [transactions, hoyStr]);
  const txAyer = useMemo(() => transactions.filter(t => new Date(t.date).toDateString() === ayerStr), [transactions, ayerStr]);

  // ── Payment alerts ─────────────────────────────────────────────────────────
  const catsPagoVencido = useMemo(() =>
    categories.filter(c => c.diaPago && !c.pagado && c.diaPago < diaHoy && c.isSelected),
  [categories, diaHoy]);

  const catsPagoProximo = useMemo(() =>
    categories.filter(c => c.diaPago && !c.pagado && c.diaPago >= diaHoy && (c.diaPago ?? 0) <= diaHoy + 3 && c.isSelected),
  [categories, diaHoy]);

  // ── Top categories ─────────────────────────────────────────────────────────
  const topCategorias = useMemo(() =>
    categories
      .filter((c: any) => c.isSelected && (c.budget ?? 0) > 0)
      .map((c: any) => ({
        ...c,
        gastado: gastosPorCatSel[c.name] ?? 0,
        pctReal: c.budget > 0 ? Math.round(((gastosPorCatSel[c.name] ?? 0) / c.budget) * 100) : 0,
        pct: c.budget > 0 ? Math.min(Math.round(((gastosPorCatSel[c.name] ?? 0) / c.budget) * 100), 100) : 0,
      }))
      .sort((a: any, b: any) => b.pctReal - a.pctReal)
      .slice(0, 3),
  [categories, gastosPorCatSel]);

  // ── Pending payments ────────────────────────────────────────────────────────
  const categoriasPendientesPago = useMemo(() => {
    return categories
      .filter((c: any) => c.isSelected && !c.pagado && c.tipo === 'gasto' && (c.budget ?? 0) > 0)
      .map((c: any) => {
        const diasRestantes = c.diaPago != null ? (c.diaPago as number) - diaHoy : null;
        const urgencia =
          diasRestantes === null   ? 'activo'   :
          diasRestantes < 0        ? 'vencido'  :
          diasRestantes <= 3       ? 'urgente'  : 'normal';
        return { ...c, diasRestantes, urgencia };
      })
      .sort((a: any, b: any) => {
        const order: Record<string, number> = { vencido: 0, urgente: 1, normal: 2, activo: 3 };
        return (order[a.urgencia] ?? 3) - (order[b.urgencia] ?? 3);
      })
      .slice(0, 3);
  }, [categories, diaHoy]);

  // ── States ─────────────────────────────────────────────────────────────────
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'income' | 'expense'>('expense');
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  // ── Animated values ────────────────────────────────────────────────────────
  const heroAnim    = useRef(new Animated.Value(0)).current;
  const balanceAnim = useRef(new Animated.Value(0)).current;
  const insightAnim = useRef(new Animated.Value(0)).current;
  // Fixed 3 bar anims (max top categories)
  const barAnim0 = useRef(new Animated.Value(0)).current;
  const barAnim1 = useRef(new Animated.Value(0)).current;
  const barAnim2 = useRef(new Animated.Value(0)).current;
  const barAnims = [barAnim0, barAnim1, barAnim2];

  // Balance counter display
  const displayBalance = useRef(0);
  const balanceText    = useRef<any>(null);

  // ── Mount effects ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Hero spring
    Animated.spring(heroAnim, {
      toValue: 1,
      tension: 60,
      friction: 9,
      useNativeDriver: true,
    }).start();

    // Balance counter animation
    Animated.timing(balanceAnim, {
      toValue: metricas.ingresoEfectivo,
      duration: 1200,
      useNativeDriver: false,
    }).start();

    balanceAnim.addListener(({ value }) => {
      displayBalance.current = value;
      if (balanceText.current) {
        balanceText.current.setNativeProps({ text: fmtCOP(value) });
      }
    });

    // Bars staggered
    Animated.stagger(100, barAnims.map(a =>
      Animated.timing(a, { toValue: 1, duration: 600, useNativeDriver: false })
    )).start();

    // AI insight — usar IA real con fallback local
    generarInsightDiario(transactions as any, categories as any, profile).then(texto => {
      setAiInsight(texto);
      Animated.timing(insightAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }).catch(() => {});

    return () => { balanceAnim.removeAllListeners(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-animate bars when month selection changes ────────────────────────────
  useEffect(() => {
    barAnims.forEach(a => a.setValue(0));
    Animated.stagger(100, barAnims.map(a =>
      Animated.timing(a, { toValue: 1, duration: 600, useNativeDriver: false })
    )).start();
  }, [mesSeleccionado]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────
  const abrirQuickAdd = (tipo: 'income' | 'expense') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setQuickAddType(tipo);
    setQuickAddVisible(true);
  };

  // ── ICON_MAP (uses colors, so inside component) ────────────────────────────
  const ICON_MAP: Record<string, { icon: string; bg: string; color: string }> = {
    'Alimentación':    { icon: 'shopping-cart', bg: colors.primaryLight,  color: colors.primary   },
    'Transporte':      { icon: 'map-pin',        bg: colors.warningLight,  color: colors.warning   },
    'Vivienda':        { icon: 'home',           bg: colors.incomeLight,   color: colors.income    },
    'Arriendo':        { icon: 'home',           bg: colors.incomeLight,   color: colors.income    },
    'Salud':           { icon: 'heart',          bg: colors.expenseLight,  color: colors.expense   },
    'Educación':       { icon: 'book-open',      bg: colors.aiLight,       color: colors.ai        },
    'Entretenimiento': { icon: 'tv',             bg: colors.aiLight,       color: colors.ai        },
    'Ropa':            { icon: 'shopping-bag',   bg: colors.primaryLight,  color: colors.primary   },
    'Servicios':       { icon: 'zap',            bg: colors.warningLight,  color: colors.warning   },
    'Telefonía':       { icon: 'phone',          bg: colors.warningLight,  color: colors.warning   },
    'Gym / Sport':     { icon: 'activity',       bg: colors.incomeLight,   color: colors.income    },
    'Mascotas':        { icon: 'feather',        bg: colors.primaryLight,  color: colors.primary   },
    'Ahorro':          { icon: 'dollar-sign',    bg: colors.incomeLight,   color: colors.income    },
    'Deudas':          { icon: 'credit-card',    bg: colors.expenseLight,  color: colors.expense   },
    'Otros':           { icon: 'more-horizontal',bg: colors.cardSecondary, color: colors.textSecondary },
  };

  const getTxIcon = (tx: Transaction) => {
    if (tx.type === 'income') {
      return { icon: 'briefcase', bg: colors.incomeLight, color: colors.income };
    }
    return ICON_MAP[tx.category] ?? { icon: 'circle', bg: colors.cardSecondary, color: colors.textTertiary };
  };

  // ── Subcomponents ──────────────────────────────────────────────────────────
  const renderTxItem = (tx: Transaction) => {
    const { icon, bg, color } = getTxIcon(tx);
    const isIncome = tx.type === 'income';
    const hora = new Date(tx.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    return (
      <SwipeableRow key={tx.id} onDelete={() => ctxDelete(tx.id)}>
        <View style={[s.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.txIcon, { backgroundColor: bg, borderRadius: 10 }]}>
            <Icon name={icon as any} size={16} color={color} />
          </View>
          <View style={s.txInfo}>
            <Text style={[s.txName, { color: colors.textPrimary }]} numberOfLines={1}>
              {tx.description || tx.category}
            </Text>
            <Text style={[s.txSub, { color: colors.textTertiary }]}>
              {tx.category} · {hora}
            </Text>
          </View>
          <Text style={[s.txAmount, { color: isIncome ? colors.income : colors.expense }]}>
            {isIncome ? '+' : '-'}{fmtCOP(tx.amount)}
          </Text>
        </View>
      </SwipeableRow>
    );
  };

  const renderCatCard = (cat: any, idx: number) => {
    const barAnim = barAnims[idx];
    const pctColor =
      cat.pctReal >= 100 ? colors.expense :
      cat.pctReal >= 80  ? colors.warning :
      colors.income;
    const iconName = (cat.icon as any) || getCategoryIcon(cat.name);
    const iconBg   = ICON_MAP[cat.name]?.bg    ?? colors.cardSecondary;
    const iconColor = ICON_MAP[cat.name]?.color ?? colors.textSecondary;

    return (
      <View
        key={cat.id}
        style={[s.catCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {/* Top row */}
        <View style={s.catTopRow}>
          <View style={[s.catIconBox, { backgroundColor: iconBg }]}>
            <Icon name={iconName as any} size={14} color={iconColor} />
          </View>
          <Text style={[s.catName, { color: colors.textPrimary }]} numberOfLines={1}>
            {cat.name}
          </Text>
          <Text style={[s.catPct, { color: pctColor }]}>{cat.pct}%</Text>
        </View>
        {/* Amounts row */}
        <View style={s.catAmountsRow}>
          <Text style={[s.catSpent, { color: colors.textSecondary }]}>
            {fmtCOP(cat.gastado)} gastado
          </Text>
          <Text style={[s.catOf, { color: colors.textTertiary }]}>
            de {fmtCOP(cat.budget)}
          </Text>
        </View>
        {/* Progress bar */}
        <View style={[s.barTrack, { backgroundColor: colors.borderSubtle }]}>
          <Animated.View
            style={[
              s.barFill,
              {
                backgroundColor: pctColor,
                width: barAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', `${cat.pct}%`],
                }),
              },
            ]}
          />
        </View>
      </View>
    );
  };

  // ── Quick action items (inside component to access colors + handlers) ───────
  const QUICK_ACTIONS = [
    {
      label: 'Ingreso',
      icon: 'arrow-up',
      bg: colors.incomeLight,
      color: colors.income,
      onPress: () => abrirQuickAdd('income'),
    },
    {
      label: 'Gasto',
      icon: 'arrow-down',
      bg: colors.expenseLight,
      color: colors.expense,
      onPress: () => abrirQuickAdd('expense'),
    },
    {
      label: 'Simular',
      icon: 'cpu',
      bg: colors.warningLight,
      color: colors.warning,
      onPress: () => onNavigate('simulador'),
    },
    {
      label: 'Finn IA',
      icon: 'message-circle',
      bg: colors.aiLight,
      color: colors.ai,
      onPress: () => { if (onOpenBot) onOpenBot(); else onNavigate('bot'); },
    },
  ];

  const firstName = user?.name?.split(' ')[0] ?? 'Tú';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <View style={[s.hero, { backgroundColor: colors.headerBg, paddingTop: insets.top + 12 }]}>
        {/* Top bar */}
        <View style={s.heroTopBar}>
          {/* Avatar */}
          <TouchableOpacity
            style={[s.avatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            onPress={() => onNavigate('perfil')}
          >
            <Text style={s.avatarLetter}>{(user?.name ?? 'U').charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>

          {/* Greeting */}
          <View style={s.greetingWrap}>
            <Text style={s.greetingText} numberOfLines={1}>
              {getSaludo()}, {firstName}
            </Text>
          </View>

          {/* Icon buttons */}
          <View style={s.heroIconsRow}>
            <TouchableOpacity
              style={[s.heroIconBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              onPress={() => onNavigate('calendario')}
            >
              <Icon name="bell" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.heroIconBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              onPress={() => onNavigate('historial')}
            >
              <Icon name="search" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.heroIconBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setDrawerVisible(true);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="menu" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance */}
        <Animated.View
          style={[
            s.balanceWrap,
            {
              opacity: heroAnim,
              transform: [{ scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
            },
          ]}
        >
          <Text style={s.balanceLabel}>
            {metricas.esIngresoReal ? 'INGRESO REGISTRADO' : 'SALARIO ESTIMADO'}
          </Text>
          <Text ref={balanceText} style={s.balanceAmount}>
            {fmtCOP(metricas.ingresoEfectivo)}
          </Text>
          <Text style={s.balanceMonth}>
            {capitalize(getNombreMes(mesActual))} {añoActual}
          </Text>

          {/* 3-segment breakdown bar */}
          <View style={s.segBarWrap}>
            {metricas.porcentajeGastado > 0 && (
              <View style={[s.segSlice, { flex: metricas.porcentajeGastado, backgroundColor: '#F87171' }]} />
            )}
            {metricas.porcentajePendiente > 0 && (
              <View style={[s.segSlice, { flex: metricas.porcentajePendiente, backgroundColor: '#FBBF24' }]} />
            )}
            {metricas.porcentajeLibre > 0 && (
              <View style={[s.segSlice, { flex: metricas.porcentajeLibre, backgroundColor: 'rgba(255,255,255,0.35)' }]} />
            )}
            {metricas.porcentajeGastado === 0 && metricas.porcentajePendiente === 0 && (
              <View style={[s.segSlice, { flex: 100, backgroundColor: 'rgba(255,255,255,0.35)' }]} />
            )}
          </View>
          <View style={s.segLabelsRow}>
            <Text style={s.segLabel}>
              <Text style={{ color: '#F87171' }}>■</Text> Gastado {metricas.porcentajeGastado}%
            </Text>
            <Text style={s.segLabel}>
              <Text style={{ color: '#FBBF24' }}>■</Text> Pendiente {metricas.porcentajePendiente}%
            </Text>
            <Text style={s.segLabel}>
              <Text style={{ color: 'rgba(255,255,255,0.6)' }}>■</Text> Libre {metricas.porcentajeLibre}%
            </Text>
          </View>

          {/* Daily budget pill */}
          <View style={s.dailyPill}>
            <Icon name="calendar" size={10} color="rgba(255,255,255,0.75)" />
            <Text style={s.dailyPillText}>
              {fmtCOP(metricas.gastoPromedioRecomendadoDia)}/día · {metricas.diasRestantesMes} días restantes
            </Text>
          </View>

          {/* CTA when no real income */}
          {!metricas.esIngresoReal && (
            <TouchableOpacity style={s.ctaIngreso} onPress={() => abrirQuickAdd('income')} activeOpacity={0.8}>
              <Icon name="plus-circle" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={s.ctaIngresoText}>Registrar ingreso real</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* ── SCROLL BODY ───────────────────────────────────────────────── */}
      <ScrollView
        style={[s.scrollBody, { backgroundColor: colors.background }]}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Quick actions ──────────────────────────────────────────── */}
        <View style={s.quickActionsRow}>
          {QUICK_ACTIONS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={s.quickActionItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[s.quickActionCircle, { backgroundColor: item.bg }]}>
                <Icon name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={[s.quickActionLabel, { color: colors.textSecondary }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Finn insight ───────────────────────────────────────────── */}
        {aiInsight && (
          <Animated.View
            style={[
              s.insightCard,
              {
                backgroundColor: colors.primaryLight,
                borderColor: colors.primaryDark,
                opacity: insightAnim,
                transform: [{ translateY: insightAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              },
            ]}
          >
            <View style={s.insightRow}>
              <View style={[s.finnAvatar, { backgroundColor: colors.primary }]}>
                <Text style={s.finnLetter}>F</Text>
              </View>
              <View style={s.insightContent}>
                <Text style={[s.insightLabel, { color: colors.primary }]}>
                  FINN · INSIGHT DEL DÍA
                </Text>
                <Text style={[s.insightText, { color: colors.primaryText }]}>
                  {aiInsight}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Payment alert ──────────────────────────────────────────── */}
        {(catsPagoVencido.length > 0 || catsPagoProximo.length > 0) && (() => {
          const isVencido = catsPagoVencido.length > 0;
          const cat: any = isVencido ? catsPagoVencido[0] : catsPagoProximo[0];
          const dias = isVencido ? diaHoy - cat.diaPago : cat.diaPago - diaHoy;
          const texto = isVencido
            ? `${cat.name} venció hace ${dias} día${dias !== 1 ? 's' : ''} · ${fmtCOP(cat.budget ?? 0)} pendiente`
            : `${cat.name} vence en ${dias} día${dias !== 1 ? 's' : ''} · ${fmtCOP(cat.budget ?? 0)}`;
          return (
            <TouchableOpacity
              style={[
                s.alertCard,
                {
                  backgroundColor: isVencido ? colors.warningLight : colors.cardSecondary,
                  borderColor: isVencido ? colors.warning : colors.border,
                },
              ]}
              onPress={() => onNavigate('calendario')}
            >
              <View style={[s.alertIcon, { backgroundColor: isVencido ? colors.warning : colors.border }]}>
                <Icon name="alert-triangle" size={14} color={isVencido ? '#FFFFFF' : colors.textSecondary} />
              </View>
              <Text style={[s.alertText, { color: isVencido ? colors.warning : colors.textSecondary }]}>
                {texto}
              </Text>
              <Icon name="chevron-right" size={14} color={isVencido ? colors.warning : colors.textTertiary} />
            </TouchableOpacity>
          );
        })()}

        {/* ── Budget section ─────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Presupuesto del mes</Text>
          <TouchableOpacity onPress={() => onNavigate('estadisticas')}>
            <Text style={[s.sectionLink, { color: colors.primary }]}>Ver todo</Text>
          </TouchableOpacity>
        </View>

        {/* Month pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.monthScroll}
          contentContainerStyle={s.monthScrollContent}
        >
          {meses.map((m) => {
            const active = m.mes === mesSeleccionado.mes && m.año === mesSeleccionado.año;
            return (
              <TouchableOpacity
                key={`${m.mes}-${m.año}`}
                style={[
                  s.monthPill,
                  active
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.cardSecondary, borderWidth: 0.5, borderColor: colors.border },
                ]}
                onPress={() => setMesSeleccionado({ mes: m.mes, año: m.año })}
              >
                <Text
                  style={[
                    s.monthPillText,
                    { color: active ? '#FFFFFF' : colors.textSecondary, fontWeight: active ? '600' : '400' },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Category cards */}
        {topCategorias.length > 0
          ? topCategorias.map((cat: any, idx: number) => renderCatCard(cat, idx))
          : (
            <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="pie-chart" size={28} color={colors.textTertiary} />
              <Text style={[s.emptyTitle, { color: colors.textSecondary }]}>
                Sin categorías con presupuesto asignado
              </Text>
              <TouchableOpacity onPress={() => onNavigate('estadisticas')}>
                <Text style={[s.emptyAction, { color: colors.primary }]}>Configurar</Text>
              </TouchableOpacity>
            </View>
          )
        }

        {/* ── Pending payments ───────────────────────────────────────── */}
        {categoriasPendientesPago.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={{ height: 0.5, flex: 1, backgroundColor: colors.border }} />
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.6 }}>
                PAGOS PENDIENTES
              </Text>
              <View style={{ height: 0.5, flex: 1, backgroundColor: colors.border }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: 'row', paddingRight: 32 }}>
              {categoriasPendientesPago.map((cat: any) => {
                const paleta = getPaletaItem(cat.name, isDark);
                const colorUrgencia =
                  cat.urgencia === 'vencido' ? colors.expense :
                  cat.urgencia === 'urgente' ? colors.warning :
                  cat.urgencia === 'activo'  ? colors.primary :
                  colors.textSecondary;
                const borderUrgencia =
                  cat.urgencia === 'vencido' ? colors.expense :
                  cat.urgencia === 'urgente' ? colors.warning :
                  cat.urgencia === 'activo'  ? colors.primaryDark :
                  colors.border;
                const iconName = (cat.icon as any) || getCategoryIcon(cat.name);
                const dias = cat.diasRestantes !== null ? Math.abs(cat.diasRestantes) : 0;
                const diasLabel =
                  cat.urgencia === 'activo'    ? 'Presupuestado' :
                  cat.urgencia === 'vencido'   ? `Venció hace ${dias} día${dias !== 1 ? 's' : ''}` :
                  cat.diasRestantes === 0      ? 'Vence hoy' :
                  `Vence en ${dias} día${dias !== 1 ? 's' : ''}`;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => onNavigate('categorias')}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: colors.card,
                      borderWidth: 0.5,
                      borderColor: borderUrgencia,
                      borderRadius: 12,
                      padding: 10,
                      minWidth: 148,
                    }}
                  >
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: paleta.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={iconName} size={13} color={paleta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textPrimary }} numberOfLines={1}>{cat.name}</Text>
                      <Text style={{ fontSize: 10, color: colorUrgencia, marginTop: 1 }}>{diasLabel}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textPrimary }}>{fmtCOP(cat.budget ?? 0)}</Text>
                  </TouchableOpacity>
                );
              })}
              {(categories as any[]).filter((c: any) => c.isSelected && !c.pagado && c.tipo === 'gasto' && (c.budget ?? 0) > 0).length > 3 && (
                <TouchableOpacity
                  onPress={() => onNavigate('categorias')}
                  style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 10, minWidth: 72 }}
                >
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                    +{(categories as any[]).filter((c: any) => c.isSelected && !c.pagado && c.tipo === 'gasto' && (c.budget ?? 0) > 0).length - 3} más
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}

        {/* ── Activity feed ──────────────────────────────────────────── */}
        <View style={[s.sectionHeader, { marginTop: 8 }]}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Actividad reciente</Text>
          <TouchableOpacity onPress={() => onNavigate('historial')}>
            <Text style={[s.sectionLink, { color: colors.primary }]}>Ver todo</Text>
          </TouchableOpacity>
        </View>

        {txHoy.length === 0 && txAyer.length === 0 ? (
          <View style={s.emptyActivity}>
            <Icon name="inbox" size={32} color={colors.textTertiary} />
            <Text style={[s.emptyActivityTitle, { color: colors.textSecondary }]}>
              Sin actividad reciente
            </Text>
            <Text style={[s.emptyActivitySub, { color: colors.textTertiary }]}>
              Registra tu primer gasto del día
            </Text>
          </View>
        ) : (
          <>
            {txHoy.length > 0 && (
              <>
                <Text style={[s.groupLabel, { color: colors.textTertiary }]}>HOY</Text>
                {txHoy.map(renderTxItem)}
              </>
            )}
            {txAyer.length > 0 && (
              <>
                <Text style={[s.groupLabel, { color: colors.textTertiary }]}>AYER</Text>
                {txAyer.map(renderTxItem)}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── DrawerMenu ────────────────────────────────────────────────── */}
      <DrawerMenu
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onNavigate={(screen) => {
          setDrawerVisible(false);
          onNavigate(screen);
        }}
      />

      {/* ── QuickAddSheet ─────────────────────────────────────────────── */}
      <QuickAddSheet
        visible={quickAddVisible}
        mode={quickAddType}
        onClose={() => setQuickAddVisible(false)}
        onAdd={(amount, category, type, date) => {
          ctxAdd({
            id: Date.now().toString(),
            amount,
            category,
            type,
            date: date.toISOString(),
          });
          setQuickAddVisible(false);
        }}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 72,
  },
  heroTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  greetingWrap: {
    flex: 1,
    alignItems: 'center',
  },
  greetingText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  heroIconsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Balance
  balanceWrap: {
    marginTop: 28,
    alignItems: 'flex-start',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: -1,
    lineHeight: 50,
  },
  balanceMonth: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 10,
  },
  changeBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
  },

  // Segment bar
  segBarWrap: {
    flexDirection: 'row',
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
    marginTop: 14,
    gap: 2,
  },
  segSlice: {
    borderRadius: 3,
  },
  segLabelsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  segLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
  },

  // Daily pill
  dailyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  dailyPillText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },

  // CTA income
  ctaIngreso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  ctaIngresoText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },

  // Scroll body
  scrollBody: {
    flex: 1,
    marginTop: -40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 16,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickActionItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  quickActionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 10,
    fontWeight: '500',
  },

  // Finn insight
  insightCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 16,
  },
  insightRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  finnAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  finnLetter: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  insightContent: {
    flex: 1,
    gap: 4,
  },
  insightLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  insightText: {
    fontSize: 13,
    lineHeight: 20,
  },

  // Alert card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  alertIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Month pills
  monthScroll: {
    marginBottom: 16,
  },
  monthScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  monthPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  monthPillText: {
    fontSize: 12,
  },

  // Category card
  catCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 6,
  },
  catTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  catPct: {
    fontSize: 11,
    fontWeight: '600',
  },
  catAmountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  catSpent: {
    fontSize: 11,
  },
  catOf: {
    fontSize: 11,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },

  // Empty category
  emptyCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  emptyAction: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Group label
  groupLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingVertical: 8,
  },

  // Tx card
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 12,
    marginBottom: 2,
  },
  txIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txInfo: {
    flex: 1,
    gap: 2,
  },
  txName: {
    fontSize: 13,
    fontWeight: '500',
  },
  txSub: {
    fontSize: 11,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty activity
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyActivityTitle: {
    fontSize: 14,
  },
  emptyActivitySub: {
    fontSize: 12,
  },
});
