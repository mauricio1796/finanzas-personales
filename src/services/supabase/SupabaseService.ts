import { supabase, isSupabaseReady } from '../../lib/supabase';
import type { Transaction, Category, FinancialProfile, FinancialGoal, UserLevel } from '../../types';
import type { PremiumState, RetoActivo } from '../../state/FinanceContext';

// ─── Tipos públicos ───────────────────────────────────────────────────────────
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

export interface TransactionPage {
  items: Transaction[];
  nextCursor: string | null;
  hasMore: boolean;
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

const PAGE_SIZE = 50;

// ─── Validación de inputs antes de tocar la DB ───────────────────────────────
function validateTransaction(tx: Transaction): void {
  if (!tx.id || typeof tx.id !== 'string') throw new Error('Transaction id inválido');
  if (typeof tx.amount !== 'number' || tx.amount < 0 || !isFinite(tx.amount)) throw new Error('Monto inválido');
  if (!['income', 'expense'].includes(tx.type)) throw new Error('Tipo de transacción inválido');
  if (!tx.date || typeof tx.date !== 'string') throw new Error('Fecha inválida');
  if (tx.description && tx.description.length > 500) throw new Error('Descripción demasiado larga');
}

function validateCategory(cat: Category): void {
  if (!cat.id || typeof cat.id !== 'string') throw new Error('Category id inválido');
  if (!cat.name || cat.name.trim().length === 0) throw new Error('Nombre de categoría requerido');
  if (cat.name.length > 100) throw new Error('Nombre de categoría demasiado largo');
  if (cat.budget !== undefined && (typeof cat.budget !== 'number' || cat.budget < 0)) throw new Error('Presupuesto inválido');
}

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

  // Upsert con resolución de conflictos: last-writer-wins por updated_at
  async upsertTransaction(userId: string, tx: Transaction): Promise<void> {
    const db = this.db;
    if (!db) return;
    validateTransaction(tx);
    // Usa la función RPC que implementa la lógica de conflictos en el servidor
    const { error } = await db.rpc('upsert_transaction_safe', {
      p_id:          tx.id,
      p_user_id:     userId,
      p_amount:      tx.amount,
      p_category:    tx.category.substring(0, 200),
      p_date:        tx.date,
      p_type:        tx.type,
      p_description: tx.description?.substring(0, 500) ?? null,
      p_updated_at:  new Date().toISOString(),
    });
    if (error) throw error;
  }

  // Soft delete: marca deleted_at en lugar de borrar físicamente
  async deleteTransaction(id: string, userId: string): Promise<void> {
    const db = this.db;
    if (!db) return;
    const { error } = await db.rpc('soft_delete_transaction', {
      p_id:      id,
      p_user_id: userId,
    });
    if (error) throw error;
  }

  // Obtiene transacciones con paginación por cursor (date + id)
  async getTransactions(userId: string, cursor?: string): Promise<TransactionPage> {
    const db = this.db;
    if (!db) return { items: [], nextCursor: null, hasMore: false };

    let query = db
      .from('transactions')
      .select('id, amount, category, date, type, description, updated_at')
      .eq('user_id', userId)
      .is('deleted_at', null)   // excluye soft-deleted
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (cursor) {
      // cursor = ISO date string usado como punto de corte
      query = query.lt('date', cursor);
    }

    const { data, error } = await query;
    if (error || !data) return { items: [], nextCursor: null, hasMore: false };

    const hasMore = data.length > PAGE_SIZE;
    const rows = hasMore ? data.slice(0, PAGE_SIZE) : data;
    const items = (rows as any[]).map(rowToTransaction);
    const nextCursor = hasMore ? rows[rows.length - 1].date : null;

    return { items, nextCursor, hasMore };
  }

