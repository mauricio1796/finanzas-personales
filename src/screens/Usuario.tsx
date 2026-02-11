import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  View,
  ScrollView,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFinance } from '@/src/core/context/FinanceContext';

interface UsuarioProps {
  onLogout?: () => void;
}

export function Usuario({ onLogout }: UsuarioProps) {
  const { width } = useWindowDimensions();
  const { user, updateUserSalary } = useFinance();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [editedEmail, setEditedEmail] = useState(user?.email || '');
  const [editedSalary, setEditedSalary] = useState(user?.monthlySalary?.toString() || '');

  const isSmallScreen = width < 768;

  const handleSave = () => {
    if (!editedName.trim() || !editedEmail.trim()) {
      Alert.alert('Error', 'El nombre y email son requeridos');
      return;
    }
    if (editedSalary && isNaN(parseFloat(editedSalary))) {
      Alert.alert('Error', 'El salario debe ser un número válido');
      return;
    }
    if (editedSalary) {
      updateUserSalary(parseFloat(editedSalary));
    }
    setIsEditing(false);
  };

  if (!user) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { paddingHorizontal: isSmallScreen ? 16 : 24 }]}>
        <ThemedText style={styles.title}>Perfil de Usuario</ThemedText>
        <ThemedView style={styles.emptyState}>
          <ThemedText style={styles.emptyStateText}>Por favor, inicia sesión primero</ThemedText>
        </ThemedView>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingHorizontal: isSmallScreen ? 16 : 24 }]}>
      <ThemedText type="title" style={styles.title}>
        Mi Perfil
      </ThemedText>

      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>
            {user.name.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
      </View>

      {/* User Info Cards */}
      {!isEditing ? (
        <ThemedView style={styles.infoSection}>
          <View style={styles.infoCard}>
            <ThemedText style={styles.infoLabel}>Nombre</ThemedText>
            <ThemedText style={styles.infoValue}>{user.name}</ThemedText>
          </View>

          <View style={styles.infoCard}>
            <ThemedText style={styles.infoLabel}>Email</ThemedText>
            <ThemedText style={styles.infoValue}>{user.email}</ThemedText>
          </View>

          <View style={styles.infoCard}>
            <ThemedText style={styles.infoLabel}>Salario Mensual</ThemedText>
            <ThemedText style={styles.infoValue}>
              {user.monthlySalary ? `$${user.monthlySalary.toFixed(2)}` : 'No establecido'}
            </ThemedText>
          </View>

          {user.createdAt && (
            <View style={styles.infoCard}>
              <ThemedText style={styles.infoLabel}>Miembro desde</ThemedText>
              <ThemedText style={styles.infoValue}>
                {new Date(user.createdAt).toLocaleDateString('es-ES')}
              </ThemedText>
            </View>
          )}

          <Pressable style={styles.editButton} onPress={() => setIsEditing(true)}>
            <ThemedText style={styles.editButtonText}>✏️ Editar Perfil</ThemedText>
          </Pressable>
        </ThemedView>
      ) : (
        <ThemedView style={styles.editSection}>
          <View>
            <ThemedText style={styles.label}>Nombre</ThemedText>
            <TextInput
              style={styles.input}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Tu nombre"
              placeholderTextColor="#999"
            />
          </View>

          <View>
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={styles.input}
              value={editedEmail}
              onChangeText={setEditedEmail}
              placeholder="tu@email.com"
              placeholderTextColor="#999"
              editable={false}
            />
          </View>

          <View>
            <ThemedText style={styles.label}>Salario Mensual</ThemedText>
            <TextInput
              style={styles.input}
              value={editedSalary}
              onChangeText={setEditedSalary}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.buttonGroup}>
            <Pressable style={[styles.button, styles.saveButton]} onPress={handleSave}>
              <ThemedText style={styles.buttonText}>Guardar Cambios</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                setIsEditing(false);
                setEditedName(user.name);
                setEditedEmail(user.email);
                setEditedSalary(user.monthlySalary?.toString() || '');
              }}
            >
              <ThemedText style={styles.buttonText}>Cancelar</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      )}

      {/* Additional Info */}
      <ThemedView style={styles.statsSection}>
        <ThemedText style={styles.statsTitle}>📊 Información de Cuenta</ThemedText>
        <View style={styles.statRow}>
          <ThemedText style={styles.statLabel}>ID de Usuario</ThemedText>
          <ThemedText style={styles.statValue}>{user.id}</ThemedText>
        </View>
      </ThemedView>

      {/* Logout Button */}
      <Pressable
        style={styles.logoutButton}
        onPress={() => {
          Alert.alert(
            'Cerrar Sesión',
            '¿Estás seguro de que deseas cerrar sesión?',
            [
              { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
              {
                text: 'Cerrar Sesión',
                onPress: onLogout,
                style: 'destructive',
              },
            ]
          );
        }}
      >
        <ThemedText style={styles.logoutButtonText}>🚪 Cerrar Sesión</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingVertical: 28,
    gap: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 24,
    color: '#1f2937',
    letterSpacing: 0.3,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#ffffff',
  },
  infoSection: {
    gap: 12,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  editButton: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  editSection: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1f2937',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#ffffff',
    fontWeight: '500',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButton: {
    backgroundColor: '#22c55e',
  },
  cancelButton: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  statsSection: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  statRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
  },
  logoutButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
    borderWidth: 2,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400e',
  },
});
