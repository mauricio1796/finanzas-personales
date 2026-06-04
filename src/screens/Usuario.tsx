import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, TextInput, Pressable, View, Text,
  TouchableOpacity, useWindowDimensions,
  Alert, Platform, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '@/src/core/context/FinanceContext';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { THEME } from '../constants/theme';

const formatCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

const HEADER_EXPANDED = 240;
const HEADER_COLLAPSED = 88;
const COLLAPSE_AT = 130;

interface UsuarioProps {
  onReset?: () => void;
  onStartTour?: () => void;
  onNavigate?: (screen: string) => void;
}

export function Usuario({ onReset, onStartTour, onNavigate }: UsuarioProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, userLevel, achievements, transactions, updateUserSalary, resetAll } = useFinance();

  const [isEditing, setIsEditing] = useState(false);
  const [editedSalary, setEditedSalary] = useState(user?.monthlySalary?.toString() || '');
  const [salaryFocused, setSalaryFocused] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isEditing) {
      setEditedSalary(
        user?.monthlySalary
          ? Math.round(user.monthlySalary).toLocaleString('es-CO').replace(/,/g, '.')
          : '',
      );
    }
  }, [user?.monthlySalary, isEditing]);

  const px = width < 768 ? 20 : 28;

  const xpProgress = userLevel ? (userLevel.experience % 1000) / 1000 : 0;
  const level = userLevel?.level ?? 1;
  const title = userLevel?.title ?? 'Principiante';
  const xpCurrent = userLevel?.experience ?? 0;
  const xpNext = level * 1000;

  const unlockedCount = achievements.filter(a => a.unclocked).length;

  // Monthly transactions
  const now = new Date();
  const monthlyTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyIncome = monthlyTxs
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const monthlyExpense = monthlyTxs
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const monthlyBalance = monthlyIncome - monthlyExpense;

  const handleSave = () => {
    const n = parseInt(editedSalary.replace(/\./g, ''), 10);
    if (editedSalary && isNaN(n)) { Alert.alert('Error', 'El salario debe ser un número válido'); return; }
    if (editedSalary) updateUserSalary(n);
    setIsEditing(false);
  };

  const handleReset = () => {
    if (Platform.OS === 'web') {
      const ok = window.confirm('Se borrarán todas tus transacciones, perfil, progreso y configuración. ¿Estás seguro?');
      if (ok) { resetAll().then(() => onReset?.()); }
      return;
    }
    Alert.alert(
      'Reiniciar App',
      'Se borrarán todas tus transacciones, perfil, progreso y configuración. ¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reiniciar Todo', style: 'destructive', onPress: async () => { await resetAll(); onReset?.(); } },
      ],
    );
  };

  const exportToCSV = async () => {
    try {
      const FileSystem = (await import('expo-file-system' as any)) as any;
      const Sharing = (await import('expo-sharing' as any)) as any;

      const header = 'Fecha,Tipo,Categoria,Monto,Descripcion\n';
      const rows = transactions.map(t => {
        const date = new Date(t.date).toLocaleDateString('es-CO');
        const type = t.type === 'income' ? 'Ingreso' : 'Gasto';
        const cat = (t.category ?? '').replace(/,/g, ';');
        const amount = Math.round(t.amount);
        const desc = ((t as any).description ?? '').replace(/,/g, ';');
        return `${date},${type},${cat},${amount},${desc}`;
      }).join('\n');

      const csv = header + rows;
      const path = (FileSystem.documentDirectory as string) + 'financy_export.csv';
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Exportar transacciones' });
    } catch {
      Alert.alert('Exportar datos', 'No fue posible exportar. Verifica que expo-file-system y expo-sharing esten instalados.');
    }
  };

  // Animated interpolations
  const headerHeight = scrollY.interpolate({
    inputRange: [0, COLLAPSE_AT],
    outputRange: [HEADER_EXPANDED + insets.top, HEADER_COLLAPSED + insets.top],
    extrapolate: 'clamp',
  });

  const detailsOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_AT * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const avatarSize = scrollY.interpolate({
    inputRange: [0, COLLAPSE_AT],
    outputRange: [76, 36],
    extrapolate: 'clamp',
  });

  const avatarTranslateX = scrollY.interpolate({
    inputRange: [0, COLLAPSE_AT],
    outputRange: [0, -(width / 2 - 58 - px)],
    extrapolate: 'clamp',
  });

  const avatarTranslateY = scrollY.interpolate({
    inputRange: [0, COLLAPSE_AT],
    outputRange: [0, -28],
    extrapolate: 'clamp',
  });

  const nameFontSize = scrollY.interpolate({
    inputRange: [0, COLLAPSE_AT],
    outputRange: [20, 16],
    extrapolate: 'clamp',
  });

  const nameTranslateX = scrollY.interpolate({
    inputRange: [0, COLLAPSE_AT],
    outputRange: [0, -(width / 2 - 120 - px)],
    extrapolate: 'clamp',
  });

  const nameTranslateY = scrollY.interpolate({
    inputRange: [0, COLLAPSE_AT],
    outputRange: [0, -56],
    extrapolate: 'clamp',
  });

  if (!user) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textTertiary, fontSize: 15 }}>Por favor, inicia sesión primero</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Sticky Animated Header */}
      <Animated.View
        style={[
          styles.stickyHeader,
          { height: headerHeight, backgroundColor: colors.primary, paddingTop: insets.top },
        ]}
        pointerEvents="none"
      >
        {/* Decorative circles */}
        <View style={[styles.deco1, { backgroundColor: 'rgba(255,255,255,0.07)' }]} />
        <View style={[styles.deco2, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
        <View style={[styles.deco3, { backgroundColor: 'rgba(255,255,255,0.09)' }]} />
        <View style={[styles.deco4, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />

        {/* Avatar */}
        <Animated.View
          style={[
            styles.avatarWrap,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: 999,
              transform: [{ translateX: avatarTranslateX }, { translateY: avatarTranslateY }],
            },
          ]}
        >
          <Animated.Text
            style={[
              styles.avatarLetter,
              {
                fontSize: scrollY.interpolate({ inputRange: [0, COLLAPSE_AT], outputRange: [32, 16], extrapolate: 'clamp' }),
              },
            ]}
          >
            {user.name.charAt(0).toUpperCase()}
          </Animated.Text>
        </Animated.View>

        {/* Name */}
        <Animated.Text
          style={[
            styles.headerName,
            {
              fontSize: nameFontSize,
              transform: [{ translateX: nameTranslateX }, { translateY: nameTranslateY }],
            },
          ]}
        >
          {user.name}
        </Animated.Text>

        {/* Collapsible details */}
        <Animated.View style={[styles.headerDetails, { opacity: detailsOpacity }]}>
          <Text style={styles.headerEmail}>{user.email}</Text>
          <View style={styles.levelPill}>
            <Text style={styles.levelPillText}>Nv.{level} · {title}</Text>
          </View>
          <View style={styles.xpSection}>
            <View style={styles.xpLabelRow}>
              <Text style={styles.xpLabel}>EXPERIENCIA</Text>
              <Text style={styles.xpValue}>{xpCurrent}/{xpNext} XP</Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${xpProgress * 100}%` as any }]} />
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Scrollable content */}
      <Animated.ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: px, paddingTop: HEADER_EXPANDED + insets.top + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
      >
        {/* Monthly summary card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardTitleRow}>
            <Icon name="trending-up" size={16} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary, marginLeft: 8 }]}>Resumen Financiero</Text>
          </View>
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Ingresos del mes</Text>
              <Text style={[styles.metricValue, { color: colors.income }]}>{formatCOP(monthlyIncome)}</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.metric}>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Gastos del mes</Text>
              <Text style={[styles.metricValue, { color: colors.expense }]}>{formatCOP(monthlyExpense)}</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.metric}>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Balance</Text>
              <Text style={[styles.metricValue, { color: monthlyBalance >= 0 ? colors.income : colors.expense }]}>
                {formatCOP(monthlyBalance)}
              </Text>
            </View>
          </View>
        </View>

        {/* Personal info card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Información Personal</Text>
            {!isEditing && (
              <TouchableOpacity
                style={[styles.editPill, { backgroundColor: colors.primaryLight }]}
                onPress={() => setIsEditing(true)}
              >
                <Text style={[styles.editPillText, { color: colors.primary }]}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Nombre */}
          <View style={styles.fieldRow}>
            <View style={[styles.fieldIconCircle, { backgroundColor: colors.primaryLight }]}>
              <Icon name="user" size={16} color={colors.primary} />
            </View>
            <View style={styles.fieldInfo}>
              <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>NOMBRE</Text>
              <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{user.name}</Text>
            </View>
          </View>

          <View style={[styles.fieldDivider, { backgroundColor: colors.divider }]} />

          {/* Email */}
          <View style={styles.fieldRow}>
            <View style={[styles.fieldIconCircle, { backgroundColor: colors.primaryLight }]}>
              <Icon name="mail" size={16} color={colors.primary} />
            </View>
            <View style={styles.fieldInfo}>
              <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>EMAIL</Text>
              <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{user.email}</Text>
            </View>
          </View>

          <View style={[styles.fieldDivider, { backgroundColor: colors.divider }]} />

          {/* Salario */}
          <View style={styles.fieldRow}>
            <View style={[styles.fieldIconCircle, { backgroundColor: colors.primaryLight }]}>
              <Icon name="credit-card" size={16} color={colors.primary} />
            </View>
            <View style={styles.fieldInfo}>
              <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>SALARIO MENSUAL</Text>
              {isEditing ? (
                <TextInput
                  style={[
                    styles.salaryInput,
                    { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg },
                    salaryFocused && { borderColor: colors.primary, borderWidth: 1.5 },
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
          </View>

          {isEditing && (
            <View style={styles.editButtons}>
              <Pressable style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                <Text style={[styles.saveBtnText, { color: '#fff' }]}>Guardar</Text>
              </Pressable>
              <Pressable
                style={[styles.cancelBtn, { backgroundColor: 'transparent', borderColor: colors.border }]}
                onPress={() => {
                  setEditedSalary(
                    user.monthlySalary
                      ? Math.round(user.monthlySalary).toLocaleString('es-CO').replace(/,/g, '.')
                      : '',
                  );
                  setIsEditing(false);
                }}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Ingresos', value: transactions.filter(t => t.type === 'income').length, icon: 'trending-up', color: colors.income },
            { label: 'Gastos',   value: transactions.filter(t => t.type === 'expense').length, icon: 'trending-down', color: colors.expense },
            { label: 'Logros',   value: `${unlockedCount} de 6`, icon: 'trophy', color: colors.primary },
          ].map((s, i) => (
            <View
              key={s.label}
              style={[
                styles.statCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                i < 2 && { marginRight: 10 },
              ]}
            >
              <View style={[styles.statIconCircle, { backgroundColor: s.color + '1F' }]}>
                <Icon name={s.icon as any} size={14} color={s.color} />
              </View>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Config section label */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>CONFIGURACIÓN</Text>

        {/* Tour row */}
        {onStartTour && (
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onStartTour}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryLight }]}>
              <Text style={{ fontSize: 16 }}>🗺️</Text>
            </View>
            <View style={styles.actionInfo}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>Tour interactivo</Text>
              <Text style={[styles.actionSub, { color: colors.textTertiary }]}>Descubre las funciones</Text>
            </View>
            <Icon name="chevron-right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        )}

        {/* Apariencia row */}
        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => onNavigate?.('configuracion')}
          activeOpacity={0.75}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryLight }]}>
            <Icon name="moon" size={16} color={colors.primary} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>Apariencia</Text>
            <Text style={[styles.actionSub, { color: colors.textTertiary }]}>Tema y personalización</Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Exportar row */}
        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={exportToCSV}
          activeOpacity={0.75}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryLight }]}>
            <Icon name="download" size={16} color={colors.primary} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>Exportar datos</Text>
            <Text style={[styles.actionSub, { color: colors.textTertiary }]}>Descarga tus transacciones</Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Danger zone */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 8 }]}>CUENTA</Text>

        <View style={[styles.dangerCard, { backgroundColor: colors.card, borderColor: colors.danger + '33' }]}>
          {/* Reset */}
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={handleReset}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: colors.dangerLight }]}>
              <Icon name="trash-2" size={16} color={colors.danger} />
            </View>
            <Text style={[styles.dangerRowText, { color: colors.danger }]}>Reiniciar App</Text>
            <Icon name="chevron-right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </Animated.ScrollView>
    </View>
  );
}

const CARD_SHADOW = Platform.OS !== 'web'
  ? { ...THEME.shadow.card }
  : {};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 16 },

  // Sticky header
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  deco1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, top: -40, right: -30 },
  deco2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, bottom: 20, left: -20 },
  deco3: { position: 'absolute', width: 80, height: 80, borderRadius: 40, top: 30, left: 40 },
  deco4: { position: 'absolute', width: 120, height: 120, borderRadius: 60, bottom: -30, right: 60 },

  avatarWrap: {
    marginTop: 28,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    ...(Platform.OS !== 'web'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6 }
      : {}),
  },
  avatarLetter: { color: '#fff', fontWeight: '700' },

  headerName: { color: '#fff', fontWeight: '600', marginTop: 10 },
  headerEmail: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },

  headerDetails: { alignItems: 'center', width: '100%', paddingHorizontal: 32 },

  levelPill: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  levelPillText: { color: '#fff', fontSize: 12, fontWeight: '500' },

  xpSection: { width: '100%', marginTop: 14, gap: 6 },
  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  xpLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '500', letterSpacing: 0.8 },
  xpValue: { color: '#fff', fontSize: 11, fontWeight: '500' },
  xpTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },

  // Cards
  card: {
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    padding: 20,
    ...CARD_SHADOW,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  editPill: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.pill,
  },
  editPillText: { fontSize: 12, fontWeight: '500' },

  // Monthly metrics
  metricsRow: { flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, alignItems: 'center', gap: 4 },
  metricLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.8, textAlign: 'center' },
  metricValue: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  metricDivider: { width: 1, height: 36, alignSelf: 'center' },

  // Fields
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  fieldDivider: { height: 1 },
  fieldIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldInfo: { flex: 1, gap: 3 },
  fieldLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.8 },
  fieldValue: { fontSize: 15, fontWeight: '500' },
  salaryInput: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  editButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: THEME.radius.md, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '600' },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: THEME.radius.md, alignItems: 'center', borderWidth: 1.5 },
  cancelBtnText: { fontSize: 14, fontWeight: '500' },

  // Stats row
  statsRow: { flexDirection: 'row' },
  statCard: {
    flex: 1,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    ...CARD_SHADOW,
  },
  statIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '400' },

  // Section label
  sectionLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: -4 },

  // Action rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    ...CARD_SHADOW,
  }, // borderRadius 14 is between md(12) and lg(20)
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInfo: { flex: 1, gap: 2 },
  actionTitle: { fontSize: 14, fontWeight: '500' },
  actionSub: { fontSize: 12, fontWeight: '400' },

  // Danger card
  dangerCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
  },
  dangerRowText: { flex: 1, fontSize: 14, fontWeight: '500' },
});