  // Versión sin paginación para sync inicial (mantiene compatibilidad)
  async getAllTransactions(userId: string): Promise<Transaction[] | null> {
    const db = this.db;
    if (!db) return null;
    const { data, error } = await db
      .from('transactions')
      .select('id, amount, category, date, type, description')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: false });
    if (error || !data) return null;
    return (data as any[]).map(rowToTransaction);
  }

  private async bulkInsertTransactions(userId: string, txs: Transaction[]): Promise<void> {
    const db = this.db;
    if (!db || txs.length === 0) return;
    const validated = txs.filter(tx => {
      try { validateTransaction(tx); return true; } catch { return false; }
    });
    if (validated.length === 0) return;
    await db.from('transactions').upsert(
      validated.map(tx => ({
        id: tx.id,
        user_id: userId,
        amount: tx.amount,
        category: tx.category.substring(0, 200),
        date: tx.date,
        type: tx.type,
        description: tx.description?.substring(0, 500) ?? null,
        updated_at: new Date().toISOString(),
      }))
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════

  async upsertCategory(userId: string, cat: Category): Promise<void> {
    const db = this.db;
    if (!db) return;
    validateCategory(cat);
    await db.from('categories').upsert({
      id: cat.id,
      user_id: userId,
      name: cat.name.trim().substring(0, 100),
      icon: cat.icon ?? null,
      color: cat.color ?? null,
      budget: cat.budget ?? null,
      is_selected: cat.isSelected ?? true,
      dia_pago: cat.diaPago ?? null,
      pagado: cat.pagado ?? false,
      tipo: cat.tipo ?? null,
      fecha_creacion: cat.fechaCreacion ?? null,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
  }

  async deleteCategory(id: string, userId: string): Promise<void> {
    const db = this.db;
    if (!db) return;
    await db
      .from('categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
  }

  async syncAllCategories(userId: string, cats: Category[]): Promise<void> {
    const db = this.db;
    if (!db) return;
    // Soft-delete todas las activas del usuario, luego upsert las nuevas
    await db
      .from('categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (cats.length === 0) return;
    const validated = cats.filter(c => {
      try { validateCategory(c); return true; } catch { return false; }
    });
    if (validated.length === 0) return;
    await db.from('categories').insert(
      validated.map(c => ({
        id: c.id,
        user_id: userId,
        name: c.name.trim().substring(0, 100),
        icon: c.icon ?? null,
        color: c.color ?? null,
        budget: c.budget ?? null,
        is_selected: c.isSelected ?? true,
        dia_pago: c.diaPago ?? null,
        pagado: c.pagado ?? false,
        tipo: c.tipo ?? null,
        fecha_creacion: c.fechaCreacion ?? null,
        updated_at: new Date().toISOString(),
      }))
    );
  }

  async getCategories(userId: string): Promise<Category[] | null> {
    const db = this.db;
    if (!db) return null;
    const { data, error } = await db
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);
    if (error || !data) return null;
    return (data as any[]).map(rowToCategory);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL PROFILE
  // ═══════════════════════════════════════════════════════════════════════════

  async upsertFinancialProfile(userId: string, profile: FinancialProfile): Promise<void> {
    const db = this.db;
    if (!db) return;
    if (profile.monthlySalary !== undefined && (profile.monthlySalary < 0 || !isFinite(profile.monthlySalary))) {
      throw new Error('Salario inválido');
    }
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
        title: goal.title?.substring(0, 200),
        description: goal.description?.substring(0, 1000) ?? null,
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
        level: Math.max(1, Math.min(5, level.level)),
        experience: Math.max(0, level.experience),
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
  // USER DATA (tabla profiles)
  // ═══════════════════════════════════════════════════════════════════════════

  async upsertUserData(userId: string, data: UserDataPayload): Promise<void> {
    const db = this.db;
    if (!db) return;
    const payload: Record<string, any> = { id: userId };
    if (data.name !== undefined) payload.name = String(data.name).substring(0, 100);
    if (data.monthlySalary !== undefined && isFinite(data.monthlySalary)) {
      payload.monthly_salary = Math.max(0, data.monthlySalary);
    }
    if (data.isOnboarded !== undefined) payload.is_onboarded = Boolean(data.isOnboarded);
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
  // FINN MEMORY
  // ═══════════════════════════════════════════════════════════════════════════

  async getFinnMemory(userId: string): Promise<FinnMemory | null> {
    const db = this.db;
    if (!db) return null;
    const { data, error } = await db
      .from('finn_memory')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return data as FinnMemory;
  }

  async upsertFinnMemory(userId: string, memory: Partial<FinnMemory>): Promise<void> {
    const db = this.db;
    if (!db) return;
    await db.from('finn_memory').upsert(
      { user_id: userId, ...memory, ultima_actualizacion: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC COMPLETO
  // ═══════════════════════════════════════════════════════════════════════════

  async pullFromServer(userId: string): Promise<ServerData | null> {
    if (!this.db) return null;
    try {
      const [transactions, categories, profile, goal, userLevel, userData] = await Promise.all([
        this.getAllTransactions(userId),
        this.getCategories(userId),
        this.getFinancialProfile(userId),
        this.getGoal(userId),
        this.getUserLevel(userId),
        this.getUserData(userId),
      ]);

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

  async deleteAllUserData(userId: string): Promise<void> {
    const db = this.db;
    if (!db) return;
    try {
      const now = new Date().toISOString();
      await Promise.all([
        // Soft delete transactions y categories — preserva auditoría
        db.from('transactions').update({ deleted_at: now }).eq('user_id', userId).is('deleted_at', null),
        db.from('categories').update({ deleted_at: now }).eq('user_id', userId).is('deleted_at', null),
        db.from('financial_profiles').delete().eq('user_id', userId),
        db.from('financial_goals').delete().eq('user_id', userId),
        db.from('user_levels').delete().eq('user_id', userId),
        db.from('finn_memory').delete().eq('user_id', userId),
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

// ─── Tipo FinnMemory ──────────────────────────────────────────────────────────
export interface FinnMemory {
  user_id: string;
  patrones: Record<string, any>;
  preferencias: Record<string, any>;
  alertas: any[];
  resumen_mes_anterior: Record<string, any> | null;
  ultima_actualizacion: string;
}

export const supabaseService = new SupabaseService();
