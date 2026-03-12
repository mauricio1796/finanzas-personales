import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Animated,
} from 'react-native';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { ProgressIndicator } from '../../components/onboarding';

export const OnboardingConfirm: React.FC = () => {
  const { setIsOnboarded, categories, profile } = useFinance();
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  const nombre = profile?.mainFinancialConcern ?? '';
  const compromisos = categories.filter((c: any) => c.tipo === 'fijo');
  const totalMensual = compromisos.reduce((s: number, c: any) => s + (c.presupuesto || 0), 0);
  const salario = profile?.monthlySalary || 0;
  const disponible = salario - totalMensual;
  const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ProgressIndicator currentStep={4} totalSteps={5} />
      <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Animated.View style={[styles.orbBox, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.orb, { backgroundColor: colors.primary }]}>
            <Text style={styles.orbIcon}>{'◈'}</Text>
          </View>
        </Animated.View>

        <View style={styles.textBlock}>
          <Text style={[styles.badge, { backgroundColor: colors.primary + '15', color: colors.primary }]}>
            {'◈ Tus compromisos estan listos'}
          </Text>
          <Text style={[styles.headline, { color: '#111827' }]}>
            {nombre ? 'Todo listo, ' + nombre + '!' : 'Todo listo!'}
          </Text>
          <Text style={[styles.subtitle, { color: '#6B7280' }]}>
            {compromisos.length + ' compromiso' + (compromisos.length !== 1 ? 's' : '') + ' configurado' + (compromisos.length !== 1 ? 's' : '')}
          </Text>
        </View>

        {compromisos.length > 0 && (
          <View style={[styles.summaryCard, { borderColor: '#E5E7EB' }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total comprometido</Text>
              <Text style={[styles.summaryValue, { color: '#EF4444' }]}>{fmtCOP(totalMensual)}</Text>
            </View>
            {salario > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Disponible real</Text>
                <Text style={[styles.summaryValue, { color: disponible >= 0 ? '#10B981' : '#EF4444' }]}>{fmtCOP(disponible)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Compromisos</Text>
              <View style={styles.catChips}>
                {compromisos.slice(0, 4).map((c: any) => (
                  <Text key={c.id} style={styles.catChip}>{c.icon || '◈'}</Text>
                ))}
                {compromisos.length > 4 && (
                  <Text style={[styles.catChip, { color: '#6B7280' }]}>{'+' + (compromisos.length - 4)}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => setIsOnboarded(true)}
          activeOpacity={0.82}
        >
          <Text style={styles.btnText}>Crear mi cuenta</Text>
        </TouchableOpacity>
        <Text style={[styles.note, { color: '#9CA3AF' }]}>Podras editar todo desde la app</Text>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 24, gap: 24, alignItems: 'stretch' },
  orbBox: { alignItems: 'center', marginBottom: 4 },
  orb: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  orbIcon: { fontSize: 36, color: '#FFFFFF', fontWeight: '700' },
  textBlock: { alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, fontSize: 12, fontWeight: '700' },
  headline: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  summaryValue: { fontSize: 15, fontWeight: '800' },
  catChips: { flexDirection: 'row', gap: 4 },
  catChip: { fontSize: 18 },
  btn: { paddingVertical: 17, borderRadius: 14, alignItems: 'center' },
  btnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  note: { fontSize: 12, textAlign: 'center', marginTop: -8 },
});