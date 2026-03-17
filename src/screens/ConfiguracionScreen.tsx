import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemePreference } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';

interface ConfiguracionScreenProps {
  onBack: () => void;
}

// ─── Mini preview card ────────────────────────────────────────────────────────
const PreviewCard = ({ isDark }: { isDark: boolean }) => {
  const bg        = isDark ? '#1C1C1F' : '#FFFFFF';
  const border    = isDark ? '#2E2E33' : '#E5E7EB';
  const textMain  = isDark ? '#F4F4F5' : '#111827';
  const textSub   = isDark ? '#A1A1AA' : '#6B7280';
  const balBg     = isDark ? '#1E1B4B' : '#EEF2FF';
  const balText   = isDark ? '#C7D2FE' : '#3730A3';
  const incomeC   = isDark ? '#34D399' : '#10B981';
  const expenseC  = isDark ? '#F87171' : '#EF4444';

  return (
    <View style={[styles.previewCard, { backgroundColor: bg, borderColor: border }]}>
      {/* Mini balance */}
      <View style={[styles.previewBalance, { backgroundColor: balBg }]}>
        <Text style={[styles.previewBalanceLabel, { color: textSub }]}>Balance disponible</Text>
        <Text style={[styles.previewBalanceValue, { color: balText }]}>$1.250.000</Text>
      </View>

      {/* Mock transactions */}
      <View style={[styles.previewTx, { borderBottomColor: border }]}>
        <View style={[styles.previewTxIcon, { backgroundColor: expenseC + '22' }]}>
          <Icon name="shopping-bag" size={12} color={expenseC} />
        </View>
        <Text style={[styles.previewTxLabel, { color: textMain }]}>Alimentación</Text>
        <Text style={[styles.previewTxAmount, { color: expenseC }]}>-$45.000</Text>
      </View>
      <View style={styles.previewTx}>
        <View style={[styles.previewTxIcon, { backgroundColor: incomeC + '22' }]}>
          <Icon name="briefcase" size={12} color={incomeC} />
        </View>
        <Text style={[styles.previewTxLabel, { color: textMain }]}>Salario</Text>
        <Text style={[styles.previewTxAmount, { color: incomeC }]}>+$2.600.000</Text>
      </View>
    </View>
  );
};

// ─── Split preview icon (system option) ──────────────────────────────────────
const SplitPreview = () => (
  <View style={styles.splitPreview}>
    <View style={styles.splitLeft} />
    <View style={styles.splitRight} />
    <View style={styles.splitDiag} />
  </View>
);

