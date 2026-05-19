import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useTheme } from '../../state/ThemeContext';

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  isUnlocked: boolean;
  unlockedDate?: string;
}

const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_expense', icon: '💰', title: 'Primer Gasto', description: 'Registra tu primer gasto en la aplicación', rarity: 'common', isUnlocked: true, unlockedDate: '2024-01-15' },
  { id: 'budget_hero', icon: '📊', title: 'Héroe del Presupuesto', description: 'Mantén tu presupuesto bajo control durante un mes completo', rarity: 'rare', isUnlocked: false },
  { id: 'savings_champion', icon: '🏆', title: 'Campeón de Ahorros', description: 'Ahorra 30% de tus ingresos durante 3 meses consecutivos', rarity: 'epic', isUnlocked: false },
  { id: 'financial_genius', icon: '🧠', title: 'Genio Financiero', description: 'Alcanza el nivel máximo en la aplicación', rarity: 'legendary', isUnlocked: false },
  { id: 'early_bird', icon: '🌅', title: 'Madrugador', description: 'Registra un gasto antes de las 8 AM durante 7 días seguidos', rarity: 'common', isUnlocked: true, unlockedDate: '2024-01-20' },
  { id: 'weekend_warrior', icon: '⚔️', title: 'Guerrero del Fin de Semana', description: 'Completa tu presupuesto sin superar límites un fin de semana', rarity: 'common', isUnlocked: false },
  { id: 'debt_slayer', icon: '🗡️', title: 'Cazador de Deudas', description: 'Paga una deuda completamente', rarity: 'rare', isUnlocked: false },
  { id: 'investment_guru', icon: '📈', title: 'Gurú de Inversiones', description: 'Invierte por primera vez a través de la aplicación', rarity: 'epic', isUnlocked: false },
];

const RARITY_COLORS: Record<Achievement['rarity'], string> = {
  common: '#6B7280', rare: '#3B82F6', epic: '#8B5CF6', legendary: '#F59E0B',
};

export const MyAchievements: React.FC = () => {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unlockedCount = ALL_ACHIEVEMENTS.filter(a => a.isUnlocked).length;
  const totalCount = ALL_ACHIEVEMENTS.length;
  const completionPercent = (unlockedCount / totalCount) * 100;

  const filtered = ALL_ACHIEVEMENTS.filter(a => {
    if (filter === 'unlocked') return a.isUnlocked;
    if (filter === 'locked') return !a.isUnlocked;
    return true;
  });

  return (
    <SafeAreaView style={[st.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={st.scroll}>
        <Text style={[st.title, { color: colors.textPrimary }]}>Logros</Text>

        {/* Stats */}
        <View style={st.statsRow}>
          {[{ label: 'Desbloqueados', value: `${unlockedCount}/${totalCount}` }, { label: 'Progreso', value: `${completionPercent.toFixed(0)}%` }].map(s => (
            <View key={s.label} style={[st.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[st.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
              <Text style={[st.statValue, { color: colors.primary }]}>{s.value}</Text>
            </View>
          ))}
        </View>

        {/* Progress bar */}
        <View style={[st.progressBg, { backgroundColor: colors.inputBg }]}>
          <View style={[st.progressFill, { width: `${completionPercent}%`, backgroundColor: colors.primary }]} />
        </View>

        {/* Filters */}
        <View style={st.filters}>
          {(['all', 'unlocked', 'locked'] as const).map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[st.filterBtn, { backgroundColor: filter === f ? colors.primary : colors.card, borderColor: filter === f ? colors.primary : colors.border }]}
            >
              <Text style={[st.filterLabel, { color: filter === f ? '#FFF' : colors.textSecondary }]}>
                {f === 'all' ? 'Todos' : f === 'unlocked' ? 'Desbloqueados' : 'Bloqueados'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Achievements */}
        {filtered.map(a => (
          <View key={a.id} style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: a.isUnlocked ? 1 : 0.55 }]}>
            <Text style={st.cardIcon}>{a.icon}</Text>
            <View style={st.cardInfo}>
              <Text style={[st.cardTitle, { color: colors.textPrimary }]}>{a.title}</Text>
              <Text style={[st.cardDesc, { color: colors.textSecondary }]}>{a.description}</Text>
              <View style={[st.rarity, { backgroundColor: RARITY_COLORS[a.rarity] + '22' }]}>
                <Text style={[st.rarityText, { color: RARITY_COLORS[a.rarity] }]}>{a.rarity}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 20 }}>{a.isUnlocked ? '✓' : '🔒'}</Text>
          </View>
        ))}

        {filtered.length === 0 && (
          <View style={st.empty}>
            <Text style={{ fontSize: 40 }}>🔒</Text>
            <Text style={[st.emptyText, { color: colors.textSecondary }]}>No hay logros en esta categoría</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  statsRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1 },
  statLabel: { fontSize: 12, fontWeight: '500' },
  statValue: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  progressBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  filters: { flexDirection: 'row', gap: 8 },
  filterBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  filterLabel: { fontSize: 12, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  cardIcon: { fontSize: 32 },
  cardInfo: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardDesc: { fontSize: 12, lineHeight: 17 },
  rarity: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  rarityText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyText: { fontSize: 14, fontWeight: '500' },
});
