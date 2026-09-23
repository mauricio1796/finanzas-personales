import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/ui/Icon';
import {
  useTheme,
  FontScaleKey,
  FONT_SCALES,
  FONT_SCALE_LABELS,
  buildFormatAmount,
} from '../state/ThemeContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PersonalizacionScreenProps {
  onBack: () => void;
}

// ─── Live preview card ────────────────────────────────────────────────────────
// Muestra cómo se ve el tamaño de texto elegido sobre el tema activo (claro/oscuro),
// con la tarjeta de balance clásica — el resto de opciones (acento, formato,
// estilo de tarjeta, layout) se quitaron para no salirse del alcance documentado.

const PreviewCard: React.FC<{ fontScale: number; isDark: boolean; primary: string }> = ({ fontScale, isDark, primary }) => {
  const bg      = isDark ? '#0F0F11' : '#F8F7FF';
  const cardBg  = isDark ? '#1C1C1F' : '#FFFFFF';
  const textMain= isDark ? '#F4F4F5' : '#111827';
  const textSub = isDark ? '#A1A1AA' : '#6B7280';
  const border  = isDark ? '#2E2E33' : '#E5E7EB';

  const fmt = buildFormatAmount('cop');
  const fs  = (base: number) => Math.round(base * fontScale);

  return (
    <View style={[pv.wrap, { backgroundColor: bg, borderColor: border }]}>
      <View style={[pv.balCard, { backgroundColor: primary }]}>
        <Text style={[pv.balLabel, { color: '#FFFFFFBB', fontSize: fs(9) }]}>DISPONIBLE AHORA</Text>
        <Text style={[pv.balAmount, { color: '#FFFFFF', fontSize: fs(20) }]}>{fmt(2_850_000)}</Text>
        <View style={pv.balRow}>
          <View style={pv.balChip}>
            <Text style={[pv.balChipText, { color: '#FFFFFFCC', fontSize: fs(9) }]}>↑ {fmt(3_200_000)}</Text>
          </View>
          <View style={pv.balChip}>
            <Text style={[pv.balChipText, { color: '#FFFFFFCC', fontSize: fs(9) }]}>↓ {fmt(350_000)}</Text>
          </View>
        </View>
      </View>

      {/* Mock transactions */}
      <View style={[pv.card, { backgroundColor: cardBg, borderColor: border }]}>
        <Text style={[pv.sectionLabel, { color: textSub, fontSize: fs(8) }]}>HOY</Text>

        <View style={[pv.txRow, { borderBottomColor: border }]}>
          <View style={[pv.txIcon, { backgroundColor: '#F55B5B22' }]}>
            <Text style={{ fontSize: fs(11) }}>🛒</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[pv.txName, { color: textMain, fontSize: fs(11) }]}>Supermercado</Text>
            <Text style={[pv.txCat,  { color: textSub,  fontSize: fs(9)  }]}>Alimentación</Text>
          </View>
          <Text style={[pv.txAmt, { color: '#F55B5B', fontSize: fs(12) }]}>-{fmt(127_000)}</Text>
        </View>

        <View style={pv.txRow}>
          <View style={[pv.txIcon, { backgroundColor: primary + '22' }]}>
            <Text style={{ fontSize: fs(11) }}>💼</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[pv.txName, { color: textMain, fontSize: fs(11) }]}>Salario</Text>
            <Text style={[pv.txCat,  { color: textSub,  fontSize: fs(9)  }]}>Ingresos</Text>
          </View>
          <Text style={[pv.txAmt, { color: '#1D9E75', fontSize: fs(12) }]}>+{fmt(3_200_000)}</Text>
        </View>
      </View>
    </View>
  );
};

