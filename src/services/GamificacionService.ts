import { Transaction } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function uniqueDays(transactions: Transaction[]): Set<string> {
  const s = new Set<string>();
  for (const t of transactions) s.add(dateStr(new Date(t.date)));
  return s;
}

// ─── Racha ───────────────────────────────────────────────────────────────────
export function calcularRachaActual(transactions: Transaction[]): number {
  const days = uniqueDays(transactions);
  let count = 0;
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  while (days.has(dateStr(cur))) {
    count++;
    cur.setDate(cur.getDate() - 1);
  }
  return count;
}

export function calcularMejorRacha(transactions: Transaction[]): number {
  const days = uniqueDays(transactions);
  if (days.size === 0) return 0;
  const sorted = Array.from(days).sort();
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000;
    if (diff === 1) { cur++; best = Math.max(best, cur); }
    else cur = 1;
  }
  return best;
}

export function calcularDiasTotales(transactions: Transaction[]): number {
  return uniqueDays(transactions).size;
}

export function calcularRachaSemanal(transactions: Transaction[]): boolean[] {
  const days = uniqueDays(transactions);
  const today = new Date();
  const dow = today.getDay();
  const sinceMonday = dow === 0 ? 6 : dow - 1;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - sinceMonday + i);
    return days.has(dateStr(d));
  });
}

// ─── XP ──────────────────────────────────────────────────────────────────────
export const XP_POR_ACCION = {
  transaccion: 10,
  pago:        50,
  reto:        100,
  leccion:     30,
  categoria:   20,
} as const;

export function calcularXPTotal(
  transactions: Transaction[],
  categoriasPagadas: number,
  retosCompletados: number,
  leccionesCompletadas: number,
): number {
  return (
    transactions.length * XP_POR_ACCION.transaccion +
    categoriasPagadas   * XP_POR_ACCION.pago +
    retosCompletados    * XP_POR_ACCION.reto +
    leccionesCompletadas * XP_POR_ACCION.leccion
  );
}

// ─── Recompensas ─────────────────────────────────────────────────────────────
export interface Recompensa {
  id: string;
  nombre: string;
  descripcion: string;
  costoXP: number;
  iconName: string;
  iconColor: string;
  iconBg: string;
  disponible: boolean;
  canjeada: boolean;
}

const CATALOGO: Omit<Recompensa, 'disponible' | 'canjeada'>[] = [
  { id: 'tema_oscuro',     nombre: 'Tema oscuro',     descripcion: 'Activa el modo oscuro',                 costoXP: 500,  iconName: 'moon',        iconColor: '#6366F1', iconBg: '#EEF2FF' },
  { id: 'avatar_especial', nombre: 'Avatar especial', descripcion: 'Desbloquea un avatar premium',          costoXP: 600,  iconName: 'star',        iconColor: '#10B981', iconBg: '#D1FAE5' },
  { id: 'analisis_pro',    nombre: 'Análisis pro',    descripcion: 'Reportes avanzados por 30 días',        costoXP: 1200, iconName: 'bar-chart-2', iconColor: '#9CA3AF', iconBg: '#F3F4F6' },
  { id: 'mes_premium',     nombre: '1 mes premium',   descripcion: 'Acceso completo a todas las funciones', costoXP: 2000, iconName: 'award',       iconColor: '#9CA3AF', iconBg: '#F3F4F6' },
];

export function getRecompensas(xpActual: number, canjeadas: string[]): Recompensa[] {
  return CATALOGO.map(r => ({
    ...r,
    disponible: xpActual >= r.costoXP,
    canjeada: canjeadas.includes(r.id),
  }));
}

// ─── Nodos habilidades ────────────────────────────────────────────────────────
export type NodoEstado = 'done' | 'active' | 'locked';

export interface NodoHabilidad {
  id: string;
  label: string;
  iconName: string;
  estado: NodoEstado;
  xpRequerido: number;
  descripcion: string;
}

const NODOS: Omit<NodoHabilidad, 'estado'>[] = [
  { id: 'presupuesto', label: 'Presupuesto básico',  iconName: 'dollar-sign', xpRequerido: 0,   descripcion: 'Aprende a crear y gestionar un presupuesto' },
  { id: 'seguimiento', label: 'Seguimiento gastos',  iconName: 'bar-chart-2', xpRequerido: 100, descripcion: 'Registra y analiza tus gastos diarios' },
  { id: 'metas',       label: 'Metas de ahorro',     iconName: 'clock',       xpRequerido: 300, descripcion: 'Define y alcanza metas financieras' },
  { id: 'inversiones', label: 'Inversiones',         iconName: 'lock',        xpRequerido: 700, descripcion: 'Aprende a invertir tu dinero' },
];

