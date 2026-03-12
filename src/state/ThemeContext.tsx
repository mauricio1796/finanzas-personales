import React, { createContext, useContext, useState, useEffect } from 'react';
import { DARK_COLORS, LIGHT_COLORS } from '../constants/colors';

export type ThemeColors = typeof DARK_COLORS;

interface ThemeContextValue {
  isDark: boolean;
  colors: ThemeColors;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  colors: DARK_COLORS,
  toggle: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(true);

  // Load persisted preference
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('financy_theme');
        if (saved === 'light') setIsDark(false);
      }
    } catch {}
  }, []);

  const toggle = () => {
    setIsDark(prev => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('financy_theme', next ? 'dark' : 'light');
        }
      } catch {}
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? DARK_COLORS : LIGHT_COLORS, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
