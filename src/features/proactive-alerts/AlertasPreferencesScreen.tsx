/**
 * AlertasPreferencesScreen — pantalla de configuración de alertas proactivas.
 * Reutiliza el sistema de colores y tipografía del ThemeContext.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../state/ThemeContext';
import { useFinance }        from '../../state';
import { Icon }              from '../../components/ui/Icon';
import {
  cargarPreferencias,
  guardarPreferencias,
} from './AlertasService';
import { DEFAULT_PREFS, type AlertPreferences } from './types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

// ── Componente fila de toggle ─────────────────────────────────────────────────

interface ToggleRowProps {
  label:       string;
  sublabel?:   string;
  value:       boolean;
  onChange:    (v: boolean) => void;
  disabled?:   boolean;
  premium?:    boolean;
  accentColor: string;
  colors:      any;
}

function ToggleRow({
  label, sublabel, value, onChange, disabled, premium, accentColor, colors,
}: ToggleRowProps) {
  return (
    <View style={[
      st.row,
      { borderBottomColor: colors.border },
      disabled && { opacity: 0.45 },
    ]}>
      <View style={st.rowLabel}>
        <View style={st.rowLabelTop}>
          <Text style={[st.rowTitle, { color: colors.textPrimary }]}>{label}</Text>
          {premium && (
            <View style={[st.premiumBadge, { backgroundColor: accentColor + '20' }]}>
              <Text style={[st.premiumBadgeText, { color: accentColor }]}>Premium</Text>
            </View>
          )}
        </View>
        {sublabel && (
          <Text style={[st.rowSub, { color: colors.textSecondary }]}>{sublabel}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: accentColor + '80' }}
        thumbColor={value ? accentColor : (Platform.OS === 'android' ? '#fff' : undefined)}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function AlertasPreferencesScreen({ onBack }: Props) {
  const { colors, isDark, accentColor } = useTheme();
  const { user, premium }              = useFinance();
  const insets                         = useSafeAreaInsets();

  const [prefs,    setPrefs]    = useState<AlertPreferences>(DEFAULT_PREFS);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const userId    = user?.id ?? '';
  const isPremium = premium?.isPremium ?? false;

  // Cargar preferencias al montar
  useEffect(() => {
    if (!userId) return;
    cargarPreferencias(userId)
      .then(p => setPrefs(p))
      .finally(() => setLoading(false));
  }, [userId]);

  // Actualizar una preferencia y guardar automáticamente
  const actualizarPref = useCallback(async <K extends keyof AlertPreferences>(
    key: K,
    value: AlertPreferences[K],
  ) => {
    const nuevas = { ...prefs, [key]: value };
    setPrefs(nuevas);
    setSaving(true);
    setSaved(false);
    try {
      await guardarPreferencias(userId, { [key]: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 2_000);
    } finally {
      setSaving(false);
    }
  }, [prefs, userId]);

  // ── UI ───────────────────────────────────────────────────────────────────

  return (
    <View style={[st.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[
        st.header,
        {
          backgroundColor: colors.card,
          paddingTop:      Math.max(insets.top, 16) + 8,
          borderBottomColor: colors.border,
        },
      ]}>
        <Pressable
          onPress={onBack}
          style={st.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[st.headerTitle, { color: colors.textPrimary }]}>
          Alertas de Finn
        </Text>
        <View style={st.headerRight}>
          {saving && <ActivityIndicator size="small" color={accentColor} />}
          {saved && !saving && (
            <Icon name="check" size={18} color="#1D9E75" />
          )}
        </View>
      </View>

      {loading ? (
        <View style={st.loadingWrap}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Sección: General */}
          <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>GENERAL</Text>
          <View style={[st.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ToggleRow
              label="Alertas activas"
              sublabel="Activa o desactiva todas las alertas de Finn"
              value={prefs.alertas_activas}
              onChange={v => actualizarPref('alertas_activas', v)}
              accentColor={accentColor}
              colors={colors}
            />
          </View>

          {/* Sección: Insight diario */}
          <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>RESUMEN DIARIO</Text>
          <View style={[st.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ToggleRow
              label="Insight diario"
              sublabel="Finn resume tu estado financiero cada mañana"
              value={prefs.insight_diario_activo}
              onChange={v => actualizarPref('insight_diario_activo', v)}
              disabled={!prefs.alertas_activas || !isPremium}
              premium
              accentColor={accentColor}
              colors={colors}
            />
            {!isPremium && (
              <View style={[st.premiumNote, { backgroundColor: accentColor + '10' }]}>
                <Icon name="lock" size={13} color={accentColor} />
                <Text style={[st.premiumNoteText, { color: accentColor }]}>
                  El insight diario requiere Plan Premium
                </Text>
              </View>
            )}
          </View>

          {/* Sección: Tipos de alerta */}
          <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>TIPOS DE ALERTA</Text>
          <View style={[st.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ToggleRow
              label="Presupuesto"
              sublabel="Avisa cuando llegas al 80% o 100% de un presupuesto"
              value={prefs.alertas_presupuesto}
              onChange={v => actualizarPref('alertas_presupuesto', v)}
              disabled={!prefs.alertas_activas}
              accentColor={accentColor}
              colors={colors}
            />
            <ToggleRow
              label="Aumentos de gasto"
              sublabel="Detecta categorías con más del 35% de aumento vs el mes pasado"
              value={prefs.alertas_anomalias}
              onChange={v => actualizarPref('alertas_anomalias', v)}
              disabled={!prefs.alertas_activas}
              accentColor={accentColor}
              colors={colors}
            />
            <ToggleRow
              label="Análisis de anomalías"
              sublabel="Detecta gastos estadísticamente inusuales por categoría"
              value={prefs.alertas_anomalias}
              onChange={v => actualizarPref('alertas_anomalias', v)}
              disabled={!prefs.alertas_activas || !isPremium}
              premium
              accentColor={accentColor}
              colors={colors}
            />
            <ToggleRow
              label="Compromisos próximos"
              sublabel="Avisa si un pago fijo vence en 1–3 días y el saldo es ajustado"
              value={prefs.alertas_compromisos}
              onChange={v => actualizarPref('alertas_compromisos', v)}
              disabled={!prefs.alertas_activas}
              accentColor={accentColor}
              colors={colors}
            />
            <ToggleRow
              label="Ritmo de gasto"
              sublabel="Alerta si la proyección a fin de mes supera tu ingreso"
              value={prefs.alertas_ritmo}
              onChange={v => actualizarPref('alertas_ritmo', v)}
              disabled={!prefs.alertas_activas}
              accentColor={accentColor}
              colors={colors}
            />
            <ToggleRow
              label="Rachas de ahorro"
              sublabel="Celebra cuando llevas días consecutivos sin gastos"
              value={prefs.alertas_ahorro}
              onChange={v => actualizarPref('alertas_ahorro', v)}
              disabled={!prefs.alertas_activas}
              accentColor={accentColor}
              colors={colors}
            />
            <ToggleRow
              label="Metas cerca"
              sublabel="Avisa cuando llegas al 85% de tu meta de ahorro"
              value={prefs.alertas_metas}
              onChange={v => actualizarPref('alertas_metas', v)}
              disabled={!prefs.alertas_activas}
              accentColor={accentColor}
              colors={colors}
            />
          </View>

          {/* Sección: Límite diario */}
          <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>FRECUENCIA</Text>
          <View style={[st.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={st.row}>
              <View style={st.rowLabel}>
                <Text style={[st.rowTitle, { color: colors.textPrimary }]}>
                  Máximo de alertas por día
                </Text>
                <Text style={[st.rowSub, { color: colors.textSecondary }]}>
                  Finn no te enviará más de este número de alertas en un día
                </Text>
              </View>
              <View style={st.countWrap}>
                <Pressable
                  onPress={() => prefs.max_alertas_dia > 1 && actualizarPref('max_alertas_dia', prefs.max_alertas_dia - 1)}
                  style={[st.countBtn, { borderColor: colors.border }]}
                >
                  <Icon name="minus" size={14} color={colors.textPrimary} />
                </Pressable>
                <Text style={[st.countValue, { color: colors.textPrimary }]}>
                  {prefs.max_alertas_dia}
                </Text>
                <Pressable
                  onPress={() => prefs.max_alertas_dia < 10 && actualizarPref('max_alertas_dia', prefs.max_alertas_dia + 1)}
                  style={[st.countBtn, { borderColor: colors.border }]}
                >
                  <Icon name="plus" size={14} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Nota informativa */}
          <View style={[st.infoBox, { backgroundColor: accentColor + '10', borderColor: accentColor + '30' }]}>
            <Icon name="info" size={14} color={accentColor} />
            <Text style={[st.infoText, { color: colors.textSecondary }]}>
              Finn analiza tus finanzas al abrir la app y te avisa solo cuando detecta algo relevante. Las alertas positivas (rachas de ahorro) aparecen máximo una vez por semana.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root:    { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 20,
    paddingBottom:    16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:              12,
  },
  backBtn:     { padding: 2 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600' },
  headerRight: { width: 24, alignItems: 'center' },

  scroll: { paddingHorizontal: 20, paddingTop: 24, gap: 4 },

  sectionTitle: {
    fontSize:     11,
    fontWeight:   '600',
    letterSpacing: 0.8,
    marginBottom:  8,
    marginTop:    20,
  },

  section: {
    borderRadius: 16,
    borderWidth:  StyleSheet.hairlineWidth,
    overflow:     'hidden',
  },

  row: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:               12,
  },
  rowLabel:    { flex: 1 },
  rowLabelTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowTitle:    { fontSize: 14, fontWeight: '500' },
  rowSub:      { fontSize: 12, marginTop: 2, lineHeight: 16 },

  premiumBadge: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      6,
  },
  premiumBadgeText: { fontSize: 10, fontWeight: '600' },

  premiumNote: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    margin:         12,
    padding:        10,
    borderRadius:   10,
  },
  premiumNoteText: { fontSize: 12 },

  countWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  countBtn: {
    width:          28,
    height:         28,
    borderRadius:   8,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  countValue: { fontSize: 16, fontWeight: '600', minWidth: 20, textAlign: 'center' },

  infoBox: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            8,
    padding:        14,
    borderRadius:   12,
    borderWidth:    1,
    marginTop:      24,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
