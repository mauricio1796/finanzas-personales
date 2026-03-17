import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import { useFinance } from '../../state';
import { Icon } from '../ui/Icon';
import { computeWeeklyMetrics } from '../../services/WeeklyReportService';

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
  const diffColor  = diffPositive ? '#EF4444' : '#10B981';
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
            <Icon name="bar-chart-2" size={16} color="#6366F1" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Semana {weekShort}</Text>
            <Text style={styles.subtitle}>Resumen semanal listo</Text>
          </View>
          <Icon name="chevron-right" size={18} color="#9CA3AF" />
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
            <Text style={[styles.stripValue, { color: '#10B981' }]}>{fmtCOP(Math.max(0, metrics.totalSaved))}</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    ...(Platform.OS !== 'web'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }
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
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  subtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '400',
    marginTop: 1,
  },
  strip: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
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
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  stripLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '400',
    marginBottom: 2,
  },
  stripValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
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
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finnMiniText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
    lineHeight: 17,
  },
});
