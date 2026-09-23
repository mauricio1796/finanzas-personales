import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../state/ThemeContext';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

// Componente funcional aparte porque una clase no puede usar el hook useTheme.
const ErrorFallback: React.FC<{ fallbackLabel?: string; onReset: () => void }> = ({ fallbackLabel, onReset }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Algo salió mal</Text>
      <Text style={[styles.msg, { color: colors.textSecondary }]}>{fallbackLabel ?? 'Ocurrió un error inesperado.'}</Text>
      <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={onReset}>
        <Text style={styles.btnText}>Reintentar</Text>
      </Pressable>
    </View>
  );
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : 'Error inesperado';
    return { hasError: true, errorMessage: msg };
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return <ErrorFallback fallbackLabel={this.props.fallbackLabel} onReset={this.handleReset} />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  msg: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
