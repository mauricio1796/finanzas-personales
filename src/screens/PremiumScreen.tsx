import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Icon } from '../components/ui/Icon';
import { useFinance } from '../state/FinanceContext';
import { useTheme } from '../state/ThemeContext';
import { PLANES_PREMIUM, FEATURES_GRATIS, FEATURES_PREMIUM, activarPremium } from '../services/PremiumService';
import { crearCheckout, esperarConfirmacionPago } from '../services/PaymentsService';
import { THEME } from '../constants/theme';
import { AppColors } from '../constants/colors';

interface PremiumScreenProps { onBack?: () => void; }

// Métodos de pago colombianos reales que ofrece el checkout de Wompi
const METODOS_PAGO = [
  { icon: 'smartphone' as const, label: 'Nequi' },
  { icon: 'credit-card' as const, label: 'Tarjeta' },
  { icon: 'dollar-sign' as const, label: 'PSE' },
  { icon: 'home' as const, label: 'Bancolombia' },
];

export const PremiumScreen: React.FC<PremiumScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, premium, setPremium } = useFinance();
  const [planSel, setPlanSel] = useState<'mensual' | 'anual'>('anual');
  const [loading, setLoading] = useState(false);
  const [pagoPendiente, setPagoPendiente] = useState<string | null>(null); // reference en curso

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const activarLocalmente = async (plan: 'mensual' | 'anual') => {
    const newState = await activarPremium(plan);
    setPremium(newState);
    setPagoPendiente(null);
    Alert.alert('¡Pago aprobado!', 'Bienvenido a FinancyAI Premium.', [{ text: 'Explorar', onPress: onBack }]);
  };

  /** Abre el checkout de Wompi y confirma el pago antes de activar Premium. */
  const pagarConWompi = async (reference?: string) => {
    setLoading(true);
    try {
      let ref = reference;

      if (!ref) {
        const redirectUrl = Linking.createURL('premium-success');
        const checkout = await crearCheckout(planSel, user?.id, redirectUrl);
        ref = checkout.reference;
        setPagoPendiente(ref);

        if (Platform.OS === 'web') {
          // En web no hay deep link de regreso: abrimos en una pestaña y el usuario
          // vuelve a tocar "Ya pagué, verificar" cuando termine.
          window.open(checkout.url, '_blank');
        } else {
          await WebBrowser.openAuthSessionAsync(checkout.url, redirectUrl);
        }
      }

      const estado = await esperarConfirmacionPago(ref);

      if (estado === 'APPROVED') {
        await activarLocalmente(planSel);
      } else if (estado === 'PENDING') {
        Alert.alert(
          'Pago en proceso',
          'Wompi todavía no confirma tu pago. Si ya pagaste, espera unos segundos y toca "Ya pagué, verificar".',
        );
      } else {
        setPagoPendiente(null);
        Alert.alert('Pago no completado', 'La transacción fue rechazada o cancelada. Puedes intentarlo de nuevo.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo procesar el pago. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuscribirse = () => pagarConWompi();
  const handleVerificar   = () => pagoPendiente && pagarConWompi(pagoPendiente);

  if (premium.isPremium) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          {onBack && <TouchableOpacity onPress={onBack} style={styles.backBtn}><Icon name="arrow-left" size={20} color={colors.textPrimary} /></TouchableOpacity>}
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.activeCard}>
          <Icon name="award" size={56} color={colors.primary} />
          <Text style={styles.activeTitle}>Eres Premium</Text>
          <Text style={styles.activePlan}>Plan {premium.plan === 'anual' ? 'Anual' : 'Mensual'}</Text>
          {premium.fechaVencimiento && <Text style={styles.activeExpiry}>Vigente hasta: {new Date(premium.fechaVencimiento).toLocaleDateString('es-CO')}</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {onBack && <TouchableOpacity onPress={onBack} style={styles.backBtn}><Icon name="arrow-left" size={20} color={colors.textPrimary} /></TouchableOpacity>}
        <Text style={styles.headerTitle}>FinancyAI Premium</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heroSub}>Desbloquea tu potencial financiero</Text>
        <View style={styles.card}>
          <View style={styles.compareHeader}>
            <Text style={styles.compareCol}>Gratis</Text>
            <Text style={[styles.compareCol, { color: colors.primary }]}>Premium</Text>
          </View>
          {FEATURES_PREMIUM.map((feat, i) => (
            <View key={i} style={styles.compareRow}>
              <View style={styles.compareCell}>
                <Icon name={i < FEATURES_GRATIS.length ? 'check' : 'x'} size={13} color={i < FEATURES_GRATIS.length ? colors.income : colors.border} />
                <Text style={[styles.compareFeat, { color: i < FEATURES_GRATIS.length ? colors.textPrimary : colors.textTertiary }]} numberOfLines={1}>{i < FEATURES_GRATIS.length ? FEATURES_GRATIS[i] : ''}</Text>
              </View>
              <View style={styles.compareCell}>
                <Icon name="check" size={13} color={colors.primary} />
                <Text style={styles.compareFeat} numberOfLines={1}>{feat}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.sectionLabel}>Elige tu plan</Text>
        {(['mensual', 'anual'] as const).map(plan => {
          const info = PLANES_PREMIUM[plan];
          const active = planSel === plan;
          return (
            <TouchableOpacity key={plan} style={[styles.planCard, active && styles.planCardActive]} onPress={() => setPlanSel(plan)} activeOpacity={0.8}>
              {info.destacado && <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>MEJOR VALOR</Text></View>}
              <View style={styles.planRow}>
                <View style={[styles.planRadio, active && styles.planRadioActive]}>{active && <View style={styles.planRadioDot} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planName, active && { color: colors.primary }]}>{plan === 'mensual' ? 'Mensual' : 'Anual'}</Text>
                  <Text style={styles.planPrice}>{info.etiqueta}</Text>
                  <Text style={styles.planDesc}>{info.descripcion}</Text>
                  {info.ahorro && <Text style={styles.planSaving}>{info.ahorro}</Text>}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={styles.metodosRow}>
          {METODOS_PAGO.map(m => (
            <View key={m.label} style={styles.metodoChip}>
              <Icon name={m.icon} size={12} color={colors.textSecondary} />
              <Text style={styles.metodoText}>{m.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.ctaBtn, loading && { opacity: 0.7 }]} onPress={handleSuscribirse} disabled={loading} activeOpacity={0.85}>
          <Text style={styles.ctaBtnText}>{loading ? 'Procesando...' : 'Pagar con Wompi'}</Text>
        </TouchableOpacity>

        {!!pagoPendiente && (
          <TouchableOpacity style={[styles.verifyBtn, loading && { opacity: 0.7 }]} onPress={handleVerificar} disabled={loading} activeOpacity={0.85}>
            <Icon name="refresh-cw" size={14} color={colors.primary} />
            <Text style={styles.verifyBtnText}>Ya pagué, verificar</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.legal}>Pago procesado por Wompi. FinancyAI nunca ve los datos de tu tarjeta.</Text>
      </ScrollView>
    </View>
  );
};

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.background },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  backBtn:        { width: 36, height: 36, borderRadius: THEME.radius.sm, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  scroll:         { padding: 16, paddingBottom: 32, gap: 16 },
  heroSub:        { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  card:           { backgroundColor: colors.card, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  compareHeader:  { flexDirection: 'row', backgroundColor: colors.cardSecondary, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  compareCol:     { flex: 1, fontSize: 12, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  compareRow:     { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  compareCell:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  compareFeat:    { fontSize: 11, color: colors.textSecondary, flex: 1 },
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' },
  planCard:       { backgroundColor: colors.card, borderRadius: THEME.radius.lg, borderWidth: 2, borderColor: colors.border, padding: 16, position: 'relative' },
  planCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  bestBadge:      { position: 'absolute', top: -1, right: 16, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: THEME.radius.sm, borderBottomRightRadius: THEME.radius.sm },
  bestBadgeText:  { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  planRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planRadio:      { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  planRadioActive:{ borderColor: colors.primary },
  planRadioDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  planName:       { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  planPrice:      { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  planDesc:       { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  planSaving:     { fontSize: 12, fontWeight: '700', color: colors.income, marginTop: 4 },
  metodosRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  metodoChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.cardSecondary, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6 },
  metodoText:     { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  ctaBtn:         { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaBtnText:     { fontSize: 16, fontWeight: '800', color: '#fff' },
  verifyBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10 },
  verifyBtnText:  { fontSize: 13, fontWeight: '700', color: colors.primary },
  legal:          { fontSize: 12, color: colors.textTertiary, textAlign: 'center' },
  activeCard:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  activeTitle:    { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  activePlan:     { fontSize: 15, color: colors.primary, fontWeight: '600' },
  activeExpiry:   { fontSize: 13, color: colors.textTertiary },
});
