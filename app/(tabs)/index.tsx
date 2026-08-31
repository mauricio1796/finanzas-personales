import { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  Animated,
  Dimensions,
  Keyboard,
  ScrollView,
  BackHandler,
  Platform,
} from 'react-native';

import { useFinance } from '../../src/state';
import { User } from '../../src/types';
import { useTheme } from '../../src/state/ThemeContext';
import { MobileShell } from '../../src/components/layout/MobileShell';
import { WebSidebar } from '../../src/components/layout/WebSidebar';
import { BottomNavBar } from '../../src/components/layout/BottomNavBar';
import { FinancialFeed } from '../../src/screens/FinancialFeed/FinancialFeed';
import { SplashScreen } from '../../src/screens/SplashScreen';
import { QuickAddSheet } from '../../src/components/ui/QuickAddSheet';
import { FinnTour, FINN_TOUR_STEPS } from '../../src/components/ui/FinnTour';
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
import { PersonalizacionScreen }        from '../../src/screens/PersonalizacionScreen';
import { AlertasPreferencesScreen }     from '../../src/features/proactive-alerts/AlertasPreferencesScreen';
import { ResumenSemanalCard } from '../../src/components/finanzas/ResumenSemanalCard';
import { type NotifData } from '../../src/services/NotificacionesService';
import { useNotificacionesManager } from '../../src/hooks/useNotificacionesManager';
import { useWidgetSync } from '../../src/hooks/useWidgetSync';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

import { AuthScreen } from '../../src/screens/AuthScreen';

// Screens
import { Ingresos } from '../../src/screens/Ingresos';
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
import { PermissionsScreen } from '../../src/screens/PermissionsScreen';
import { PinSetupScreen }   from '../../src/screens/PinSetupScreen';
import { PinEntryScreen }   from '../../src/screens/PinEntryScreen';
import { savePin, hasPin, verifyPin, clearPin } from '../../src/services/PinService';
import { SharedFinancesEntryScreen } from '../../src/features/shared-finances/screens/SharedFinancesEntryScreen';
import { ReceiptScanScreen } from '../../src/features/receipt-scan/screens/ReceiptScanScreen';

