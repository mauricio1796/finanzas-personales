import { supabase, isSupabaseReady } from '../../lib/supabase';
import type { Transaction, Category, FinancialProfile, FinancialGoal, UserLevel } from '../../types';
import type { PremiumState, RetoActivo } from '../../state/FinanceContext';

// ─── Tipo de datos del servidor ───────────────────────────────────────────────
export interface ServerData {
  transactions: Transaction[];
  categories: Category[];
  profile: FinancialProfile | null;
  goal: FinancialGoal | null;
  userLevel: UserLevel | null;
  leccionesCompletadas: string[];
  retosCompletados: string[];
  retoActivo: RetoActivo | null;
  premium: PremiumState;
  isOnboarded: boolean;
  paidTxIds: string[];
  name: string;
  monthlySalary: number;
}

type UserDataPayload = Partial<{
  name: string;
  monthlySalary: number;
  isOnboarded: boolean;
  paidTxIds: string[];
  leccionesCompletadas: string[];
  retosCompletados: string[];
  retoActivo: RetoActivo | null;
  premium: PremiumState;
}>;

const DEFAULT_PREMIUM: PremiumState = {
  isPremium: false,
  plan: null,
  fechaInicio: null,
  fechaVencimiento: null,
};

// ─── Mappers: filas BD → tipos del app ────────────────────────────────────────
function rowToTransaction(r: Record<string, any>): Transaction {
  return {
    id: r.id as string,
    amount: r.amount as number,
    category: r.category as string,
    date: r.date as string,
    type: r.type as 'income' | 'expense',
    ...(r.description ? { description: r.description as string } : {}),
  };
}

function rowToCategory(r: Record<string, any>): Category {
  return {
    id: r.id as string,
    name: r.name as string,
    ...(r.icon ? { icon: r.icon as string } : {}),
    ...(r.color ? { color: r.color as string } : {}),
    ...(r.budget != null ? { budget: r.budget as number } : {}),
    isSelected: (r.is_selected as boolean) ?? true,
    ...(r.dia_pago != null ? { diaPago: r.dia_pago as number } : {}),
    pagado: (r.pagado as boolean) ?? false,
    ...(r.tipo ? { tipo: r.tipo as Category['tipo'] } : {}),
    ...(r.fecha_creacion ? { fechaCreacion: r.fecha_creacion as string } : {}),
  };
}

