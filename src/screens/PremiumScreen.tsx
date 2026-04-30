import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/ui/Icon';
import { useFinance } from '../state/FinanceContext';
import { PLANES_PREMIUM, FEATURES_GRATIS, FEATURES_PREMIUM, activarPremium } from '../services/PremiumService';
import { THEME } from '../constants/theme';

interface PremiumScreenProps { onBack?: () => void; }

export const PremiumScreen: React.FC<PremiumScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { premium, setPremium } = useFinance();
  const [planSel, setPlanSel] = useState<'mensual' | 'anual'>('anual');
  const [loading, setLoading] = useState(false);

  const handleSuscribirse = async () => {
    setLoading(true);
    try {
      const newState = await activarPremium(planSel);
      setPremium(newState);
      Alert.alert('Bienvenido a Premium', 'Tu suscripcion esta activa.', [{ text: 'Explorar', onPress: onBack }]);
    } catch {
      Alert.alert('Error', 'No se pudo procesar el pago. Intenta de nuevo.');
    } finally { setLoading(false); }
  };

  if (premium.isPremium) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          {onBack && <TouchableOpacity onPress={onBack} style={styles.backBtn}><Icon name="arrow-left" size={20} color={THEME.colors.textPrimary} /></TouchableOpacity>}
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.activeCard}>
          <Icon name="award" size={56} color={THEME.colors.primary} />
          <Text style={styles.activeTitle}>Eres Premium</Text>
          <Text style={styles.activePlan}>Plan {planSel === 'anual' ? 'Anual' : 'Mensual'}</Text>
          {premium.fechaVencimiento && <Text style={styles.activeExpiry}>Vigente hasta: {new Date(premium.fechaVencimiento).toLocaleDateString('es-CO')}</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {onBack && <TouchableOpacity onPress={onBack} style={styles.backBtn}><Icon name="arrow-left" size={20} color={THEME.colors.textPrimary} /></TouchableOpacity>}
        <Text style={styles.headerTitle}>FinancyAI Premium</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heroSub}>Desbloquea tu potencial financiero</Text>
        <View style={styles.card}>
          <View style={styles.compareHeader}>
            <Text style={styles.compareCol}>Gratis</Text>
            <Text style={[styles.compareCol, { color: THEME.colors.primary }]}>Premium</Text>
          </View>
          {FEATURES_PREMIUM.map((feat, i) => (
            <View key={i} style={styles.compareRow}>
              <View style={styles.compareCell}>
                <Icon name={i < FEATURES_GRATIS.length ? 'check' : 'x'} size={13} color={i < FEATURES_GRATIS.length ? THEME.colors.income : THEME.colors.border} />
                <Text style={[styles.compareFeat, { color: i < FEATURES_GRATIS.length ? THEME.colors.textPrimary : THEME.colors.textTertiary }]} numberOfLines={1}>{i < FEATURES_GRATIS.length ? FEATURES_GRATIS[i] : ''}</Text>
              </View>
              <View style={styles.compareCell}>
                <Icon name="check" size={13} color={THEME.colors.primary} />
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
                  <Text style={[styles.planName, active && { color: THEME.colors.primary }]}>{plan === 'mensual' ? 'Mensual' : 'Anual'}</Text>
                  <Text style={styles.planPrice}>{info.etiqueta}</Text>
                  <Text style={styles.planDesc}>{info.descripcion}</Text>
                  {info.ahorro && <Text style={styles.planSaving}>{info.ahorro}</Text>}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={[styles.ctaBtn, loading && { opacity: 0.7 }]} onPress={handleSuscribirse} disabled={loading} activeOpacity={0.85}>
          <Text style={styles.ctaBtnText}>{loading ? 'Procesando...' : 'Comenzar ahora'}</Text>
        </TouchableOpacity>
        <Text style={styles.legal}>Pago seguro. Cancela cuando quieras.</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.colors.border, backgroundColor: THEME.colors.surface },
  backBtn: { width: 36, height: 36, borderRadius: THEME.radius.sm, backgroundColor: THEME.colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: THEME.colors.textPrimary },
  scroll: { padding: 16, paddingBottom: 32, gap: 16 },
  heroSub: { fontSize: 15, color: THEME.colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  card: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.border, overflow: 'hidden' },
  compareHeader: { flexDirection: 'row', backgroundColor: THEME.colors.surfaceSecondary, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  compareCol: { flex: 1, fontSize: 12, fontWeight: '700', color: THEME.colors.textSecondary, textAlign: 'center' },
  compareRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: THEME.colors.surfaceSecondary },
  compareCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  compareFeat: { fontSize: 11, color: THEME.colors.textSecondary, flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: THEME.colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' },
  planCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 2, borderColor: THEME.colors.border, padding: 16, position: 'relative' },
  planCardActive: { borderColor: THEME.colors.primary, backgroundColor: THEME.colors.primaryLight },
  bestBadge: { position: 'absolute', top: -1, right: 16, backgroundColor: THEME.colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: THEME.radius.sm, borderBottomRightRadius: THEME.radius.sm },
  bestBadgeText: { fontSize: 10, fontWeight: '800', color: THEME.colors.surface, letterSpacing: 0.5 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: THEME.colors.border, alignItems: 'center', justifyContent: 'center' },
  planRadioActive: { borderColor: THEME.colors.primary },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: THEME.colors.primary },
  planName: { fontSize: 15, fontWeight: '700', color: THEME.colors.textSecondary },
  planPrice: { fontSize: 20, fontWeight: '800', color: THEME.colors.textPrimary, marginTop: 2 },
  planDesc: { fontSize: 12, color: THEME.colors.textTertiary, marginTop: 2 },
  planSaving: { fontSize: 12, fontWeight: '700', color: THEME.colors.income, marginTop: 4 },
  ctaBtn: { backgroundColor: THEME.colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaBtnText: { fontSize: 16, fontWeight: '800', color: THEME.colors.surface },
  legal: { fontSize: 12, color: THEME.colors.textTertiary, textAlign: 'center' },
  activeCard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  activeTitle: { fontSize: 26, fontWeight: '800', color: THEME.colors.textPrimary },
  activePlan: { fontSize: 15, color: THEME.colors.primary, fontWeight: '600' },
  activeExpiry: { fontSize: 13, color: THEME.colors.textTertiary },
});
