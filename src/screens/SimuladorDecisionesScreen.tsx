import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Animated,
  TextInput, KeyboardAvoidingView, Platform, Keyboard, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { PremiumLock } from '../components/ui/PremiumLock';
import { useHaptics } from '../hooks/useHaptics';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { useBottomPadding } from '../hooks/useBottomPadding';
import { calcularMetricasFinancieras } from '../utils/ingresoUtils';
import { simularDecision, ResultadoSimulacion, VeredictoSimulador } from '../utils/simuladorUtils';
import { getPaletaItem } from '../constants/catalogoCategorias';
import { THEME } from '../constants/theme';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

const MONTOS_SUGERIDOS = [50000, 100000, 200000, 500000, 1000000];

function fmtSugerido(n: number): string {
  if (n >= 1_000_000) return `$${n / 1_000_000}M`;
  return `$${n / 1000}k`;
}

function iconoVeredicto(v: VeredictoSimulador): any {
  if (v === 'si_puedes')   return 'check-circle';
  if (v === 'con_cuidado') return 'alert-circle';
  return 'x-circle';
}

function colorVeredictoHistorial(v: VeredictoSimulador, colors: any): string {
  if (v === 'si_puedes')   return colors.income;
  if (v === 'con_cuidado') return colors.warning;
  return colors.expense;
}

