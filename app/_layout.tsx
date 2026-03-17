import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { FinanceProvider } from '@/src/state';
import { ThemeProvider, useTheme } from '@/src/state/ThemeContext';
import { LIGHT_COLORS, DARK_COLORS } from '@/src/constants/colors';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppShell() {
  const { isDark } = useTheme();

  const navTheme = isDark
    ? { ...DarkTheme,    colors: { ...DarkTheme.colors,    background: DARK_COLORS.background,  card: DARK_COLORS.card,  border: DARK_COLORS.border  } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: LIGHT_COLORS.background, card: LIGHT_COLORS.card, border: LIGHT_COLORS.border } };

  return (
    <NavThemeProvider value={navTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <FinanceProvider>
        <AppShell />
      </FinanceProvider>
    </ThemeProvider>
  );
}
