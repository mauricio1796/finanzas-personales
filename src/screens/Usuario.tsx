import React, { useState, useEffect } from 'react';
import {
  StyleSheet, TextInput, Pressable, View, Text,
  ScrollView, TouchableOpacity, useWindowDimensions, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '@/src/core/context/FinanceContext';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';

const formatCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

const ACHIEVEMENT_DEFS = [
  { type: 'first_transaction', icon: '💰', title: 'Primer Paso',           description: 'Registra tu primera transacción',           rarity: 'common'    },
  { type: 'streak',            icon: '🔥', title: 'Racha de 7 días',       description: 'Registra gastos 7 días seguidos',            rarity: 'rare'      },
  { type: 'budget_control',    icon: '📊', title: 'Héroe del Presupuesto', description: 'Mantén el presupuesto bajo control un mes',   rarity: 'rare'      },
  { type: 'savings_goal',      icon: '🏆', title: 'Meta de Ahorro',        description: 'Alcanza tu meta de ahorro',                  rarity: 'epic'      },
  { type: 'no_debt',           icon: '🗡️', title: 'Sin Deudas',            description: 'Paga todas tus deudas',                      rarity: 'epic'      },
  { type: 'custom',            icon: '🧠', title: 'Genio Financiero',      description: 'Alcanza el nivel máximo',                    rarity: 'legendary' },
] as const;

const RARITY_HEX: Record<string, string> = {
  common:    '#6B7280',
  rare:      '#3B82F6',
  epic:      '#8B5CF6',
  legendary: '#F59E0B',
};

interface UsuarioProps {
  onLogout?: () => void;
  onReset?: () => void;
  onStartTour?: () => void;
  onNavigate?: (screen: string) => void;
}

export function Usuario({ onLogout, onReset, onStartTour, onNavigate }: UsuarioProps) {
  const { width }  = useWindowDimensions();
  const insets     = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, userLevel, achievements, transactions, updateUserSalary, resetAll } = useFinance();

  const [isEditing, setIsEditing]   = useState(false);
  const [editedSalary, setEditedSalary] = useState(user?.monthlySalary?.toString() || '');
  const [salaryFocused, setSalaryFocused] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setEditedSalary(user?.monthlySalary ? Math.round(user.monthlySalary).toLocaleString('es-CO').replace(/,/g, '.') : '');
    }
  }, [user?.monthlySalary, isEditing]);

  const px = width < 768 ? 20 : 28;

  const xpProgress = userLevel ? (userLevel.experience % 1000) / 1000 : 0;
  const level      = userLevel?.level ?? 1;
  const title      = userLevel?.title ?? 'Principiante';
  const xpCurrent  = userLevel?.experience ?? 0;
  const xpNext     = level * 1000;

  const unlockedTypes   = new Set(achievements.filter(a => a.unclocked).map(a => a.type));
  const achievementRows = ACHIEVEMENT_DEFS.map(def => ({ ...def, isUnlocked: unlockedTypes.has(def.type) }));
  const unlockedCount   = achievementRows.filter(a => a.isUnlocked).length;

  const handleSave = () => {
    const n = parseInt(editedSalary.replace(/\./g, ''), 10);
    if (editedSalary && isNaN(n)) { Alert.alert('Error', 'El salario debe ser un número válido'); return; }
    if (editedSalary) updateUserSalary(n);
    setIsEditing(false);
  };

  const handleReset = () => {
    Alert.alert(
      'Reiniciar App',
      'Se borrarán todas tus transacciones, perfil, progreso y configuración. ¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reiniciar Todo', style: 'destructive', onPress: async () => { await resetAll(); onReset?.(); } },
      ],
    );
  };

  if (!user) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textTertiary, fontSize: 15 }}>Por favor, inicia sesión primero</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingHorizontal: px }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerLabel, { color: colors.textTertiary }]}>PERFIL</Text>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Mi Cuenta</Text>
      </View>

      {/* Avatar + name */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarLetter, { color: colors.textInverse }]}>{user.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.avatarInfo}>
            <Text style={[styles.userName, { color: colors.textPrimary }]}>{user.name}</Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
            <View style={[styles.levelBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.levelBadgeText, { color: colors.primary }]}>Nv.{level} · {title}</Text>
            </View>
          </View>
        </View>

        <View style={styles.xpSection}>
          <View style={styles.xpLabelRow}>
            <Text style={[styles.xpLabel, { color: colors.textTertiary }]}>EXPERIENCIA</Text>
            <Text style={[styles.xpValue, { color: colors.primary }]}>{xpCurrent} / {xpNext} XP</Text>
          </View>
          <View style={[styles.xpTrack, { backgroundColor: colors.primaryLight }]}>
            <View style={[styles.xpFill, { width: `${xpProgress * 100}%` as any, backgroundColor: colors.primary }]} />
          </View>
        </View>
      </View>

      {/* Profile fields */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Información</Text>
          {!isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Text style={[styles.editLink, { color: colors.primary }]}>Editar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>NOMBRE</Text>
          <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{user.name}</Text>
        </View>
        <View style={[styles.fieldRow, { borderTopColor: colors.divider, borderBottomColor: colors.divider, borderTopWidth: 1, borderBottomWidth: 1 }]}>
          <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>EMAIL</Text>
          <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{user.email}</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>SALARIO MENSUAL</Text>
          {isEditing ? (
            <TextInput
              style={[
                styles.salaryInput,
                { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg },
                salaryFocused && { borderColor: colors.primary, borderWidth: 2 },
              ]}
              value={editedSalary}
              onChangeText={txt => {
                const d = txt.replace(/\./g, '').replace(/[^0-9]/g, '');
                const n = parseInt(d, 10);
                setEditedSalary(isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.'));
              }}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              onFocus={() => setSalaryFocused(true)}
              onBlur={() => setSalaryFocused(false)}
            />
          ) : (
            <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>
              {user.monthlySalary ? formatCOP(user.monthlySalary) : 'No establecido'}
            </Text>
          )}
        </View>

        {isEditing && (
          <View style={styles.editButtons}>
            <Pressable style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Text style={[styles.saveBtnText, { color: colors.textInverse }]}>Guardar</Text>
            </Pressable>
            <Pressable
              style={[styles.cancelBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
              onPress={() => { setEditedSalary(user.monthlySalary ? Math.round(user.monthlySalary).toLocaleString('es-CO').replace(/,/g, '.') : ''); setIsEditing(false); }}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { label: 'Ingresos', value: transactions.filter(t => t.type === 'income').length,  color: colors.primary  },
          { label: 'Gastos',   value: transactions.filter(t => t.type === 'expense').length, color: colors.expense  },
          { label: 'Logros',   value: unlockedCount,                                          color: colors.income   },
        ].map(s => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderTopColor: s.color }]}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Achievements */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Logros</Text>
          <Text style={[styles.achieveCount, { color: colors.primary }]}>{unlockedCount}/{achievementRows.length}</Text>
        </View>
        <View style={[styles.achieveTrack, { backgroundColor: colors.primaryLight }]}>
          <View style={[styles.achieveFill, { width: `${(unlockedCount / achievementRows.length) * 100}%` as any, backgroundColor: colors.primary }]} />
        </View>
        {achievementRows.map((ach, i) => (
          <View
            key={ach.type}
            style={[
              styles.achRow,
              i < achievementRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider },
              !ach.isUnlocked && styles.achRowLocked,
            ]}
          >
            <View style={[
              styles.achIconCircle,
              ach.isUnlocked
                ? { backgroundColor: RARITY_HEX[ach.rarity] + '22', borderColor: RARITY_HEX[ach.rarity] }
                : { backgroundColor: colors.inputBg, borderColor: colors.border },
            ]}>
              <Text style={styles.achIcon}>{ach.isUnlocked ? ach.icon : '🔒'}</Text>
            </View>
            <View style={styles.achInfo}>
              <Text style={[styles.achTitle, { color: ach.isUnlocked ? colors.textPrimary : colors.textSecondary }]}>{ach.title}</Text>
              <Text style={[styles.achDesc, { color: colors.textTertiary }]}>{ach.description}</Text>
            </View>
            <View style={[styles.rarityDot, { backgroundColor: RARITY_HEX[ach.rarity] }]} />
          </View>
        ))}
      </View>

      {/* Tour */}
      {onStartTour && (
        <Pressable style={[styles.tourBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primaryDark + '55' }]} onPress={onStartTour}>
          <Text style={styles.tourBtnIcon}>🗺️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tourBtnTitle, { color: colors.primaryText }]}>Tour interactivo</Text>
            <Text style={[styles.tourBtnSub, { color: colors.primary }]}>Recorre las funciones principales</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
      )}

      {/* Apariencia */}
      <TouchableOpacity
        style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => onNavigate?.('configuracion')}
        activeOpacity={0.8}
      >
        <View style={[styles.settingIcon, { backgroundColor: colors.primaryLight }]}>
          <Icon name="moon" size={16} color={colors.primary} />
        </View>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Apariencia</Text>
        <Icon name="chevron-right" size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      {/* Logout */}
      <Pressable
        style={[styles.logoutBtn, { backgroundColor: colors.dangerLight, borderColor: colors.danger + '55' }]}
        onPress={() => Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar Sesión', onPress: onLogout, style: 'destructive' },
        ])}
      >
        <Text style={[styles.logoutText, { color: colors.danger }]}>Cerrar Sesión</Text>
      </Pressable>

      {/* Reset */}
      <Pressable
        style={[styles.resetBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
        onPress={handleReset}
      >
        <Text style={[styles.resetText, { color: colors.textSecondary }]}>Reiniciar App</Text>
      </Pressable>

      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 20, gap: 16 },
  header: { marginBottom: 4 },
  headerLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 1.2 },
  headerTitle: { fontSize: 22, fontWeight: '500' },

  card: {
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 20,
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 } : {}),
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '500' },
  editLink:  { fontSize: 13, fontWeight: '500' },

  avatarRow:   { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  avatar:      { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 26, fontWeight: '500' },
  avatarInfo:  { flex: 1, gap: 4 },
  userName:    { fontSize: 18, fontWeight: '500' },
  userEmail:   { fontSize: 13, fontWeight: '400' },
  levelBadge:  { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, marginTop: 4 },
  levelBadgeText: { fontSize: 11, fontWeight: '500' },

  xpSection:  { gap: 8 },
  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpLabel:    { fontSize: 10, fontWeight: '500', letterSpacing: 0.8 },
  xpValue:    { fontSize: 11, fontWeight: '500' },
  xpTrack:    { height: 6, borderRadius: 3, overflow: 'hidden' },
  xpFill:     { height: '100%', borderRadius: 3 },

  fieldRow:    { paddingVertical: 12, gap: 4 },
  fieldLabel:  { fontSize: 10, fontWeight: '500', letterSpacing: 0.8 },
  fieldValue:  { fontSize: 15, fontWeight: '500' },
  salaryInput: { marginTop: 4, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15, fontWeight: '500' },
  editButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  saveBtn:     { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '500' },
  cancelBtn:   { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  cancelBtnText: { fontSize: 14, fontWeight: '500' },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderTopWidth: 3,
    borderWidth: 0.5,
    padding: 14,
    alignItems: 'center',
    ...(Platform.OS !== 'web' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 } : {}),
  },
  statValue: { fontSize: 22, fontWeight: '500', marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: '400' },

  achieveCount: { fontSize: 13, fontWeight: '500' },
  achieveTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  achieveFill:  { height: '100%', borderRadius: 3 },
  achRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  achRowLocked: { opacity: 0.5 },
  achIconCircle:{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  achIcon:      { fontSize: 18 },
  achInfo:      { flex: 1, gap: 2 },
  achTitle:     { fontSize: 14, fontWeight: '500' },
  achDesc:      { fontSize: 12, fontWeight: '400' },
  rarityDot:    { width: 8, height: 8, borderRadius: 4 },

  tourBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, borderWidth: 0.5, padding: 16,
  },
  tourBtnIcon:  { fontSize: 24 },
  tourBtnTitle: { fontSize: 14, fontWeight: '500' },
  tourBtnSub:   { fontSize: 12, fontWeight: '400', marginTop: 1 },

  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 0.5, padding: 14,
  },
  settingIcon:  { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, fontSize: 14, fontWeight: '500' },

  logoutBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 0.5 },
  logoutText: { fontSize: 15, fontWeight: '500' },
  resetBtn:  { paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 0.5 },
  resetText: { fontSize: 15, fontWeight: '500' },
});
