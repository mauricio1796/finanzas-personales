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
import { useTheme } from '../../state/ThemeContext';
import { THEME } from '../../constants/theme';
import { verificarGastoInusual } from '../../services/NotificacionesService';
import { type Transaction } from '../../types';

// ─── Quick categories ──────────────────────────────────────────────────
const INCOME_CATS = [
  { id: 'salario',      label: 'Salario'     },
  { id: 'freelance',    label: 'Freelance'   },
  { id: 'negocio',      label: 'Negocio'     },
  { id: 'inversiones',  label: 'Inversiones' },
  { id: 'otros',        label: 'Otros'       },
];

const EXPENSE_CATS = [
  { id: 'Alimentación',    label: 'Alimentación' },
  { id: 'Transporte',      label: 'Transporte'   },
  { id: 'Servicios',       label: 'Servicios'    },
  { id: 'Arriendo',        label: 'Arriendo'     },
  { id: 'Salud',           label: 'Salud'        },
  { id: 'Entretenimiento', label: 'Entrete.'     },
  { id: 'Ropa',            label: 'Ropa'         },
  { id: 'Otros',           label: 'Otros'        },
];

export interface QuickAddInitialData {
  amount?:      number;
  category?:    string;
  description?: string;
  type?:        'income' | 'expense';
}

interface QuickAddSheetProps {
  visible:      boolean;
  mode:         'income' | 'expense';
  onClose:      () => void;
  onAdd:        (amount: number, category: string, type: 'income' | 'expense', date: Date, description?: string) => void;
  initialData?: QuickAddInitialData;
}

export const QuickAddSheet: React.FC<QuickAddSheetProps> = ({ visible, mode, onClose, onAdd, initialData }) => {
  const { colors } = useTheme();
  const { categories, transactions } = useFinance();
  const slideAnim  = useRef(new Animated.Value(400)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;

  const [amount,      setAmount]      = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);

  const isIncome = mode === 'income';
  const accent   = isIncome ? colors.income : colors.expense;
  const accentBg = isIncome ? colors.incomeLight : colors.expenseLight;
  // Use user budget categories for expenses if available, fallback to defaults
  const userExpCats = !isIncome
    ? categories.filter((cat: any) => cat.isSelected !== false).map((cat: any) => ({ id: cat.name, label: cat.name }))
    : [];
  const cats = isIncome ? INCOME_CATS : (userExpCats.length > 0 ? userExpCats : EXPENSE_CATS);

  useEffect(() => {
    if (visible) {
      // Pre-fill from initialData (voice input) or reset to defaults
      if (initialData?.amount && initialData.amount > 0) {
        setAmount(initialData.amount.toLocaleString('es-CO').replace(/,/g, '.'));
      } else {
        setAmount('');
      }
      if (initialData?.description) {
        setDescription(initialData.description);
      } else {
        setDescription('');
      }
      // Find category by name (from voice parse) or default to first
      const matchedCat = initialData?.category
        ? cats.find(c => c.label.toLowerCase() === initialData.category!.toLowerCase())?.id
        : null;
      setSelectedCat(matchedCat ?? cats[0]?.id ?? null);
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

    const fecha = new Date();
    onAdd(parsed, selectedCat, mode, fecha, description.trim() || undefined);

    // Verificar gasto inusual de forma asíncrona (no bloquea la UI)
    if (mode === 'expense') {
      const tempTx: Transaction = {
        id:       fecha.getTime().toString(),
        amount:   parsed,
        category: selectedCat,
        type:     'expense',
        date:     fecha.toISOString(),
      };
      verificarGastoInusual(tempTx, transactions).catch(() => {});
    }

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
          <Animated.View style={[styles.backdrop, { opacity: backdropOp, backgroundColor: colors.overlay }]} />
        </TouchableWithoutFeedback>

        {/* Sheet — sube automáticamente con el teclado */}
        <Animated.View style={[styles.sheet, { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={[styles.modeTag, { backgroundColor: accentBg }]}>
              <Text style={[styles.modeTagText, { color: accent }]}>
                {isIncome ? '↑ Ingreso' : '↓ Gasto'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.inputBg }]}>
              <Icon name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Amount input */}
          <View style={styles.amountRow}>
            <Text style={[styles.currencySymbol, { color: accent }]}>$</Text>
            <TextInput
              style={[styles.amountInput, { color: accent, borderBottomColor: amountFocused ? accent : colors.border }, Platform.OS === 'web' && ({ outline: 'none' } as any)]}
              placeholder="0"
              placeholderTextColor={colors.border}
              keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
              value={amount}
              onChangeText={(txt) => { const d = txt.replace(/\./g, '').replace(/[^0-9]/g, ''); const n = parseInt(d, 10); setAmount(isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.')); }}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
            />
          </View>

          {/* Category chips */}
          <Text style={[styles.catLabel, { color: colors.textTertiary }]}>CATEGORÍA</Text>
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
                  style={[
                    styles.catChip,
                    { borderColor: colors.border, backgroundColor: colors.cardSecondary },
                    active && { backgroundColor: accent, borderColor: accent },
                  ]}
                  onPress={() => setSelectedCat(cat.id)}
                  activeOpacity={0.7}
                >
                  <Icon name={getCategoryIcon(cat.id)} size={15} color={active ? THEME.colors.surface : colors.textSecondary} />
                  <Text style={[styles.catChipLabel, { color: colors.textPrimary }, active && styles.catChipLabelActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Description input (opcional) */}
          <TextInput
            style={[styles.descInput, {
              backgroundColor: colors.inputBg,
              borderColor:     colors.border,
              color:           colors.textPrimary,
            }, Platform.OS === 'web' && ({ outline: 'none' } as any)]}
            placeholder="Descripción (opcional)"
            placeholderTextColor={colors.textTertiary ?? colors.border}
            value={description}
            onChangeText={setDescription}
            maxLength={80}
          />

          {/* Confirm button */}
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: canConfirm ? accent : colors.border }]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.8}
          >
            <Text style={[styles.confirmBtnText, !canConfirm && { color: colors.textTertiary }]}>
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
  },
  sheet: {
    width: '100%',
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
    marginRight: 8,
  },

  catChipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  catChipLabelActive: {
    color: THEME.colors.surface,
  },

  // Description
  descInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
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
    color: THEME.colors.surface,
  },
});
