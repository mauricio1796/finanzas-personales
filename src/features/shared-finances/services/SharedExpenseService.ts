import { supabase } from '../../../lib/supabase';
import { obtenerMiembros } from './SharedSpaceService';
import type { SharedExpense } from '../types';

function assertSupabase() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

export interface NuevoGastoCompartido {
  spaceId: string;
  amount: number;
  category: string;
  description?: string;
  date: string;
}

// Registra un gasto y genera automáticamente los splits 50/50
export async function registrarGastoCompartido(gasto: NuevoGastoCompartido): Promise<SharedExpense> {
  const db = assertSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  // Insertar el gasto
  const { data: expense, error: expErr } = await db
    .from('shared_expenses')
    .insert({
      space_id: gasto.spaceId,
      paid_by: user.id,
      amount: gasto.amount,
      category: gasto.category,
      description: gasto.description ?? null,
      date: gasto.date,
    })
    .select()
    .single();
  if (expErr) throw expErr;

  // Obtener miembros activos para 50/50
  const miembros = await obtenerMiembros(gasto.spaceId);
  if (miembros.length === 0) throw new Error('No hay miembros activos en el espacio');

  const montoPorPersona = Number((gasto.amount / miembros.length).toFixed(2));

  // Ajustar redondeo en el primer miembro
  const splits = miembros.map((m, i) => ({
    expense_id: expense.id,
    user_id: m.userId,
    assigned_amount: i === 0
      ? Number((gasto.amount - montoPorPersona * (miembros.length - 1)).toFixed(2))
      : montoPorPersona,
  }));

  const { error: splitErr } = await db.from('expense_splits').insert(splits);
  if (splitErr) throw splitErr;

  return {
    id: expense.id,
    spaceId: expense.space_id,
    paidBy: expense.paid_by,
    amount: Number(expense.amount),
    category: expense.category,
    description: expense.description ?? undefined,
    date: expense.date,
    createdAt: expense.created_at,
    paidByName: user.email ?? 'Tú',
  };
}

export async function obtenerGastosCompartidos(spaceId: string): Promise<SharedExpense[]> {
  const db = assertSupabase();
  const { data, error } = await db
    .from('shared_expenses')
    .select('*, pagador:paid_by(name)')
    .eq('space_id', spaceId)
    .order('date', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    spaceId: row.space_id,
    paidBy: row.paid_by,
    amount: Number(row.amount),
    category: row.category,
    description: row.description ?? undefined,
    date: row.date,
    createdAt: row.created_at,
    paidByName: row.pagador?.name ?? 'Usuario',
  }));
}

export async function eliminarGastoCompartido(expenseId: string): Promise<void> {
  const db = assertSupabase();
  // Los splits se borran en cascada por FK
  const { error } = await db.from('shared_expenses').delete().eq('id', expenseId);
  if (error) throw error;
}
