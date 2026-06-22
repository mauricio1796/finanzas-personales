// ─── Finanzas Compartidas — Tipos TypeScript ─────────────────────────────────

export type SpaceType = 'pareja' | 'roomies' | 'familia';
export type MemberRole = 'creador' | 'miembro';
export type MemberStatus = 'activo' | 'pendiente';
export type InvitationStatus = 'pendiente' | 'aceptada' | 'rechazada' | 'expirada';

// División futura: solo 50/50 por ahora; el campo permite ampliar
export type SplitMode = 'equal'; // | 'percentage' | 'exact' — futuro

export interface SharedSpace {
  id: string;
  name: string;
  type: SpaceType;
  createdBy: string;
  createdAt: string;
}

export interface SpaceMember {
  id: string;
  spaceId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  createdAt: string;
  // Enriquecido en el cliente desde profiles
  displayName?: string;
}

export interface SharedExpense {
  id: string;
  spaceId: string;
  paidBy: string;
  amount: number;
  category: string;
  description?: string;
  date: string;
  createdAt: string;
  // Enriquecido en el cliente
  paidByName?: string;
}

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  userId: string;
  assignedAmount: number;
}

export interface SpaceInvitation {
  id: string;
  spaceId: string;
  code: string;
  email?: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

// Balance calculado en el cliente
export interface MemberBalance {
  userId: string;
  displayName: string;
  totalPaid: number;       // Suma de gastos donde este usuario pagó
  totalOwed: number;       // Suma de splits asignados a este usuario
  net: number;             // totalPaid - totalOwed (positivo = le deben, negativo = debe)
}

// Resumen del espacio para Finn (solo datos del espacio, sin finanzas personales)
export interface SharedSpaceSummary {
  spaceName: string;
  spaceType: SpaceType;
  members: { userId: string; displayName: string }[];
  totalGastosMes: number;
  gastosPorCategoria: { categoria: string; monto: number }[];
  balances: MemberBalance[];
  // Deuda neta entre dos miembros (simplificada para pareja)
  deudaNeta: { deudorNombre: string; acreedorNombre: string; monto: number } | null;
}
