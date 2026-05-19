import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { LIGHT_COLORS, DARK_COLORS, AppColors } from '../constants/colors';

// ─── Accent palettes ──────────────────────────────────────────────────────────

export type AccentKey = 'indigo' | 'emerald' | 'ocean' | 'orange' | 'rose' | 'slate';

interface AccentPalette {
  primary:      string;
  primaryLight: string;
  primaryDark:  string;
  primaryText:  string;
  headerBg:     string;
  // dark-mode overrides
  primaryDark_dm:      string;
  primaryLight_dm:     string;
  primaryText_dm:      string;
  headerBg_dm:         string;
  tabActive_dm:        string;
}

export const ACCENT_PALETTES: Record<AccentKey, AccentPalette> = {
  indigo: {
    primary: '#6156E8', primaryLight: '#EEF0FF', primaryDark: '#4A3FD4',
    primaryText: '#3730A3', headerBg: '#6156E8',
    primaryDark_dm: '#818CF8', primaryLight_dm: '#1E1B4B',
    primaryText_dm: '#C7D2FE', headerBg_dm: '#312E81', tabActive_dm: '#818CF8',
  },
  emerald: {
    primary: '#059669', primaryLight: '#D1FAE5', primaryDark: '#047857',
    primaryText: '#065F46', headerBg: '#059669',
    primaryDark_dm: '#34D399', primaryLight_dm: '#064E3B',
    primaryText_dm: '#6EE7B7', headerBg_dm: '#064E3B', tabActive_dm: '#34D399',
  },
  ocean: {
    primary: '#0284C7', primaryLight: '#E0F2FE', primaryDark: '#0369A1',
    primaryText: '#0C4A6E', headerBg: '#0284C7',
    primaryDark_dm: '#38BDF8', primaryLight_dm: '#082F49',
    primaryText_dm: '#BAE6FD', headerBg_dm: '#0C4A6E', tabActive_dm: '#38BDF8',
  },
  orange: {
    primary: '#EA580C', primaryLight: '#FFF7ED', primaryDark: '#C2410C',
    primaryText: '#7C2D12', headerBg: '#EA580C',
    primaryDark_dm: '#FB923C', primaryLight_dm: '#431407',
    primaryText_dm: '#FED7AA', headerBg_dm: '#431407', tabActive_dm: '#FB923C',
  },
  rose: {
    primary: '#E11D48', primaryLight: '#FFE4E6', primaryDark: '#BE123C',
    primaryText: '#881337', headerBg: '#E11D48',
    primaryDark_dm: '#FB7185', primaryLight_dm: '#4C0519',
    primaryText_dm: '#FECDD3', headerBg_dm: '#4C0519', tabActive_dm: '#FB7185',
  },
  slate: {
    primary: '#475569', primaryLight: '#F1F5F9', primaryDark: '#334155',
    primaryText: '#1E293B', headerBg: '#475569',
    primaryDark_dm: '#94A3B8', primaryLight_dm: '#1E293B',
    primaryText_dm: '#CBD5E1', headerBg_dm: '#1E293B', tabActive_dm: '#94A3B8',
  },
};

export const ACCENT_LABELS: Record<AccentKey, string> = {
  indigo:  'Índigo',
  emerald: 'Esmeralda',
  ocean:   'Océano',
  orange:  'Naranja',
  rose:    'Rosa',
  slate:   'Pizarra',
};

// ─── Font scale ───────────────────────────────────────────────────────────────

export type FontScaleKey = 'compact' | 'normal' | 'large';

export const FONT_SCALES: Record<FontScaleKey, number> = {
  compact: 0.88,
  normal:  1.0,
  large:   1.14,
};

export const FONT_SCALE_LABELS: Record<FontScaleKey, string> = {
  compact: 'Compacto',
  normal:  'Normal',
  large:   'Grande',
};

// ─── Number format ────────────────────────────────────────────────────────────

export type NumFormatKey = 'cop' | 'usd' | 'compact' | 'plain';

export const NUM_FORMAT_LABELS: Record<NumFormatKey, string> = {
  cop:     '$1.250.000',
  usd:     '$1,250,000',
  compact: '$1.25M',
  plain:   '1.250 COP',
};

