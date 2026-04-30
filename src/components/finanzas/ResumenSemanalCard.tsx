import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import { useFinance } from '../../state';
import { Icon } from '../ui/Icon';
import { computeWeeklyMetrics } from '../../services/WeeklyReportService';
import { THEME } from '../../constants/theme';

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

interface ResumenSemanalCardProps {
  onPress: () => void;
}

export function ResumenSemanalCard({ onPress }: ResumenSemanalCardProps) {
  const { transactions, categories, userLevel } = useFinance();

  const metrics = useMemo(
    () => computeWeeklyMetrics(transactions, categories, userLevel ?? null, 0),
    [transactions.length, categories.length, userLevel],
  );

  // Entrance animation
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // Week label shortened: "3–9 mar"
  const weekShort = (() => {
    const s = metrics.weekStart;
    const e = metrics.weekEnd;
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${s.getDate()}–${e.getDate()} ${months[e.getMonth()]}`;
  })();

  const diffPct    = Math.round(metrics.gastos.diffPercent);
  const diffPositive = diffPct > 0;
  const diffColor  = diffPositive ? THEME.colors.expense : THEME.colors.income;
  const diffLabel  = diffPositive ? `+${diffPct}%` : `${diffPct}%`;

  return (
    <Animated.View style={[
      styles.card,
      { transform: [{ translateY }], opacity },
    ]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <Icon name="bar-chart-2" size={16} color={THEME.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Semana {weekShort}</Text>
            <Text style={styles.subtitle}>Resumen semanal listo</Text>
          </View>
          <Icon name="chevron-right" size={18} color={THEME.colors.textTertiary} />
        </View>

        {/* Metric strip */}
        <View style={styles.strip}>
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Gastado</Text>
            <Text style={styles.stripValue}>{fmtCOP(metrics.totalSpent)}</Text>
          </View>
          <View style={styles.stripDivider} />
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Ahorrado</Text>
            <Text style={[styles.stripValue, { color: THEME.colors.income }]}>{fmtCOP(Math.max(0, metrics.totalSaved))}</Text>
          </View>
          <View style={styles.stripDivider} />
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>vs ant.</Text>
            <Text style={[styles.stripValue, { color: diffColor }]}>{diffLabel}</Text>
          </View>
        </View>

        {/* Finn preview */}
        <View style={styles.insightRow}>
          <View style={styles.finnMini}>
            <Text style={styles.finnMiniText}>F</Text>
          </View>
          <Text style={styles.insightText} numberOfLines={2}>{metrics.aiInsight}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 14,
    ...(Platform.OS !== 'web'
      ? { ...THEME.shadow.card }
      : {}),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    fontWeight: '400',
    marginTop: 1,
  },
  strip: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.background,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  stripItem: {
    flex: 1,
    alignItems: 'center',
  },
  stripDivider: {
    width: 0.5,
    backgroundColor: THEME.colors.border,
    marginVertical: 2,
  },
  stripLabel: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    fontWeight: '400',
    marginBottom: 2,
  },
  stripValue: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  finnMini: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finnMiniText: {
    fontSize: 10,
    fontWeight: '500',
    color: THEME.colors.surface,
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '400',
    lineHeight: 17,
  },
});