function labelVeredicto(v: VeredictoSimulador): string {
  if (v === 'si_puedes')      return '¡Sí puedes!';
  if (v === 'con_cuidado')    return 'Con cuidado';
  if (v === 'mejor_no')       return 'Mejor no';
  return 'No alcanza';
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export const SimuladorDecisionesScreen: React.FC<Props> = ({ onBack, onNavigate }) => {
  const { transactions, categories, profile, premium } = useFinance();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const bottomPad = useBottomPadding(24);
  const { panResponder: swipePR, translateX: swipeX } = useSwipeBack(onBack);

  const [monto, setMonto] = useState('');
  const [montoFormateado, setMontoFormateado] = useState('');
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null);
  const [historial, setHistorial] = useState<
    { monto: number; veredicto: VeredictoSimulador; label: string }[]
  >([]);
  const [inputFocused, setInputFocused] = useState(false);

  // Animations
  const resultadoAnim = useRef(new Animated.Value(0)).current;
  const barraAnim     = useRef(new Animated.Value(0)).current;
  const shakeAnim     = useRef(new Animated.Value(0)).current;

  // Métricas del mes actual
  const now = useMemo(() => new Date(), []);
  const metricas = useMemo(
    () => calcularMetricasFinancieras(
      transactions, categories, profile?.monthlySalary ?? 0,
      now.getMonth(), now.getFullYear(),
    ),
    [transactions.length, categories.length, profile?.monthlySalary],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleMontoChange = useCallback((text: string) => {
    const soloDigitos = text.replace(/[^0-9]/g, '');
    setMonto(soloDigitos);
    if (soloDigitos) {
      const num = parseInt(soloDigitos, 10);
      setMontoFormateado(num.toLocaleString('es-CO').replace(/,/g, '.'));
    } else {
      setMontoFormateado('');
    }
    // Limpiar resultado al cambiar monto
    if (resultado) setResultado(null);
  }, [resultado]);

  const simular = useCallback(() => {
    const montoNum = parseInt(monto, 10);
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10,  duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6,   duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6,  duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,   duration: 50, useNativeDriver: true }),
      ]).start();
      haptics.error();
      return;
    }

    Keyboard.dismiss();
    haptics.medium();

    const res = simularDecision(montoNum, transactions, categories as any, metricas);
    setResultado(res);

    setHistorial(prev => [
      { monto: montoNum, veredicto: res.veredicto, label: fmtCOP(montoNum) },
      ...prev.filter(h => h.monto !== montoNum),
    ].slice(0, 5));

    resultadoAnim.setValue(0);
    barraAnim.setValue(0);

    Animated.sequence([
      Animated.spring(resultadoAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
      Animated.timing(barraAnim,     { toValue: 1, duration: 600, useNativeDriver: false }),
    ]).start();

    if (res.veredicto === 'si_puedes')      haptics.success();
    else if (res.veredicto === 'con_cuidado') haptics.warning();
    else                                      haptics.error();
  }, [monto, transactions, categories, metricas]);

  const limpiar = useCallback(() => {
    setResultado(null);
    setMonto('');
    setMontoFormateado('');
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!premium.isPremium) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
            <Icon name="arrow-left" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginRight: 20 }}>Simulador</Text>
        </View>
        <PremiumLock
          title="Simulador de decisiones"
          description="Antes de gastar, pregúntale al simulador: '¿puedo comprar esto sin descuadrar mi mes?' y recibe un veredicto basado en tus datos reales."
          onUpgrade={() => onNavigate('premium')}
          onDismiss={onBack}
        />
      </View>
    );
  }

  return (
    <Animated.View
      style={[s.root, { backgroundColor: colors.background, transform: [{ translateX: swipeX }] }]}
      {...swipePR.panHandlers}
    >
      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + 12 }]}>
        <View style={s.headerNav}>
          <TouchableOpacity
            onPress={onBack}
            style={s.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={16} color={'#fff'} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Simulador</Text>
          <View style={{ width: 34 }} />
        </View>

        <Text style={s.headerSub}>
          Descubre si puedes permitirte una compra y qué impacto tiene en tu presupuesto
        </Text>

        {/* Mini stats row */}
        <View style={s.statsRow}>
          <View style={s.statPill}>
            <Text style={s.statPillValue}>{fmtCOP(metricas.balanceDisponible)}</Text>
            <Text style={s.statPillLabel}>Disponible ahora</Text>
          </View>
          <View style={s.statPill}>
            <Text style={s.statPillValue}>{fmtCOP(metricas.gastoPromedioRecomendadoDia)}/día</Text>
            <Text style={s.statPillLabel}>Presupuesto diario</Text>
          </View>
          <View style={s.statPill}>
            <Text style={s.statPillValue}>{metricas.diasRestantesMes}d</Text>
            <Text style={s.statPillLabel}>Días restantes</Text>
          </View>
        </View>
      </View>

      {/* ── Body ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Input card ── */}
          <Animated.View style={[s.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
            <View style={[
              s.inputCard,
              {
                backgroundColor: colors.card,
                borderColor: inputFocused ? colors.primary : colors.border,
                borderWidth: inputFocused ? 1.5 : 0.5,
              },
            ]}>
              <Text style={[s.inputPrompt, { color: colors.textSecondary }]}>
                ¿Cuánto quieres gastar?
              </Text>
              <View style={s.amountRow}>
                <Text style={[s.currencySign, { color: colors.textTertiary }]}>$</Text>
                <TextInput
                  value={montoFormateado}
                  onChangeText={handleMontoChange}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  style={[s.amountInput, { color: colors.textPrimary }]}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  returnKeyType="done"
                  onSubmitEditing={simular}
                  autoFocus
                />
              </View>

              {/* Montos rápidos */}
              <View style={s.quickMontosRow}>
                {MONTOS_SUGERIDOS.map(v => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => { haptics.light(); handleMontoChange(String(v)); }}
                    style={[s.quickMontoBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={[s.quickMontoLabel, { color: colors.textSecondary }]}>
                      {fmtSugerido(v)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* ── Botón simular ── */}
          <TouchableOpacity
            onPress={simular}
            style={[
              s.simularBtn,
              { backgroundColor: monto ? colors.primary : colors.cardSecondary },
            ]}
            activeOpacity={0.85}
          >
            <Icon name="zap" size={18} color={monto ? '#fff' : colors.textTertiary} />
            <Text style={[s.simularBtnText, { color: monto ? '#FFFFFF' : colors.textTertiary }]}>
              Analizar compra
            </Text>
          </TouchableOpacity>

          {/* ── Historial de simulaciones (cuando no hay resultado activo) ── */}
          {historial.length > 0 && !resultado && (
            <View style={s.historialSection}>
              <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>
                SIMULACIONES RECIENTES
              </Text>
              {historial.map((h, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => { haptics.light(); handleMontoChange(String(h.monto)); }}
                  style={[s.historialItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={iconoVeredicto(h.veredicto)}
                    size={16}
                    color={colorVeredictoHistorial(h.veredicto, colors)}
                  />
                  <Text style={[s.historialLabel, { color: colors.textPrimary }]}>{h.label}</Text>
                  <Text style={[s.historialVeredicto, { color: colors.textTertiary }]}>
                    {labelVeredicto(h.veredicto)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Resultado ── */}
          {resultado && (
            <Animated.View style={[
              s.resultadoWrap,
              {
                opacity: resultadoAnim,
                transform: [{
                  translateY: resultadoAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }),
                }],
              },
            ]}>

              {/* Card veredicto */}
              <View style={[
                s.veredictoCard,
                {
                  backgroundColor: resultado.colorVeredicto + '18',
                  borderColor: resultado.colorVeredicto + '60',
                },
              ]}>
                <View style={[s.veredictoIconCircle, { backgroundColor: resultado.colorVeredicto + '25' }]}>
                  <Icon name={resultado.iconoVeredicto as any} size={26} color={resultado.colorVeredicto} />
                </View>
                <Text style={[s.veredictoTitulo, { color: resultado.colorVeredicto }]}>
                  {resultado.titulo}
                </Text>
                <Text style={[s.veredictoSub, { color: colors.textSecondary }]}>
                  {resultado.subtitulo}
                </Text>
                <Text style={[s.veredictoMonto, { color: colors.textPrimary }]}>
                  {fmtCOP(resultado.monto)}
                </Text>
              </View>

              {/* Impacto en balance */}
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.cardTitle, { color: colors.textPrimary }]}>Impacto en tu balance</Text>

                {/* Barra antes */}
                <View style={s.barGroup}>
                  <View style={s.barRow}>
                    <Text style={[s.barLabel, { color: colors.textSecondary }]}>Antes</Text>
                    <Text style={[s.barValue, { color: colors.income }]}>{fmtCOP(resultado.balanceAntes)}</Text>
                  </View>
                  <View style={[s.barTrack, { backgroundColor: colors.borderSubtle }]}>
                    <View style={[s.barFill, { width: '100%', backgroundColor: colors.income }]} />
                  </View>
                </View>

                {/* Barra después */}
                <View style={s.barGroup}>
                  <View style={s.barRow}>
                    <Text style={[s.barLabel, { color: colors.textSecondary }]}>Después</Text>
                    <Text style={[s.barValue, { color: resultado.colorVeredicto }]}>
                      {fmtCOP(resultado.balanceDespues)}
                    </Text>
                  </View>
                  <View style={[s.barTrack, { backgroundColor: colors.borderSubtle }]}>
                    <Animated.View style={[
                      s.barFill,
                      {
                        backgroundColor: resultado.colorVeredicto,
                        width: barraAnim.interpolate({
                          inputRange:  [0, 1],
                          outputRange: [
                            '0%',
                            resultado.balanceAntes > 0
                              ? `${Math.min(100, Math.round((resultado.balanceDespues / resultado.balanceAntes) * 100))}%`
                              : '0%',
                          ],
                        }),
                      },
                    ]} />
                  </View>
                </View>

                <View style={[s.barFooter, { borderTopColor: colors.borderSubtle }]}>
                  <Text style={[s.barFooterLabel, { color: colors.textSecondary }]}>
                    % gastado del ingreso
                  </Text>
                  <Text style={[s.barFooterValue, { color: resultado.colorVeredicto }]}>
                    {resultado.nuevoPorcentajeGastado}%
                  </Text>
                </View>
              </View>

              {/* Equivalencias */}
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.cardTitle, { color: colors.textPrimary }]}>Esta compra equivale a...</Text>
                {resultado.equivalencias.map((eq, i) => (
                  <View key={i} style={s.equivRow}>
                    <View style={[s.equivIcon, { backgroundColor: colors.cardSecondary }]}>
                      <Icon name={eq.icono as any} size={15} color={colors.textSecondary} />
                    </View>
                    <Text style={[s.equivDesc, { color: colors.textSecondary }]}>{eq.descripcion}</Text>
                    <Text style={[s.equivVal, { color: colors.textPrimary }]}>{eq.cantidad}</Text>
                  </View>
                ))}
              </View>

              {/* Categorías sugeridas */}
              {resultado.categoriasSugeridas.length > 0 && (
                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.cardTitle, { color: colors.textPrimary }]}>
                    ¿En qué categoría la registrarías?
                  </Text>
                  {resultado.categoriasSugeridas.map((ci, i) => {
                    const paleta = getPaletaItem(ci.categoria.name, isDark);
                    return (
                      <View key={i} style={[s.catRow, { opacity: ci.puedeAbsorber ? 1 : 0.5 }]}>
                        <View style={[s.catIcon, { backgroundColor: paleta.bg }]}>
                          <Icon name={(ci.categoria.icon ?? 'tag') as any} size={14} color={paleta.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.catName, { color: colors.textPrimary }]}>
                            {ci.categoria.name}
                          </Text>
                          <Text style={[s.catSub, { color: colors.textTertiary }]}>
                            {fmtCOP(ci.presupuestoRestante)} disponible · {ci.pctDelPresupuesto}% del presupuesto
                          </Text>
                        </View>
                        <View style={[
                          s.catBadge,
                          { backgroundColor: ci.puedeAbsorber ? colors.incomeLight : colors.expenseLight },
                        ]}>
                          <Icon
                            name={ci.puedeAbsorber ? 'check' : 'x'}
                            size={12}
                            color={ci.puedeAbsorber ? colors.income : colors.expense}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Plan de ahorro alternativo */}
              {(resultado.veredicto === 'mejor_no' || resultado.veredicto === 'con_cuidado') && (
                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.cardTitle, { color: colors.textPrimary }]}>
                    Plan de ahorro alternativo
                  </Text>
                  {[
                    {
                      icono: 'calendar' as const,
                      label: 'Ahorrando el 10%/mes',
                      valor: `${resultado.planAhorro.semanasSiGuardas10Pct} semanas`,
                    },
                    {
                      icono: 'trending-up' as const,
                      label: 'Ahorrando el 20%/mes',
                      valor: `${resultado.planAhorro.mesesSiApartas20Pct} mes${resultado.planAhorro.mesesSiApartas20Pct !== 1 ? 'es' : ''}`,
                    },
                    {
                      icono: 'crosshair' as const,
                      label: `Guardando ${fmtCOP(resultado.planAhorro.montoAhorroSugerido)}/mes`,
                      valor: 'Meta alcanzable',
                    },
                  ].map((item, i) => (
                    <View key={i} style={s.planRow}>
                      <View style={[s.planIcon, { backgroundColor: colors.primaryLight }]}>
                        <Icon name={item.icono} size={13} color={colors.primary} />
                      </View>
                      <Text style={[s.planLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                      <Text style={[s.planValor, { color: colors.primary }]}>{item.valor}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Consejo de Finn */}
              <View style={[s.finnCard, { backgroundColor: colors.primaryLight, borderColor: colors.primaryDark + '40' }]}>
                <View style={[s.finnAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={s.finnLetter}>F</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.finnLabel, { color: colors.primary }]}>FINN · ANÁLISIS</Text>
                  <Text style={[s.finnText, { color: colors.primaryText }]}>{resultado.consejoFinn}</Text>
                </View>
              </View>

              {/* Acciones post-simulación */}
              <View style={s.accionesRow}>
                <TouchableOpacity
                  onPress={limpiar}
                  style={[s.accionBtnOutline, { borderColor: colors.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[s.accionBtnOutlineText, { color: colors.textSecondary }]}>
                    Nueva simulación
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { haptics.light(); onNavigate('categorias'); }}
                  style={[s.accionBtn, { backgroundColor: colors.primary }]}
                  activeOpacity={0.85}
                >
                  <Text style={s.accionBtnText}>Ver categorías</Text>
                </TouchableOpacity>
              </View>

            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:            { flex: 1 },

  // Header
  header:          { paddingHorizontal: 20, paddingBottom: 20 },
  headerNav:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  backBtn:         { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:     { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: '#fff' },
  headerSub:       { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 18, marginBottom: 14 },
  statsRow:        { flexDirection: 'row', gap: 8 },
  statPill:        { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, alignItems: 'center' },
  statPillValue:   { fontSize: 12, fontWeight: '500', color: '#fff' },
  statPillLabel:   { fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  // Input
  inputWrap:       { margin: 16 },
  inputCard:       { borderRadius: THEME.radius.lg, padding: 20, alignItems: 'center', gap: 10 },
  inputPrompt:     { fontSize: 13 },
  amountRow:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  currencySign:    { fontSize: 28, fontWeight: '400' },
  amountInput:     { fontSize: 42, fontWeight: '500', minWidth: 80, textAlign: 'center' },
  quickMontosRow:  { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  quickMontoBtn:   { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 0.5 },
  quickMontoLabel: { fontSize: 12 },

  // Botón simular
  simularBtn:      { marginHorizontal: 16, borderRadius: THEME.radius.lg, padding: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  simularBtnText:  { fontSize: 15, fontWeight: '500' },

  // Historial
  historialSection:{ margin: 16, gap: 8 },
  sectionLabel:    { fontSize: 11, fontWeight: '600', letterSpacing: 0.6 },
  historialItem:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12, borderWidth: 0.5 },
  historialLabel:  { flex: 1, fontSize: 13 },
  historialVeredicto: { fontSize: 11 },

  // Resultado wrapper
  resultadoWrap:   { gap: 12, marginTop: 16, paddingHorizontal: 16, paddingBottom: 8 },

  // Veredicto card
  veredictoCard:   { borderRadius: THEME.radius.lg, borderWidth: 1, padding: 20, alignItems: 'center', gap: 8 },
  veredictoIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  veredictoTitulo: { fontSize: 22, fontWeight: '500' },
  veredictoSub:    { fontSize: 13, textAlign: 'center' },
  veredictoMonto:  { fontSize: 26, fontWeight: '500' },

  // Cards genéricas
  card:            { borderRadius: THEME.radius.lg, borderWidth: 0.5, padding: 14, gap: 10 },
  cardTitle:       { fontSize: 13, fontWeight: '600' },

  // Barras de impacto
  barGroup:        { gap: 6 },
  barRow:          { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel:        { fontSize: 11 },
  barValue:        { fontSize: 11, fontWeight: '500' },
  barTrack:        { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill:         { height: 8, borderRadius: 4 },
  barFooter:       { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, borderTopWidth: 0.5 },
  barFooterLabel:  { fontSize: 12 },
  barFooterValue:  { fontSize: 12, fontWeight: '500' },

  // Equivalencias
  equivRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  equivIcon:       { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  equivDesc:       { flex: 1, fontSize: 13 },
  equivVal:        { fontSize: 13, fontWeight: '500' },

  // Categorías
  catRow:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIcon:         { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catName:         { fontSize: 12, fontWeight: '500' },
  catSub:          { fontSize: 10 },
  catBadge:        { borderRadius: 8, padding: 5 },

  // Plan ahorro
  planRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planIcon:        { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  planLabel:       { flex: 1, fontSize: 12 },
  planValor:       { fontSize: 12, fontWeight: '500' },

  // Finn
  finnCard:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 0.5, padding: 14 }, // borderRadius 14 is intentionally between md(12) and lg(20)
  finnAvatar:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  finnLetter:      { fontSize: 11, fontWeight: '600', color: '#fff' },
  finnLabel:       { fontSize: 10, fontWeight: '600', letterSpacing: 0.4, marginBottom: 3 },
  finnText:        { fontSize: 13, lineHeight: 20 },

  // Acciones
  accionesRow:     { flexDirection: 'row', gap: 8, paddingBottom: 8 },
  accionBtnOutline: { flex: 1, borderRadius: 14, borderWidth: 0.5, padding: 13, alignItems: 'center' }, // 14 is between md/lg
  accionBtnOutlineText: { fontSize: 13 },
  accionBtn:       { flex: 1, borderRadius: 14, padding: 13, alignItems: 'center' }, // 14 is between md/lg
  accionBtnText:   { fontSize: 13, fontWeight: '500', color: '#fff' },
});
