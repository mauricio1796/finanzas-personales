import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '@/src/core/context/FinanceContext';

const formatCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

// ─── Static achievement definitions ────────────────────────────────────────
const ACHIEVEMENT_DEFS = [
  { type: 'first_transaction', icon: '💰', title: 'Primer Paso',       description: 'Registra tu primera transacción', rarity: 'common'    },
  { type: 'streak',            icon: '🔥', title: 'Racha de 7 días',   description: 'Registra gastos 7 días seguidos', rarity: 'rare'      },
  { type: 'budget_control',    icon: '📊', title: 'Héroe del Presupuesto', description: 'Mantén el presupuesto bajo control un mes', rarity: 'rare' },
  { type: 'savings_goal',      icon: '🏆', title: 'Meta de Ahorro',    description: 'Alcanza tu meta de ahorro', rarity: 'epic'          },
  { type: 'no_debt',           icon: '🗡️', title: 'Sin Deudas',        description: 'Paga todas tus deudas', rarity: 'epic'              },
  { type: 'custom',            icon: '🧠', title: 'Genio Financiero',  description: 'Alcanza el nivel máximo', rarity: 'legendary'       },
] as const;

const RARITY_COLORS: Record<string, string> = {
  common:    '#6B7280',
  rare:      '#3B82F6',
  epic:      '#8B5CF6',
  legendary: '#F59E0B',
};

const LEVEL_TITLES = ['Principiante', 'Aprendiz', 'Gestor', 'Experto', 'Inversionista'];

interface UsuarioProps {
  onLogout?: () => void;
  onReset?: () => void;
  onStartTour?: () => void;
}

