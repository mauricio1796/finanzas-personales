import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../state/ThemeContext';

interface MobileShellProps {
  children: React.ReactNode;
}

export const MobileShell: React.FC<MobileShellProps> = ({ children }) => {
  const { colors } = useTheme();

  if (Platform.OS === 'web') {
    return (
      <View style={[st.webRoot, { backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  }

  return (
    <View style={[st.nativeRoot, { backgroundColor: colors.background }]}>
      {children}
    </View>
  );
};

const st = StyleSheet.create({
  nativeRoot: { flex: 1 },
  webRoot:    { flex: 1, minHeight: '100vh' as any },
});