export function buildFormatAmount(fmt: NumFormatKey): (n: number) => string {
  return (n: number) => {
    const abs = Math.abs(Math.round(n));
    const sign = n < 0 ? '-' : '';
    switch (fmt) {
      case 'usd':
        return sign + '$' + abs.toLocaleString('en-US');
      case 'compact': {
        if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(2) + 'M';
        if (abs >= 1_000)     return sign + '$' + (abs / 1_000).toFixed(1) + 'K';
        return sign + '$' + abs.toString();
      }
      case 'plain':
        return sign + abs.toLocaleString('es-CO').replace(/,/g, '.') + ' COP';
      case 'cop':
      default:
        return sign + '$' + abs.toLocaleString('es-CO').replace(/,/g, '.');
    }
  };
}

// ─── Card style ───────────────────────────────────────────────────────────────

export type CardStyleKey = 'gradient' | 'minimal' | 'dark' | 'glass';

export const CARD_STYLE_LABELS: Record<CardStyleKey, string> = {
  gradient: 'Degradado',
  minimal:  'Minimalista',
  dark:     'Oscuro',
  glass:    'Cristal',
};

// ─── Balance layout ───────────────────────────────────────────────────────────

export type BalanceLayoutKey = 'clasica' | 'compacta' | 'anillo' | 'horizontal';

export const BALANCE_LAYOUT_LABELS: Record<BalanceLayoutKey, string> = {
  clasica:    'Clásica',
  compacta:   'Compacta',
  anillo:     'Anillo',
  horizontal: 'Horizontal',
};

export const BALANCE_LAYOUT_ICONS: Record<BalanceLayoutKey, string> = {
  clasica:    '▦',
  compacta:   '▬',
  anillo:     '◎',
  horizontal: '⊟',
};

// ─── Context type ─────────────────────────────────────────────────────────────

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextType {
  // Theme
  isDark:        boolean;
  colors:        AppColors;
  preference:    ThemePreference;
  setPreference: (p: ThemePreference) => void;
  toggle:        () => void;
  // Accent
  accentKey:     AccentKey;
  setAccentKey:  (k: AccentKey) => void;
  accentColor:   string;
  // Font scale
  fontScaleKey:     FontScaleKey;
  setFontScaleKey:  (k: FontScaleKey) => void;
  fontScale:        number;
  // Number format
  numFormat:        NumFormatKey;
  setNumFormat:     (k: NumFormatKey) => void;
  formatAmount:     (n: number) => string;
  // Card style
  cardStyle:        CardStyleKey;
  setCardStyle:     (k: CardStyleKey) => void;
  // Balance layout
  balanceLayout:    BalanceLayoutKey;
  setBalanceLayout: (k: BalanceLayoutKey) => void;
}

const STORAGE_KEY = '@financy_theme';
const PERSONALIZACION_KEY = '@financy_personalizacion';

