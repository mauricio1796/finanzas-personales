import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  View,
  Text,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';

import { useFinance } from '../../src/state';
import { User, Transaction, AuthState } from '../../src/types';
import { useTheme } from '../../src/state/ThemeContext';
import { MobileShell } from '../../src/components/layout/MobileShell';
import { BottomNavBar } from '../../src/components/layout/BottomNavBar';
import { FinancialFeed } from '../../src/screens/FinancialFeed/FinancialFeed';
import { SplashScreen } from '../../src/screens/SplashScreen';
import { QuickAddSheet } from '../../src/components/ui/QuickAddSheet';
import { ProductTour, APP_TOUR_STEPS } from '../../src/components/ui/ProductTour';
import { storageService } from '../../src/services/storage/StorageService';

// Screens
import { FinanzasScreen } from '../../src/screens/FinanzasScreen';
import { Gastos } from '../../src/screens/Gastos';
import { Categorias } from '../../src/screens/Categorias';
import { Estadisticas } from '../../src/screens/Estadisticas';
import { BotIA } from '../../src/screens/BotIA';
import { ExplorarScreen } from '../../src/screens/ExplorarScreen';
import { HistorialScreen } from '../../src/screens/HistorialScreen';
import { Usuario } from '../../src/screens/Usuario';
import { type ScreenName } from '../../src/screens/Navigation';
import {
  OnboardingWelcome,
  OnboardingProfile,
  OnboardingCategories,
  OnboardingMontos,
  OnboardingConfirm,
} from '../../src/screens/Onboarding';

