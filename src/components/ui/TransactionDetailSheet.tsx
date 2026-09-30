import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated, TouchableOpacity,
  TouchableWithoutFeedback, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../state/ThemeContext';
import { THEME } from '../../constants/theme';
import { getCategoryIcon, Icon } from './Icon';
import { type Transaction, type OrigenTransaccion } from '../../types';
import { useFinance } from '../../state';
import { entidadPorId, etiquetaMedio } from '../../utils/mediosPago';

const ORIGEN_LABEL: Record<OrigenTransaccion, string> = {
  manual:       'Registrado por ti',
  recibo:       'Recibo escaneado',
  notificacion: 'Detectado de una notificación',
  correo:       'Detectado de un correo del banco',
  atajo:        'Detectado con Apple Pay',
  texto:        'Detectado de un mensaje del banco',
  open_finance: 'Sincronizado con tu banco',
};

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
}

const fmtCOP = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const Row: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor ?? colors.textPrimary }]}>{value}</Text>
    </View>
  );
};

export const TransactionDetailSheet: React.FC<Props> = ({ transaction, onClose }) => {
  const { colors } = useTheme();
  const { mediosPago } = useFinance();
  const slideAnim  = useRef(new Animated.Value(500)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;

  const visible = !!transaction;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim,  { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim,  { toValue: 500, duration: 230, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 0,   duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!transaction) return null;

  const isIncome  = transaction.type === 'income';
  const accent    = isIncome ? colors.income : colors.expense;
  const accentBg  = isIncome ? '#DCFCE7' : '#FEE2E2';
  const date      = new Date(transaction.date);
  const dia       = DIAS[date.getDay()];
  const dayNum    = date.getDate();
  const mes       = MESES[date.getMonth()];
  const año       = date.getFullYear();
  const hora      = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const catIcon   = getCategoryIcon(transaction.category);
  const medio     = transaction.paymentMethodId
    ? mediosPago.find(m => m.id === transaction.paymentMethodId)
    : undefined;


  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOp, backgroundColor: colors.overlay }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header con tipo y cierre */}
        <View style={styles.header}>
          <View style={[styles.typeBadge, { backgroundColor: accentBg }]}>
            <Text style={[styles.typeBadgeText, { color: accent }]}>
              {isIncome ? '↑ Ingreso' : '↓ Gasto'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.inputBg }]} activeOpacity={0.7}>
            <Feather name="x" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Ícono + monto principal */}
        <View style={styles.amountSection}>
          <View style={[styles.iconCircle, { backgroundColor: accentBg }]}>
            <Icon name={catIcon as any} size={28} color={accent} />
          </View>
          <Text style={[styles.amountText, { color: accent }]}>
            {isIncome ? '+' : '-'}{fmtCOP(transaction.amount)}
          </Text>
          <Text style={[styles.titleText, { color: colors.textPrimary }]}>
            {transaction.description || transaction.category}
          </Text>
        </View>

        {/* Datos de detalle */}
        <View style={[styles.detailCard, { backgroundColor: colors.cardSecondary ?? colors.inputBg, borderColor: colors.border }]}>
          <Row label="Categoría"  value={transaction.category} />
          <Row label="Fecha"      value={`${dia}, ${dayNum} de ${mes} de ${año}`} />
          <Row label="Hora"       value={hora} />
          {transaction.description && transaction.description !== transaction.category && (
            <Row label="Descripción" value={transaction.description} />
          )}
          {transaction.paymentMethodId && (
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <Text style={[styles.rowLabel, { color: colors.textTertiary }]}>Medio de pago</Text>
              {medio ? (
                <View style={styles.medioValue}>
                  <View style={[styles.medioDot, { backgroundColor: entidadPorId(medio.entidad).color }]} />
                  <Text style={[styles.rowValue, { color: colors.textPrimary }]} numberOfLines={1}>
                    {etiquetaMedio(medio)}{medio.archivado ? ' (archivado)' : ''}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.rowValue, { color: colors.textTertiary }]}>Medio eliminado</Text>
              )}
            </View>
          )}
          {transaction.merchant && <Row label="Comercio" value={transaction.merchant} />}
          {transaction.source && transaction.source !== 'manual' && (
            <Row label="Origen" value={ORIGEN_LABEL[transaction.source] ?? transaction.source} />
          )}
          <Row label="Tipo"       value={isIncome ? 'Ingreso' : 'Gasto'} valueColor={accent} />
          <Row label="Monto"      value={fmtCOP(transaction.amount)} valueColor={accent} />
        </View>

        {/* Botón cerrar */}
        <TouchableOpacity
          style={[styles.closeFullBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
          onPress={onClose}
          activeOpacity={0.75}
        >
          <Text style={[styles.closeFullBtnText, { color: colors.textSecondary }]}>Cerrar</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 -8px 32px rgba(0,0,0,0.15)' } as any)
      : {
          shadowColor: '#0B1220',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 16,
        }),
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 8,
  },
  typeBadge: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100,
  },
  typeBadgeText: {
    fontSize: 13, fontWeight: '700',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  // Amount hero
  amountSection: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  amountText: {
    fontSize: 36, fontWeight: '800', letterSpacing: -1,
  },
  titleText: {
    fontSize: 16, fontWeight: '600',
  },

  // Detail rows
  detailCard: {
    borderRadius: 16, borderWidth: 1,
    marginBottom: 16, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 13, fontWeight: '500',
  },
  rowValue: {
    fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right',
  },
  medioValue: {
    flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '60%',
  },
  medioDot: {
    width: 10, height: 10, borderRadius: 5,
  },

  // Close button
  closeFullBtn: {
    borderRadius: 14, borderWidth: 1,
    paddingVertical: 14, alignItems: 'center',
  },
  closeFullBtnText: {
    fontSize: 15, fontWeight: '600',
  },
});
