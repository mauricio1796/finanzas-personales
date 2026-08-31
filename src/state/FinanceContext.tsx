import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { InteractionManager } from 'react-native';
import { storageService } from '../services/storage/StorageService';
import { supabaseService } from '../services/supabase/SupabaseService';
import type { ServerData } from '../services/supabase/SupabaseService';
import { syncQueue, type SyncStatus } from '../services/SyncQueueService';
import { reprogramarTodasLasNotificaciones } from '../services/NotificacionesService';
import { computeGamification, reconcileXp, buildUserLevel } from '../services/GamificacionService';
import { getIngresoEfectivoMes } from '../utils/ingresoUtils';
import { inyectarSubcategoriasDefecto } from '../models/Category';
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
  Meta,
  Deuda,
  PagoDeuda,
  GastoRecurrente,
} from '../types';

// ─── Phase 3 types ───────────────────────────────────────────────────────────
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
  /** Salario base + ingresos extra del mes actual − gastos del mes actual */
  saldoDisponible: number;
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
  /** Suma un bono de XP puntual (sobre el XP derivado del motor). Monótono. */
  awardXp: (amount: number) => void;
  addTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  updateTransaction: (id: string, update: Partial<Transaction>) => void;
  addIncome: (amount: number, category: string, date: Date, description?: string, subcategory?: string) => void;
  addExpense: (amount: number, category: string, date: Date, description?: string, subcategory?: string) => void;
  updateUserSalary: (salary: number) => void;
  resetAll: () => Promise<void>;

  // Sync: importa datos del servidor al contexto local (usado en login/registro)
  importServerData: (data: Partial<ServerData>) => Promise<void>;

  // Estado de sincronización visible al usuario
  syncStatus: SyncStatus;
  syncPendingCount: number;
  syncFailureMessage: string | null;
  clearSyncFailure: () => void;

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

  // Metas
  metas: Meta[];
  addMeta: (meta: Meta) => void;
  updateMeta: (id: string, update: Partial<Meta>) => void;
  deleteMeta: (id: string) => void;
  abonarMeta: (id: string, monto: number) => void;

  // Deudas
  deudas: Deuda[];
  addDeuda: (deuda: Deuda) => void;
  updateDeuda: (id: string, update: Partial<Deuda>) => void;
  deleteDeuda: (id: string) => void;
  pagarDeuda: (id: string, pago: PagoDeuda) => void;

  // Gastos Recurrentes
  recurrentes: GastoRecurrente[];
  addRecurrente: (r: GastoRecurrente) => void;
  updateRecurrente: (id: string, update: Partial<GastoRecurrente>) => void;
  deleteRecurrente: (id: string) => void;
  toggleRecurrente: (id: string) => void;
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

  // Metas / Deudas / Recurrentes
  const [metas, setMetas] = useState<Meta[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [recurrentes, setRecurrentes] = useState<GastoRecurrente[]>([]);

  // Phase 3
  const [leccionesCompletadas, setLeccionesCompletadas] = useState<string[]>([]);
  const [retoActivo, setRetoActivo] = useState<RetoActivo | null>(null);
  const [retosCompletados, setRetosCompletados] = useState<string[]>([]);
  const [premium, setPremiumState] = useState<PremiumState>(DEFAULT_PREMIUM);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncPendingCount, setSyncPendingCount] = useState(0);
  const [syncFailureMessage, setSyncFailureMessage] = useState<string | null>(null);

  // ─── Hydration (AsyncStorage → estado local) ──────────────────────────────
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
        storedMetas,
        storedDeudas,
        storedRecurrentes,
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
        storageService.getMetas(),
        storageService.getDeudas(),
        storageService.getRecurrentes(),
      ]);

      if (storedOnboarded) setIsOnboardedState(true);
      if (storedUser) setUserState(storedUser);
      if (storedTxs) setTransactions(storedTxs);
      if (storedCats) {
        const migrated = storedCats.map((c: any) => {
          const { presupuesto, gastado, ...rest } = c;
          if (presupuesto !== undefined && rest.budget === undefined) rest.budget = presupuesto;
          if (rest.isSelected === undefined || rest.isSelected === null) rest.isSelected = true;
          if (rest.tipo === 'variable' || rest.tipo === 'fijo') rest.tipo = 'gasto';
          return rest as Category;
        });
        // Inyectar subcategorías por defecto para categorías que no las tengan
        setCategoriesState(inyectarSubcategoriasDefecto(migrated));
      }
      if (storedProfile) setProfileState(storedProfile);
      if (storedGoal) setGoalState(storedGoal);
      if (storedLevel) setUserLevelState(storedLevel);
      if (storedLecciones) setLeccionesCompletadas(storedLecciones);
      if (storedRetoActivo) setRetoActivo(storedRetoActivo);
      if (storedRetosComp) setRetosCompletados(storedRetosComp);
      if (storedPremium) setPremiumState(storedPremium);
      if (storedMetas) setMetas(storedMetas);
      if (storedDeudas) setDeudas(storedDeudas);
      if (storedRecurrentes) setRecurrentes(storedRecurrentes);

      // storedPaidIds se usa en Estadisticas directamente via storageService (no en este contexto)
      void storedPaidIds;
    } catch (e) {
      console.warn('Hydration error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { hydrate(); }, [hydrate]);

  // Suscribirse al estado del sync queue
  useEffect(() => {
    const unsub = syncQueue.onStatusChange((status, count) => {
      setSyncStatus(status);
      setSyncPendingCount(count);
    });
    return unsub;
  }, []);

  // Notificar al usuario cuando una operación de sync falla definitivamente
  useEffect(() => {
    const unsub = syncQueue.onSyncFailure((descripcion) => {
      setSyncFailureMessage(`No se pudo guardar "${descripcion}". Verifica tu conexión.`);
    });
    return unsub;
  }, []);

  // ─── Auto-persist (AsyncStorage) ──────────────────────────────────────────
  // Nota: el sync a Supabase se hace en cada método de acción (fire-and-forget),
  // NO en estos effects, para evitar syncs completos en cada cambio.
  useEffect(() => { storageService.saveTransactions(transactions); }, [transactions]);
  useEffect(() => { if (profile) storageService.saveProfile(profile); }, [profile]);
  useEffect(() => { if (goal) storageService.saveGoal(goal); }, [goal]);
  useEffect(() => { if (userLevel) storageService.saveUserLevel(userLevel); }, [userLevel]);
  useEffect(() => {
    if (!categories.length) return;
    storageService.saveCategories(categories);
    // No reprogramar notificaciones durante el onboarding: compite con la
    // animación de transición entre pasos y deja la pantalla en blanco.
    // OnboardingMontos las reprograma explícitamente al confirmar presupuestos.
    if (!isOnboarded) return;
    // Diferir fuera del frame de render para no bloquear transiciones de UI.
    const task = InteractionManager.runAfterInteractions(() => {
      reprogramarTodasLasNotificaciones(categories);
    });
    return () => task.cancel();
  }, [categories, isOnboarded]);
  useEffect(() => { if (user) storageService.saveUser(user); }, [user]);
  useEffect(() => { storageService.saveLeccionesCompletadas(leccionesCompletadas); }, [leccionesCompletadas]);
  useEffect(() => { storageService.saveRetosCompletados(retosCompletados); }, [retosCompletados]);
  useEffect(() => { storageService.saveRetoActivo(retoActivo); }, [retoActivo]);
  useEffect(() => { storageService.savePremium(premium); }, [premium]);
  useEffect(() => { storageService.saveMetas(metas); }, [metas]);
  useEffect(() => { storageService.saveDeudas(deudas); }, [deudas]);
  useEffect(() => { storageService.saveRecurrentes(recurrentes); }, [recurrentes]);

  // ─── Motor de gamificación: fuente única de verdad para XP / nivel ─────────
  // Deriva el XP desde los datos reales (transacciones, pagos, retos, lecciones,
  // logros) y lo reconcilia de forma monótona con lo ya guardado: el progreso
  // nunca retrocede. Sustituye a los incrementos dispersos de `experience`.
  useEffect(() => {
    if (isLoading) return;
    const snap = computeGamification({
      transactions,
      categories,
      goal,
      leccionesCompletadas,
      retosCompletados,
    });
    setUserLevelState(prev => {
      const xp = reconcileXp(prev?.experience, snap.xpTotal);
      if (prev && prev.experience === xp && prev.level === snap.nivel.level) return prev;
      const next = buildUserLevel(prev, xp, user?.id ?? 'local');
      if (user) {
        const uid = user.id;
        syncQueue.enqueue('sincronizar nivel', () => supabaseService.upsertUserLevel(uid, next));
      }
      return next;
    });
  }, [isLoading, transactions, categories, goal, leccionesCompletadas, retosCompletados, user]);

  // ─── importServerData: carga datos del servidor en el contexto local ───────
  // Llamado desde index.tsx después de un login o registro exitoso.
  const importServerData = async (data: Partial<ServerData>): Promise<void> => {
    if (data.transactions !== undefined) setTransactions(data.transactions);
    if (data.categories !== undefined) setCategoriesState(data.categories);
    if (data.profile !== undefined) setProfileState(data.profile);
    if (data.goal !== undefined) setGoalState(data.goal);
    if (data.userLevel !== undefined) setUserLevelState(data.userLevel);
    if (data.leccionesCompletadas !== undefined) setLeccionesCompletadas(data.leccionesCompletadas);
    if (data.retosCompletados !== undefined) setRetosCompletados(data.retosCompletados);
    if (data.retoActivo !== undefined) setRetoActivo(data.retoActivo);
    if (data.premium !== undefined) setPremiumState(data.premium);
    if (data.isOnboarded !== undefined) setIsOnboardedState(data.isOnboarded);
    if (data.paidTxIds !== undefined) await storageService.savePaidTxIds(data.paidTxIds);
    if (data.metas !== undefined) setMetas(data.metas);
    if (data.deudas !== undefined) setDeudas(data.deudas);
    if (data.recurrentes !== undefined) setRecurrentes(data.recurrentes);
  };

  // ─── Core methods ─────────────────────────────────────────────────────────
  const setUser = (u: User | null) => setUserState(u);

  const setIsOnboarded = async (value: boolean) => {
    setIsOnboardedState(value);
    await storageService.setOnboarded(value);
    if (!value) {
      setOnboardingState(DEFAULT_ONBOARDING);
    } else if (user) {
      const uid = user.id;
      syncQueue.enqueue('marcar onboarded', () => supabaseService.upsertUserData(uid, { isOnboarded: value }));
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

  const setProfile = (p: FinancialProfile) => {
    setProfileState(p);
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('actualizar perfil', () => supabaseService.upsertFinancialProfile(uid, p));
    }
  };

  const setGoal = (g: FinancialGoal) => {
    setGoalState(g);
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('actualizar meta', () => supabaseService.upsertGoal(uid, g));
    }
  };

  const setUserLevel = (l: UserLevel) => {
    // Reconstruye para que nivel/título queden siempre coherentes con el XP.
    const next = buildUserLevel(l, l.experience, l.userId || user?.id || 'local');
    setUserLevelState(next);
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('actualizar nivel', () => supabaseService.upsertUserLevel(uid, next));
    }
  };

  const awardXp = (amount: number) => {
    if (!amount || amount <= 0) return;
    setUserLevelState(prev => {
      const xp = reconcileXp(prev?.experience, (prev?.experience ?? 0) + amount);
      const next = buildUserLevel(prev, xp, user?.id ?? 'local');
      if (user) {
        const uid = user.id;
        syncQueue.enqueue('sumar XP', () => supabaseService.upsertUserLevel(uid, next));
      }
      return next;
    });
  };

  const addTransaction = (tx: Transaction) => {
    setTransactions(prev => [tx, ...prev]);
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('agregar transacción', () => supabaseService.upsertTransaction(uid, tx));
    }
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('eliminar transacción', () => supabaseService.deleteTransaction(id, uid));
    }
  };

  const updateTransaction = (id: string, update: Partial<Transaction>) => {
    setTransactions(prev => prev.map(tx => {
      if (tx.id !== id) return tx;
      const updated = { ...tx, ...update };
      if (user) {
        const uid = user.id;
        syncQueue.enqueue('actualizar transacción', () => supabaseService.upsertTransaction(uid, updated));
      }
      return updated;
    }));
  };

  const addIncome = (amount: number, category: string, date: Date, description?: string, subcategory?: string) => {
    addTransaction({
      id: Date.now().toString(),
      amount,
      category,
      type: 'income',
      date: date.toISOString(),
      ...(description?.trim() ? { description: description.trim() } : {}),
      ...(subcategory ? { subcategory } : {}),
    });
  };

  const addExpense = (amount: number, category: string, date: Date, description?: string, subcategory?: string) => {
    addTransaction({
      id: Date.now().toString(),
      amount,
      category,
      type: 'expense',
      date: date.toISOString(),
      ...(description?.trim() ? { description: description.trim() } : {}),
      ...(subcategory ? { subcategory } : {}),
    });
  };

  const updateUserSalary = (salary: number) => {
    setUserState(prev => prev ? { ...prev, monthlySalary: salary } : prev);
    setProfileState(prev => prev ? { ...prev, monthlySalary: salary } : prev);
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('actualizar salario', () => supabaseService.upsertUserData(uid, { monthlySalary: salary }));
      if (profile) {
        const updatedProfile = { ...profile, monthlySalary: salary };
        syncQueue.enqueue('actualizar perfil financiero', () => supabaseService.upsertFinancialProfile(uid, updatedProfile));
      }
    }
  };

  // ─── Phase 3 methods ──────────────────────────────────────────────────────
  const completarLeccion = (leccionId: string, xp: number) => {
    setLeccionesCompletadas(prev => {
      if (prev.includes(leccionId)) return prev;
      const next = [...prev, leccionId];
      if (user) {
        const uid = user.id;
        syncQueue.enqueue('completar lección', () => supabaseService.upsertUserData(uid, { leccionesCompletadas: next }));
      }
      return next;
    });
    // El XP lo deriva el motor de gamificación a partir de `leccionesCompletadas`.
    void xp;
  };

  const iniciarReto = (retoId: string) => {
    const nuevo: RetoActivo = { retoId, fechaInicio: new Date().toISOString() };
    setRetoActivo(nuevo);
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('iniciar reto', () => supabaseService.upsertUserData(uid, { retoActivo: nuevo }));
    }
  };

  const completarReto = (retoId: string, xp?: number) => {
    setRetosCompletados(prev => {
      if (prev.includes(retoId)) return prev;
      const next = [...prev, retoId];
      if (user) {
        const uid = user.id;
        syncQueue.enqueue('completar reto', () => supabaseService.upsertUserData(uid, { retosCompletados: next }));
      }
      return next;
    });
    setRetoActivo(null);
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('limpiar reto activo', () => supabaseService.upsertUserData(uid, { retoActivo: null }));
    }
    // El XP lo deriva el motor de gamificación a partir de `retosCompletados`.
    void xp;
  };

  const abandonarReto = () => {
    setRetoActivo(null);
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('abandonar reto', () => supabaseService.upsertUserData(uid, { retoActivo: null }));
    }
  };

  const setPremium = (state: PremiumState) => {
    setPremiumState(state);
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('actualizar premium', () => supabaseService.upsertUserData(uid, { premium: state }));
    }
  };

  // ─── Category management ──────────────────────────────────────────────────
  const addCategory = (cat: Category) => {
    setCategoriesState(prev => [...prev, cat]);
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('agregar categoría', () => supabaseService.upsertCategory(uid, cat));
    }
  };

  const updateCategory = (id: string, update: CategoryUpdate) => {
    setCategoriesState(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, ...update };
      if (user) {
        const uid = user.id;
        syncQueue.enqueue('actualizar categoría', () => supabaseService.upsertCategory(uid, updated));
      }
      return updated;
    }));
  };

  const deleteCategory = (id: string) => {
    setCategoriesState(prev => prev.filter(c => c.id !== id));
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('eliminar categoría', () => supabaseService.deleteCategory(id, uid));
    }
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
          if (user) {
            const uid = user.id;
            syncQueue.enqueue('registrar pago categoría', () => supabaseService.upsertTransaction(uid, newTx));
          }
          return [newTx, ...prev2];
        });
      }
      return prev.map(c => {
        if (c.id !== id) return c;
        const updated = { ...c, pagado: true };
        if (user) {
          const uid = user.id;
          syncQueue.enqueue('marcar categoría pagada', () => supabaseService.upsertCategory(uid, updated));
        }
        return updated;
      });
    });
  };

  const unmarkCategoryPaid = (id: string) => {
    const txId = 'budget_payment_' + id;
    setTransactions(prev => prev.filter(t => t.id !== txId));
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('desmarcar pago', () => supabaseService.deleteTransaction(txId, uid));
    }
    setCategoriesState(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, pagado: false };
      if (user) {
        const uid = user.id;
        syncQueue.enqueue('desmarcar categoría pagada', () => supabaseService.upsertCategory(uid, updated));
      }
      return updated;
    }));
  };

  // ─── Metas ────────────────────────────────────────────────────────────────
  const addMeta = (meta: Meta) => {
    setMetas(prev => [meta, ...prev]);
    if (user) syncQueue.enqueue('agregar meta', () => supabaseService.upsertMeta(user.id, meta));
  };
  const updateMeta = (id: string, update: Partial<Meta>) =>
    setMetas(prev => prev.map(m => {
      if (m.id !== id) return m;
      const updated = { ...m, ...update };
      if (user) syncQueue.enqueue('actualizar meta', () => supabaseService.upsertMeta(user.id, updated));
      return updated;
    }));
  const deleteMeta = (id: string) => {
    setMetas(prev => prev.filter(m => m.id !== id));
    if (user) syncQueue.enqueue('eliminar meta', () => supabaseService.deleteMeta(id, user.id));
  };
  const abonarMeta = (id: string, monto: number) =>
    setMetas(prev => prev.map(m => {
      if (m.id !== id) return m;
      const nuevo = Math.min(m.montoActual + monto, m.montoObjetivo);
      const updated = { ...m, montoActual: nuevo, completada: nuevo >= m.montoObjetivo };
      if (user) syncQueue.enqueue('abonar meta', () => supabaseService.upsertMeta(user.id, updated));
      return updated;
    }));

  // ─── Deudas ───────────────────────────────────────────────────────────────
  const addDeuda = (deuda: Deuda) => {
    setDeudas(prev => [deuda, ...prev]);
    if (user) syncQueue.enqueue('agregar deuda', () => supabaseService.upsertDeuda(user.id, deuda));
  };
  const updateDeuda = (id: string, update: Partial<Deuda>) =>
    setDeudas(prev => prev.map(d => {
      if (d.id !== id) return d;
      const updated = { ...d, ...update };
      if (user) syncQueue.enqueue('actualizar deuda', () => supabaseService.upsertDeuda(user.id, updated));
      return updated;
    }));
  const deleteDeuda = (id: string) => {
    setDeudas(prev => prev.filter(d => d.id !== id));
    if (user) syncQueue.enqueue('eliminar deuda', () => supabaseService.deleteDeuda(id, user.id));
  };
  const pagarDeuda = (id: string, pago: PagoDeuda) =>
    setDeudas(prev => prev.map(d => {
      if (d.id !== id) return d;
      const nuevoSaldo = Math.max(0, d.saldo - pago.monto);
      const updated = {
        ...d,
        saldo: nuevoSaldo,
        saldada: nuevoSaldo <= 0,
        pagos: [pago, ...d.pagos],
      };
      if (user) syncQueue.enqueue('pagar deuda', () => supabaseService.upsertDeuda(user.id, updated));
      return updated;
    }));

  // ─── Gastos Recurrentes ───────────────────────────────────────────────────
  const addRecurrente = (r: GastoRecurrente) => {
    setRecurrentes(prev => [r, ...prev]);
    if (user) syncQueue.enqueue('agregar recurrente', () => supabaseService.upsertRecurrente(user.id, r));
  };
  const updateRecurrente = (id: string, update: Partial<GastoRecurrente>) =>
    setRecurrentes(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...update };
      if (user) syncQueue.enqueue('actualizar recurrente', () => supabaseService.upsertRecurrente(user.id, updated));
      return updated;
    }));
  const deleteRecurrente = (id: string) => {
    setRecurrentes(prev => prev.filter(r => r.id !== id));
    if (user) syncQueue.enqueue('eliminar recurrente', () => supabaseService.deleteRecurrente(id, user.id));
  };
  const toggleRecurrente = (id: string) =>
    setRecurrentes(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, activo: !r.activo };
      if (user) syncQueue.enqueue('toggle recurrente', () => supabaseService.upsertRecurrente(user.id, updated));
      return updated;
    }));

  const resetAll = async () => {
    if (user) {
      await supabaseService.deleteAllUserData(user.id).catch(() => {});
    }
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
    setMetas([]);
    setDeudas([]);
    setRecurrentes([]);
  };

  // ── Saldo disponible (salario + ingresos extra − gastos del mes actual) ──────
  const saldoDisponible = useMemo(() => {
    const now  = new Date();
    const mes  = now.getMonth();
    const año  = now.getFullYear();
    const ingresoTotal = getIngresoEfectivoMes(transactions, profile?.monthlySalary ?? 0, mes, año);
    const gastosMes    = transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === mes && d.getFullYear() === año;
      })
      .reduce((s, t) => s + t.amount, 0);
    // No cortamos en 0: si hay déficit se muestra negativo para que el usuario lo vea
    return ingresoTotal - gastosMes;
  }, [transactions, profile?.monthlySalary]);

  const value: FinanceContextType = {
    user,
    syncStatus,
    syncPendingCount,
    syncFailureMessage,
    clearSyncFailure: () => setSyncFailureMessage(null),
    transactions,
    categories,
    saldoDisponible,
    metas,
    deudas,
    recurrentes,
    addMeta,
    updateMeta,
    deleteMeta,
    abonarMeta,
    addDeuda,
    updateDeuda,
    deleteDeuda,
    pagarDeuda,
    addRecurrente,
    updateRecurrente,
    deleteRecurrente,
    toggleRecurrente,
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
    awardXp,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    addIncome,
    addExpense,
    importServerData,
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
