import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storageService } from '../services/storage/StorageService';
import { reprogramarTodasLasNotificaciones } from '../services/NotificacionesService';
import {
  User,
  Category,
  CategoryUpdate,
  Transaction,
  FinancialProfile,
  FinancialGoal,
  UserLevel,
  Achievement,
  OnboardingState,
} from '../types';

// ─── New types for Phase 3 ───────────────────────────────────────────────────
export interface PremiumState {
  isPremium: boolean;
  plan: 'mensual' | 'anual' | null;
  fechaInicio: string | null;
  fechaVencimiento: string | null;
}

export interface RetoActivo {
  retoId: string;
  fechaInicio: string;
}

// ─── Context shape ───────────────────────────────────────────────────────────
interface FinanceContextType {
  // Core state
  user: User | null;
  transactions: Transaction[];
  categories: Category[];
  profile: FinancialProfile | null;
  goal: FinancialGoal | null;
  userLevel: UserLevel | null;
  achievements: Achievement[];
  isOnboarded: boolean;
  onboardingState: OnboardingState | null;
  isLoading: boolean;

  // Phase 3 state
  leccionesCompletadas: string[];
  retoActivo: RetoActivo | null;
  retosCompletados: string[];
  premium: PremiumState;

  // Core methods
  setUser: (user: User | null) => void;
  setIsOnboarded: (value: boolean) => Promise<void>;
  updateOnboardingStep: (step: number) => void;
  setCategories: (cats: Category[]) => void;
  setProfile: (profile: FinancialProfile) => void;
  setGoal: (goal: FinancialGoal) => void;
  setUserLevel: (level: UserLevel) => void;
  addTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  addIncome: (amount: number, category: string, date: Date, description?: string) => void;
  addExpense: (amount: number, category: string, date: Date, description?: string) => void;

  updateUserSalary: (salary: number) => void;
  resetAll: () => Promise<void>;

  // Phase 3 methods
  completarLeccion: (leccionId: string, xp: number) => void;
  iniciarReto: (retoId: string) => void;
  completarReto: (retoId: string, xp?: number) => void;
  abandonarReto: () => void;
  setPremium: (state: PremiumState) => void;

  // Category management
  addCategory: (cat: Category) => void;
  updateCategory: (id: string, update: CategoryUpdate) => void;
  deleteCategory: (id: string) => void;
  markCategoryPaid: (id: string) => void;
  unmarkCategoryPaid: (id: string) => void;
}


// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_PREMIUM: PremiumState = {
  isPremium: false,
  plan: null,
  fechaInicio: null,
  fechaVencimiento: null,
};