const ThemeContext = createContext<ThemeContextType>({
  isDark: false, colors: LIGHT_COLORS, preference: 'system',
  setPreference: () => {}, toggle: () => {},
  accentKey: 'indigo', setAccentKey: () => {}, accentColor: '#6156E8',
  fontScaleKey: 'normal', setFontScaleKey: () => {}, fontScale: 1,
  numFormat: 'cop', setNumFormat: () => {}, formatAmount: buildFormatAmount('cop'),
  cardStyle: 'gradient', setCardStyle: () => {},
  balanceLayout: 'clasica', setBalanceLayout: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();

  const [preference,    setPreferenceState]   = useState<ThemePreference>('system');
  const [accentKey,     setAccentKeyState]     = useState<AccentKey>('indigo');
  const [fontScaleKey,  setFontScaleKeyState]  = useState<FontScaleKey>('normal');
  const [numFormat,     setNumFormatState]     = useState<NumFormatKey>('cop');
  const [cardStyle,      setCardStyleState]     = useState<CardStyleKey>('gradient');
  const [balanceLayout,  setBalanceLayoutState] = useState<BalanceLayoutKey>('clasica');
  const [loaded,         setLoaded]             = useState(false);

  // ── Load persisted prefs ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(PERSONALIZACION_KEY),
    ]).then(([themeVal, personVal]) => {
      if (themeVal === 'light' || themeVal === 'dark' || themeVal === 'system') {
        setPreferenceState(themeVal);
      }
      if (personVal) {
        try {
          const p = JSON.parse(personVal);
          if (p.accentKey    && p.accentKey    in ACCENT_PALETTES)  setAccentKeyState(p.accentKey);
          if (p.fontScaleKey && p.fontScaleKey in FONT_SCALES)      setFontScaleKeyState(p.fontScaleKey);
          if (p.numFormat    && p.numFormat    in NUM_FORMAT_LABELS) setNumFormatState(p.numFormat);
          if (p.cardStyle     && p.cardStyle     in CARD_STYLE_LABELS)     setCardStyleState(p.cardStyle);
          if (p.balanceLayout && p.balanceLayout in BALANCE_LAYOUT_LABELS) setBalanceLayoutState(p.balanceLayout);
        } catch {}
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // ── Save personalization whenever it changes ──────────────────────────────
  const savePersonalizacion = useCallback(
    (patch: Partial<{ accentKey: AccentKey; fontScaleKey: FontScaleKey; numFormat: NumFormatKey; cardStyle: CardStyleKey; balanceLayout: BalanceLayoutKey }>) => {
      AsyncStorage.getItem(PERSONALIZACION_KEY).then(raw => {
        const current = raw ? JSON.parse(raw) : {};
        AsyncStorage.setItem(PERSONALIZACION_KEY, JSON.stringify({ ...current, ...patch })).catch(() => {});
      }).catch(() => {});
    },
    [],
  );

  // ── Setters ───────────────────────────────────────────────────────────────
  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setPreference(preference === 'dark' ? 'light' : 'dark');
  }, [preference, setPreference]);

  const setAccentKey = useCallback((k: AccentKey) => {
    setAccentKeyState(k);
    savePersonalizacion({ accentKey: k });
  }, [savePersonalizacion]);

  const setFontScaleKey = useCallback((k: FontScaleKey) => {
    setFontScaleKeyState(k);
    savePersonalizacion({ fontScaleKey: k });
  }, [savePersonalizacion]);

  const setNumFormat = useCallback((k: NumFormatKey) => {
    setNumFormatState(k);
    savePersonalizacion({ numFormat: k });
  }, [savePersonalizacion]);

  const setCardStyle = useCallback((k: CardStyleKey) => {
    setCardStyleState(k);
    savePersonalizacion({ cardStyle: k });
  }, [savePersonalizacion]);

  const setBalanceLayout = useCallback((k: BalanceLayoutKey) => {
    setBalanceLayoutState(k);
    savePersonalizacion({ balanceLayout: k });
  }, [savePersonalizacion]);

  // ── Derived values ────────────────────────────────────────────────────────
  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark');

  const colors: AppColors = useMemo(() => {
    // ── Base: light/dark + accent override ───────────────────────────────────
    const base    = isDark ? DARK_COLORS : LIGHT_COLORS;
    const palette = ACCENT_PALETTES[accentKey];

    let themed: AppColors = base;
    if (accentKey !== 'indigo') {
      themed = isDark
        ? {
            ...base,
            primary:      palette.primaryDark_dm,
            primaryLight: palette.primaryLight_dm,
            primaryDark:  palette.primaryDark_dm,
            primaryText:  palette.primaryText_dm,
            tabActive:    palette.tabActive_dm,
            tabActiveBg:  palette.primaryLight_dm,
            headerBg:     palette.headerBg_dm,
            ai:           palette.primaryDark_dm,
            aiLight:      palette.primaryLight_dm,
            aiText:       palette.primaryText_dm,
          }
        : {
            ...base,
            primary:      palette.primary,
            primaryLight: palette.primaryLight,
            primaryDark:  palette.primaryDark,
            primaryText:  palette.primaryText,
            tabActive:    palette.primary,
            tabActiveBg:  palette.primaryLight,
            headerBg:     palette.headerBg,
            ai:           palette.primary,
            aiLight:      palette.primaryLight,
            aiText:       palette.primaryText,
          };
    }

    return themed;
  }, [isDark, accentKey]);

  const accentColor   = colors.primary;
  const fontScale     = FONT_SCALES[fontScaleKey];
  const formatAmount  = useMemo(() => buildFormatAmount(numFormat), [numFormat]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{
      isDark, colors, preference, setPreference, toggle,
      accentKey, setAccentKey, accentColor,
      fontScaleKey, setFontScaleKey, fontScale,
      numFormat, setNumFormat, formatAmount,
      cardStyle, setCardStyle,
      balanceLayout, setBalanceLayout,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// Backward compat
export type ThemeColors = AppColors;