const SCREEN_W = Dimensions.get('window').width;

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
    addCategory,
    isLoading, importServerData, saldoDisponible, resetAll,
    syncFailureMessage, clearSyncFailure,
  } = useFinance();
  useTheme(); // keep context subscription

  // ==================== NOTIFICATIONS ====================
  useNotificacionesManager();
  useWidgetSync();

  // ==================== DEEP LINK (widget tap) ====================
  // Maneja finanzaspersonales://agregar-gasto cuando el usuario toca el widget
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (url.includes('agregar-gasto')) {
        setQuickAddMode('expense');
      }
    };
    // URL que abrió la app desde estado cerrado
    Linking.getInitialURL().then(url => {
      if (url && url.includes('agregar-gasto')) setQuickAddMode('expense');
    });
    // URL mientras la app está en background
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== SPLASH ====================
  const [showSplash, setShowSplash] = useState(true);

  // ==================== PIN ====================
  const [showPinSetup,  setShowPinSetup]  = useState(false);
  const [pinExists,     setPinExists]     = useState(false);
  const [pinChecked,    setPinChecked]    = useState(false); // evita race condition
  const [isUnlocked,    setIsUnlocked]    = useState(false);

  // Al salir del splash verifica si hay PIN guardado (antes de renderizar nada)
  useEffect(() => {
    if (!showSplash) {
      hasPin().then(exists => {
        setPinExists(exists);
        setPinChecked(true);
      });
    }
  }, [showSplash]);

  // ==================== PERMISSIONS (solo nativo) ====================
  const [showPermissions, setShowPermissions] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return; // permisos no aplican en web
    storageService.getPermissionsShown().then(shown => {
      if (!shown) setShowPermissions(true);
    });
  }, []);

  // ==================== AUTH STATE ====================
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // ── OTP flow ──
  const [otpEmail, setOtpEmail]         = useState('');
  const [otpName, setOtpName]           = useState('');
  const [otpPassword, setOtpPassword]   = useState('');
  const [otpConfirm, setOtpConfirm]     = useState('');
  const [otpShowPwd, setOtpShowPwd]     = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false); // bloquea onboarding durante login
  const [otpCode, setOtpCode]         = useState(['', '', '', '', '', '', '', '']);
  const [otpStep, setOtpStep]         = useState<'email' | 'register' | 'code'>('email');
  const [otpResendSecs, setOtpResendSecs] = useState(0);
  const otpRefs    = useRef<(TextInput | null)[]>([]);
  const otpNameRef = useRef<TextInput | null>(null);
  const otpPwdRef  = useRef<TextInput | null>(null);
  const otpCfmRef  = useRef<TextInput | null>(null);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ==================== APP STATE ====================
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('dashboard');
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [quickAddMode, setQuickAddMode] = useState<'income' | 'expense' | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [botInitialMessage, setBotInitialMessage] = useState<string | undefined>(undefined);
  const [resumenMensualMes, setResumenMensualMes] = useState<{ mes: number; año: number } | undefined>(undefined);
  const { toast, mostrar: mostrarToast, ocultar: ocultarToast } = useToast();

  // Mostrar Toast cuando SyncQueue descarta una operación definitivamente
  useEffect(() => {
    if (syncFailureMessage) {
      mostrarToast(syncFailureMessage, 'error');
      clearSyncFailure();
    }
  }, [syncFailureMessage, mostrarToast, clearSyncFailure]);

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

  // Animación de entrada al cambiar de paso. Se ejecuta desde un efecto (no de
  // forma imperativa dentro de goNext/goBack) para que un re-render pesado
  // durante la transición no deje la pantalla con opacity=0 permanentemente.
  useEffect(() => {
    onboardingAnim.setValue(0);
    const anim = Animated.timing(onboardingAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (!finished) onboardingAnim.setValue(1);
    });
    // Red de seguridad: si la animación se interrumpe (unmount / cambio de paso
    // encadenado), nunca dejamos el contenido oculto.
    return () => {
      anim.stop();
      onboardingAnim.setValue(1);
    };
  }, [onboardingStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = () => {
    const idx = ONBOARDING_STEPS.indexOf(onboardingStep);
    if (idx < ONBOARDING_STEPS.length - 1) {
      updateOnboardingStep(idx + 1);
      setOnboardingStep(ONBOARDING_STEPS[idx + 1]);
    }
  };

  const goBack = () => {
    const idx = ONBOARDING_STEPS.indexOf(onboardingStep);
    if (idx > 0) {
      setOnboardingStep(ONBOARDING_STEPS[idx - 1]);
    }
  };



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
          setNavHistory(['dashboard']);
          setCurrentScreen('resumenMensual');
        }
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notification listeners — tap opens the target screen (native only)
  useEffect(() => {
    if (Platform.OS === 'web') return;
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
      if (legacyType === 'weekly_summary') navegarA('resumenSemanal');
      if (legacyType === 'cierre_mes') { setResumenMensualMes(undefined); navegarA('resumenMensual'); }
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
  // ── OTP: iniciar cuenta regresiva de reenvío ─────────────────────────────
  const startResendTimer = () => {
    setOtpResendSecs(60);
    if (resendTimer.current) clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setOtpResendSecs(s => {
        if (s <= 1) { clearInterval(resendTimer.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  // ── OTP: enviar código (usuario existente) ───────────────────────────────
  const handleSendOtp = async () => {
    setAuthError('');
    const email = otpEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setAuthError('Ingresa un correo válido');
      return;
    }
    setAuthLoading(true);
    try {
      const { error, userNotFound } = await authService.sendOtp(email);
      if (userNotFound) {
        // Correo no registrado → pantalla de registro
        setOtpStep('register');
        setTimeout(() => otpNameRef.current?.focus(), 300);
        return;
      }
      if (error) { setAuthError(error); return; }
      setOtpStep('code');
      setOtpCode(['', '', '', '', '', '', '', '']);
      startResendTimer();
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } finally {
      setAuthLoading(false);
    }
  };

  // ── OTP: registrar nuevo usuario y enviar código ─────────────────────────
  const handleRegisterOtp = async () => {
    setAuthError('');
    // Usar nombre de Finn (profile) o email prefix como fallback
    const name = profile?.mainFinancialConcern?.trim() || otpEmail.split('@')[0];
    if (otpPassword.length < 6) { setAuthError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (otpPassword !== otpConfirm) { setAuthError('Las contraseñas no coinciden'); return; }
    setAuthLoading(true);
    try {
      const { error } = await authService.sendOtpNewUser(otpEmail.trim().toLowerCase(), name, otpPassword);
      if (error) { setAuthError(error); return; }
      setOtpStep('code');
      setOtpCode(['', '', '', '', '', '', '', '']);
      startResendTimer();
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } finally {
      setAuthLoading(false);
    }
  };

  // ── OTP: verificar código ─────────────────────────────────────────────────
  const handleVerifyOtp = async (codeArr?: string[]) => {
    const code = (codeArr ?? otpCode).join('');
    if (code.length < 8) return;
    setAuthError('');
    setAuthLoading(true);
    setOtpVerifying(true); // evita flash de onboarding durante el login
    try {
      const { user: sbUser, error } = await authService.verifyOtp(otpEmail.trim().toLowerCase(), code);
      if (error || !sbUser) {
        setAuthError(error ?? 'Código incorrecto');
        setOtpCode(['','','','','','','','']);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }
      // Preservar datos locales del onboarding antes de cualquier importación
      const locallyOnboarded = isOnboarded;
      const serverData = await supabaseService.pullFromServer(sbUser.id);

      // Verificar si ya tiene PIN guardado (usuario que vuelve a loguear con correo)
      const alreadyHasPin = await hasPin();

      if (serverData?.isOnboarded) {
        // ── Usuario existente: importar datos del servidor ──────────────
        await importServerData(serverData);
        const finalUser = { ...sbUser };
        if (serverData.name && serverData.name !== sbUser.name) {
          finalUser.name = serverData.name;
          finalUser.monthlySalary = serverData.monthlySalary || sbUser.monthlySalary;
        }
        setIsOnboarded(true);
        setShowSplash(false);
        setUser(finalUser);
      } else if (locallyOnboarded) {
        // ── Usuario nuevo que hizo onboarding offline ─────────────────
        const nombreLocal = profile?.mainFinancialConcern || sbUser.name;
        const finalUser = { ...sbUser, name: nombreLocal };
        setIsOnboarded(true);
        setShowSplash(false);
        setUser(finalUser);
        supabaseService.pushAllToServer(sbUser.id, {
          transactions,
          categories,
          profile: profile ?? null,
          goal: goal ?? null,
          userLevel: userLevel ?? null,
          leccionesCompletadas,
          retosCompletados,
          retoActivo: retoActivo ?? null,
          premium,
          isOnboarded: true,
          name: nombreLocal,
          monthlySalary: profile?.monthlySalary ?? sbUser.monthlySalary ?? 0,
        }).catch(() => {});
      } else {
        // ── Usuario completamente nuevo (sin onboarding local) ────────
        setUser(sbUser);
      }
      setOtpEmail(''); setOtpName(''); setOtpCode(['','','','','','','','']); setOtpStep('email');

      // Si no tiene PIN configurado aún → pedir que cree uno
      if (!alreadyHasPin) {
        setShowPinSetup(true);
      } else {
        // Ya tiene PIN → la pantalla de entrada lo pedirá (user ya está seteado)
        setIsUnlocked(false);
        setPinExists(true);
      }
    } finally {
      setAuthLoading(false);
      setOtpVerifying(false);
    }
  };

  // ── OTP: manejar input de cada dígito ────────────────────────────────────
  const handleOtpDigit = (text: string, idx: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...otpCode];
    next[idx] = digit;
    setOtpCode(next);
    if (digit && idx < 7) {
      otpRefs.current[idx + 1]?.focus();
    }
    if (next.every(d => d !== '')) {
      Keyboard.dismiss();
      handleVerifyOtp(next);
    }
  };

  const handleOtpKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !otpCode[idx] && idx > 0) {
      const next = [...otpCode];
      next[idx - 1] = '';
      setOtpCode(next);
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleLogin = async () => {
    setAuthError('');
    if (!loginEmail || !loginPassword) {
      setAuthError('Por favor completa todos los campos');
      return;
    }
    setAuthLoading(true);
    try {
      if (authService.isReady) {
        const { user: sbUser, error } = await authService.signIn(loginEmail, loginPassword);
        if (error || !sbUser) { setAuthError(error ?? 'Error al iniciar sesión'); return; }
        setUser(sbUser);
        const serverData = await supabaseService.pullFromServer(sbUser.id);
        if (serverData) {
          await importServerData(serverData);
          if (serverData.name && serverData.name !== sbUser.name) {
            setUser({ ...sbUser, name: serverData.name, monthlySalary: serverData.monthlySalary || sbUser.monthlySalary });
          }
        }
      } else {
        const newUser: User = { id: Date.now().toString(), email: loginEmail, name: loginEmail.split('@')[0] };
        setUser(newUser);
      }
      setLoginEmail(''); setLoginPassword('');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async () => {
    setAuthError('');
    if (!registerEmail || !registerPassword || !registerConfirmPassword) {
      setAuthError('Por favor completa todos los campos');
      return;
    }
    const resolvedName = registerEmail.split('@')[0];
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
        const { user: sbUser, error } = await authService.signUp(registerEmail, registerPassword, resolvedName);
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
          name: resolvedName,
          monthlySalary: profile?.monthlySalary ?? sbUser.monthlySalary ?? 0,
        });
      } else {
        // ── Fallback local (sin Supabase configurado) ─────────────────────
        const newUser: User = {
          id: Date.now().toString(),
          email: registerEmail,
          name: resolvedName,
          createdAt: new Date().toISOString(),
        };
        setUser(newUser);
      }
      setRegisterEmail('');
      setRegisterPassword('');
      setRegisterConfirmPassword('');
    } finally {
      setAuthLoading(false);
    }
  };


  const handleReset = async () => {
    // Intentar cerrar sesión en Supabase, pero continuar aunque falle
    if (authService.isReady) {
      try { await authService.signOut(); } catch {}
    }
    // Limpiar PIN
    await clearPin();
    setPinExists(false);
    setIsUnlocked(false);
    setShowPinSetup(false);
    // Limpiar todos los datos persistidos
    await resetAll();
    await setIsOnboarded(false);
    // Limpiar estado OTP
    setOtpEmail('');
    setOtpName('');
    setOtpPassword('');
    setOtpConfirm('');
    setOtpCode(['', '', '', '', '', '', '', '']);
    setOtpStep('email');
    setOtpResendSecs(0);
    if (resendTimer.current) clearInterval(resendTimer.current);
    setAuthError('');
    setUser(null);
    setCurrentScreen('dashboard');
    // Arrancar desde splash
    setShowSplash(true);
  };

  // ==================== FINANCE HANDLERS ====================
  const addTransaction = (amount: number, category: string, type: 'income' | 'expense', date: Date, description?: string) => {
    // Si es un gasto y la categoría no existe en la lista del usuario, crearla
    if (type === 'expense') {
      const exists = categories.some((c: any) => c.name === category);
      if (!exists) {
        addCategory({
          id: Date.now().toString(),
          name: category,
          budget: 0,
          isSelected: true,
          tipo: 'gasto',
          fechaCreacion: new Date().toISOString(),
        });
      }
    }
    ctxAddTransaction({
      id: Date.now().toString(),
      amount,
      category,
      type,
      date: date.toISOString(),
      ...(description?.trim() ? { description: description.trim() } : {}),
    });
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

  // ── Android hardware back button (native only) ────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (quickAddMode !== null) { setQuickAddMode(null); return true; }
      if (TAB_KEYS.includes(currentScreen)) return false;
      volver();
      return true;
    });
    return () => subscription.remove();
  }, [quickAddMode, currentScreen, volver]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== 0. SPLASH ====================
  if (showSplash) {
    return <MobileShell><SplashScreen onDone={() => setShowSplash(false)} /></MobileShell>;
  }

  // ==================== 0b. LOADING (AsyncStorage + PIN check) ====================
  // Esperamos a que hidrate el storage Y a que termine el chequeo del PIN
  // para evitar la race condition que saltaría el PIN entry
  if (isLoading || !pinChecked) {
    return <MobileShell><DashboardSkeleton /></MobileShell>;
  }

  // ==================== 1. PIN ENTRY (usuario que regresa — antes que todo) ====================
  // Si el usuario ya está en storage Y tiene PIN → pedirlo antes que nada
  if (user && pinExists && !isUnlocked && Platform.OS !== 'web') {
    return (
      <MobileShell>
        <PinEntryScreen
          userName={user.name}
          userEmail={user.email}
          onSuccess={() => setIsUnlocked(true)}
          onForgotPin={async () => {
            await clearPin();
            setPinExists(false);
            setIsUnlocked(false);
            setUser(null);
          }}
          verifyPin={verifyPin}
        />
      </MobileShell>
    );
  }

  // ==================== 2. PERMISOS (primera vez) ====================
  if (showPermissions) {
    return (
      <MobileShell>
        <PermissionsScreen onDone={() => setShowPermissions(false)} />
      </MobileShell>
    );
  }

  // ==================== 3. ONBOARDING (usuario nuevo) ====================
  if (!isOnboarded && !otpVerifying) {
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

  // ==================== 4. AUTH — flujo OTP por correo ====================
  if (!user) {
    return (
      <MobileShell>
        <AuthScreen
          otpStep={otpStep}
          setOtpStep={setOtpStep}
          otpEmail={otpEmail}
          setOtpEmail={setOtpEmail}
          otpPassword={otpPassword}
          setOtpPassword={setOtpPassword}
          otpConfirm={otpConfirm}
          setOtpConfirm={setOtpConfirm}
          otpShowPwd={otpShowPwd}
          setOtpShowPwd={setOtpShowPwd}
          otpCode={otpCode}
          handleOtpDigit={handleOtpDigit}
          handleOtpKeyPress={handleOtpKeyPress}
          otpResendSecs={otpResendSecs}
          authLoading={authLoading}
          authError={authError}
          handleSendOtp={handleSendOtp}
          handleRegisterOtp={handleRegisterOtp}
          handleVerifyOtp={handleVerifyOtp}
          otpRefs={otpRefs}
          otpPwdRef={otpPwdRef}
          otpCfmRef={otpCfmRef}
          profileName={profile?.mainFinancialConcern}
        />
      </MobileShell>
    );
  }

  // ==================== 5. PIN SETUP (primera vez tras verificar OTP) ====================
  if (showPinSetup && Platform.OS !== 'web') {
    return (
      <MobileShell>
        <PinSetupScreen
          userName={user?.name}
          onDone={async (pin) => {
            await savePin(pin, user?.id ?? '');
            setPinExists(true);
            setIsUnlocked(true);
            setShowPinSetup(false);
          }}
        />
      </MobileShell>
    );
  }

  // ==================== 3. MAIN APP (CON DATOS DEL PERFIL CARGADOS) ====================
  return (
    <MobileShell>
      <WebSidebar
        currentScreen={currentScreen}
        onNavigate={navegarATab}
        onQuickAdd={() => setQuickAddMode('expense')}
        userName={user?.name}
      >
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
          {currentScreen === 'ingresos' && (
            <Ingresos
              transactions={transactions}
              onAddIncome={addIncome}
              onDeleteTransaction={deleteTransaction}
              onBack={volver}
            />
          )}
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
            <BotIA transactions={transactions} monthlySalary={saldoDisponible} onBack={volver} />
          )}
          {currentScreen === 'perfil' && (
            <Usuario
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
            <ConfiguracionScreen onBack={volver} onNavigate={navegarA} />
          )}
          {currentScreen === 'personalizacion' && (
            <PersonalizacionScreen onBack={volver} />
          )}
          {currentScreen === 'alertas-preferencias' && (
            <AlertasPreferencesScreen onBack={volver} />
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
          {currentScreen === 'widget' && Platform.OS !== 'web' && (
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
          {currentScreen === 'compartido' && (
            <SharedFinancesEntryScreen onVolver={volver} />
          )}
          {currentScreen === 'escanear' && (
            <ReceiptScanScreen
              onGastoRegistrado={() => navegarA('gastos')}
              onCancelar={volver}
            />
          )}
        </Animated.View>
        {mostrarBottomNav(currentScreen) && Platform.OS !== 'web' && (
          <BottomNavBar
            currentScreen={getTabActivo(currentScreen)}
            onNavigate={navegarATab}
            onQuickAdd={() => setQuickAddMode('expense')}
            onScrollToTop={handleScrollToTop}
          />
        )}
      </View>

      {/* Finn Tour */}
      <FinnTour
        steps={FINN_TOUR_STEPS}
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
      </WebSidebar>
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
  // ── New minimal auth screens ────────────────────────────────────────────────
  authRoot: {
    flex: 1,
    backgroundColor: '#F8F7FF',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(97,86,232,0.13)',
  },
  blobTR: {
    width: 220,
    height: 220,
    top: -70,
    right: -70,
  },
  blobBL: {
    width: 160,
    height: 160,
    bottom: 80,
    left: -60,
  },
  blobBR: {
    width: 100,
    height: 100,
    bottom: -30,
    right: 30,
    backgroundColor: 'rgba(97,86,232,0.07)',
  },
  cornerLink: {
    position: 'absolute',
    top: 52,
    right: 24,
    zIndex: 10,
  },
  cornerLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6156E8',
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  authBigTitle: {
    fontSize: 52,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -2,
    marginBottom: 40,
  },
  authFields: {
    gap: 14,
  },
  authFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authFieldPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  authFieldIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  authFieldInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    padding: 0,
  },
  authFab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#6156E8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6156E8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  authFabIcon: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  authError: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  authForgot: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  authToggleBtn: {
    marginTop: 32,
    alignSelf: 'flex-start',
  },
  authToggleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6156E8',
  },

  // OTP screens
  otpLogoWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  otpLogoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6156E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  otpLogoText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  otpLogoName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 0.3,
  },
  otpSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  otpDisclaimer: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  otpBoxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 20,
  },
  otpBox: {
    width: 36,
    height: 48,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  otpBoxFilled: {
    borderColor: '#6156E8',
    backgroundColor: '#EEF2FF',
  },
  otpVerifying: {
    fontSize: 14,
    color: '#6156E8',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '500',
  },
  otpResendBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  otpResendText: {
    fontSize: 13,
    color: '#6156E8',
    fontWeight: '600',
    textAlign: 'center',
  },
  otpChangeEmail: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },

  // App layout
  appContainer: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
  },
});
