import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable,
  StyleSheet, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { getBgIconoCategoria, getIconoCategoria } from '../utils/categoryUtils';
import { Category } from '../types';

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

interface PlanificarMesScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function PlanificarMesScreen({ visible, onClose }: PlanificarMesScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { categories, updateCategory } = useFinance();

  // Only top-level expense categories
  const cats = useMemo(
    () => categories.filter(c => c.isSelected && !c.parentCategoryId && c.tipo !== 'ingreso'),
    [categories],
  );

  // Local draft budgets: categoryId → string value
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    cats.forEach(c => { init[c.id] = c.budget ? String(c.budget) : ''; });
    return init;
  });

  const totalPlanificado = useMemo(() => {
    return cats.reduce((sum, c) => {
      const val = parseInt((drafts[c.id] ?? '').replace(/\./g, ''), 10);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [drafts, cats]);

  const handleChange = (id: string, raw: string) => {
    const digits = raw.replace(/\./g, '').replace(/[^0-9]/g, '');
    const n = parseInt(digits, 10);
    const formatted = isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.');
    setDrafts(prev => ({ ...prev, [id]: formatted }));
  };

  const handleSave = () => {
    cats.forEach(c => {
      const raw = (drafts[c.id] ?? '').replace(/\./g, '');
      const n = parseInt(raw, 10);
      const budget = isNaN(n) ? 0 : n;
      if (budget !== (c.budget ?? 0)) {
        updateCategory(c.id, { budget });
      }
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
            <Icon name="x" size={20} color={colors.textSecondary} />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={[s.headerLabel, { color: colors.textTertiary }]}>PLANIFICACIÓN</Text>
            <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Presupuesto del Mes</Text>
          </View>
          <Pressable onPress={handleSave} style={[s.saveBtn, { backgroundColor: colors.primary }]}>
            <Text style={s.saveBtnText}>Guardar</Text>
          </Pressable>
        </View>

        {/* Total chip */}
        <View style={[s.totalBar, { backgroundColor: colors.primaryLight }]}>
          <Text style={[s.totalLabel, { color: colors.primary }]}>Total planificado</Text>
          <Text style={[s.totalAmount, { color: colors.primary }]}>{fmtCOP(totalPlanificado)}</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {cats.map(c => {
            const { bg: iconBg, color: iconColor } = getBgIconoCategoria(c.name, isDark);
            const iconName = (c.icon as string) || getIconoCategoria(c.name);
            const val = drafts[c.id] ?? '';
            const num = parseInt(val.replace(/\./g, ''), 10);
            const isEmpty = !val || isNaN(num) || num === 0;

            return (
              <View key={c.id} style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.iconBox, { backgroundColor: iconBg }]}>
                  <Icon name={iconName as any} size={18} color={iconColor} />
                </View>
                <Text style={[s.catName, { color: colors.textPrimary }]} numberOfLines={1}>{c.name}</Text>
                <View style={[s.inputWrap, { borderColor: isEmpty ? colors.border : colors.primary, backgroundColor: colors.card }]}>
                  <Text style={[s.currencySign, { color: colors.textTertiary }]}>$</Text>
                  <TextInput
                    style={[s.input, { color: colors.textPrimary }]}
                    keyboardType="numeric"
                    value={val}
                    onChangeText={raw => handleChange(c.id, raw)}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    selectTextOnFocus
                  />
                </View>
              </View>
            );
          })}

          {cats.length === 0 && (
            <View style={s.emptyBox}>
              <Icon name="inbox" size={32} color={colors.textTertiary} />
              <Text style={[s.emptyText, { color: colors.textTertiary }]}>
                No hay categorías activas. Actívalas en la pantalla de categorías.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  closeBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
  },

  list: {
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  catName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 110,
  },
  currencySign: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 2,
  },
  input: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 80,
    padding: 0,
  },

  emptyBox: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 260,
  },
});