export default function HomeScreen() {
  const {
    setUser, user, isOnboarded, setIsOnboarded, onboardingState, profile,
    transactions, addTransaction: ctxAddTransaction, deleteTransaction: ctxDeleteTransaction,
  } = useFinance();
  const { colors } = useTheme();

  // ==================== SPLASH ====================
  const [showSplash, setShowSplash] = useState(true);

  // ==================== AUTH STATE ====================
  const [authState, setAuthState] = useState<AuthState>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // ==================== APP STATE ====================
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('dashboard');
  const [quickAddMode, setQuickAddMode] = useState<'income' | 'expense' | null>(null);
  const [showTour, setShowTour] = useState(false);

  // ==================== ANIMATIONS ====================
  const authAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(authAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
  }, [authState, authAnim]);

  // Auto-show tour on first login
  useEffect(() => {
    if (!user) return;
    storageService.getTourDone().then(done => {
      if (!done) {
        // Small delay so the app finishes rendering before tour starts
        const t = setTimeout(() => setShowTour(true), 600);
        return () => clearTimeout(t);
      }
    });
  }, [user?.id]);

  // ==================== AUTH HANDLERS ====================
  const handleLogin = () => {
    setAuthError('');
    if (!loginEmail || !loginPassword) {
      setAuthError('Por favor completa todos los campos');
      return;
    }
    const newUser: User = {
      id: Date.now().toString(),
      email: loginEmail,
      name: loginEmail.split('@')[0],
    };
    setUser(newUser);
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
    const newUser: User = {
      id: Date.now().toString(),
      email: registerEmail,
      name: registerName,
      createdAt: new Date().toISOString(),
    };
    setUser(newUser);
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
    setLoginEmail('');
    setLoginPassword('');
    setShowSplash(false); // don't re-show splash on logout
  };

  const handleReset = () => {
    setUser(null);
    setAuthState('login');
    setCurrentScreen('dashboard');
    setLoginEmail('');
    setLoginPassword('');
    setShowSplash(false);
  };

  // ==================== FINANCE HANDLERS ====================
  const addTransaction = (amount: number, category: string, type: 'income' | 'expense', date: Date, description?: string) => {
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      amount,
      category,
      type,
      date: date.toISOString(),
      ...(description?.trim() ? { description: description.trim() } : {}),
    };
    ctxAddTransaction(newTransaction);
  };

  const addIncome = (amount: number, category: string, date: Date, description?: string) =>
    addTransaction(amount, category, 'income', date, description);

  const addExpense = (amount: number, category: string, date: Date, description?: string) =>
    addTransaction(amount, category, 'expense', date, description);

  const deleteTransaction = (id: string) => ctxDeleteTransaction(id);

  const handleTourFinish = () => {
    setShowTour(false);
    storageService.setTourDone(true).catch(() => {});
  };

  const handleStartTour = () => {
    setCurrentScreen('dashboard');
    setTimeout(() => setShowTour(true), 300);
  };

  const handleNavigateToSection = (section: string) => {
    // FAB buttons on dashboard open the quick-add sheet instead of navigating
    if (section === 'quick_income') { setQuickAddMode('income'); return; }
    if (section === 'quick_expense') { setQuickAddMode('expense'); return; }
    setCurrentScreen(section as ScreenName);
  };

  // ==================== 0. SPLASH ====================
  if (showSplash) {
    return <MobileShell><SplashScreen onDone={() => setShowSplash(false)} /></MobileShell>;
  }

  // ==================== 1. ONBOARDING AI (PRIMERO) ====================
  // La IA recopila toda la información del usuario antes de pedir cuenta
  const onboardingStep = onboardingState?.step ?? 0;
  if (!isOnboarded) {
    switch (onboardingStep) {
      case 0:
        return <MobileShell><OnboardingWelcome /></MobileShell>;
      case 1:
        return <MobileShell><OnboardingProfile /></MobileShell>;
      case 2:
        return <MobileShell><OnboardingCategories /></MobileShell>;
      case 3:
        return <MobileShell><OnboardingMontos /></MobileShell>;
      case 4:
        return <MobileShell><OnboardingConfirm /></MobileShell>;
      default:
        return <MobileShell><OnboardingWelcome /></MobileShell>;
    }
  }

  // ==================== 2. AUTH (DESPUÉS DEL ONBOARDING) ====================
  // El perfil financiero ya está cargado; ahora el usuario crea su cuenta
  if (!user) {
    if (authState === 'login') {
      return (
        <MobileShell>
          <KeyboardAvoidingView
            style={styles.authContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={80}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.authContent}>
                <Animated.View
                  style={[
                    styles.authBox,
                    {
                      transform: [{ scale: authAnim }],
                      opacity: authAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                      backgroundColor: colors.glass_bg_medium,
                      borderColor: colors.glass_border,
                    },
                  ]}
                >
                  {/* Badge de perfil listo */}
                  <View style={styles.profileReadyBadge}>
                    <Text style={[styles.profileReadyText, { color: colors.primary }]}>✦ Tu perfil financiero está listo</Text>
                  </View>

                  <Text style={[styles.authTitle, { color: colors.text_primary }]}>¡Bienvenido{profile?.monthlySalary ? '' : ''} 🎉</Text>
                  <Text style={[styles.authSubtitle, { color: colors.text_secondary }]}>
                    Inicia sesión para acceder a tu app personalizada
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text_secondary }]}>Correo</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text_primary, borderColor: colors.glass_border, backgroundColor: colors.glass_bg }]}
                      placeholder="usuario@ejemplo.com"
                      placeholderTextColor={colors.text_tertiary}
                      value={loginEmail}
                      onChangeText={setLoginEmail}
                      keyboardType="email-address"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text_secondary }]}>Contraseña</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text_primary, borderColor: colors.glass_border, backgroundColor: colors.glass_bg }]}
                      placeholder="••••••••"
                      placeholderTextColor={colors.text_tertiary}
                      value={loginPassword}
                      onChangeText={setLoginPassword}
                      secureTextEntry
                    />
                  </View>

                  {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

                  <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleLogin}>
                    <Text style={[styles.primaryButtonText, { color: colors.background }]}>Iniciar Sesión</Text>
                  </Pressable>

                  <Pressable onPress={() => setAuthState('register')}>
                    <Text style={[styles.toggleText, { color: colors.text_secondary }]}>
                      ¿No tienes cuenta?{' '}
                      <Text style={[styles.toggleLink, { color: colors.primary }]}>Crear cuenta</Text>
                    </Text>
                  </Pressable>
                </Animated.View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </MobileShell>
      );
    }

    // ==================== REGISTER ====================
    if (authState === 'register') {
      return (
        <MobileShell>
          <KeyboardAvoidingView
            style={styles.authContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={80}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.authContent}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                  <Animated.View
                    style={[
                      styles.authBox,
                      {
                        transform: [{ scale: authAnim }],
                        opacity: authAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                        backgroundColor: colors.glass_bg_medium,
                        borderColor: colors.glass_border,
                      },
                    ]}
                  >
                    {/* Badge de perfil listo */}
                    <View style={styles.profileReadyBadge}>
                      <Text style={[styles.profileReadyText, { color: colors.primary }]}>✦ Tu perfil financiero está listo</Text>
                    </View>

                    <Text style={[styles.authTitle, { color: colors.text_primary }]}>Crea tu Cuenta 🚀</Text>
                    <Text style={[styles.authSubtitle, { color: colors.text_secondary }]}>
                      Último paso — guarda tu perfil personalizado
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: colors.text_secondary }]}>Nombre</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text_primary, borderColor: colors.glass_border, backgroundColor: colors.glass_bg }]}
                        placeholder="Tu nombre"
                        placeholderTextColor={colors.text_tertiary}
                        value={registerName}
                        onChangeText={setRegisterName}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: colors.text_secondary }]}>Correo</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text_primary, borderColor: colors.glass_border, backgroundColor: colors.glass_bg }]}
                        placeholder="usuario@ejemplo.com"
                        placeholderTextColor={colors.text_tertiary}
                        value={registerEmail}
                        onChangeText={setRegisterEmail}
                        keyboardType="email-address"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: colors.text_secondary }]}>Contraseña</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text_primary, borderColor: colors.glass_border, backgroundColor: colors.glass_bg }]}
                        placeholder="••••••••"
                        placeholderTextColor={colors.text_tertiary}
                        value={registerPassword}
                        onChangeText={setRegisterPassword}
                        secureTextEntry
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: colors.text_secondary }]}>Confirmar Contraseña</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text_primary, borderColor: colors.glass_border, backgroundColor: colors.glass_bg }]}
                        placeholder="••••••••"
                        placeholderTextColor={colors.text_tertiary}
                        value={registerConfirmPassword}
                        onChangeText={setRegisterConfirmPassword}
                        secureTextEntry
                      />
                    </View>

                    {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

                    <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleRegister}>
                      <Text style={[styles.primaryButtonText, { color: colors.background }]}>Crear Cuenta y Comenzar</Text>
                    </Pressable>

                    <Pressable onPress={() => setAuthState('login')}>
                      <Text style={[styles.toggleText, { color: colors.text_secondary }]}>
                        ¿Ya tienes cuenta?{' '}
                        <Text style={[styles.toggleLink, { color: colors.primary }]}>Inicia sesión</Text>
                      </Text>
                    </Pressable>
                  </Animated.View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </MobileShell>
      );
    }
  }

  // ==================== 3. MAIN APP (CON DATOS DEL PERFIL CARGADOS) ====================
  return (
    <MobileShell>
      <View style={styles.appContainer}>
        <View style={styles.screenContent}>
          {currentScreen === 'dashboard' && (
            <FinancialFeed
              transactions={transactions}
              onNavigateToSection={handleNavigateToSection}
            />
          )}
          {currentScreen === 'ingresos' && <FinanzasScreen />}
          {currentScreen === 'gastos' && (
            <Gastos
              transactions={transactions}
              onAddExpense={addExpense}
              onDeleteTransaction={deleteTransaction}
            />
          )}
          {currentScreen === 'categorias' && <Categorias onCategoryUpdate={() => {}} />}
          {currentScreen === 'estadisticas' && (
            <Estadisticas transactions={transactions} monthlySalary={profile?.monthlySalary || 0} />
          )}
          {currentScreen === 'bot' && (
            <BotIA transactions={transactions} monthlySalary={profile?.monthlySalary || 0} />
          )}
          {currentScreen === 'perfil' && (
            <Usuario onLogout={handleLogout} onReset={handleReset} onStartTour={handleStartTour} />
          )}
          {currentScreen === 'explorar' && (
            <ExplorarScreen />
          )}
          {currentScreen === 'historial' && (
            <HistorialScreen />
          )}
        </View>
        <BottomNavBar
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
      </View>

      {/* Product Tour */}
      <ProductTour
        steps={APP_TOUR_STEPS}
        visible={showTour}
        onFinish={handleTourFinish}
      />

      {/* Quick Add Bottom Sheet */}
      <QuickAddSheet
        visible={quickAddMode !== null}
        mode={quickAddMode ?? 'expense'}
        onClose={() => setQuickAddMode(null)}
        onAdd={(amount, category, type, date) => {
          addTransaction(amount, category, type, date);
          setQuickAddMode(null);
        }}
      />
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  // Auth
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  scrollContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    width: '100%',
  },
  authBox: {
    width: '100%',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
  },
  profileReadyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 212, 170, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.30)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  profileReadyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  authTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  authSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    fontWeight: '500',
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 14,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  toggleText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleLink: {
    fontWeight: '700',
  },
  // App layout
  appContainer: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
  },
});
