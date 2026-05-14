import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/ui/Icon';
import {
  useTheme,
  AccentKey,
  FontScaleKey,
  NumFormatKey,
  CardStyleKey,
  ACCENT_PALETTES,
  ACCENT_LABELS,
  FONT_SCALES,
  FONT_SCALE_LABELS,
  NUM_FORMAT_LABELS,
  CARD_STYLE_LABELS,
  buildFormatAmount,
} from '../state/ThemeContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PersonalizacionScreenProps {
  onBack: () => void;
}

// ─── Live preview card ────────────────────────────────────────────────────────

const PreviewCard: React.FC<{
  accentKey:  AccentKey;
  fontScale:  number;
  numFormat:  NumFormatKey;
  cardStyle:  CardStyleKey;
  isDark:     boolean;
}> = ({ accentKey, fontScale, numFormat, cardStyle, isDark }) => {
  const palette = ACCENT_PALETTES[accentKey];
  const primary = isDark ? palette.primaryDark_dm : palette.primary;
  const bg      = isDark ? '#0F0F11' : '#F8F7FF';
  const cardBg  = isDark ? '#1C1C1F' : '#FFFFFF';
  const textMain= isDark ? '#F4F4F5' : '#111827';
  const textSub = isDark ? '#A1A1AA' : '#6B7280';
  const border  = isDark ? '#2E2E33' : '#E5E7EB';

  const fmt = buildFormatAmount(numFormat);
  const fs  = (base: number) => Math.round(base * fontScale);

  // Balance card appearance
  let balanceBg = primary;
  let balanceText = '#FFFFFF';
  let balanceBorder = 'transparent';
  if (cardStyle === 'minimal') {
    balanceBg    = cardBg;
    balanceText  = textMain;
    balanceBorder = primary;
  } else if (cardStyle === 'dark') {
    balanceBg    = isDark ? '#0A0A0F' : '#111827';
    balanceText  = '#FFFFFF';
  } else if (cardStyle === 'glass') {
    balanceBg    = primary + '22';
    balanceText  = isDark ? '#FFFFFF' : textMain;
    balanceBorder = primary + '55';
  }

  return (
    <View style={[pv.wrap, { backgroundColor: bg }]}>
      {/* Balance card */}
      <View style={[pv.balCard, {
        backgroundColor: balanceBg,
        borderWidth: cardStyle === 'minimal' || cardStyle === 'glass' ? 2 : 0,
        borderColor: balanceBorder,
      }]}>
        <Text style={[pv.balLabel, { color: balanceText + 'BB', fontSize: fs(9) }]}>
          DISPONIBLE AHORA
        </Text>
        <Text style={[pv.balAmount, { color: balanceText, fontSize: fs(20) }]}>
          {fmt(2_850_000)}
        </Text>
        <View style={pv.balRow}>
          <View style={pv.balChip}>
            <Text style={[pv.balChipText, { color: balanceText + 'CC', fontSize: fs(9) }]}>
              ↑ {fmt(3_200_000)}
            </Text>
          </View>
          <View style={pv.balChip}>
            <Text style={[pv.balChipText, { color: balanceText + 'CC', fontSize: fs(9) }]}>
              ↓ {fmt(350_000)}
            </Text>
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
          <Text style={[pv.txAmt, { color: '#F55B5B', fontSize: fs(12) }]}>
            -{fmt(127_000)}
          </Text>
        </View>

        <View style={pv.txRow}>
          <View style={[pv.txIcon, { backgroundColor: primary + '22' }]}>
            <Text style={{ fontSize: fs(11) }}>💼</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[pv.txName, { color: textMain, fontSize: fs(11) }]}>Salario</Text>
            <Text style={[pv.txCat,  { color: textSub,  fontSize: fs(9)  }]}>Ingresos</Text>
          </View>
          <Text style={[pv.txAmt, { color: '#1D9E75', fontSize: fs(12) }]}>
            +{fmt(3_200_000)}
          </Text>
        </View>
      </View>

      {/* Mock nav bar */}
      <View style={[pv.nav, { backgroundColor: cardBg, borderTopColor: border }]}>
        {(['dashboard', 'bot', 'add', 'explorar', 'perfil'] as const).map((tab, i) => {
          const isActive = i === 0;
          const icons = ['home', 'message-circle', 'plus', 'compass', 'user'];
          return (
            <View key={tab} style={pv.navItem}>
              <View style={[
                pv.navIconWrap,
                isActive && { backgroundColor: primary + '18' },
              ]}>
                <Icon
                  name={icons[i] as any}
                  size={fs(13)}
                  color={isActive ? primary : (isDark ? '#71717A' : '#9CA3AF')}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const pv = StyleSheet.create({
  wrap:      { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
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
  nav:       { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, borderTopWidth: 1 },
  navItem:   { alignItems: 'center', justifyContent: 'center' },
  navIconWrap: { padding: 6, borderRadius: 10 },
});

// ─── Section helpers ──────────────────────────────────────────────────────────

const SectionTitle: React.FC<{ label: string; sub?: string }> = ({ label, sub }) => (
  <View style={s.sectionHeader}>
    <Text style={s.sectionTitle}>{label}</Text>
    {sub && <Text style={s.sectionSub}>{sub}</Text>}
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

export const PersonalizacionScreen: React.FC<PersonalizacionScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const {
    isDark, colors,
    accentKey, setAccentKey,
    fontScaleKey, setFontScaleKey,
    numFormat, setNumFormat,
    cardStyle, setCardStyle,
    fontScale,
  } = useTheme();

  // Local preview state mirrors live state
  const [prevAccent,    setPrevAccent]    = useState<AccentKey>(accentKey);
  const [prevFontScale, setPrevFontScale] = useState<FontScaleKey>(fontScaleKey);
  const [prevNumFormat, setPrevNumFormat] = useState<NumFormatKey>(numFormat);
  const [prevCardStyle, setPrevCardStyle] = useState<CardStyleKey>(cardStyle);

  const applyAccent = (k: AccentKey) => {
    setPrevAccent(k);
    setAccentKey(k);
  };
  const applyFont = (k: FontScaleKey) => {
    setPrevFontScale(k);
    setFontScaleKey(k);
  };
  const applyFormat = (k: NumFormatKey) => {
    setPrevNumFormat(k);
    setNumFormat(k);
  };
  const applyCard = (k: CardStyleKey) => {
    setPrevCardStyle(k);
    setCardStyle(k);
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Live preview ── */}
        <View style={s.previewSection}>
          <Text style={[s.previewLabel, { color: colors.textTertiary, fontSize: fs(11) }]}>
            VISTA PREVIA EN TIEMPO REAL
          </Text>
          <PreviewCard
            accentKey={prevAccent}
            fontScale={FONT_SCALES[prevFontScale]}
            numFormat={prevNumFormat}
            cardStyle={prevCardStyle}
            isDark={isDark}
          />
        </View>

        {/* ──────────────────────────────────────────────────────
            1. COLOR DE ACENTO
        ────────────────────────────────────────────────────── */}
        <SectionTitle
          label="Color principal"
          sub="Define el color de acento en toda la aplicación"
        />

        <View style={[s.card, { backgroundColor: colors.card }]}>
          <View style={s.accentGrid}>
            {(Object.keys(ACCENT_PALETTES) as AccentKey[]).map(key => {
              const palette = ACCENT_PALETTES[key];
              const color   = isDark ? palette.primaryDark_dm : palette.primary;
              const active  = prevAccent === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.accentItem, active && { borderColor: color, borderWidth: 2 }, { backgroundColor: colors.cardSecondary }]}
                  onPress={() => applyAccent(key)}
                  activeOpacity={0.75}
                >
                  <View style={[s.accentDot, { backgroundColor: color }]}>
                    {active && <Text style={s.accentCheck}>✓</Text>}
                  </View>
                  <Text style={[s.accentLabel, { color: active ? color : colors.textSecondary, fontSize: fs(11) }]}>
                    {ACCENT_LABELS[key]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ──────────────────────────────────────────────────────
            2. TAMAÑO DE TIPOGRAFÍA
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

        {/* ──────────────────────────────────────────────────────
            3. FORMATO DE NÚMEROS
        ────────────────────────────────────────────────────── */}
        <SectionTitle
          label="Formato de cantidades"
          sub="Cómo se muestran los valores monetarios"
        />

        <View style={[s.card, { backgroundColor: colors.card }]}>
          {(Object.keys(NUM_FORMAT_LABELS) as NumFormatKey[]).map((key, i, arr) => {
            const active = prevNumFormat === key;
            const descs: Record<NumFormatKey, string> = {
              cop:     'Estilo colombiano con puntos',
              usd:     'Estilo americano con comas',
              compact: 'Millones y miles abreviados',
              plain:   'Con código de moneda COP',
            };
            return (
              <TouchableOpacity
                key={key}
                style={[
                  s.optionRow,
                  i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
                onPress={() => applyFormat(key)}
                activeOpacity={0.7}
              >
                <View style={s.optionLeft}>
                  <View>
                    <Text style={[s.optionName, { color: active ? colors.primary : colors.textPrimary, fontSize: fs(14), fontWeight: '700' }]}>
                      {NUM_FORMAT_LABELS[key]}
                    </Text>
                    <Text style={[s.optionDesc, { color: colors.textTertiary, fontSize: fs(11) }]}>
                      {descs[key]}
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

        {/* ──────────────────────────────────────────────────────
            4. ESTILO DE TARJETA DE BALANCE
        ────────────────────────────────────────────────────── */}
        <SectionTitle
          label="Estilo del balance"
          sub="Apariencia de la tarjeta de balance principal"
        />

        <View style={[s.card, { backgroundColor: colors.card }]}>
          <View style={s.cardStyleGrid}>
            {(Object.keys(CARD_STYLE_LABELS) as CardStyleKey[]).map(key => {
              const active = prevCardStyle === key;
              const icons: Record<CardStyleKey, string> = {
                gradient: '🎨', minimal: '⬜', dark: '⬛', glass: '🔷',
              };
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    s.cardStyleItem,
                    { backgroundColor: colors.cardSecondary },
                    active && { borderColor: colors.primary, borderWidth: 2 },
                  ]}
                  onPress={() => applyCard(key)}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 24, marginBottom: 6 }}>{icons[key]}</Text>
                  <Text style={[s.cardStyleLabel, {
                    color: active ? colors.primary : colors.textSecondary,
                    fontSize: fs(11),
                  }]}>
                    {CARD_STYLE_LABELS[key]}
                  </Text>
                  {active && (
                    <View style={[s.cardStyleBadge, { backgroundColor: colors.primary }]}>
                      <Text style={s.cardStyleBadgeText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Reset */}
        <TouchableOpacity
          style={[s.resetBtn, { borderColor: colors.border }]}
          onPress={() => {
            applyAccent('indigo');
            applyFont('normal');
            applyFormat('cop');
            applyCard('gradient');
          }}
          activeOpacity={0.7}
        >
          <Icon name="refresh-cw" size={14} color={colors.textTertiary} />
          <Text style={[s.resetText, { color: colors.textTertiary, fontSize: fs(13) }]}>
            Restablecer valores por defecto
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

  // ── Preview ──
  previewSection: {
    marginBottom: 24,
    gap: 10,
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
    color: '#111827',
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '400',
  },

  // ── Card container ──
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Accent grid ──
  accentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  accentItem: {
    flex: 1,
    minWidth: '28%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 8,
  },
  accentDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentCheck: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  accentLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Option rows (font / format) ──
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

  // ── Card style grid ──
  cardStyleGrid: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  cardStyleItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  cardStyleLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
  cardStyleBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStyleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
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
