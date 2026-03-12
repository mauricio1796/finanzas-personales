import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { StatusBarSim } from './StatusBarSim';
import { useTheme } from '../../state/ThemeContext';

interface MobileShellProps {
  children: React.ReactNode;
}

export const MobileShell: React.FC<MobileShellProps> = ({ children }) => {
  const { colors } = useTheme();

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.nativeContainer, { backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  }

  return (
    <View style={styles.webOuter as any}>
      <View style={[styles.shell, { backgroundColor: colors.background } as any]}>
        <StatusBarSim />
        <View style={styles.content}>
          {children}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  nativeContainer: {
    flex: 1,
  },
  webOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CBD5E1',
    paddingVertical: 20,
  },
  shell: {
    width: 390,
    maxWidth: '100%' as any,
    flex: 1,
    overflow: 'hidden',
    borderRadius: 44 as any,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 24px 64px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)',
      maxHeight: 844,
    } : {}),
  },
  content: {
    flex: 1,
  },
});