const pv = StyleSheet.create({
  wrap:      { borderRadius: 16, overflow: 'hidden', borderWidth: 1, gap: 0 },
  balCard:   { padding: 16, gap: 6 },
  balLabel:  { fontWeight: '700', letterSpacing: 0.5 },
  balAmount: { fontWeight: '800', letterSpacing: -1 },
  balRow:    { flexDirection: 'row', gap: 8, marginTop: 4 },
  balChip:   { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  balChipText: { fontWeight: '600' },
  card:      { padding: 12, borderTopWidth: 1 },
  sectionLabel: { fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  txRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  txIcon:    { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txName:    { fontWeight: '600' },
  txCat:     { fontWeight: '400' },
  txAmt:     { fontWeight: '700' },
});

// ─── Section helpers ──────────────────────────────────────────────────────────

const SectionTitle: React.FC<{ label: string; sub?: string }> = ({ label, sub }) => {
  const { colors } = useTheme();
  return (
    <View style={s.sectionHeader}>
      <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>{label}</Text>
      {sub && <Text style={[s.sectionSub, { color: colors.textSecondary }]}>{sub}</Text>}
    </View>
  );
};


// ─── Main screen ──────────────────────────────────────────────────────────────

export const PersonalizacionScreen: React.FC<PersonalizacionScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const {
    isDark, colors,
    fontScaleKey, setFontScaleKey,
    fontScale,
  } = useTheme();

  // Local preview state mirrora el estado real
  const [prevFontScale, setPrevFontScale] = useState<FontScaleKey>(fontScaleKey);

  const applyFont = (k: FontScaleKey) => {
    setPrevFontScale(k);
    setFontScaleKey(k);
  };

  const fs = (base: number) => Math.round(base * fontScale);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: colors.textPrimary, fontSize: fs(17) }]}>Personalización</Text>
          <Text style={[s.headerSub, { color: colors.textSecondary, fontSize: fs(12) }]}>Haz la app tuya</Text>
        </View>
      </View>

      {/* ── Sticky live preview ── */}
      <View style={[s.previewSticky, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[s.previewLabel, { color: colors.textTertiary, fontSize: fs(11) }]}>
          VISTA PREVIA
        </Text>
        <PreviewCard
          fontScale={FONT_SCALES[prevFontScale]}
          isDark={isDark}
          primary={colors.primary}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ──────────────────────────────────────────────────────
            TAMAÑO DE TIPOGRAFÍA
        ────────────────────────────────────────────────────── */}
        <SectionTitle
          label="Tamaño de texto"
          sub="Ajusta la escala tipográfica de toda la interfaz"
        />

        <View style={[s.card, { backgroundColor: colors.card }]}>
          {(Object.keys(FONT_SCALE_LABELS) as FontScaleKey[]).map((key, i, arr) => {
            const active = prevFontScale === key;
            const examples = { compact: 'Aa', normal: 'Aa', large: 'Aa' };
            const sizes    = { compact: fs(14) * 0.88, normal: fs(16), large: fs(18) * 1.14 };
            return (
              <TouchableOpacity
                key={key}
                style={[
                  s.optionRow,
                  i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
                onPress={() => applyFont(key)}
                activeOpacity={0.7}
              >
                <View style={s.optionLeft}>
                  <Text style={{ fontSize: sizes[key], fontWeight: '700', color: active ? colors.primary : colors.textPrimary, marginRight: 14, width: 28 }}>
                    {examples[key]}
                  </Text>
                  <View>
                    <Text style={[s.optionName, { color: colors.textPrimary, fontSize: fs(14) }]}>{FONT_SCALE_LABELS[key]}</Text>
                    <Text style={[s.optionDesc, { color: colors.textTertiary, fontSize: fs(11) }]}>
                      {key === 'compact' ? 'Más contenido visible' : key === 'normal' ? 'Tamaño estándar' : 'Mayor legibilidad'}
                    </Text>
                  </View>
                </View>
                <View style={[s.radioOuter, { borderColor: active ? colors.primary : colors.border }]}>
                  {active && <View style={[s.radioInner, { backgroundColor: colors.primary }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Reset */}
        <TouchableOpacity
          style={[s.resetBtn, { borderColor: colors.border }]}
          onPress={() => applyFont('normal')}
          activeOpacity={0.7}
        >
          <Icon name="refresh-cw" size={14} color={colors.textTertiary} />
          <Text style={[s.resetText, { color: colors.textTertiary, fontSize: fs(13) }]}>
            Restablecer tamaño de texto
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontWeight: '500',
    marginTop: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 8,
  },

  // ── Preview (sticky) ──
  previewSticky: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  previewLabel: {
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  // ── Section header ──
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '400',
  },

  // ── Card container ──
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 2,
  },

  // ── Option rows (font) ──
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  optionName: {
    fontWeight: '600',
  },
  optionDesc: {
    marginTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // ── Reset ──
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  resetText: {
    fontWeight: '500',
  },
});