// ─── Theme option card ────────────────────────────────────────────────────────
const ThemeOption = ({
  label,
  subtitle,
  value,
  current,
  onSelect,
  colors,
  showBadge,
}: {
  label: string;
  subtitle: string;
  value: ThemePreference;
  current: ThemePreference;
  onSelect: (v: ThemePreference) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  showBadge?: boolean;
}) => {
  const isActive = value === current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }),
    ]).start();
    onSelect(value);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={[
        styles.themeOption,
        {
          backgroundColor: colors.card,
          borderColor: isActive ? colors.primary : colors.border,
          borderWidth: isActive ? 1.5 : 0.5,
        },
        { transform: [{ scale: scaleAnim }] },
      ]}>
        {/* Preview thumbnail */}
        {value === 'light' && (
          <View style={styles.previewThumb}>
            <View style={[styles.thumbBg, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
              <View style={[styles.thumbLine, { backgroundColor: '#E5E7EB' }]} />
              <View style={[styles.thumbDot,  { backgroundColor: '#6366F1' }]} />
            </View>
          </View>
        )}
        {value === 'dark' && (
          <View style={styles.previewThumb}>
            <View style={[styles.thumbBg, { backgroundColor: '#1C1C1F', borderColor: '#2E2E33' }]}>
              <View style={[styles.thumbLine, { backgroundColor: '#3F3F46' }]} />
              <View style={[styles.thumbDot,  { backgroundColor: '#818CF8' }]} />
            </View>
          </View>
        )}
        {value === 'system' && (
          <View style={styles.previewThumb}>
            <SplitPreview />
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{label}</Text>
            {showBadge && (
              <View style={[styles.recBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.recBadgeText, { color: colors.primaryText }]}>Recomendado</Text>
              </View>
            )}
          </View>
          <Text style={[styles.optionSub, { color: colors.textTertiary }]}>{subtitle}</Text>
        </View>

        {/* Radio */}
        <View style={[
          styles.radio,
          { borderColor: isActive ? colors.primary : colors.border },
          isActive && { backgroundColor: colors.primary },
        ]}>
          {isActive && <View style={styles.radioInner} />}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export function ConfiguracionScreen({ onBack }: ConfiguracionScreenProps) {
  const insets = useSafeAreaInsets();
  const { isDark, colors, preference, setPreference, toggle } = useTheme();

  const previewFade = useRef(new Animated.Value(1)).current;
  const thumbAnim   = useRef(new Animated.Value(isDark ? 1 : 0)).current;
  const [trackColor] = useState(new Animated.Value(isDark ? 1 : 0));

  // Animate preview when theme changes
  useEffect(() => {
    previewFade.setValue(0);
    Animated.timing(previewFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [isDark]);

  // Animate toggle thumb
  useEffect(() => {
    Animated.spring(thumbAnim, { toValue: isDark ? 1 : 0, useNativeDriver: true }).start();
    Animated.timing(trackColor, { toValue: isDark ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [isDark]);

  const thumbTranslate = thumbAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 30] });
  const trackBg = trackColor.interpolate({
    inputRange:  [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Icon name="arrow-left" size={20} color={colors.headerIcon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Apariencia</Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>

        {/* ── Sección tema ── */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>TEMA DE LA APP</Text>

        <ThemeOption
          label="Claro"
          subtitle="Siempre modo claro"
          value="light"
          current={preference}
          onSelect={setPreference}
          colors={colors}
        />
        <ThemeOption
          label="Oscuro"
          subtitle="Siempre modo oscuro"
          value="dark"
          current={preference}
          onSelect={setPreference}
          colors={colors}
        />
        <ThemeOption
          label="Sistema"
          subtitle="Sigue el teléfono"
          value="system"
          current={preference}
          onSelect={setPreference}
          colors={colors}
          showBadge
        />

        {/* ── Vista previa ── */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 20 }]}>VISTA PREVIA</Text>
        <Animated.View style={{ opacity: previewFade }}>
          <PreviewCard isDark={isDark} />
        </Animated.View>

        {/* ── Toggle rápido ── */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 20 }]}>CAMBIO RÁPIDO</Text>
        <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>
              {isDark ? 'Modo oscuro activo' : 'Modo claro activo'}
            </Text>
            <Text style={[styles.toggleSub, { color: colors.textTertiary }]}>
              Toca para cambiar
            </Text>
          </View>
          <TouchableOpacity onPress={toggle} activeOpacity={0.9}>
            <Animated.View style={[styles.toggleTrack, { backgroundColor: trackBg }]}>
              <Animated.View style={[
                styles.toggleThumb,
                { transform: [{ translateX: thumbTranslate }] },
              ]}>
                <Icon
                  name={isDark ? 'moon' : 'sun'}
                  size={12}
                  color={isDark ? '#000' : colors.warning}
                />
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
  },
  scroll: {
    padding: 16,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },

  // Theme option
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    gap: 12,
    marginBottom: 8,
  },
  previewThumb: {
    width: 48,
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbBg: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 4,
    gap: 4,
    justifyContent: 'center',
  },
  thumbLine: {
    height: 3,
    borderRadius: 2,
    width: '70%',
  },
  thumbDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  splitPreview: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  splitLeft: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0, right: '50%',
    backgroundColor: '#FFFFFF',
  },
  splitRight: {
    position: 'absolute',
    top: 0, left: '50%', bottom: 0, right: 0,
    backgroundColor: '#1C1C1F',
  },
  splitDiag: {
    position: 'absolute',
    top: 0, bottom: 0,
    left: '45%',
    width: 10,
    backgroundColor: '#ccc',
    transform: [{ skewX: '-8deg' }],
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionSub: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  recBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  // Preview card
  previewCard: {
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 12,
    gap: 10,
  },
  previewBalance: {
    borderRadius: 10,
    padding: 10,
  },
  previewBalanceLabel: {
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 2,
  },
  previewBalanceValue: {
    fontSize: 18,
    fontWeight: '500',
  },
  previewTx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
  },
  previewTxIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTxLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
  },
  previewTxAmount: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
    gap: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleSub: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  toggleTrack: {
    width: 56,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    position: 'relative',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
});