function rowToProfile(r: Record<string, any>, userId: string): FinancialProfile {
  return {
    id: r.id as string,
    userId,
    employmentType: r.employment_type as FinancialProfile['employmentType'],
    incomeType: r.income_type as FinancialProfile['incomeType'],
    monthlySalary: r.monthly_salary as number,
    hasDebts: r.has_debts as boolean,
    ...(r.debt_amount != null ? { debtAmount: r.debt_amount as number } : {}),
    mainFinancialConcern: r.main_financial_concern as string,
    currencyPreference: (r.currency_preference as string) ?? 'COP',
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToGoal(r: Record<string, any>, userId: string): FinancialGoal {
  return {
    id: r.id as string,
    userId,
    type: r.type as FinancialGoal['type'],
    title: r.title as string,
    ...(r.description ? { description: r.description as string } : {}),
    ...(r.target_amount != null ? { targetAmount: r.target_amount as number } : {}),
    currentAmount: r.current_amount as number,
    ...(r.deadline ? { deadline: r.deadline as string } : {}),
    priority: r.priority as FinancialGoal['priority'],
    isActive: r.is_active as boolean,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToUserLevel(r: Record<string, any>, userId: string): UserLevel {
  return {
    id: r.id as string,
    userId,
    level: r.level as number,
    experience: r.experience as number,
    title: r.title as UserLevel['title'],
    createdAt: r.updated_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ─── Servicio ─────────────────────────────────────────────────────────────────
class SupabaseService {
  readonly isReady = isSupabaseReady;

  private get db() { return supabase; }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async upsertTransaction(userId: string, tx: Transaction): Promise<void> {
    const db = this.db;
    if (!db) return;
    await db.from('transactions').upsert({
      id: tx.id,
      user_id: userId,
      amount: tx.amount,
      category: tx.category,
      date: tx.date,
      type: tx.type,
      description: tx.description ?? null,
    });
  }

  async deleteTransaction(id: string): Promise<void> {
    const db = this.db;
    if (!db) return;
    await db.from('transactions').delete().eq('id', id);
  }

  async getTransactions(userId: string): Promise<Transaction[] | null> {
    const db = this.db;
    if (!db) return null;
    const { data, error } = await db
      .from('transactions')
      .select('id, amount, category, date, type, description')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error || !data) return null;
    return (data as any[]).map(rowToTransaction);
  }

  // Bulk insert para primer push (registro)
  private async bulkInsertTransactions(userId: string, txs: Transaction[]): Promise<void> {
    const db = this.db;
    if (!db || txs.length === 0) return;
    await db.from('transactions').upsert(
      txs.map(tx => ({
        id: tx.id,
        user_id: userId,
        amount: tx.amount,
        category: tx.category,
        date: tx.date,
        type: tx.type,
        description: tx.description ?? null,
      }))
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════

  async upsertCategory(userId: string, cat: Category): Promise<void> {
    const db = this.db;
    if (!db) return;
    await db.from('categories').upsert({
      id: cat.id,
      user_id: userId,
      name: cat.name,
      icon: cat.icon ?? null,
      color: cat.color ?? null,
      budget: cat.budget ?? null,
      is_selected: cat.isSelected ?? true,
      dia_pago: cat.diaPago ?? null,
      pagado: cat.pagado ?? false,
      tipo: cat.tipo ?? null,
      fecha_creacion: cat.fechaCreacion ?? null,
    });
  }

  async deleteCategory(id: string): Promise<void> {
    const db = this.db;
    if (!db) return;
    await db.from('categories').delete().eq('id', id);
  }

  // Reemplaza todas las categorías del usuario (usado en primer push)
  async syncAllCategories(userId: string, cats: Category[]): Promise<void> {
    const db = this.db;
    if (!db) return;
    await db.from('categories').delete().eq('user_id', userId);
    if (cats.length === 0) return;
    await db.from('categories').insert(
      cats.map(c => ({
        id: c.id,
        user_id: userId,
        name: c.name,
        icon: c.icon ?? null,
        color: c.color ?? null,
        budget: c.budget ?? null,
        is_selected: c.isSelected ?? true,
        dia_pago: c.diaPago ?? null,
        pagado: c.pagado ?? false,
        tipo: c.tipo ?? null,
        fecha_creacion: c.fechaCreacion ?? null,
      }))
    );
  }

  async getCategories(userId: string): Promise<Category[] | null> {
    const db = this.db;
    if (!db) return null;
    const { data, error } = await db
      .from('categories')
      .select('*')
      .eq('user_id', userId);
    if (error || !data) return null;
    return (data as any[]).map(rowToCategory);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL PROFILE
  // ═══════════════════════════════════════════════════════════════════════════

  async upsertFinancialProfile(userId: string, profile: FinancialProfile): Promise<void> {
    const db = this.db;
    if (!db) return;
    await db.from('financial_profiles').upsert(
      {
        user_id: userId,
        employment_type: profile.employmentType,
        income_type: profile.incomeType,
        monthly_salary: profile.monthlySalary,
        has_debts: profile.hasDebts,
        debt_amount: profile.debtAmount ?? null,
        main_financial_concern: profile.mainFinancialConcern,
        currency_preference: profile.currencyPreference,
      },
      { onConflict: 'user_id' }
    );
  }

  async getFinancialProfile(userId: string): Promise<FinancialProfile | null> {
    const db = this.db;
    if (!db) return null;
    const { data, error } = await db
      .from('financial_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return rowToProfile(data as any, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL GOAL
  // ═══════════════════════════════════════════════════════════════════════════

  async upsertGoal(userId: string, goal: FinancialGoal): Promise<void> {
    const db = this.db;
    if (!db) return;
    await db.from('financial_goals').upsert(
      {
        user_id: userId,
        type: goal.type,
        title: goal.title,
        description: goal.description ?? null,
        target_amount: goal.targetAmount ?? null,
        current_amount: goal.currentAmount,
        deadline: goal.deadline ?? null,
        priority: goal.priority,
        is_active: goal.isActive,
      },
      { onConflict: 'user_id' }
    );
  }

  async getGoal(userId: string): Promise<FinancialGoal | null> {
    const db = this.db;
    if (!db) return null;
    const { data, error } = await db
      .from('financial_goals')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return rowToGoal(data as any, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER LEVEL
  // ═══════════════════════════════════════════════════════════════════════════

  async upsertUserLevel(userId: string, level: UserLevel): Promise<void> {
    const db = this.db;
    if (!db) return;
    await db.from('user_levels').upsert(
      {
        user_id: userId,
        level: level.level,
        experience: level.experience,
        title: level.title,
      },
      { onConflict: 'user_id' }
    );
  }

  async getUserLevel(userId: string): Promise<UserLevel | null> {
    const db = this.db;
    if (!db) return null;
    const { data, error } = await db
      .from('user_levels')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return rowToUserLevel(data as any, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER DATA (tabla profiles — datos misceláneos)
  // ═══════════════════════════════════════════════════════════════════════════

  async upsertUserData(userId: string, data: UserDataPayload): Promise<void> {
    const db = this.db;
    if (!db) return;
    const payload: Record<string, any> = { id: userId };
    if (data.name !== undefined) payload.name = data.name;
    if (data.monthlySalary !== undefined) payload.monthly_salary = data.monthlySalary;
    if (data.isOnboarded !== undefined) payload.is_onboarded = data.isOnboarded;
    if (data.paidTxIds !== undefined) payload.paid_tx_ids = data.paidTxIds;
    if (data.leccionesCompletadas !== undefined) payload.lecciones_completadas = data.leccionesCompletadas;
    if (data.retosCompletados !== undefined) payload.retos_completados = data.retosCompletados;
    if (data.retoActivo !== undefined) payload.reto_activo = data.retoActivo;
    if (data.premium !== undefined) payload.premium = data.premium;
    await db.from('profiles').upsert(payload);
  }

  async getUserData(userId: string): Promise<{
    name: string;
    monthlySalary: number;
    isOnboarded: boolean;
    paidTxIds: string[];
    leccionesCompletadas: string[];
    retosCompletados: string[];
    retoActivo: RetoActivo | null;
    premium: PremiumState;
  } | null> {
    const db = this.db;
    if (!db) return null;
    const { data, error } = await db
      .from('profiles')
      .select('name, monthly_salary, is_onboarded, paid_tx_ids, lecciones_completadas, retos_completados, reto_activo, premium')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    const r = data as any;
    return {
      name: (r.name as string) ?? '',
      monthlySalary: (r.monthly_salary as number) ?? 0,
      isOnboarded: (r.is_onboarded as boolean) ?? false,
      paidTxIds: (r.paid_tx_ids as string[]) ?? [],
      leccionesCompletadas: (r.lecciones_completadas as string[]) ?? [],
      retosCompletados: (r.retos_completados as string[]) ?? [],
      retoActivo: (r.reto_activo as RetoActivo | null) ?? null,
      premium: (r.premium as PremiumState) ?? DEFAULT_PREMIUM,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC COMPLETO
  // ═══════════════════════════════════════════════════════════════════════════

  // Pull: trae todos los datos del servidor (usado en login)
  async pullFromServer(userId: string): Promise<ServerData | null> {
    if (!this.db) return null;
    try {
      const [transactions, categories, profile, goal, userLevel, userData] = await Promise.all([
        this.getTransactions(userId),
        this.getCategories(userId),
        this.getFinancialProfile(userId),
        this.getGoal(userId),
        this.getUserLevel(userId),
        this.getUserData(userId),
      ]);

      // Si el servidor no tiene nada (cuenta nueva), retorna null
      // para que el caller use los datos locales
      if (!transactions && !categories && !profile && !userData) return null;

      return {
        transactions: transactions ?? [],
        categories: categories ?? [],
        profile: profile ?? null,
        goal: goal ?? null,
        userLevel: userLevel ?? null,
        leccionesCompletadas: userData?.leccionesCompletadas ?? [],
        retosCompletados: userData?.retosCompletados ?? [],
        retoActivo: userData?.retoActivo ?? null,
        premium: userData?.premium ?? DEFAULT_PREMIUM,
        isOnboarded: userData?.isOnboarded ?? false,
        paidTxIds: userData?.paidTxIds ?? [],
        name: userData?.name ?? '',
        monthlySalary: userData?.monthlySalary ?? 0,
      };
    } catch (e) {
      console.warn('[SupabaseService] pullFromServer error:', e);
      return null;
    }
  }

  // Push: sube todos los datos locales al servidor (usado en primer registro)
  async pushAllToServer(userId: string, data: {
    transactions: Transaction[];
    categories: Category[];
    profile: FinancialProfile | null;
    goal: FinancialGoal | null;
    userLevel: UserLevel | null;
    leccionesCompletadas: string[];
    retosCompletados: string[];
    retoActivo: RetoActivo | null;
    premium: PremiumState;
    isOnboarded: boolean;
    name: string;
    monthlySalary: number;
  }): Promise<void> {
    if (!this.db) return;
    try {
      await Promise.all([
        this.bulkInsertTransactions(userId, data.transactions),
        this.syncAllCategories(userId, data.categories),
        data.profile ? this.upsertFinancialProfile(userId, data.profile) : Promise.resolve(),
        data.goal ? this.upsertGoal(userId, data.goal) : Promise.resolve(),
        data.userLevel ? this.upsertUserLevel(userId, data.userLevel) : Promise.resolve(),
        this.upsertUserData(userId, {
          name: data.name,
          monthlySalary: data.monthlySalary,
          isOnboarded: data.isOnboarded,
          leccionesCompletadas: data.leccionesCompletadas,
          retosCompletados: data.retosCompletados,
          retoActivo: data.retoActivo,
          premium: data.premium,
        }),
      ]);
    } catch (e) {
      console.warn('[SupabaseService] pushAllToServer error:', e);
    }
  }

  // Elimina todos los datos del usuario (usado en resetAll)
  async deleteAllUserData(userId: string): Promise<void> {
    const db = this.db;
    if (!db) return;
    try {
      await Promise.all([
        db.from('transactions').delete().eq('user_id', userId),
        db.from('categories').delete().eq('user_id', userId),
        db.from('financial_profiles').delete().eq('user_id', userId),
        db.from('financial_goals').delete().eq('user_id', userId),
        db.from('user_levels').delete().eq('user_id', userId),
        // El row de profiles se resetea pero no se elimina (está enlazado a auth.users)
        db.from('profiles').update({
          monthly_salary: 0,
          is_onboarded: false,
          paid_tx_ids: [],
          lecciones_completadas: [],
          retos_completados: [],
          reto_activo: null,
          premium: DEFAULT_PREMIUM,
        }).eq('id', userId),
      ]);
    } catch (e) {
      console.warn('[SupabaseService] deleteAllUserData error:', e);
    }
  }
}

export const supabaseService = new SupabaseService();
