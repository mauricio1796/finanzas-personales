import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  View,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';

import { useFinance } from '../../src/state';
import { User, Transaction, AuthState } from '../../src/types';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';

// Import screens
import { Dashboard } from '../../src/screens/Dashboard';
// TODO: Import remaining screens from new structure
// import { Ingresos } from '../../src/screens/Ingresos';
// import { Gastos } from '../../src/screens/Gastos';
// import { Categorias } from '../../src/screens/Categorias';
// import { Estadisticas } from '../../src/screens/Estadisticas';
// import { BotIA } from '../../src/screens/BotIA';
// import { Usuario } from '../../src/screens/Usuario';
// Import legacy screens temporarily
import { Ingresos } from '../../src/screens/Ingresos';
import { Gastos } from '../../src/screens/Gastos';
import { Categorias } from '../../src/screens/Categorias';
import { Estadisticas } from '../../src/screens/Estadisticas';
import { BotIA } from '../../src/screens/BotIA';
import { Usuario } from '../../src/screens/Usuario';
import { Navigation, type ScreenName } from '../../src/screens/Navigation';
import { OnboardingWelcome, OnboardingProfile, OnboardingGoal, OnboardingBudget, OnboardingConfirm, OnboardingDashboardOverlay } from '../../src/screens/Onboarding';
import OnboardingTutorial from '../../src/screens/OnboardingTutorial';