export function getNodosHabilidades(xpTotal: number, _leccionesCompletadas: string[]): NodoHabilidad[] {
  return NODOS.map((nodo, i) => {
    const siguiente = NODOS[i + 1];
    let estado: NodoEstado;
    if (siguiente && xpTotal >= siguiente.xpRequerido) {
      estado = 'done';
    } else if (xpTotal >= nodo.xpRequerido) {
      estado = 'active';
    } else {
      estado = 'locked';
    }
    return { ...nodo, estado };
  });
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export interface JugadorRanking {
  id: string;
  nombre: string;
  iniciales: string;
  titulo: string;
  nivel: number;
  xp: number;
  avatarBg: string;
  avatarColor: string;
  esUsuario: boolean;
}

const FICTICIOS: Omit<JugadorRanking, 'esUsuario'>[] = [
  { id: 'f1', nombre: 'Valentina Ríos',  iniciales: 'VR', titulo: 'Inversionista', nivel: 5, xp: 5000, avatarBg: '#EDE9FE', avatarColor: '#5B21B6' },
  { id: 'f2', nombre: 'Andrés Mora',     iniciales: 'AM', titulo: 'Experto',       nivel: 4, xp: 3800, avatarBg: '#DBEAFE', avatarColor: '#1E40AF' },
  { id: 'f3', nombre: 'Camila Torres',   iniciales: 'CT', titulo: 'Gestor',        nivel: 3, xp: 2900, avatarBg: '#D1FAE5', avatarColor: '#065F46' },
  { id: 'f4', nombre: 'Santiago López',  iniciales: 'SL', titulo: 'Gestor',        nivel: 3, xp: 2100, avatarBg: '#FEF3C7', avatarColor: '#92400E' },
  { id: 'f5', nombre: 'Mariana Castro',  iniciales: 'MC', titulo: 'Aprendiz',      nivel: 2, xp: 1500, avatarBg: '#FCE7F3', avatarColor: '#9D174D' },
  { id: 'f6', nombre: 'Felipe Vargas',   iniciales: 'FV', titulo: 'Aprendiz',      nivel: 2, xp: 1100, avatarBg: '#EEF2FF', avatarColor: '#3730A3' },
  { id: 'f7', nombre: 'Luciana Herrera', iniciales: 'LH', titulo: 'Aprendiz',      nivel: 2, xp: 800,  avatarBg: '#FEE2E2', avatarColor: '#991B1B' },
  { id: 'f8', nombre: 'Mateo Jiménez',   iniciales: 'MJ', titulo: 'Principiante',  nivel: 1, xp: 450,  avatarBg: '#F3F4F6', avatarColor: '#374151' },
  { id: 'f9', nombre: 'Isabella Pérez',  iniciales: 'IP', titulo: 'Principiante',  nivel: 1, xp: 200,  avatarBg: '#ECFDF5', avatarColor: '#065F46' },
];

export function getLeaderboard(
  nombreUsuario: string,
  xpUsuario: number,
  nivelUsuario: number,
  tituloUsuario: string,
): JugadorRanking[] {
  const initials = (nombreUsuario ?? 'Tú')
    .split(' ').slice(0, 2)
    .map(w => (w[0] ?? '').toUpperCase())
    .join('') || 'Tú';

  const usuario: JugadorRanking = {
    id: 'me',
    nombre: nombreUsuario ?? 'Tú',
    iniciales: initials,
    titulo: tituloUsuario,
    nivel: nivelUsuario,
    xp: xpUsuario,
    avatarBg: '#EEF2FF',
    avatarColor: '#4338CA',
    esUsuario: true,
  };

  return [...FICTICIOS.map(j => ({ ...j, esUsuario: false })), usuario]
    .sort((a, b) => b.xp - a.xp);
}

// ─── Hábitos ─────────────────────────────────────────────────────────────────
export interface HabitoFinanciero {
  id: string;
  nombre: string;
  descripcion: string;
  iconName: string;
  iconColor: string;
  iconBg: string;
  xpPorAccion: number;
  progreso: number;
  progresoLabel: string;
  color: string;
}

export function getHabitos(
  transactions: Transaction[],
  categoriasPagadas: number,
  retosCompletados: string[],
  leccionesCompletadas: string[],
): HabitoFinanciero[] {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  const diasConTx = new Set(
    transactions
      .filter(t => { const d = new Date(t.date); return d.getMonth() === m && d.getFullYear() === y; })
      .map(t => dateStr(new Date(t.date)))
  ).size;

  return [
    {
      id: 'registrar_gastos',
      nombre: 'Registrar gastos',
      descripcion: 'Registra al menos un gasto cada día',
      iconName: 'trending-down',
      iconColor: '#6366F1',
      iconBg: '#EEF2FF',
      xpPorAccion: XP_POR_ACCION.transaccion,
      progreso: Math.min(diasConTx / 30, 1),
      progresoLabel: `${diasConTx} / 30 días`,
      color: '#6366F1',
    },
    {
      id: 'respetar_presupuesto',
      nombre: 'Respetar presupuesto',
      descripcion: 'Mantén tus gastos dentro del presupuesto',
      iconName: 'shield',
      iconColor: '#10B981',
      iconBg: '#D1FAE5',
      xpPorAccion: XP_POR_ACCION.pago,
      progreso: Math.min(categoriasPagadas / 4, 1),
      progresoLabel: `${Math.min(categoriasPagadas, 4)} / 4 semanas`,
      color: '#10B981',
    },
    {
      id: 'completar_retos',
      nombre: 'Completar retos',
      descripcion: 'Completa retos financieros semanales',
      iconName: 'zap',
      iconColor: '#F59E0B',
      iconBg: '#FEF3C7',
      xpPorAccion: XP_POR_ACCION.reto,
      progreso: Math.min(retosCompletados.length / 4, 1),
      progresoLabel: `${retosCompletados.length} / 4 retos`,
      color: '#F59E0B',
    },
    {
      id: 'lecciones_academia',
      nombre: 'Lecciones academia',
      descripcion: 'Aprende en la academia financiera',
      iconName: 'book-open',
      iconColor: '#8B5CF6',
      iconBg: '#EDE9FE',
      xpPorAccion: XP_POR_ACCION.leccion,
      progreso: Math.min(leccionesCompletadas.length / 12, 1),
      progresoLabel: `${leccionesCompletadas.length} / 12 lecciones`,
      color: '#8B5CF6',
    },
  ];
}
