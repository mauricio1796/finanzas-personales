import { Platform } from 'react-native';

export const THEME = {
  colors: {
    primary:          '#6156E8',
    primaryLight:     '#EEF0FF',
    background:       '#F8F7FF',
    surface:          '#FFFFFF',
    surfaceSecondary: '#F4F3F8',
    income:           '#1D9E75',
    incomeLight:      '#D1FAE5',
    expense:          '#F55B5B',
    expenseLight:     '#FEE2E2',
    textPrimary:      '#111827',
    textSecondary:    '#6B7280',
    textTertiary:     '#9CA3AF',
    border:           '#E5E7EB',
  },
  radius: {
    sm:     8,
    md:     12,
    lg:     20,
    pill:   100,
    circle: 9999,
  },
  shadow: {
    card: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius:  16,
      elevation:     3,
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