export default function HomeScreen() {
  const { setUser, user, isOnboarded, setIsOnboarded, onboardingState } = useFinance();

  // ==================== AUTH STATE ====================
  const [authState, setAuthState] = useState<AuthState>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // ==================== FINANCE STATE ====================
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('dashboard');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showOnboardingOverlay, setShowOnboardingOverlay] = useState(true);
  // Botón de reset onboarding (solo desarrollo)
  const handleResetOnboarding = async () => {
    if (window.confirm && !window.confirm('¿Seguro que quieres reiniciar el onboarding?')) return;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    if (typeof global !== 'undefined' && global.localStorage) {
      global.localStorage.clear();
    }
    // if (typeof AsyncStorage !== 'undefined') {
    //   try { await AsyncStorage.clear(); } catch {}
    // }
    if (setIsOnboarded) setIsOnboarded(false);
    window.location.reload();
  };

  // ==================== ANIMATIONS ====================
  const authAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(authAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
  }, [authState, authAnim]);

  // ==================== AUTH HANDLERS ====================
  const handleLogin = () => {
    setAuthError('');
    if (!loginEmail || !loginPassword) {
      setAuthError('Por favor completa todos los campos');
      return;
    }
    const user: User = {
      id: Date.now().toString(),
      email: loginEmail,
      name: loginEmail.split('@')[0],
    };
    setUser(user);
    setAuthState('authenticated');
    setShowTutorial(true);
    setLoginEmail('');
    setLoginPassword('');
  };

  const handleRegister = () => {
    setAuthError('');
    if (!registerName || !registerEmail || !registerPassword || !registerConfirmPassword) {
      setAuthError('Por favor completa todos los campos');
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setAuthError('Las contraseñas no coinciden');
      return;
    }
    if (registerPassword.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    const user: User = {
      id: Date.now().toString(),
      email: registerEmail,
      name: registerName,
      createdAt: new Date().toISOString(),
    };
    setUser(user);
    setAuthState('authenticated');
    setShowTutorial(true);
    setRegisterName('');
    setRegisterEmail('');
    setRegisterPassword('');
    setRegisterConfirmPassword('');
  };

  const handleLogout = async () => {
    setUser(null);
    setAuthState('login');
    await setIsOnboarded(false);
    setCurrentScreen('dashboard');
    setTransactions([]);
    setLoginEmail('');
    setLoginPassword('');
  };

  // ==================== FINANCE HANDLERS ====================
  const addTransaction = (amount: number, category: string, type: 'income' | 'expense', date: Date) => {
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      amount,
      category,
      type,
      date: date.toISOString(),
    };
    setTransactions(prev => [newTransaction, ...prev]);
  };

  const addIncome = (amount: number, category: string, date: Date) => {
    addTransaction(amount, category, 'income', date);
  };

  const addExpense = (amount: number, category: string, date: Date) => {
    addTransaction(amount, category, 'expense', date);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleNavigateToSection = (section: string) => {
    setCurrentScreen(section as ScreenName);
  };

  // handleCategoriesSelected removed (unused)

  // ==================== LOGIN SCREEN ====================
  if (!user) {
    if (authState === 'login') {
      return (
        <Modal visible transparent animationType="fade">
          <KeyboardAvoidingView
            style={styles.authContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={80}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <ThemedView style={styles.authContent}>
                <Animated.View
                  style={[
                    styles.authBox,
                    {
                      transform: [{ scale: authAnim }],
                      opacity: authAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                    },
                  ]}
                >
                  <ThemedText style={styles.authTitle}>Bienvenido 👋</ThemedText>
                  <ThemedText style={styles.authSubtitle}>Inicia sesión en tu cuenta</ThemedText>

                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Correo</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="usuario@ejemplo.com"
                      placeholderTextColor="#94A3B8"
                      value={loginEmail}
                      onChangeText={setLoginEmail}
                      keyboardType="email-address"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Contraseña</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      value={loginPassword}
                      onChangeText={setLoginPassword}
                      secureTextEntry
                    />
                  </View>

                  {authError ? (
                    <ThemedText style={styles.errorText}>{authError}</ThemedText>
                  ) : null}

                  <Pressable style={styles.primaryButton} onPress={handleLogin}>
                    <ThemedText style={styles.primaryButtonText}>Iniciar Sesión</ThemedText>
                  </Pressable>

                  <Pressable onPress={() => setAuthState('register')}>
                    <ThemedText style={styles.toggleText}>
                      ¿No tienes cuenta? <ThemedText style={styles.toggleLink}>Regístrate</ThemedText>
                    </ThemedText>
                  </Pressable>
                </Animated.View>
              </ThemedView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
      );
    }

    // ==================== REGISTER SCREEN ====================
    if (authState === 'register') {
      return (
        <Modal visible transparent animationType="fade">
          <KeyboardAvoidingView
            style={styles.authContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={80}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <ThemedView style={styles.authContent}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                  <Animated.View
                    style={[
                      styles.authBox,
                      {
                        transform: [{ scale: authAnim }],
                        opacity: authAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                      },
                    ]}
                  >
                    <ThemedText style={styles.authTitle}>Crea tu Cuenta 🚀</ThemedText>
                    <ThemedText style={styles.authSubtitle}>Completa tu información</ThemedText>

                    <View style={styles.inputGroup}>
                      <ThemedText style={styles.label}>Nombre</ThemedText>
                      <TextInput
                        style={styles.input}
                        placeholder="Tu nombre"
                        placeholderTextColor="#94A3B8"
                        value={registerName}
                        onChangeText={setRegisterName}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <ThemedText style={styles.label}>Correo</ThemedText>
                      <TextInput
                        style={styles.input}
                        placeholder="usuario@ejemplo.com"
                        placeholderTextColor="#94A3B8"
                        value={registerEmail}
                        onChangeText={setRegisterEmail}
                        keyboardType="email-address"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <ThemedText style={styles.label}>Contraseña</ThemedText>
                      <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#94A3B8"
                        value={registerPassword}
                        onChangeText={setRegisterPassword}
                        secureTextEntry
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <ThemedText style={styles.label}>Confirmar Contraseña</ThemedText>
                      <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#94A3B8"
                        value={registerConfirmPassword}
                        onChangeText={setRegisterConfirmPassword}
                        secureTextEntry
                      />
                    </View>

                    {authError ? (
                      <ThemedText style={styles.errorText}>{authError}</ThemedText>
                    ) : null}

                    <Pressable style={styles.primaryButton} onPress={handleRegister}>
                      <ThemedText style={styles.primaryButtonText}>Registrarse</ThemedText>
                    </Pressable>

                    <Pressable onPress={() => setAuthState('login')}>
                      <ThemedText style={styles.toggleText}>
                        ¿Ya tienes cuenta? <ThemedText style={styles.toggleLink}>Inicia sesión</ThemedText>
                      </ThemedText>
                    </Pressable>
                  </Animated.View>
                </ScrollView>
              </ThemedView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
      );
    }
  }

  // ==================== CATEGORY SELECTION SCREEN ====================
  if (showTutorial) {
    return (
      <>
        <View style={styles.dummyBackground} />
        <OnboardingTutorial
          visible={showTutorial}
          onComplete={() => setShowTutorial(false)}
        />
      </>
    );
  }

  // FLUJO DE ONBOARDING MULTIPANTALLA usando contexto global
  const onboardingStep = onboardingState?.step ?? 0;
  if (!isOnboarded) {
    switch (onboardingStep) {
      case 0:
        return <OnboardingWelcome />;
      case 1:
        return <OnboardingProfile />;
      case 2:
        return <OnboardingGoal />;
      case 3:
        return <OnboardingBudget />;
      case 4:
        return <OnboardingConfirm />;
      case 5:
        // Dashboard como paso final del onboarding
        return (
          <>
            <View style={styles.dashboardOnboardingContainer}>
              <Dashboard transactions={transactions} monthlySalary={user?.monthlySalary || 0} onNavigateToSection={() => {}} />
            </View>
            <OnboardingDashboardOverlay
              visible={showOnboardingOverlay}
              onComplete={() => setShowOnboardingOverlay(false)}
            />
          </>
        );
      default:
        return <OnboardingWelcome />;
    }
  }

  // ==================== MOBILE DASHBOARD ====================
  return (
    <View style={styles.mobileContainer}>
      <View style={styles.mobileHeader}>
        <ThemedText style={styles.mobileHeaderTitle}>
          {currentScreen === 'dashboard' && '📊 Dashboard'}
          {currentScreen === 'ingresos' && '📈 Ingresos'}
          {currentScreen === 'gastos' && '💸 Gastos'}
          {currentScreen === 'categorias' && '🗂️ Categorías'}
          {currentScreen === 'estadisticas' && '📉 Estadísticas'}
          {currentScreen === 'bot' && '🤖 Asistente IA'}
          {currentScreen === 'perfil' && '👤 Perfil'}
        </ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <ThemedText style={styles.logoutBtnText}>Cerrar sesión</ThemedText>
          </Pressable>
          <Pressable style={[styles.logoutBtn, { backgroundColor: '#e0e7ff' }]} onPress={handleResetOnboarding}>
            <ThemedText style={[styles.logoutBtnText, { color: '#3730a3' }]}>Reset Onboarding</ThemedText>
          </Pressable>
        </View>
      </View>
      <View style={styles.screenContent}>
        {currentScreen === 'dashboard' && (
          <Dashboard
            transactions={transactions}
            monthlySalary={0}
            onNavigateToSection={handleNavigateToSection}
          />
        )}
        {currentScreen === 'ingresos' && (
          <Ingresos
            transactions={transactions}
            onAddIncome={addIncome}
            onDeleteTransaction={deleteTransaction}
          />
        )}
        {currentScreen === 'gastos' && (
          <Gastos
            transactions={transactions}
            onAddExpense={addExpense}
            onDeleteTransaction={deleteTransaction}
          />
        )}
        {currentScreen === 'categorias' && <Categorias onCategoryUpdate={() => {}} />}
        {currentScreen === 'estadisticas' && (
          <Estadisticas transactions={transactions} monthlySalary={0} />
        )}
        {currentScreen === 'bot' && (
          <BotIA transactions={transactions} monthlySalary={0} />
        )}
        {currentScreen === 'perfil' && (
          <Usuario onLogout={handleLogout} />
        )}
      </View>
      <Navigation
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        userName={user?.name}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  authContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  scrollContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  authBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleLink: {
    color: '#0ea5e9',
    fontWeight: '700',
  },

  // Mobile Layout
  mobileContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  mobileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginTop: 10,
  },
  mobileHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
  },
  logoutBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  screenContent: {
    flex: 1,
    paddingBottom: 80,
    overflow: 'hidden',
  },
  dummyBackground: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  dashboardOnboardingContainer: {
    flex: 1,
  },
});
