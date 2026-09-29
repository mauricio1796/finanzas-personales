import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { storageService } from '../services/storage/StorageService';
import { supabaseService } from '../services/supabase/SupabaseService';
import type { ServerData } from '../services/supabase/SupabaseService';
import { syncQueue, type SyncStatus } from '../services/SyncQueueService';
import { reprogramarTodasLasNotificaciones } from '../services/NotificacionesService';
import { limpiarDispositivo } from '../services/LocalWipeService';
import { computeGamification, reconcileXp, buildUserLevel, LOGROS, RARITY_STYLE } from '../services/GamificacionService';
import { emitRewardToast } from '../utils/rewardToastBus';
import { calcularMetricasFinancieras, getSerieAhorro, type PuntoAhorro } from '../utils/ingresoUtils';
import { resolverPuntoPartida, puntoPartidaDeclarado } from '../utils/ahorroEvidencia';
import { metaPrincipal, goalDesdeMeta, metaDesdeGoal, migrarGoalLegado } from '../utils/metasUtils';
import { sincronizarPremium } from '../services/PremiumService';
import { RETOS_DISPONIBLES } from '../services/RetosService';
import { LECCIONES } from '../services/AcademiaService';
import { inyectarSubcategoriasDefecto } from '../models/Category';
import {
  migrarTransaccionesACategoryId,
  renombrarCategoriaEnTransacciones,
  encontrarCategoriaDeTx,
} from '../utils/categoryResolver';
import {
  User,
  Category,
  CategoryUpdate,
  Transaction,
  FinancialProfile,
  FinancialGoal,
  PuntoPartida,
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
  /**
   * Snapshot del motor de gamificación (BUG-23). Fuente ÚNICA de XP/nivel:
   * las pantallas lo consumen en vez de recalcular su propia versión.
   */
  gamificacion: ReturnType<typeof computeGamification>;

  // Core methods
  setUser: (user: User | null) => void;
  setIsOnboarded: (value: boolean) => Promise<void>;
  /** Cierra el onboarding solo si los datos se guardaron (BUG-11). */
  finalizarOnboarding: () => Promise<{ ok: boolean; error?: string }>;
  updateOnboardingStep: (step: number) => void;
  setCategories: (cats: Category[]) => void;
  setProfile: (profile: FinancialProfile) => void;
  /** Ahorro real mes a mes, últimos 24 meses (solo lo registrado). */
  serieAhorro: PuntoAhorro[];
  /** Línea base vigente (declarada o calculada). null = aún no hay contra qué medir. */
  puntoPartida: PuntoPartida | null;
  /** Declara cuánto ahorraba antes de Finn; null vuelve al cálculo automático. */
  setPuntoPartida: (ahorroMensual: number | null) => void;
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
  /** Reiniciar app: borra en el servidor y, solo si lo logra, en el dispositivo. */
  resetAll: () => Promise<{ ok: boolean; error?: string }>;
  /** Deja el dispositivo y el estado en memoria como recién instalados (sin tocar el servidor). */
  limpiarEstadoLocal: () => Promise<void>;

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
  const [userLevel, setUserLevelState] = useState<UserLevel | null>(null);
  const [achievements] = useState<Achievement[]>([]);
  const [isOnboarded, setIsOnboardedState] = useState(false);
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(DEFAULT_ONBOARDING);
  const [isLoading, setIsLoading] = useState(true);

  // Metas / Deudas / Recurrentes
  const [metas, setMetas] = useState<Meta[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [recurrentes, setRecurrentes] = useState<GastoRecurrente[]>([]);

  /**
   * `goal` ya no es un estado aparte: es la meta principal de `metas[]`. Así
   * Finn, alertas, PDF, notificaciones y gamificación ven la misma meta que la
   * pantalla Metas (antes eran dos sistemas que nunca se cruzaban).
   */
  const goal = useMemo<FinancialGoal | null>(() => {
    const principal = metaPrincipal(metas);
    return principal ? goalDesdeMeta(principal, user?.id ?? 'local') : null;
  }, [metas, user?.id]);

  /** Tras migrar el goal legado a una meta, lo desactiva para no re-migrarlo. */
  const retirarGoalLegado = (legado: FinancialGoal, meta: Meta) => {
    const inactivo = { ...legado, isActive: false };
    storageService.saveGoal(inactivo).catch(() => {});
    const uid = legado.userId && legado.userId !== 'local' ? legado.userId : null;
    if (uid) {
      syncQueue.enqueue('migrar meta', () => supabaseService.upsertMeta(uid, meta));
      syncQueue.enqueue('retirar meta legado', () => supabaseService.upsertGoal(uid, inactivo));
    }
  };

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
        storageService.getMetas(),
        storageService.getDeudas(),
        storageService.getRecurrentes(),
      ]);

      if (storedOnboarded) setIsOnboardedState(true);
      if (storedUser) setUserState(storedUser);

      let catsHidratadas: Category[] = [];
      if (storedCats) {
        const migrated = storedCats.map((c: any) => {
          const { presupuesto, gastado, ...rest } = c;
          if (presupuesto !== undefined && rest.budget === undefined) rest.budget = presupuesto;
          if (rest.isSelected === undefined || rest.isSelected === null) rest.isSelected = true;
          if (rest.tipo === 'variable' || rest.tipo === 'fijo') rest.tipo = 'gasto';
          return rest as Category;
        });
        // Inyectar subcategorías por defecto para categorías que no las tengan
        catsHidratadas = inyectarSubcategoriasDefecto(migrated);
        setCategoriesState(catsHidratadas);
      }

      // BUG-10: dota de `categoryId` estable a las transacciones antiguas, que
      // solo guardaban el nombre de la categoría. Se hace después de tener las
      // categorías para poder resolver la correspondencia. Las transacciones
      // cuya categoría ya no existe se dejan intactas: su nombre histórico es
      // la única información que queda de ese gasto.
      if (storedTxs) {
        const migradas = migrarTransaccionesACategoryId(storedTxs, catsHidratadas);
        setTransactions(migradas ?? storedTxs);
        if (migradas) {
          storageService.saveTransactions(migradas).catch(() => {
            // Si la escritura falla, la migración se reintenta en el próximo arranque.
          });
        }
      }
      if (storedProfile) setProfileState(storedProfile);
      if (storedLevel) setUserLevelState(storedLevel);
      if (storedLecciones) setLeccionesCompletadas(storedLecciones);
      if (storedRetoActivo) setRetoActivo(storedRetoActivo);
      if (storedRetosComp) setRetosCompletados(storedRetosComp);
      // BUG-07: el estado Premium NO se hidrata desde el almacenamiento local.
      // `sincronizarPremium()` consulta el entitlement real en Supabase y solo
      // acepta el caché local si el servidor ya lo confirmó antes y sigue
      // dentro del período de gracia sin conexión. El caché lo administra en
      // exclusiva PremiumService (incluye la marca de verificación).
      sincronizarPremium()
        .then(setPremiumState)
        .catch(() => setPremiumState(DEFAULT_PREMIUM));
      // La meta guardada antes de unificar (FinancialGoal) pasa a `metas[]` una vez.
      const hidratacionMetas = migrarGoalLegado(storedMetas ?? [], storedGoal);
      if (storedMetas || hidratacionMetas.migrada) setMetas(hidratacionMetas.metas);
      if (storedGoal && hidratacionMetas.migrada) retirarGoalLegado(storedGoal, hidratacionMetas.migrada);
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
  // El caché de Premium lo administra PremiumService (incluye la marca de
  // "verificado con el servidor"); escribirlo aquí borraría esa marca.
  useEffect(() => { storageService.saveMetas(metas); }, [metas]);
  useEffect(() => { storageService.saveDeudas(deudas); }, [deudas]);
  useEffect(() => { storageService.saveRecurrentes(recurrentes); }, [recurrentes]);

  // ─── Motor de gamificación: fuente única de verdad para XP / nivel ─────────
  // Deriva el XP desde los datos reales (transacciones, pagos, retos, lecciones,
  // logros) y lo reconcilia de forma monótona con lo ya guardado: el progreso
  // nunca retrocede. Sustituye a los incrementos dispersos de `experience`.
  //
  // prevSnapRef guarda el último snapshot para poder avisar "en el momento" —
  // toast + XP animado — cuando algo cambia de verdad (nuevo logro, subida de
  // nivel), sin repetir el aviso en cada re-render ni al cargar la app.
  const prevSnapRef = useRef<{ logros: Set<string>; nivel: number } | null>(null);

  /**
   * BUG-23 — Un único cálculo de gamificación para toda la app. Antes esto
   * vivía dentro del efecto y GamificacionScreen hacía su propio
   * `calcularXPTotal` en paralelo, con un `Math.max` de parche: el número
   * grande y el desglose podían no cuadrar, y el widget mostraba otro nivel.
   */
  const gamificacion = useMemo(
    () => computeGamification({
      transactions,
      categories,
      goal,
      leccionesCompletadas,
      retosCompletados,
    }),
    [transactions, categories, goal, leccionesCompletadas, retosCompletados],
  );

  useEffect(() => {
    if (isLoading) return;
    const snap = gamificacion;

    const prevSnap = prevSnapRef.current;
    if (prevSnap) {
      for (const logro of LOGROS) {
        if (snap.unlockedLogros.has(logro.id) && !prevSnap.logros.has(logro.id)) {
          const paleta = RARITY_STYLE[logro.rarity];
          emitRewardToast({
            title: logro.titulo,
            subtitle: `+${logro.xp} XP`,
            icon: logro.icono,
            iconColor: paleta.color,
            iconBg: paleta.bg,
          });
        }
      }
      if (snap.nivel.level > prevSnap.nivel) {
        emitRewardToast({
          title: `Nivel ${snap.nivel.level} · ${snap.nivel.title}`,
          subtitle: snap.nivel.unlock.nombre,
          icon: snap.nivel.unlock.icono,
          iconColor: snap.nivel.color,
          iconBg: `${snap.nivel.color}22`,
        });
      }
    }
    prevSnapRef.current = { logros: snap.unlockedLogros, nivel: snap.nivel.level };

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
  }, [isLoading, gamificacion, user]);

  // ─── importServerData: carga datos del servidor en el contexto local ───────
  // Llamado desde index.tsx después de un login o registro exitoso.
  const importServerData = async (data: Partial<ServerData>): Promise<void> => {
    if (data.transactions !== undefined) setTransactions(data.transactions);
    if (data.categories !== undefined) setCategoriesState(data.categories);
    if (data.profile !== undefined) setProfileState(data.profile);
    if (data.userLevel !== undefined) setUserLevelState(data.userLevel);
    if (data.leccionesCompletadas !== undefined) setLeccionesCompletadas(data.leccionesCompletadas);
    if (data.retosCompletados !== undefined) setRetosCompletados(data.retosCompletados);
    if (data.retoActivo !== undefined) setRetoActivo(data.retoActivo);
    // BUG-07: `data.premium` viene de profiles.premium, que históricamente el
    // cliente podía escribir. El entitlement real se resuelve solo contra
    // `premium_entitlements` vía sincronizarPremium().
    void data.premium;
    if (data.isOnboarded !== undefined) setIsOnboardedState(data.isOnboarded);
    if (data.paidTxIds !== undefined) await storageService.savePaidTxIds(data.paidTxIds);
    if (data.metas !== undefined || data.goal) {
      const base = data.metas ?? metas;
      const { metas: conMigrada, migrada } = migrarGoalLegado(base, data.goal);
      if (data.metas !== undefined || migrada) setMetas(conMigrada);
      if (data.goal && migrada) retirarGoalLegado(data.goal, migrada);
    }
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

  /**
   * BUG-11 — Cierra el onboarding solo si los datos quedaron realmente guardados.
   *
   * Antes: `setIsOnboarded(true)` se invocaba sin `await` y la navegación seguía
   * de inmediato, mientras perfil, categorías y meta se guardaban en efectos
   * aparte y sin manejo de error. Si una de esas escrituras fallaba (disco
   * lleno, error de almacenamiento), el usuario quedaba marcado como
   * "onboarded" pero con datos incompletos y sin aviso.
   *
   * Ahora la marca de completado es lo ÚLTIMO que se escribe: si algo falla
   * antes, el onboarding no se cierra y el usuario puede reintentar.
   */
  const finalizarOnboarding = async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      await Promise.all([
        profile ? storageService.saveProfile(profile) : Promise.resolve(),
        storageService.saveCategories(categories),
      ]);

      // Solo tras confirmar la persistencia de los datos se marca completado.
      await storageService.setOnboarded(true);
      setIsOnboardedState(true);

      if (user) {
        const uid = user.id;
        syncQueue.enqueue('marcar onboarded', () => supabaseService.upsertUserData(uid, { isOnboarded: true }));
      }
      return { ok: true };
    } catch (e: any) {
      console.warn('[Onboarding] No se pudo finalizar:', e?.message);
      return { ok: false, error: e?.message ?? 'No se pudieron guardar tus datos.' };
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

  // ─── Evidencia de ahorro ──────────────────────────────────────────────────
  const serieAhorro = useMemo(
    () => getSerieAhorro(transactions, profile?.monthlySalary ?? 0, 24),
    [transactions, profile?.monthlySalary],
  );
  const puntoPartida = useMemo(
    () => resolverPuntoPartida(profile?.puntoPartida, serieAhorro),
    [profile?.puntoPartida, serieAhorro],
  );
  const setPuntoPartida = (ahorroMensual: number | null) => {
    if (!profile) return;
    setProfile({
      ...profile,
      puntoPartida: ahorroMensual === null ? null : puntoPartidaDeclarado(ahorroMensual),
      updatedAt: new Date().toISOString(),
    });
  };

  /**
   * Finn (AgentService) y el bot escriben la meta con este método. Se guarda
   * como meta: actualiza la principal si el id coincide, o crea una nueva.
   */
  const setGoal = (g: FinancialGoal) => {
    const existente = metas.find(m => m.id === g.id);
    const meta = metaDesdeGoal(g, existente);
    if (!meta) return;
    if (existente) updateMeta(existente.id, meta);
    else addMeta(meta);
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
    // BUG-10: toda transacción nace con identidad estable de categoría. Quien
    // llama puede pasar el nombre (o un id) en `category`; aquí se resuelve una
    // sola vez y se normaliza el nombre visible al canónico de la categoría.
    const cat = tx.categoryId ? undefined : encontrarCategoriaDeTx(tx, categories);
    const conId: Transaction = cat
      ? { ...tx, categoryId: cat.id, category: cat.name }
      : tx;

    setTransactions(prev => [conId, ...prev]);
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('agregar transacción', () => supabaseService.upsertTransaction(uid, conId));
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

  /**
   * BUG-15 — defensa en profundidad para contenido Premium.
   * Antes, el único control era un `if` en el render de la pantalla: cualquier
   * ruta alternativa a estos mutadores (deep link, consola de depuración, un
   * refactor futuro) otorgaba el contenido igual. Ahora la propia capa de
   * estado rechaza el contenido Premium si el entitlement no está activo.
   */
  const puedeAccederAContenidoPremium = (esPremium: boolean): boolean =>
    !esPremium || premium.isPremium;

  const completarLeccion = (leccionId: string, xp: number) => {
    const leccion = LECCIONES.find(l => l.id === leccionId);
    if (leccion && !puedeAccederAContenidoPremium(leccion.isPremium)) {
      console.warn('[Premium] Lección premium bloqueada sin entitlement activo:', leccionId);
      return;
    }
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
    const reto = RETOS_DISPONIBLES.find(r => r.id === retoId);
    if (reto && !puedeAccederAContenidoPremium(reto.isPremium)) {
      console.warn('[Premium] Reto premium bloqueado sin entitlement activo:', retoId);
      return;
    }
    const nuevo: RetoActivo = { retoId, fechaInicio: new Date().toISOString() };
    setRetoActivo(nuevo);
    if (user) {
      const uid = user.id;
      syncQueue.enqueue('iniciar reto', () => supabaseService.upsertUserData(uid, { retoActivo: nuevo }));
    }
  };

  const completarReto = (retoId: string, xp?: number) => {
    const retoDef = RETOS_DISPONIBLES.find(r => r.id === retoId);
    if (retoDef && !puedeAccederAContenidoPremium(retoDef.isPremium)) {
      console.warn('[Premium] Reto premium bloqueado sin entitlement activo:', retoId);
      return;
    }
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

  /**
   * Refleja en la UI el entitlement que el SERVIDOR ya resolvió. No lo sube a
   * Supabase: `premium_entitlements` solo la escribe el Worker tras verificar
   * el pago con Wompi, y `profiles.premium` quedó protegida por trigger.
   */
  const setPremium = (state: PremiumState) => {
    setPremiumState(state);
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
    let renombrado: { antes: string; despues: string } | null = null;

    setCategoriesState(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, ...update };
      if (typeof update.name === 'string' && update.name !== c.name) {
        renombrado = { antes: c.name, despues: update.name };
      }
      if (user) {
        const uid = user.id;
        syncQueue.enqueue('actualizar categoría', () => supabaseService.upsertCategory(uid, updated));
      }
      return updated;
    }));

    // BUG-10: al renombrar, el histórico debe seguir la categoría. Como las
    // transacciones llevan `categoryId`, el gasto ya registrado no desaparece
    // del presupuesto: solo se actualiza su nombre visible.
    if (renombrado) {
      const { antes, despues } = renombrado;
      setTransactions(prev => {
        const actualizadas = renombrarCategoriaEnTransacciones(prev, id, antes, despues);
        if (!actualizadas) return prev;
        if (user) {
          const uid = user.id;
          const cambiadas = actualizadas.filter((tx, i) => tx !== prev[i]);
          cambiadas.forEach(tx => {
            syncQueue.enqueue('renombrar categoría en transacción',
              () => supabaseService.upsertTransaction(uid, tx));
          });
        }
        return actualizadas;
      });
    }
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
  const abonarMeta = (id: string, monto: number) => {
    // Snapshot previo (fuera del updater) para decidir la recompensa una sola vez,
    // sin side-effects dentro del reducer de setMetas.
    const actual = metas.find(m => m.id === id);
    const seCompletaAhora = !!actual && !actual.completada &&
      Math.min(actual.montoActual + monto, actual.montoObjetivo) >= actual.montoObjetivo;

    setMetas(prev => prev.map(m => {
      if (m.id !== id) return m;
      const nuevo = Math.min(m.montoActual + monto, m.montoObjetivo);
      const aportes = [...(m.aportes ?? []), { monto, fecha: new Date().toISOString() }];
      const updated = { ...m, montoActual: nuevo, completada: nuevo >= m.montoObjetivo, aportes };
      if (user) syncQueue.enqueue('abonar meta', () => supabaseService.upsertMeta(user.id, updated));
      return updated;
    }));

    // Recompensa por completar una meta (solo la primera vez que cruza el objetivo)
    if (seCompletaAhora) awardXp(150);
  };

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

  const limpiarEstadoLocal = async () => {
    await limpiarDispositivo();
    setUserState(null);
    setTransactions([]);
    setCategoriesState([]);
    setProfileState(null);
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

  const resetAll = async (): Promise<{ ok: boolean; error?: string }> => {
    if (user) {
      // Nada en cola puede re-crear datos después del borrado en el servidor.
      await syncQueue.clear();
      const r = await supabaseService.resetMyData();
      // Si el servidor falla NO se borra nada local: al volver a entrar los
      // datos se descargarían otra vez y el usuario creería que se borraron.
      if (!r.ok) return r;
    }
    await limpiarEstadoLocal();
    return { ok: true };
  };

  // ── Saldo disponible (salario + ingresos extra − gastos del mes actual) ──────
  const saldoDisponible = useMemo(() => {
    const now = new Date();
    // Mismo motor que el resto de la app: lo apartado en "Ahorro" sale del
    // disponible sin importar si se registró como gasto o como ingreso.
    // (Sin categorías: el disponible no depende de compromisos pendientes.)
    // No se corta en 0: si hay déficit se muestra negativo para que el usuario lo vea.
    return calcularMetricasFinancieras(
      transactions, [], profile?.monthlySalary ?? 0, now.getMonth(), now.getFullYear(),
    ).balanceDisponible;
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
    gamificacion,
    setUser,
    setIsOnboarded,
    finalizarOnboarding,
    updateOnboardingStep,
    setCategories,
    setProfile,
    serieAhorro,
    puntoPartida,
    setPuntoPartida,
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
    limpiarEstadoLocal,
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
