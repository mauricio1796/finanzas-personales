/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F5F5F5',
    background: '#0A0E27',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const CategoryColors: Record<string, { bg: string; border: string; light: string }> = {
  Comida: { bg: '#FF5454', border: '#FF2E2E', light: '#FFB3B3' },
  Transporte: { bg: '#00D9FF', border: '#00A8CC', light: '#66E6FF' },
  Vivienda: { bg: '#FFB800', border: '#FF9500', light: '#FFD700' },
  Servicios: { bg: '#00E5FF', border: '#00BCD4', light: '#80F7FF' },
  Ocio: { bg: '#FF00FF', border: '#D700D7', light: '#FF66FF' },
  Salud: { bg: '#00FF88', border: '#00CC6A', light: '#66FFAA' },
  Educación: { bg: '#FFD500', border: '#FFC200', light: '#FFEB99' },
  Ropa: { bg: '#FF6B9D', border: '#FF4081', light: '#FF99B9' },
  Mascotas: { bg: '#FF7043', border: '#FF5722', light: '#FF9B7B' },
  Seguros: { bg: '#7C4DFF', border: '#6A1B9A', light: '#A78BFA' },
  Suscripciones: { bg: '#FF1493', border: '#C71585', light: '#FF69B4' },
  Gimnasio: { bg: '#FF6B00', border: '#E65100', light: '#FFB366' },
  Restaurantes: { bg: '#FF4500', border: '#CC3600', light: '#FF8C66' },
  Cine: { bg: '#00D9FF', border: '#0088CC', light: '#66E6FF' },
  Viajes: { bg: '#1E90FF', border: '#0066FF', light: '#66B3FF' },
  Regalos: { bg: '#FF69B4', border: '#FF1493', light: '#FFB3D9' },
  'Cuidado Personal': { bg: '#FF00FF', border: '#D700D7', light: '#FF66FF' },
  'Deuda/Créditos': { bg: '#FF5555', border: '#FF0000', light: '#FF8888' },
  Ahorros: { bg: '#00FF88', border: '#00CC6A', light: '#66FFAA' },
  Otros: { bg: '#00D9FF', border: '#0088CC', light: '#66E6FF' },
  Entretenimiento: { bg: '#FF6B9D', border: '#FF4081', light: '#FF99B9' },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

