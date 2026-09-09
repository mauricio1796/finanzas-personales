import { LIGHT_COLORS } from './colors';

// ─── Design tokens ────────────────────────────────────────────────────────────
// Los colores viven en un único lugar: `colors.ts` (LIGHT_COLORS / DARK_COLORS).
// `THEME.colors` es sólo una vista de la paleta light para código estático que
// no consume `useTheme()`. Para pantallas con soporte de tema usa `useTheme()`.

const STATIC_COLORS = {
  ...LIGHT_COLORS,
  // Aliases retro-compatibles usados por pantallas antiguas
  surface:          LIGHT_COLORS.card,
  surfaceSecondary: LIGHT_COLORS.cardSecondary,
};

export const THEME = {
  colors: STATIC_COLORS,
  radius: {
    sm:     10,
    md:     14,
    lg:     24,
    card:   24,
    chip:   14,
    pill:   100,
    circle: 9999,
  },
  shadow: {
    card: {
      shadowColor:   '#0B1220',
      shadowOffset:  { width: 0, height: 8 },
      shadowOpacity: 0.05,
      shadowRadius:  24,
      elevation:     3,
    },
    hero: {
      shadowColor:   '#0B1220',
      shadowOffset:  { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius:  28,
      elevation:     10,
    },
    fab: {
      shadowColor:   '#6156E8',
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius:  12,
      elevation:     8,
    },
  },
  spacing: {
    xs:  4,
    sm:  8,
    md:  12,
    lg:  16,
    xl:  24,
    xxl: 32,
  },
  font: {
    regular: '400' as const,
    medium:  '500' as const,
    bold:    '700' as const,
  },
} as const;

// Aliases convenientes para imports cortos
export const T = THEME;