const DEFAULT_ONBOARDING: OnboardingState = {
  completed: false,
  step: 0,
  profileCompleted: false,
  goalSelected: false,
  budgetCreated: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const FinanceContext = createContext<FinanceContextType | null>(null);

export const useFinance = (): FinanceContextType => {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
};

// ─── Provider ────────────────────────────────────────────────────────────────
export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategoriesState] = useState<Category[]>([]);
  const [profile, setProfileState] = useState<FinancialProfile | null>(null);
  const [goal, setGoalState] = useState<FinancialGoal | null>(null);
  const [userLevel, setUserLevelState] = useState<UserLevel | null>(null);
  const [achievements] = useState<Achievement[]>([]);
  const [isOnboarded, setIsOnboardedState] = useState(false);
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(DEFAULT_ONBOARDING);
  const [isLoading, setIsLoading] = useState(true);

  // Phase 3 state
  const [leccionesCompletadas, setLeccionesCompletadas] = useState<string[]>([]);
  const [retoActivo, setRetoActivo] = useState<RetoActivo | null>(null);
  const [retosCompletados, setRetosCompletados] = useState<string[]>([]);
  const [premium, setPremiumState] = useState<PremiumState>(DEFAULT_PREMIUM);


  // ─── Hydration ─────────────────────────────────────────────────────────────
  const hydrate = useCallback(async () => {
    try {
      const [
        storedOnboarded,
        storedUser,
        storedTxs,
        storedCats,
        storedProfile,
        storedGoal,
        storedLevel,
        storedPaidIds,
        storedLecciones,
        storedRetoActivo,
        storedRetosComp,
        storedPremium,
      ] = await Promise.all([
        storageService.getOnboarded(),
        storageService.getUser(),
        storageService.getTransactions(),
        storageService.getCategories(),
        storageService.getProfile(),
        storageService.getGoal(),
        storageService.getUserLevel(),
        storageService.getPaidTxIds(),
        storageService.getLeccionesCompletadas(),
        storageService.getRetoActivo(),
        storageService.getRetosCompletados(),
        storageService.getPremium(),
      ]);

      if (storedOnboarded) setIsOnboardedState(true);
      if (storedUser) setUserState(storedUser);
      if (storedTxs) setTransactions(storedTxs);
      if (storedCats) {
        // Migration 1: rename legacy presupuesto → budget, drop gastado
        // Migration 2: ensure isSelected=true for categories without the flag
        //              (fix for onboarding bug where isSelected was not set)
        const migrated = storedCats.map((c: any) => {
          const { presupuesto, gastado, ...rest } = c;
          if (presupuesto !== undefined && rest.budget === undefined) {
            rest.budget = presupuesto;
          }
          // Fix missing isSelected — any saved category was intentionally added
          if (rest.isSelected === undefined || rest.isSelected === null) {
            rest.isSelected = true;
          }
          // Fix tipo: 'variable' → 'gasto' (legacy onboarding set wrong tipo)
          if (rest.tipo === 'variable' || rest.tipo === 'fijo') {
            rest.tipo = 'gasto';
          }
          return rest as Category;
        });
        setCategoriesState(migrated);
      }
      if (storedProfile) setProfileState(storedProfile);
      if (storedGoal) setGoalState(storedGoal);
      if (storedLevel) setUserLevelState(storedLevel);
      if (storedLecciones) setLeccionesCompletadas(storedLecciones);
      if (storedRetoActivo) setRetoActivo(storedRetoActivo);
      if (storedRetosComp) setRetosCompletados(storedRetosComp);
      if (storedPremium) setPremiumState(storedPremium);
    } catch (e) {
      console.warn('Hydration error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { hydrate(); }, [hydrate]);

  // ─── Auto-persist ──────────────────────────────────────────────────────────
  useEffect(() => { storageService.saveTransactions(transactions); }, [transactions]);
  useEffect(() => { if (profile) storageService.saveProfile(profile); }, [profile]);
  useEffect(() => { if (goal) storageService.saveGoal(goal); }, [goal]);
  useEffect(() => { if (userLevel) storageService.saveUserLevel(userLevel); }, [userLevel]);
  useEffect(() => { if (categories.length) storageService.saveCategories(categories); reprogramarTodasLasNotificaciones(categories); }, [categories]);
  useEffect(() => { if (user) storageService.saveUser(user); }, [user]);
  useEffect(() => { storageService.saveLeccionesCompletadas(leccionesCompletadas); }, [leccionesCompletadas]);
  useEffect(() => { storageService.saveRetosCompletados(retosCompletados); }, [retosCompletados]);
  useEffect(() => { storageService.saveRetoActivo(retoActivo); }, [retoActivo]);
  useEffect(() => { storageService.savePremium(premium); }, [premium]);


  // ─── Core methods ─────────────────────────────────────────────────────────
  const setUser = (u: User | null) => setUserState(u);

  const setIsOnboarded = async (value: boolean) => {
    setIsOnboardedState(value);
    await storageService.setOnboarded(value);
    if (!value) {
      setOnboardingState(DEFAULT_ONBOARDING);
    }
  };

  const updateOnboardingStep = (step: number) => {
    setOnboardingState(prev => ({
      ...(prev ?? DEFAULT_ONBOARDING),
      step,
      updatedAt: new Date().toISOString(),
    }));
  };

  const setCategories = (cats: Category[]) => setCategoriesState(cats);
  const setProfile = (p: FinancialProfile) => setProfileState(p);
  const setGoal = (g: FinancialGoal) => setGoalState(g);
  const setUserLevel = (l: UserLevel) => setUserLevelState(l);

  const addTransaction = (tx: Transaction) => {
    setTransactions(prev => [tx, ...prev]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  const addIncome = (amount: number, category: string, date: Date, description?: string) => {
    addTransaction({
      id: Date.now().toString(),
      amount,
      category,
      type: 'income',
      date: date.toISOString(),
      ...(description?.trim() ? { description: description.trim() } : {}),
    });
  };

  const addExpense = (amount: number, category: string, date: Date, description?: string) => {
    addTransaction({
      id: Date.now().toString(),
      amount,
      category,
      type: 'expense',
      date: date.toISOString(),
      ...(description?.trim() ? { description: description.trim() } : {}),
    });
  };

  // ─── Phase 3 methods ──────────────────────────────────────────────────────
  const completarLeccion = (leccionId: string, xp: number) => {
    setLeccionesCompletadas(prev => prev.includes(leccionId) ? prev : [...prev, leccionId]);
    if (xp > 0 && userLevel) {
      setUserLevelState(prev => prev ? { ...prev, experience: prev.experience + xp } : prev);
    }
  };

  const iniciarReto = (retoId: string) => {
    setRetoActivo({ retoId, fechaInicio: new Date().toISOString() });
  };

  const completarReto = (retoId: string, xp?: number) => {
    setRetosCompletados(prev => prev.includes(retoId) ? prev : [...prev, retoId]);
    setRetoActivo(null);
    if (xp && xp > 0) {
      setUserLevelState(prev => prev ? { ...prev, experience: prev.experience + xp } : prev);
    }
  };

  const abandonarReto = () => {
    setRetoActivo(null);
  };

  const setPremium = (state: PremiumState) => {
    setPremiumState(state);
  };


  const updateUserSalary = (salary: number) => {
    setUserState(prev => prev ? { ...prev, monthlySalary: salary } : prev);
    setProfileState(prev => prev ? { ...prev, monthlySalary: salary } : prev);
  };

  const addCategory = (cat: Category) => {
    setCategoriesState(prev => [...prev, cat]);
    if (userLevel) setUserLevelState(prev => prev ? { ...prev, experience: prev.experience + 20 } : prev);
  };

  const updateCategory = (id: string, update: CategoryUpdate) => {
    setCategoriesState(prev => prev.map(c => c.id === id ? { ...c, ...update } : c));
    if (userLevel) setUserLevelState(prev => prev ? { ...prev, experience: prev.experience + 10 } : prev);
  };

  const deleteCategory = (id: string) => {
    setCategoriesState(prev => prev.filter(c => c.id !== id));
  };

  const markCategoryPaid = (id: string) => {
    setCategoriesState(prev => {
      const cat = prev.find(c => c.id === id);
      if (cat && (cat.budget ?? 0) > 0) {
        const txId = 'budget_payment_' + id;
        setTransactions(prev2 => {
          if (prev2.some(t => t.id === txId)) return prev2;
          const newTx: Transaction = {
            id: txId,
            amount: cat.budget!,
            category: cat.name,
            date: new Date().toISOString(),
            type: 'expense',
            description: cat.tipo === 'fijo' ? 'Gasto fijo pagado' : 'Presupuesto pagado',
          };
          return [newTx, ...prev2];
        });
      }
      return prev.map(c => c.id === id ? { ...c, pagado: true } : c);
    });
    if (userLevel) setUserLevelState(prev => prev ? { ...prev, experience: prev.experience + 50 } : prev);
  };

  const unmarkCategoryPaid = (id: string) => {
    const txId = 'budget_payment_' + id;
    setTransactions(prev => prev.filter(t => t.id !== txId));
    setCategoriesState(prev => prev.map(c => c.id === id ? { ...c, pagado: false } : c));
  };

  const resetAll = async () => {
    await storageService.clearAll();
    setUserState(null);
    setTransactions([]);
    setCategoriesState([]);
    setProfileState(null);
    setGoalState(null);
    setUserLevelState(null);
    setIsOnboardedState(false);
    setOnboardingState(DEFAULT_ONBOARDING);
    setLeccionesCompletadas([]);
    setRetoActivo(null);
    setRetosCompletados([]);
    setPremiumState(DEFAULT_PREMIUM);
  };

  const value: FinanceContextType = {
    user,
    transactions,
    categories,
    profile,
    goal,
    userLevel,
    achievements,
    isOnboarded,
    onboardingState,
    isLoading,
    leccionesCompletadas,
    retoActivo,
    retosCompletados,
    premium,
    setUser,
    setIsOnboarded,
    updateOnboardingStep,
    setCategories,
    setProfile,
    setGoal,
    setUserLevel,
    addTransaction,
    deleteTransaction,
    addIncome,
    addExpense,
    completarLeccion,
    iniciarReto,
    completarReto,
    abandonarReto,
    setPremium,
    updateUserSalary,
    resetAll,
    addCategory,
    updateCategory,
    deleteCategory,
    markCategoryPaid,
    unmarkCategoryPaid,
  };

  return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
};
