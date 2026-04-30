import { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  View,
  Text,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  BackHandler,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;

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
import { authService } from '../../src/services/supabase/AuthService';
import { supabaseService } from '../../src/services/supabase/SupabaseService';
import { DashboardSkeleton } from '../../src/components/ui/SkeletonLoader';
import { Toast, useToast } from '../../src/components/ui/Toast';
import { ResumenSemanalScreen } from '../../src/screens/ResumenSemanalScreen';
import { ResumenMensualScreen } from '../../src/screens/ResumenMensualScreen';
import { SimuladorDecisionesScreen } from '../../src/screens/SimuladorDecisionesScreen';
import { ExportarReporteScreen } from '../../src/screens/ExportarReporteScreen';
import { WidgetConfigScreen } from '../../src/screens/WidgetConfigScreen';
import { deberiasMostrarResumen } from '../../src/utils/resumenMensualUtils';
import { GamificacionScreen } from '../../src/screens/GamificacionScreen';
import { ConfiguracionScreen } from '../../src/screens/ConfiguracionScreen';
import { ResumenSemanalCard } from '../../src/components/finanzas/ResumenSemanalCard';
import { type NotifData } from '../../src/services/NotificacionesService';
import { useNotificacionesManager } from '../../src/hooks/useNotificacionesManager';
import { useWidgetSync } from '../../src/hooks/useWidgetSync';
import * as Notifications from 'expo-notifications';

// Screens
import { FinanzasScreen } from '../../src/screens/FinanzasScreen';
import { Gastos } from '../../src/screens/Gastos';
import { Categorias } from '../../src/screens/Categorias';
import { CategoriasScreen } from '../../src/screens/CategoriasScreen';
import { Estadisticas } from '../../src/screens/Estadisticas';
import { BotIA } from '../../src/screens/BotIA';
import { ExplorarScreen } from '../../src/screens/ExplorarScreen';
import { HistorialScreen } from '../../src/screens/HistorialScreen';
import { RetosScreen } from '../../src/screens/RetosScreen';
import { CalendarioScreen } from '../../src/screens/CalendarioScreen';
import { AcademiaScreen } from '../../src/screens/AcademiaScreen';
import { ProyeccionesScreen } from '../../src/screens/ProyeccionesScreen';
import { MetasScreen } from '../../src/screens/MetasScreen';
import { DeudasScreen } from '../../src/screens/DeudasScreen';
import { RecurrentesScreen } from '../../src/screens/RecurrentesScreen';
import { Usuario } from '../../src/screens/Usuario';
import { type ScreenName } from '../../src/screens/Navigation';
import {
  OnboardingWelcome,
  OnboardingProfile,
  OnboardingSalario,
  OnboardingCategories,
  OnboardingMontos,
  OnboardingConfirm,
} from '../../src/screens/Onboarding';

type OnboardingStep = 'welcome' | 'profile' | 'salario' | 'categories' | 'montos' | 'confirm';
const ONBOARDING_STEPS: OnboardingStep[] = ['welcome', 'profile', 'salario', 'categories', 'montos', 'confirm'];

const TAB_KEYS = ['dashboard', 'categorias', 'estadisticas', 'perfil'];
function getTabActivo(screen: string): string {
  if (TAB_KEYS.includes(screen)) return screen;
  if (screen === 'configuracion') return 'perfil';
  return 'dashboard';
}
function mostrarBottomNav(screen: string): boolean {
  return TAB_KEYS.includes(screen);
}

export default function HomeScreen() {
  const {
    setUser, user, isOnboarded, setIsOnboarded, onboardingState, updateOnboardingStep, profile,
    transactions, categories, goal, userLevel, leccionesCompletadas, retosCompletados, retoActivo, premium,
    addTransaction: ctxAddTransaction, deleteTransaction: ctxDeleteTransaction,
    isLoading, importServerData,
  } = useFinance();
  const { colors } = useTheme();

  // ==================== NOTIFICATIONS ====================
  useNotificacionesManager();
  useWidgetSync();

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
  const [authLoading, setAuthLoading] = useState(false);

  // ==================== APP STATE ====================
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('dashboard');
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [quickAddMode, setQuickAddMode] = useState<'income' | 'expense' | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [botInitialMessage, setBotInitialMessage] = useState<string | undefined>(undefined);
  const [resumenMensualMes, setResumenMensualMes] = useState<{ mes: number; año: number } | undefined>(undefined);
  const { toast, mostrar: mostrarToast, ocultar: ocultarToast } = useToast();

  // ==================== NAVIGATION STACK ====================
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  // Tab scroll-to-top refs
  const tabScrollRef = useRef<ScrollView | null>(null);

  const ejecutarTransicion = useCallback((callback: () => void, goingBack = false) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, {
        toValue: goingBack ? SCREEN_W * 0.3 : -SCREEN_W * 0.08,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      slideAnim.setValue(goingBack ? -SCREEN_W * 0.08 : SCREEN_W * 0.08);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]).start();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navegarA = useCallback((screen: string) => {
    if (screen === currentScreen) return;
    ejecutarTransicion(() => {
      setNavHistory(prev => [...prev, currentScreen].slice(-10));
      setCurrentScreen(screen as ScreenName);
    }, false);
  }, [currentScreen, ejecutarTransicion]);

  const volver = useCallback(() => {
    const prev = navHistory.length > 0 ? navHistory[navHistory.length - 1] : 'dashboard';
    ejecutarTransicion(() => {
      setNavHistory(h => h.slice(0, -1));
      setCurrentScreen(prev as ScreenName);
    }, true);
  }, [navHistory, ejecutarTransicion]);

  const navegarATab = useCallback((screen: string) => {
    setNavHistory([]);
    Animated.timing(fadeAnim, { toValue: 0, duration: 80, useNativeDriver: true })
      .start(() => {
        setCurrentScreen(screen as ScreenName);
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScrollToTop = useCallback(() => {
    tabScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // ==================== ONBOARDING STEP MACHINE ====================
  const storedIdx = onboardingState?.step ?? 0;
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(
    ONBOARDING_STEPS[Math.min(storedIdx, ONBOARDING_STEPS.length - 1)] ?? 'profile'
  );
  const onboardingAnim = useRef(new Animated.Value(1)).current;

  // Reset onboarding step to the beginning whenever isOnboarded is cleared (e.g. resetAll)
  useEffect(() => {
    if (!isOnboarded) {
      setOnboardingStep(ONBOARDING_STEPS[0]);
    }
  }, [isOnboarded]);

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
        const t = setTimeout(() => setShowTour(true), 600);
        return () => clearTimeout(t);
      }
    });

    // Auto-show monthly close screen if applicable
    const t = setTimeout(() => {
      deberiasMostrarResumen().then(({ mostrar, mes, año }) => {
        if (mostrar) {
          setResumenMensualMes({ mes, año });
          setCurrentScreen('resumenMensual');
        }
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [user?.id]);

  // Notification listeners — tap opens the target screen
  useEffect(() => {
    const SCREEN_MAP: Record<string, string> = {
      'dashboard':      'dashboard',
      'categorias':     'categorias',
      'estadisticas':   'estadisticas',
      'historial':      'historial',
      'resumenSemanal': 'resumenSemanal',
      'resumenMensual': 'resumenMensual',
      'gamificacion':   'gamificacion',
      'bot':            'bot',
    };

    const tapSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as unknown as NotifData | undefined;

      // New format: data.screen
      if (data?.screen) {
        const target = SCREEN_MAP[data.screen] ?? data.screen;
        navegarA(target);
        return;
      }

      // Legacy format: data.type
      const legacyType = (data as any)?.type;
      if (legacyType === 'weekly_summary') setCurrentScreen('resumenSemanal');
      if (legacyType === 'cierre_mes') { setResumenMensualMes(undefined); setCurrentScreen('resumenMensual'); }
    });

    const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as unknown as NotifData | undefined;
      if (data?.tipo === 'presupuesto_limite' || data?.tipo === 'gasto_inusual') {
        // Handled passively — the notification banner is shown by the OS
        // and the app will react when the user taps it
      }
    });

    return () => {
      tapSub.remove();
      foregroundSub.remove();
    };
  }, [navegarA]);

  // ==================== AUTH HANDLERS ====================
  const handleLogin = async () => {
    setAuthError('');
    if (!loginEmail || !loginPassword) {
      setAuthError('Por favor completa todos los campos');
      return;
    }
    setAuthLoading(true);
    try {
      if (authService.isReady) {
        // ── Auth real con Supabase ──────────────────────────────────────────
        const { user: sbUser, error } = await authService.signIn(loginEmail, loginPassword);
        if (error || !sbUser) { setAuthError(error ?? 'Error al iniciar sesión'); return; }

        setUser(sbUser);

        // Traer datos del servidor y cargarlos en el contexto
        const serverData = await supabaseService.pullFromServer(sbUser.id);
        if (serverData) {
          await importServerData(serverData);
          // Sincronizar el nombre en el contexto del usuario si el servidor lo tiene
          if (serverData.name && serverData.name !== sbUser.name) {
            setUser({ ...sbUser, name: serverData.name, monthlySalary: serverData.monthlySalary || sbUser.monthlySalary });
          }
        }
      } else {
        // ── Fallback local (sin Supabase configurado) ─────────────────────
        const newUser: User = {
          id: Date.now().toString(),
          email: loginEmail,
          name: loginEmail.split('@')[0],
        };
        setUser(newUser);
      }
      setLoginEmail('');
      setLoginPassword('');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async () => {
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
    setAuthLoading(true);
    try {
      if (authService.isReady) {
        // ── Auth real con Supabase ──────────────────────────────────────────
        const { user: sbUser, error } = await authService.signUp(registerEmail, registerPassword, registerName);
        if (error || !sbUser) { setAuthError(error ?? 'Error al crear cuenta'); return; }

        setUser(sbUser);

        // Subir todos los datos locales del onboarding al servidor
        await supabaseService.pushAllToServer(sbUser.id, {
          transactions,
          categories,
          profile: profile ?? null,
          goal: goal ?? null,
          userLevel: userLevel ?? null,
          leccionesCompletadas,
          retosCompletados,
          retoActivo: retoActivo ?? null,
          premium,
          isOnboarded,
          name: registerName,
          monthlySalary: profile?.monthlySalary ?? sbUser.monthlySalary ?? 0,
        });
      } else {
        // ── Fallback local (sin Supabase configurado) ─────────────────────
        const newUser: User = {
          id: Date.now().toString(),
          email: registerEmail,
          name: registerName,
          createdAt: new Date().toISOString(),
        };
        setUser(newUser);
      }
      setRegisterName('');
      setRegisterEmail('');
      setRegisterPassword('');
      setRegisterConfirmPassword('');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (authService.isReady) {
      await authService.signOut();
    }
    setUser(null);
    setAuthState('login');
    await setIsOnboarded(false);
    setCurrentScreen('dashboard');
    setLoginEmail('');
    setLoginPassword('');
    setShowSplash(false);
  };

  const handleReset = () => {
    setUser(null);
    setAuthState('login');
    setCurrentScreen('dashboard');
    setLoginEmail('');
    setLoginPassword('');
    setShowSplash(true);
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
    if (section === 'quick_income') { setQuickAddMode('income'); return; }
    if (section === 'quick_expense') { setQuickAddMode('expense'); return; }
    navegarA(section);
  };

  // ── Android hardware back button ──────────────────────────────────────────
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (quickAddMode !== null) { setQuickAddMode(null); return true; }
      if (TAB_KEYS.includes(currentScreen)) return false; // let OS handle (exit app)
      volver();
      return true;
    });
    return () => subscription.remove();
  }, [quickAddMode, currentScreen, volver]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== 0. SPLASH ====================
  if (showSplash) {
    return <MobileShell><SplashScreen onDone={() => setShowSplash(false)} /></MobileShell>;
  }

  // ==================== 0b. LOADING (hydrating AsyncStorage) ====================
  if (isLoading) {
    return <MobileShell><DashboardSkeleton /></MobileShell>;
  }

  // ==================== 1. ONBOARDING AI (PRIMERO) ====================

  const goNext = () => {
    const idx = ONBOARDING_STEPS.indexOf(onboardingStep);
    if (idx < ONBOARDING_STEPS.length - 1) {
      const nextStep = ONBOARDING_STEPS[idx + 1];
      updateOnboardingStep(idx + 1);
      onboardingAnim.setValue(0);
      setOnboardingStep(nextStep);
      Animated.timing(onboardingAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    }
  };

  const goBack = () => {
    const idx = ONBOARDING_STEPS.indexOf(onboardingStep);
    if (idx > 0) {
      onboardingAnim.setValue(0);
      setOnboardingStep(ONBOARDING_STEPS[idx - 1]);
      Animated.timing(onboardingAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
  };

  if (!isOnboarded) {
    const slideX = onboardingAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
    const wrapStyle = { flex: 1, opacity: onboardingAnim, transform: [{ translateX: slideX }] };
    return (
      <MobileShell>
        <Animated.View style={wrapStyle}>
          {onboardingStep === 'welcome'    && <OnboardingWelcome    onNext={goNext} />}
          {onboardingStep === 'profile'    && <OnboardingProfile    onNext={goNext} onBack={goBack} />}
          {onboardingStep === 'salario'    && <OnboardingSalario    onNext={goNext} onBack={goBack} />}
          {onboardingStep === 'categories' && <OnboardingCategories onNext={goNext} onBack={goBack} />}
          {onboardingStep === 'montos'     && <OnboardingMontos     onNext={goNext} onBack={goBack} />}
          {onboardingStep === 'confirm'    && <OnboardingConfirm    onDone={goNext} />}
        </Animated.View>
      </MobileShell>
    );
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
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* Badge de perfil listo */}
                  <View style={styles.profileReadyBadge}>
                    <Text style={[styles.profileReadyText, { color: colors.primary }]}>✦ Tu perfil financiero está listo</Text>
                  </View>

                  <Text style={[styles.authTitle, { color: colors.textPrimary }]}>¡Bienvenido{profile?.monthlySalary ? '' : ''} 🎉</Text>
                  <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
                    Inicia sesión para acceder a tu app personalizada
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Correo</Text>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                      placeholder="usuario@ejemplo.com"
                      placeholderTextColor={colors.textTertiary}
                      value={loginEmail}
                      onChangeText={setLoginEmail}
                      keyboardType="email-address"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Contraseña</Text>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                      placeholder="••••••••"
                      placeholderTextColor={colors.textTertiary}
                      value={loginPassword}
                      onChangeText={setLoginPassword}
                      secureTextEntry
                    />
                  </View>

                  {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

                  <Pressable
                    style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: authLoading ? 0.7 : 1 }]}
                    onPress={handleLogin}
                    disabled={authLoading}
                  >
                    <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                      {authLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </Text>
                  </Pressable>

                  <Pressable onPress={() => setAuthState('register')}>
                    <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
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
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {/* Badge de perfil listo */}
                    <View style={styles.profileReadyBadge}>
                      <Text style={[styles.profileReadyText, { color: colors.primary }]}>✦ Tu perfil financiero está listo</Text>
                    </View>

                    <Text style={[styles.authTitle, { color: colors.textPrimary }]}>Crea tu Cuenta 🚀</Text>
                    <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
                      Último paso — guarda tu perfil personalizado
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Nombre</Text>
                      <TextInput
                        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                        placeholder="Tu nombre"
                        placeholderTextColor={colors.textTertiary}
                        value={registerName}
                        onChangeText={setRegisterName}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Correo</Text>
                      <TextInput
                        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                        placeholder="usuario@ejemplo.com"
                        placeholderTextColor={colors.textTertiary}
                        value={registerEmail}
                        onChangeText={setRegisterEmail}
                        keyboardType="email-address"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Contraseña</Text>
                      <TextInput
                        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                        placeholder="••••••••"
                        placeholderTextColor={colors.textTertiary}
                        value={registerPassword}
                        onChangeText={setRegisterPassword}
                        secureTextEntry
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Confirmar Contraseña</Text>
                      <TextInput
                        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                        placeholder="••••••••"
                        placeholderTextColor={colors.textTertiary}
                        value={registerConfirmPassword}
                        onChangeText={setRegisterConfirmPassword}
                        secureTextEntry
                      />
                    </View>

                    {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

                    <Pressable
                      style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: authLoading ? 0.7 : 1 }]}
                      onPress={handleRegister}
                      disabled={authLoading}
                    >
                      <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                        {authLoading ? 'Creando cuenta...' : 'Crear Cuenta y Comenzar'}
                      </Text>
                    </Pressable>

                    <Pressable onPress={() => setAuthState('login')}>
                      <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
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
        <Toast
          visible={toast.visible}
          mensaje={toast.mensaje}
          tipo={toast.tipo}
          onHide={ocultarToast}
        />
        <Animated.View style={[styles.screenContent, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
          {currentScreen === 'dashboard' && (
            <FinancialFeed
              onNavigate={handleNavigateToSection}
              onOpenBot={(msg) => {
                setBotInitialMessage(msg);
                navegarA('bot');
              }}
            />
          )}
          {currentScreen === 'ingresos' && <FinanzasScreen onBack={volver} />}
          {currentScreen === 'gastos' && (
            <Gastos
              transactions={transactions}
              onAddExpense={addExpense}
              onDeleteTransaction={deleteTransaction}
              onBack={volver}
            />
          )}
          {currentScreen === 'categorias' && <CategoriasScreen onNavigate={navegarA} />}
          {currentScreen === 'estadisticas' && (
            <Estadisticas
              onBack={volver}
              onNavigate={navegarA}
            />
          )}
          {currentScreen === 'bot' && (
            <BotIA transactions={transactions} monthlySalary={profile?.monthlySalary || 0} onBack={volver} />
          )}
          {currentScreen === 'perfil' && (
            <Usuario
              onLogout={handleLogout}
              onReset={handleReset}
              onStartTour={handleStartTour}
              onNavigate={navegarA}
            />
          )}
          {currentScreen === 'explorar' && (
            <ExplorarScreen onBack={volver} />
          )}
          {currentScreen === 'historial' && (
            <HistorialScreen onBack={volver} onNavigate={navegarA} />
          )}
          {currentScreen === 'resumenSemanal' && (
            <ResumenSemanalScreen
              onBack={volver}
              onOpenBot={(msg) => {
                setBotInitialMessage(msg);
                navegarA('bot');
              }}
            />
          )}
          {currentScreen === 'gamificacion' && (
            <GamificacionScreen onNavigate={navegarA} onBack={volver} />
          )}
          {currentScreen === 'configuracion' && (
            <ConfiguracionScreen onBack={volver} />
          )}
          {currentScreen === 'retos' && (
            <RetosScreen onBack={volver} />
          )}
          {currentScreen === 'calendario' && (
            <CalendarioScreen onBack={volver} />
          )}
          {currentScreen === 'academia' && (
            <AcademiaScreen onBack={volver} />
          )}
          {currentScreen === 'proyecciones' && (
            <ProyeccionesScreen onBack={volver} />
          )}
          {currentScreen === 'resumenMensual' && (
            <ResumenMensualScreen
              onBack={volver}
              onNavigate={navegarA}
              mesOverride={resumenMensualMes}
            />
          )}
          {currentScreen === 'simulador' && (
            <SimuladorDecisionesScreen onBack={volver} onNavigate={navegarA} />
          )}
          {currentScreen === 'exportar' && (
            <ExportarReporteScreen onBack={volver} />
          )}
          {currentScreen === 'widget' && (
            <WidgetConfigScreen onBack={volver} />
          )}
          {currentScreen === 'metas' && (
            <MetasScreen onBack={volver} />
          )}
          {currentScreen === 'deudas' && (
            <DeudasScreen onBack={volver} />
          )}
          {currentScreen === 'recurrentes' && (
            <RecurrentesScreen onBack={volver} />
          )}
        </Animated.View>
        {mostrarBottomNav(currentScreen) && (
          <BottomNavBar
            currentScreen={getTabActivo(currentScreen)}
            onNavigate={navegarATab}
            onQuickAdd={() => setQuickAddMode('expense')}
            onScrollToTop={handleScrollToTop}
          />
        )}
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
