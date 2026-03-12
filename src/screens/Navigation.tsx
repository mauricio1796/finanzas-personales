import React from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export type ScreenName = 'dashboard' | 'ingresos' | 'gastos' | 'categorias' | 'estadisticas' | 'bot' | 'perfil' | 'explorar' | 'historial';

interface NavigationProps {
  currentScreen: ScreenName;
  onScreenChange: (screen: ScreenName) => void;
  userName?: string;
}

export function Navigation({ currentScreen, onScreenChange, userName }: NavigationProps) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;

  const navItems: { id: ScreenName; label: string; icon: string; description?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', description: 'Resumen general' },
    { id: 'ingresos', label: 'Ingresos', icon: '📈', description: 'Registrar ingresos' },
    { id: 'gastos', label: 'Gastos', icon: '💸', description: 'Registrar gastos' },
    { id: 'categorias', label: 'Categorías', icon: '🏷️', description: 'Administrar' },
    { id: 'estadisticas', label: 'Estadísticas', icon: '📉', description: 'Análisis' },
    { id: 'bot', label: 'Asistente IA', icon: '🤖', description: 'Asesoría' },
    { id: 'perfil', label: 'Perfil', icon: '👤', description: 'Configuración' },
  ];

  if (isSmallScreen) {
    return (
      <ThemedView style={styles.mobileContainer}>
        <View style={styles.mobileNav}>
          {navItems.map(item => (
            <Pressable
              key={item.id}
              style={[
                styles.mobileNavItem,
                currentScreen === item.id && styles.mobileNavItemActive,
              ]}
              onPress={() => onScreenChange(item.id)}
            >
              <ThemedText style={styles.mobileNavIcon}>{item.icon}</ThemedText>
              {currentScreen === item.id && (
                <ThemedText style={styles.mobileNavLabel}>{item.label}</ThemedText>
              )}
            </Pressable>
          ))}
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.sidebarContainer}>
      {/* Header */}
      <View style={styles.sidebarHeader}>
        <ThemedText style={styles.logo}>💰</ThemedText>
        <ThemedText style={styles.logoText}>FinancyAI</ThemedText>
        {userName && (
          <ThemedText style={styles.userName}>Usuario: {userName}</ThemedText>
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Navigation Items */}
      <View style={styles.navList}>
        <ThemedText style={styles.sectionLabel}>MENÚ PRINCIPAL</ThemedText>
        {navItems.slice(0, 3).map(item => (
          <Pressable
            key={item.id}
            style={[
              styles.navItem,
              currentScreen === item.id && styles.navItemActive,
            ]}
            onPress={() => onScreenChange(item.id)}
          >
            <ThemedText style={styles.navIcon}>{item.icon}</ThemedText>
            <View style={styles.navTextContainer}>
              <ThemedText
                style={[
                  styles.navLabel,
                  currentScreen === item.id && styles.navLabelActive,
                ]}
              >
                {item.label}
              </ThemedText>
              <ThemedText style={styles.navDescription}>{item.description}</ThemedText>
            </View>
            {currentScreen === item.id && <View style={styles.activeIndicator} />}
          </Pressable>
        ))}

        <ThemedText style={[styles.sectionLabel, { marginTop: 20 }]}>HERRAMIENTAS</ThemedText>
        {navItems.slice(3, 6).map(item => (
          <Pressable
            key={item.id}
            style={[
              styles.navItem,
              currentScreen === item.id && styles.navItemActive,
            ]}
            onPress={() => onScreenChange(item.id)}
          >
            <ThemedText style={styles.navIcon}>{item.icon}</ThemedText>
            <View style={styles.navTextContainer}>
              <ThemedText
                style={[
                  styles.navLabel,
                  currentScreen === item.id && styles.navLabelActive,
                ]}
              >
                {item.label}
              </ThemedText>
              <ThemedText style={styles.navDescription}>{item.description}</ThemedText>
            </View>
            {currentScreen === item.id && <View style={styles.activeIndicator} />}
          </Pressable>
        ))}

        <ThemedText style={[styles.sectionLabel, { marginTop: 20 }]}>CUENTA</ThemedText>
        {navItems.slice(6).map(item => (
          <Pressable
            key={item.id}
            style={[
              styles.navItem,
              currentScreen === item.id && styles.navItemActive,
            ]}
            onPress={() => onScreenChange(item.id)}
          >
            <ThemedText style={styles.navIcon}>{item.icon}</ThemedText>
            <View style={styles.navTextContainer}>
              <ThemedText
                style={[
                  styles.navLabel,
                  currentScreen === item.id && styles.navLabelActive,
                ]}
              >
                {item.label}
              </ThemedText>
              <ThemedText style={styles.navDescription}>{item.description}</ThemedText>
            </View>
            {currentScreen === item.id && <View style={styles.activeIndicator} />}
          </Pressable>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.divider} />
      <ThemedView style={styles.sidebarFooter}>
        <ThemedText style={styles.footerVersion}>FinancyAI v1.0</ThemedText>
        <ThemedText style={styles.footerText}>Gestión financiera inteligente</ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  sidebarContainer: {
    width: 280,
    height: '100%',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    backgroundColor: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    marginBottom: 24,
    alignItems: 'center',
    paddingBottom: 16,
  },
  logo: {
    fontSize: 32,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  userName: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 12,
    textTransform: 'uppercase',
  },
  navList: {
    gap: 0,
    flex: 1,
    paddingBottom: 16,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 12,
    marginBottom: 6,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: '#dbeafe',
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
  },
  navIcon: {
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  navTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  navDescription: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  navLabelActive: {
    fontWeight: '700',
    color: '#0ea5e9',
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0ea5e9',
  },
  sidebarFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  footerVersion: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    fontWeight: '500',
  },
  mobileContainer: {
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fafafa',
  },
  mobileNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  mobileNavItem: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mobileNavItemActive: {
    backgroundColor: '#dbeafe',
    borderBottomWidth: 3,
    borderBottomColor: '#0ea5e9',
  },
  mobileNavIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  mobileNavLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0ea5e9',
  },
});