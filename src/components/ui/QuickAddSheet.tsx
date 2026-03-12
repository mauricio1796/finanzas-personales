import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useFinance } from '../../state';
import { Icon, getCategoryIcon } from './Icon';

// ─── Quick categories ──────────────────────────────────────────────────
const INCOME_CATS = [
  { id: 'salario',      label: 'Salario'     },
  { id: 'freelance',    label: 'Freelance'   },
  { id: 'negocio',      label: 'Negocio'     },
  { id: 'inversiones',  label: 'Inversiones' },
  { id: 'otros',        label: 'Otros'       },
];

const EXPENSE_CATS = [
  { id: 'alimentacion',    label: 'Alimentación' },
  { id: 'transporte',      label: 'Transporte'   },
  { id: 'servicios',       label: 'Servicios'    },
  { id: 'arriendo',        label: 'Arriendo'     },
  { id: 'salud',           label: 'Salud'        },
  { id: 'entretenimiento', label: 'Entrete.'     },
  { id: 'ropa',            label: 'Ropa'         },
  { id: 'otros',           label: 'Otros'        },
];

interface QuickAddSheetProps {
  visible: boolean;
  mode: 'income' | 'expense';
  onClose: () => void;
  onAdd: (amount: number, category: string, type: 'income' | 'expense', date: Date) => void;
}

export const QuickAddSheet: React.FC<QuickAddSheetProps> = ({ visible, mode, onClose, onAdd }) => {
  const { categories } = useFinance();
  const slideAnim  = useRef(new Animated.Value(400)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;

  const [amount, setAmount] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [amountFocused, setAmountFocused] = useState(false);

  const isIncome = mode === 'income';
  const accent   = isIncome ? '#10B981' : '#EF4444';
  const accentBg = isIncome ? '#ECFDF5' : '#FEF2F2';
  // Use user budget categories for expenses if available, fallback to defaults
  const userExpCats = !isIncome
    ? categories.map((cat: any) => ({ id: cat.id, label: cat.name }))
    : [];
  const cats = isIncome ? INCOME_CATS : (userExpCats.length > 0 ? userExpCats : EXPENSE_CATS);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setSelectedCat(cats[0]?.id ?? null);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 250, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleConfirm = () => {
    const parsed = parseInt(amount.replace(/\./g, ''), 10);
    if (!parsed || parsed <= 0 || !selectedCat) return;
    onAdd(parsed, selectedCat, mode, new Date());
    handleClose();
  };

  const canConfirm = !!amount && parseInt(amount.replace(/\./g, ''), 10) > 0 && !!selectedCat;

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.kavContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Backdrop — cierra al tocar fuera */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOp }]} />
        </TouchableWithoutFeedback>

        {/* Sheet — sube automáticamente con el teclado */}
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={[styles.modeTag, { backgroundColor: accentBg }]}>
              <Text style={[styles.modeTagText, { color: accent }]}>
                {isIncome ? '↑ Ingreso' : '↓ Gasto'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Icon name="x" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Amount input */}
          <View style={styles.amountRow}>
            <Text style={[styles.currencySymbol, { color: accent }]}>$</Text>
            <TextInput
              style={[styles.amountInput, { color: accent, borderBottomColor: amountFocused ? accent : '#E5E7EB' }]}
              placeholder="0"
              placeholderTextColor="#D1D5DB"
              keyboardType="numeric"
              value={amount}
              onChangeText={(txt) => { const d = txt.replace(/\./g, '').replace(/[^0-9]/g, ''); const n = parseInt(d, 10); setAmount(isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.')); }}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
            />
          </View>

          {/* Category chips */}
          <Text style={styles.catLabel}>CATEGORÍA</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catScroll}
            keyboardShouldPersistTaps="handled"
          >
            {cats.map(cat => {
              const active = selectedCat === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, active && { backgroundColor: accent, borderColor: accent }]}
                  onPress={() => setSelectedCat(cat.id)}
                  activeOpacity={0.7}
                >
                  <Icon name={getCategoryIcon(cat.id)} size={15} color={active ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[styles.catChipLabel, active && styles.catChipLabelActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Confirm button */}
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: canConfirm ? accent : '#E5E7EB' }]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.8}
          >
            <Text style={[styles.confirmBtnText, !canConfirm && styles.confirmBtnTextDisabled]}>
              {isIncome ? 'Registrar Ingreso' : 'Registrar Gasto'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  kavContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    ...(Platform.OS === 'web' ? { boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' } as any : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 16,
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  modeTag: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
  },
  modeTagText: {
    fontSize: 14,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Amount
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 24,
    gap: 4,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 52,
  },
  amountInput: {
    flex: 1,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
    borderBottomWidth: 2,
    paddingBottom: 4,
  },

  // Categories
  catLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  catScroll: {
    marginBottom: 24,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginRight: 8,
  },

  catChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  catChipLabelActive: {
    color: '#FFFFFF',
  },

  // Confirm
  confirmBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  confirmBtnTextDisabled: {
    color: '#9CA3AF',
  },
});
