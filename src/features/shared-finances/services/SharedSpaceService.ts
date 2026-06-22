import { supabase } from '../../../lib/supabase';
import type {
  SharedSpace,
  SpaceMember,
  SpaceInvitation,
  MemberBalance,
  SharedSpaceSummary,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function assertSupabase() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

// ─── Espacio ──────────────────────────────────────────────────────────────────

export async function crearEspacio(nombre: string): Promise<SharedSpace> {
  const db = assertSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  // Crear el espacio
  const { data: space, error: spaceErr } = await db
    .from('shared_spaces')
    .insert({ name: nombre, type: 'pareja', created_by: user.id })
    .select()
    .single();
  if (spaceErr) throw spaceErr;

  // Auto-insertar al creador como miembro activo
  const { error: memberErr } = await db
    .from('space_members')
    .insert({ space_id: space.id, user_id: user.id, role: 'creador', status: 'activo' });
  if (memberErr) throw memberErr;

  return mapSpace(space);
}

export async function obtenerMiEspacio(): Promise<SharedSpace | null> {
  const db = assertSupabase();
  const { data, error } = await db
    .from('shared_spaces')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSpace(data) : null;
}

// ─── Invitaciones ─────────────────────────────────────────────────────────────

export async function crearInvitacion(spaceId: string): Promise<SpaceInvitation> {
  const db = assertSupabase();

  // Invalidar invitaciones pendientes anteriores del mismo espacio
  await db
    .from('space_invitations')
    .update({ status: 'expirada' })
    .eq('space_id', spaceId)
    .eq('status', 'pendiente');

  const codigo = generarCodigo();
  const { data, error } = await db
    .from('space_invitations')
    .insert({
      space_id: spaceId,
      code: codigo,
      status: 'pendiente',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return mapInvitation(data);
}

export async function obtenerInvitacionPorCodigo(codigo: string): Promise<SpaceInvitation | null> {
  const db = assertSupabase();
  const { data, error } = await db
    .from('space_invitations')
    .select('*')
    .eq('code', codigo.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data ? mapInvitation(data) : null;
}

export async function aceptarInvitacion(codigo: string): Promise<SharedSpace> {
  const db = assertSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const invitacion = await obtenerInvitacionPorCodigo(codigo);
  if (!invitacion) throw new Error('Código de invitación no encontrado');
  if (invitacion.status !== 'pendiente') throw new Error('Esta invitación ya fue usada o expiró');
  if (new Date(invitacion.expiresAt) < new Date()) throw new Error('Esta invitación ha expirado');

  // Verificar que no sea el mismo creador
  const { data: space } = await db
    .from('shared_spaces')
    .select('created_by, name, type, created_at')
    .eq('id', invitacion.spaceId)
    .single();
  if (!space) throw new Error('Espacio no encontrado');
  if (space.created_by === user.id) throw new Error('Ya eres el creador de este espacio');

  // Agregar como miembro activo
  const { error: memberErr } = await db
    .from('space_members')
    .upsert(
      { space_id: invitacion.spaceId, user_id: user.id, role: 'miembro', status: 'activo' },
      { onConflict: 'space_id,user_id' }
    );
  if (memberErr) throw memberErr;

  // Marcar invitación como aceptada
  await db
    .from('space_invitations')
    .update({ status: 'aceptada' })
    .eq('id', invitacion.id);

  return {
    id: invitacion.spaceId,
    name: space.name,
    type: space.type,
    createdBy: space.created_by,
    createdAt: space.created_at,
  };
}

// ─── Miembros ─────────────────────────────────────────────────────────────────

export async function obtenerMiembros(spaceId: string): Promise<SpaceMember[]> {
  const db = assertSupabase();
  const { data, error } = await db
    .from('space_members')
    .select('*, profiles:user_id(name)')
    .eq('space_id', spaceId)
    .eq('status', 'activo');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    spaceId: row.space_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    displayName: row.profiles?.name ?? 'Usuario',
  }));
}

// ─── Balance ──────────────────────────────────────────────────────────────────

export async function calcularBalances(spaceId: string): Promise<MemberBalance[]> {
  const db = assertSupabase();

  const miembros = await obtenerMiembros(spaceId);

  // Gastos pagados por cada miembro
  const { data: gastos, error: gastosErr } = await db
    .from('shared_expenses')
    .select('paid_by, amount')
    .eq('space_id', spaceId);
  if (gastosErr) throw gastosErr;

  // Splits asignados a cada miembro
  const { data: splits, error: splitsErr } = await db
    .from('expense_splits')
    .select('user_id, assigned_amount, expense_id, shared_expenses!inner(space_id)')
    .eq('shared_expenses.space_id', spaceId);
  if (splitsErr) throw splitsErr;

  const totalPagadoPor: Record<string, number> = {};
  const totalDebidoPor: Record<string, number> = {};

  for (const m of miembros) {
    totalPagadoPor[m.userId] = 0;
    totalDebidoPor[m.userId] = 0;
  }

  for (const g of gastos ?? []) {
    totalPagadoPor[g.paid_by] = (totalPagadoPor[g.paid_by] ?? 0) + Number(g.amount);
  }
  for (const s of splits ?? []) {
    totalDebidoPor[s.user_id] = (totalDebidoPor[s.user_id] ?? 0) + Number(s.assigned_amount);
  }

  return miembros.map(m => ({
    userId: m.userId,
    displayName: m.displayName ?? 'Usuario',
    totalPaid: totalPagadoPor[m.userId] ?? 0,
    totalOwed: totalDebidoPor[m.userId] ?? 0,
    net: (totalPagadoPor[m.userId] ?? 0) - (totalDebidoPor[m.userId] ?? 0),
  }));
}

// ─── Resumen para Finn (solo datos del espacio, sin finanzas personales) ──────

export async function obtenerResumenParaFinn(spaceId: string): Promise<SharedSpaceSummary | null> {
  const db = assertSupabase();

  const { data: space } = await db
    .from('shared_spaces')
    .select('*')
    .eq('id', spaceId)
    .single();
  if (!space) return null;

  const miembros = await obtenerMiembros(spaceId);

  const mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { data: gastosMes } = await db
    .from('shared_expenses')
    .select('amount, category')
    .eq('space_id', spaceId)
    .gte('date', `${mesActual}-01`);

  const totalMes = (gastosMes ?? []).reduce((s, g) => s + Number(g.amount), 0);

  const porCategoria: Record<string, number> = {};
  for (const g of gastosMes ?? []) {
    porCategoria[g.category] = (porCategoria[g.category] ?? 0) + Number(g.amount);
  }

  const balances = await calcularBalances(spaceId);

  let deudaNeta: SharedSpaceSummary['deudaNeta'] = null;
  if (balances.length === 2) {
    const [a, b] = balances;
    if (Math.abs(a.net) > 1) {
      deudaNeta = a.net < 0
        ? { deudorNombre: a.displayName, acreedorNombre: b.displayName, monto: Math.abs(a.net) }
        : { deudorNombre: b.displayName, acreedorNombre: a.displayName, monto: Math.abs(b.net) };
    }
  }

  return {
    spaceName: space.name,
    spaceType: space.type,
    members: miembros.map(m => ({ userId: m.userId, displayName: m.displayName ?? 'Usuario' })),
    totalGastosMes: totalMes,
    gastosPorCategoria: Object.entries(porCategoria).map(([categoria, monto]) => ({ categoria, monto })),
    balances,
    deudaNeta,
  };
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapSpace(row: any): SharedSpace {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapInvitation(row: any): SpaceInvitation {
  return {
    id: row.id,
    spaceId: row.space_id,
    code: row.code,
    email: row.email,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}