export function Usuario({ onLogout, onReset, onStartTour }: UsuarioProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, userLevel, achievements, transactions, updateUserSalary, resetAll } = useFinance();
  const [isEditing, setIsEditing] = useState(false);
  const [editedSalary, setEditedSalary] = useState(user?.monthlySalary?.toString() || '');
  const [salaryFocused, setSalaryFocused] = useState(false);

  // Sync salary field when user data changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditedSalary(user?.monthlySalary ? Math.round(user.monthlySalary).toLocaleString('es-CO').replace(/,/g, '.') : '');
    }
  }, [user?.monthlySalary, isEditing]);

  const isSmall = width < 768;
  const px = isSmall ? 20 : 28;

  // XP progress
  const xpProgress  = userLevel ? (userLevel.experience % 1000) / 1000 : 0;
  const level       = userLevel?.level ?? 1;
  const title       = userLevel?.title ?? 'Principiante';
  const xpCurrent   = userLevel?.experience ?? 0;
  const xpNext      = level * 1000;

  // Achievements: merge static defs with unlocked data from context
  const unlockedTypes = new Set(achievements.filter(a => a.unclocked).map(a => a.type));
  const achievementRows = ACHIEVEMENT_DEFS.map(def => ({
    ...def,
    isUnlocked: unlockedTypes.has(def.type),
  }));
  const unlockedCount = achievementRows.filter(a => a.isUnlocked).length;

  const handleSave = () => {
    const _salNum = parseInt(editedSalary.replace(/\./g, ''), 10);
    if (editedSalary && isNaN(_salNum)) {
      Alert.alert('Error', 'El salario debe ser un número válido');
      return;
    }
    if (editedSalary) updateUserSalary(_salNum);
    setIsEditing(false);
  };

    const handleReset = () => {
    Alert.alert(
      'Reiniciar App',
      'Se borrarán todas tus transacciones, perfil, progreso y configuración. ¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reiniciar Todo',
          style: 'destructive',
          onPress: async () => {
            await resetAll();
            onReset?.();
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <View style={[styles.scroll, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.emptyText}>Por favor, inicia sesión primero</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingHorizontal: px }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>PERFIL</Text>
        <Text style={styles.headerTitle}>Mi Cuenta</Text>
      </View>

      {/* Avatar + name card */}
      <View style={styles.card}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{user.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.avatarInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Nv.{level} · {title}</Text>
            </View>
          </View>
        </View>

        {/* XP Bar */}
        <View style={styles.xpSection}>
          <View style={styles.xpLabelRow}>
            <Text style={styles.xpLabel}>EXPERIENCIA</Text>
            <Text style={styles.xpValue}>{xpCurrent} / {xpNext} XP</Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${xpProgress * 100}%` as any }]} />
          </View>
        </View>
      </View>

      {/* Profile fields */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Información</Text>
          {!isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Text style={styles.editLink}>Editar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>NOMBRE</Text>
          <Text style={styles.fieldValue}>{user.name}</Text>
        </View>
        <View style={[styles.fieldRow, styles.fieldRowBorder]}>
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <Text style={styles.fieldValue}>{user.email}</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>SALARIO MENSUAL</Text>
          {isEditing ? (
            <TextInput
              style={[styles.salaryInput, salaryFocused && styles.salaryInputFocused]}
              value={editedSalary}
              onChangeText={(txt) => { const d = txt.replace(/\./g, '').replace(/[^0-9]/g, ''); const n = parseInt(d, 10); setEditedSalary(isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.')); }}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              onFocus={() => setSalaryFocused(true)}
              onBlur={() => setSalaryFocused(false)}
            />
          ) : (
            <Text style={styles.fieldValue}>
              {user.monthlySalary ? formatCOP(user.monthlySalary) : 'No establecido'}
            </Text>
          )}
        </View>

        {isEditing && (
          <View style={styles.editButtons}>
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Guardar</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => {
              setEditedSalary(user.monthlySalary ? Math.round(user.monthlySalary).toLocaleString('es-CO').replace(/,/g, '.') : '');
              setIsEditing(false);
            }}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Stats summary */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderTopColor: '#6366F1' }]}>
          <Text style={styles.statValue}>{transactions.filter(t => t.type === 'income').length}</Text>
          <Text style={styles.statLabel}>Ingresos</Text>
        </View>
        <View style={[styles.statCard, { borderTopColor: '#EF4444' }]}>
          <Text style={[styles.statValue, { color: '#EF4444' }]}>{transactions.filter(t => t.type === 'expense').length}</Text>
          <Text style={styles.statLabel}>Gastos</Text>
        </View>
        <View style={[styles.statCard, { borderTopColor: '#10B981' }]}>
          <Text style={[styles.statValue, { color: '#10B981' }]}>{unlockedCount}</Text>
          <Text style={styles.statLabel}>Logros</Text>
        </View>
      </View>

      {/* Achievements */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Logros</Text>
          <Text style={styles.achieveCount}>{unlockedCount}/{achievementRows.length}</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.achieveTrack}>
          <View style={[styles.achieveFill, { width: `${(unlockedCount / achievementRows.length) * 100}%` as any }]} />
        </View>

        {achievementRows.map((ach, i) => (
          <View
            key={ach.type}
            style={[
              styles.achRow,
              i < achievementRows.length - 1 && styles.achRowBorder,
              !ach.isUnlocked && styles.achRowLocked,
            ]}
          >
            <View style={[styles.achIconCircle, ach.isUnlocked
              ? { backgroundColor: RARITY_COLORS[ach.rarity] + '22', borderColor: RARITY_COLORS[ach.rarity] }
              : styles.achIconCircleLocked
            ]}>
              <Text style={[styles.achIcon, !ach.isUnlocked && styles.achIconLocked]}>
                {ach.isUnlocked ? ach.icon : '🔒'}
              </Text>
            </View>
            <View style={styles.achInfo}>
              <Text style={[styles.achTitle, !ach.isUnlocked && styles.achTitleLocked]}>
                {ach.title}
              </Text>
              <Text style={styles.achDesc}>{ach.description}</Text>
            </View>
            <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS[ach.rarity] }]} />
          </View>
        ))}
      </View>

      {/* Tour button */}
      {onStartTour && (
        <Pressable style={styles.tourBtn} onPress={onStartTour}>
          <Text style={styles.tourBtnIcon}>🗺️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.tourBtnTitle}>Tour interactivo</Text>
            <Text style={styles.tourBtnSub}>Recorre las funciones principales</Text>
          </View>
          <Text style={styles.tourBtnArrow}>›</Text>
        </Pressable>
      )}

      {/* Logout */}
      <Pressable
        style={styles.logoutBtn}
        onPress={() => Alert.alert(
          'Cerrar Sesión',
          '¿Estás seguro?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Cerrar Sesión', onPress: onLogout, style: 'destructive' },
          ]
        )}
      >
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </Pressable>

      {/* Reset */}
      <Pressable
        style={styles.resetBtn}
        onPress={handleReset}
      >
        <Text style={styles.resetText}>Reiniciar App</Text>
      </Pressable>

            <View style={{ height: 16 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    paddingTop: 20,
    gap: 16,
  },

  header: {
    marginBottom: 4,
  },
  headerLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    } : {}),
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  editLink: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '600',
  },

  // Avatar
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  userEmail: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginTop: 4,
  },
  levelBadgeText: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '700',
  },

  // XP
  xpSection: {
    gap: 8,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  xpValue: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '700',
  },
  xpTrack: {
    height: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },

  // Fields
  fieldRow: {
    paddingVertical: 12,
    gap: 4,
  },
  fieldRowBorder: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    marginVertical: 0,
  },
  fieldLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  salaryInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
    backgroundColor: '#FAFAFA',
  },
  salaryInputFocused: {
    borderColor: '#6366F1',
    borderWidth: 2,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelBtnText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    alignItems: 'center',
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    } : {}),
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#6366F1',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },

  // Achievements
  achieveCount: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '700',
  },
  achieveTrack: {
    height: 5,
    backgroundColor: '#EEF2FF',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  achieveFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  achRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  achRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  achRowLocked: {
    opacity: 0.5,
  },
  achIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achIconCircleLocked: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  achIcon: {
    fontSize: 18,
  },
  achIconLocked: {
    fontSize: 16,
  },
  achInfo: {
    flex: 1,
    gap: 2,
  },
  achTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  achTitleLocked: {
    color: '#6B7280',
  },
  achDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Tour button
  tourBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    padding: 16,
    marginBottom: 12,
  },
  tourBtnIcon: { fontSize: 24 },
  tourBtnTitle: { fontSize: 14, fontWeight: '700', color: '#4338CA' },
  tourBtnSub: { fontSize: 12, color: '#6366F1', marginTop: 1 },
  tourBtnArrow: { fontSize: 20, color: '#6366F1', fontWeight: '300' },

  // Logout
  logoutBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },

  resetBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resetText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },

  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
