import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFinance } from '../state/FinanceContext';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import {
  calcularWidgetData,
  actualizarWidget,
  leerDatosWidget,
  type WidgetData,
} from '../services/WidgetService';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const WidgetConfigScreen: React.FC<Props> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { transactions, categories, profile, userLevel, user } = useFinance();

  const [widgetData, setWidgetData]       = useState<WidgetData | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync]       = useState<string | null>(null);

  const fmtCOP = (n: number) =>
    '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
  const fmtCompacto = (n: number) => {
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return '$' + Math.round(n / 1_000) + 'k';
    return '$' + Math.round(n);
  };

  useEffect(() => {
    leerDatosWidget().then(setWidgetData);
  }, []);

  const sincronizarWidget = async () => {
    setSincronizando(true);
    const data = calcularWidgetData(transactions, categories as any, profile, userLevel, user);
    await actualizarWidget(data);
    setWidgetData(data);
    setUltimaSync(
      new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    );
    setSincronizando(false);
  };

  // ── Widget preview ───────────────────────────────────────────────────────
  const pct = Math.min(widgetData?.porcentajeGastado ?? 0, 100);

  const barColor = pct >= 100 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#10B981';

  const pasos = Platform.OS === 'android'
    ? [
        'Mantén presionada la pantalla de inicio',
        'Toca "Widgets"',
        'Busca "FinancyAI" en la lista',
        'Arrastra el widget a tu pantalla de inicio',
        'El widget se actualiza automáticamente con la app',
      ]
    : [
        'Mantén presionada la pantalla de inicio',
        'Toca el botón "+" en la esquina superior izquierda',
        'Busca "FinancyAI" en la lista de widgets',
        'Selecciona el tamaño (pequeño o mediano)',
        'Toca "Agregar widget"',
      ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onBack} style={[s.backBtn, { backgroundColor: colors.inputBg }]}>
          <Icon name="arrow-left" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Widget de Inicio</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Previsualización */}
        <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>PREVISUALIZACIÓN</Text>
        <View style={s.widgetPreview}>
          {/* Header del widget */}
          <View style={s.wHeader}>
            <Text style={s.wBrand}>FinancyAI</Text>
            <Text style={s.wHora}>{widgetData?.ultimaActualizacion ?? '—'}</Text>
          </View>

          {/* Balance */}
          <Text style={s.wBalanceLabel}>BALANCE DISPONIBLE</Text>
          <Text style={s.wBalance}>
            {widgetData ? fmtCompacto(widgetData.balanceDisponible) : '—'}
          </Text>

          {/* Barra */}
          <View style={s.wBarTrack}>
            <View style={[s.wBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
          </View>
          <View style={s.wBarLabels}>
            <Text style={s.wBarText}>{pct}% del ingreso</Text>
            <Text style={s.wBarText}>{widgetData?.mesLabel ?? '—'}</Text>
          </View>

          {/* Pills */}
          <View style={s.wPills}>
            {[
              {
                label: 'HOY',
                value: widgetData ? fmtCompacto(widgetData.gastadoHoy) : '—',
              },
              {
                label: 'RACHA',
                value: widgetData ? `${widgetData.rachaActual}d` : '—',
              },
              {
                label: 'PRÓXIMO',
                value: widgetData?.proximoPago
                  ? (widgetData.proximoPago.diasRestantes === 0
                    ? 'Hoy'
                    : `día ${new Date().getDate() + widgetData.proximoPago.diasRestantes}`)
                  : 'Al día',
              },
            ].map(p => (
              <View key={p.label} style={s.wPill}>
                <Text style={s.wPillLabel}>{p.label}</Text>
                <Text style={s.wPillValue}>{p.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Estado de sincronización */}
        <View style={[s.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.statusIcon, { backgroundColor: widgetData ? colors.incomeLight : colors.inputBg }]}>
            <Icon
              name={widgetData ? 'check-circle' : 'clock'}
              size={18}
              color={widgetData ? colors.income : colors.textTertiary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.statusTitle, { color: colors.textPrimary }]}>
              {widgetData ? 'Widget sincronizado' : 'Sin datos en el widget'}
            </Text>
            <Text style={[s.statusSub, { color: colors.textTertiary }]}>
              {ultimaSync
                ? `Última actualización: ${ultimaSync}`
                : 'Sincroniza para que el widget muestre tus datos'}
            </Text>
          </View>
        </View>

        {/* Datos que se muestran */}
        {widgetData && (
          <>
            <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>DATOS ACTUALES</Text>
            <View style={[s.dataCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { label: 'Balance disponible', value: fmtCOP(widgetData.balanceDisponible), color: colors.income },
                { label: 'Gasto hoy',          value: fmtCOP(widgetData.gastadoHoy),        color: colors.expense },
                { label: 'Gasto del mes',      value: fmtCOP(widgetData.gastadoMes),        color: colors.expense },
                { label: 'Racha activa',       value: `${widgetData.rachaActual} días`,      color: colors.primary },
                { label: 'Nivel',              value: `${widgetData.nivelUsuario} · ${widgetData.tituloNivel}`, color: colors.primary },
              ].map((item, i, arr) => (
                <View
                  key={item.label}
                  style={[s.dataRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                >
                  <Text style={[s.dataLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                  <Text style={[s.dataValue, { color: item.color }]}>{item.value}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Botón de sincronización */}
        <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>SINCRONIZAR</Text>
        <TouchableOpacity
          style={[s.syncBtn, { backgroundColor: sincronizando ? colors.border : colors.primary }]}
          onPress={sincronizarWidget}
          disabled={sincronizando}
          activeOpacity={0.85}
        >
          <Icon name={sincronizando ? 'loader' : 'refresh-cw'} size={18} color={sincronizando ? colors.textTertiary : '#FFFFFF'} />
          <Text style={[s.syncBtnText, { color: sincronizando ? colors.textTertiary : '#FFFFFF' }]}>
            {sincronizando ? 'Sincronizando…' : 'Sincronizar widget ahora'}
          </Text>
        </TouchableOpacity>

        {/* Instrucciones */}
        <Text style={[s.sectionLabel, { color: colors.textTertiary, marginTop: 8 }]}>
          CÓMO AGREGAR EL WIDGET
        </Text>
        <View style={[s.stepsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {pasos.map((texto, i) => (
            <View
              key={i}
              style={[s.step, i < pasos.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <View style={[s.stepNum, { backgroundColor: colors.primaryLight }]}>
                <Text style={[s.stepNumText, { color: colors.primary }]}>{i + 1}</Text>
              </View>
              <Text style={[s.stepText, { color: colors.textSecondary }]}>{texto}</Text>
            </View>
          ))}
        </View>

        {/* Nota de actualización */}
        <View style={[s.noteCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
          <Icon name="info" size={15} color={colors.primary} />
          <Text style={[s.noteText, { color: colors.primary }]}>
            El widget se actualiza automáticamente cada vez que abrís la app o registrás una transacción.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  scroll: { padding: 16 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.7,
    marginTop: 20, marginBottom: 10,
  },

  // Widget preview
  widgetPreview: {
    backgroundColor: '#6366F1',
    borderRadius: 20,
    padding: 16,
    marginBottom: 4,
  },
  wHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  wBrand: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  wHora:  { fontSize: 9, color: 'rgba(255,255,255,0.55)' },
  wBalanceLabel: {
    fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.5, marginBottom: 2,
  },
  wBalance: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 10 },
  wBarTrack: {
    height: 5, backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3, marginBottom: 4, overflow: 'hidden',
  },
  wBarFill: { height: 5, borderRadius: 3 },
  wBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  wBarText: { fontSize: 8, color: 'rgba(255,255,255,0.65)' },
  wPills: { flexDirection: 'row', gap: 6 },
  wPill: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 9, padding: 7,
  },
  wPillLabel: { fontSize: 7, fontWeight: '600', color: 'rgba(255,255,255,0.65)', marginBottom: 2 },
  wPillValue: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  // Status
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  statusIcon: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  statusTitle: { fontSize: 14, fontWeight: '600' },
  statusSub:   { fontSize: 12, marginTop: 2 },

  // Data rows
  dataCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  dataRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 16,
  },
  dataLabel: { fontSize: 13 },
  dataValue: { fontSize: 13, fontWeight: '700' },

  // Sync button
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15, borderRadius: 14,
  },
  syncBtnText: { fontSize: 15, fontWeight: '700' },

  // Steps
  stepsCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  step: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNumText: { fontSize: 12, fontWeight: '700' },
  stepText: { fontSize: 13, flex: 1, lineHeight: 20 },

  // Note
  noteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 16,
  },
  noteText: { fontSize: 12, flex: 1, lineHeight: 18 },
});
