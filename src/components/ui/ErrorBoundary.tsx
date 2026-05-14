import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

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

    return (
      <View style={styles.container}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Algo salió mal</Text>
        <Text style={styles.msg}>{this.props.fallbackLabel ?? 'Ocurrió un error inesperado.'}</Text>
        <Pressable style={styles.btn} onPress={this.handleReset}>
          <Text style={styles.btnText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F8F7FF',
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 8, textAlign: 'center' },
  msg: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btn: {
    backgroundColor: '#6156E8',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
