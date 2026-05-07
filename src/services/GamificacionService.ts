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
    if (diff === 1) { cur++; best = Math.max(best, cur); } else cur = 1;
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

// ─── Sistema de niveles (10 niveles con desbloqueos reales) ──────────────────

export interface NivelConfig {
  level:       number;
  title:       string;
  xpRequired:  number;   // XP total acumulado para alcanzar este nivel
  color:       string;
  gradient:    [string, string];
  unlock:      AppUnlock;
}

export interface AppUnlock {
  id:          string;
  nombre:      string;
  descripcion: string;
  icono:       string;
  tipo:        'feature' | 'cosmetic' | 'ai' | 'premium';
}

export const NIVELES: NivelConfig[] = [
  {
    level: 1, title: 'Principiante', xpRequired: 0,
    color: '#6B7280', gradient: ['#9CA3AF', '#6B7280'],
    unlock: { id: 'base', nombre: 'App completa básica', descripcion: 'Registra gastos, ingresos y categorías', icono: 'home', tipo: 'feature' },
  },
  {
    level: 2, title: 'Aprendiz', xpRequired: 300,
    color: '#3B82F6', gradient: ['#60A5FA', '#3B82F6'],
    unlock: { id: 'historial_avanzado', nombre: 'Historial avanzado', descripcion: 'Filtra y exporta tu historial de transacciones', icono: 'list', tipo: 'feature' },
  },
  {
    level: 3, title: 'Gestor', xpRequired: 800,
    color: '#10B981', gradient: ['#34D399', '#10B981'],
    unlock: { id: 'simulador', nombre: 'Simulador de compras', descripcion: '¿Puedo comprarlo? Simula antes de gastar', icono: 'cpu', tipo: 'feature' },
  },
  {
    level: 4, title: 'Estratega', xpRequired: 1800,
    color: '#F59E0B', gradient: ['#FCD34D', '#F59E0B'],
    unlock: { id: 'proyecciones', nombre: 'Proyecciones mensuales', descripcion: 'Predice cuánto gastarás el próximo mes con IA', icono: 'trending-up', tipo: 'ai' },
  },
  {
    level: 5, title: 'Analista', xpRequired: 3500,
    color: '#8B5CF6', gradient: ['#A78BFA', '#8B5CF6'],
    unlock: { id: 'reportes_pro', nombre: 'Reportes Pro', descripcion: 'Gráficas avanzadas de flujo, comparativas y tendencias', icono: 'bar-chart-2', tipo: 'feature' },
  },
  {
    level: 6, title: 'Experto', xpRequired: 6000,
    color: '#EC4899', gradient: ['#F472B6', '#EC4899'],
    unlock: { id: 'finn_coaching', nombre: 'Finn Coaching', descripcion: 'Sesiones de análisis profundo con la IA cada semana', icono: 'message-circle', tipo: 'ai' },
  },
  {
    level: 7, title: 'Maestro', xpRequired: 9500,
    color: '#EF4444', gradient: ['#F87171', '#EF4444'],
    unlock: { id: 'temas_exclusivos', nombre: 'Temas exclusivos', descripcion: 'Desbloquea paletas de colores y temas premium', icono: 'droplet', tipo: 'cosmetic' },
  },
  {
    level: 8, title: 'Asesor', xpRequired: 14000,
    color: '#06B6D4', gradient: ['#22D3EE', '#06B6D4'],
    unlock: { id: 'multi_cuentas', nombre: 'Multi-cuentas', descripcion: 'Gestiona hasta 3 cuentas o bolsillos diferentes', icono: 'layers', tipo: 'feature' },
  },
  {
    level: 9, title: 'Inversionista', xpRequired: 20000,
    color: '#F97316', gradient: ['#FB923C', '#F97316'],
    unlock: { id: 'premium_full', nombre: 'Premium completo', descripcion: 'Acceso a todas las funciones sin límites', icono: 'award', tipo: 'premium' },
  },
  {
    level: 10, title: 'Gurú Financiero', xpRequired: 30000,
    color: '#EAB308', gradient: ['#FDE047', '#EAB308'],
    unlock: { id: 'guru_badge', nombre: 'Insignia Gurú', descripcion: 'Eres de los mejores. Badge exclusivo + soporte prioritario + beneficios de por vida', icono: 'star', tipo: 'premium' },
  },
];

export function getNivelActual(xpTotal: number): NivelConfig {
  let nivel = NIVELES[0];
  for (const n of NIVELES) {
    if (xpTotal >= n.xpRequired) nivel = n;
  }
  return nivel;
}

export function getNivelSiguiente(xpTotal: number): NivelConfig | null {
  for (const n of NIVELES) {
    if (xpTotal < n.xpRequired) return n;
  }
  return null;
}

export function getProgresoNivel(xpTotal: number): number {
  const actual = getNivelActual(xpTotal);
  const siguiente = getNivelSiguiente(xpTotal);
  if (!siguiente) return 1;
  const xpEnNivel = xpTotal - actual.xpRequired;
  const xpNecesario = siguiente.xpRequired - actual.xpRequired;
  return Math.min(xpEnNivel / xpNecesario, 1);
}

export function getUnlocksDesbloqueados(xpTotal: number): AppUnlock[] {
  return NIVELES.filter(n => xpTotal >= n.xpRequired).map(n => n.unlock);
}

// ─── XP por acción ───────────────────────────────────────────────────────────
export const XP_POR_ACCION = {
  transaccion: 10,
  pago:        50,
  reto:        100,
  leccion:     30,
  categoria:   20,
  logro_common:    50,
  logro_rare:      150,
  logro_epic:      300,
  logro_legendary: 500,
} as const;

// ─── Logros ──────────────────────────────────────────────────────────────────

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Logro {
  id:          string;
  titulo:      string;
  descripcion: string;
  rarity:      Rarity;
  icono:       string;
  xp:          number;
  categoria:   'habitos' | 'ahorro' | 'retos' | 'educacion' | 'social';
  condicion:   (data: LogroConditionData) => boolean;
}

export interface LogroConditionData {
  transactions:         any[];
  categories:           any[];
  rachaActual:          number;
  mejorRacha:           number;
  leccionesCompletadas: string[];
  retosCompletados:     string[];
  goal:                 any;
  xpTotal:              number;
  diasTotales:          number;
}

export const RARITY_STYLE: Record<Rarity, { bg: string; color: string; glow: string; label: string }> = {
  common:    { bg: '#F3F4F6', color: '#6B7280', glow: '#9CA3AF', label: 'Común' },
  rare:      { bg: '#DBEAFE', color: '#1D4ED8', glow: '#60A5FA', label: 'Raro' },
  epic:      { bg: '#EDE9FE', color: '#6D28D9', glow: '#A78BFA', label: 'Épico' },
  legendary: { bg: '#FEF3C7', color: '#B45309', glow: '#FCD34D', label: 'Legendario' },
};

export const LOGROS: Logro[] = [
  // ── Hábitos ──
  {
    id: 'primer_paso', titulo: 'Primer paso', rarity: 'common', icono: 'play-circle',
    xp: XP_POR_ACCION.logro_common, categoria: 'habitos',
    descripcion: 'Registra tu primera transacción',
    condicion: d => d.transactions.length > 0,
  },
  {
    id: 'racha_3', titulo: 'En racha', rarity: 'common', icono: 'zap',
    xp: XP_POR_ACCION.logro_common, categoria: 'habitos',
    descripcion: 'Usa la app 3 días seguidos',
    condicion: d => d.rachaActual >= 3,
  },
  {
    id: 'racha_7', titulo: 'Semana perfecta', rarity: 'rare', icono: 'zap',
    xp: XP_POR_ACCION.logro_rare, categoria: 'habitos',
    descripcion: 'Usa la app 7 días seguidos',
    condicion: d => d.rachaActual >= 7,
  },
  {
    id: 'racha_30', titulo: 'Hábito formado', rarity: 'epic', icono: 'flame' as any,
    xp: XP_POR_ACCION.logro_epic, categoria: 'habitos',
    descripcion: 'Mantén una racha de 30 días',
    condicion: d => d.mejorRacha >= 30,
  },
  {
    id: 'cien_transacciones', titulo: 'Contador activo', rarity: 'rare', icono: 'layers',
    xp: XP_POR_ACCION.logro_rare, categoria: 'habitos',
    descripcion: 'Registra 100 transacciones',
    condicion: d => d.transactions.length >= 100,
  },
  // ── Ahorro ──
  {
    id: 'primera_meta', titulo: 'Soñador', rarity: 'common', icono: 'target',
    xp: XP_POR_ACCION.logro_common, categoria: 'ahorro',
    descripcion: 'Crea tu primera meta de ahorro',
    condicion: d => !!d.goal?.targetAmount,
  },
  {
    id: 'meta_cumplida', titulo: 'Meta alcanzada', rarity: 'epic', icono: 'check-circle',
    xp: XP_POR_ACCION.logro_epic, categoria: 'ahorro',
    descripcion: 'Completa tu primera meta de ahorro',
    condicion: d => !!(d.goal?.targetAmount && d.goal.currentAmount >= d.goal.targetAmount),
  },
  {
    id: 'heroe_presupuesto', titulo: 'Héroe del presupuesto', rarity: 'epic', icono: 'shield',
    xp: XP_POR_ACCION.logro_epic, categoria: 'ahorro',
    descripcion: 'Paga 5 compromisos de presupuesto',
    condicion: d => d.categories.filter((c: any) => c.pagado).length >= 5,
  },
  {
    id: 'sin_deudas', titulo: 'Libre de deudas', rarity: 'legendary', icono: 'unlock',
    xp: XP_POR_ACCION.logro_legendary, categoria: 'ahorro',
    descripcion: 'Marca todas tus categorías de deuda como pagadas',
    condicion: d => {
      const deudas = d.categories.filter((c: any) => c.tipo === 'deuda');
      return deudas.length > 0 && deudas.every((c: any) => c.pagado);
    },
  },
  // ── Retos ──
  {
    id: 'primer_reto', titulo: 'Aceptaste el reto', rarity: 'common', icono: 'flag',
    xp: XP_POR_ACCION.logro_common, categoria: 'retos',
    descripcion: 'Completa tu primer reto financiero',
    condicion: d => d.retosCompletados.length >= 1,
  },
  {
    id: 'tres_retos', titulo: 'Retador', rarity: 'rare', icono: 'award',
    xp: XP_POR_ACCION.logro_rare, categoria: 'retos',
    descripcion: 'Completa 3 retos financieros',
    condicion: d => d.retosCompletados.length >= 3,
  },
  // ── Educación ──
  {
    id: 'primera_leccion', titulo: 'Curioso', rarity: 'common', icono: 'book-open',
    xp: XP_POR_ACCION.logro_common, categoria: 'educacion',
    descripcion: 'Completa tu primera lección de la academia',
    condicion: d => d.leccionesCompletadas.length >= 1,
  },
  {
    id: 'cinco_lecciones', titulo: 'Estudiante', rarity: 'rare', icono: 'book-open',
    xp: XP_POR_ACCION.logro_rare, categoria: 'educacion',
    descripcion: 'Completa 5 lecciones',
    condicion: d => d.leccionesCompletadas.length >= 5,
  },
  {
    id: 'genio_financiero', titulo: 'Genio financiero', rarity: 'legendary', icono: 'cpu',
    xp: XP_POR_ACCION.logro_legendary, categoria: 'educacion',
    descripcion: 'Completa todos los módulos de la academia',
    condicion: d => d.leccionesCompletadas.length >= 12,
  },
  // ── Nivel ──
  {
    id: 'nivel_5', titulo: 'Analista certificado', rarity: 'legendary', icono: 'star',
    xp: XP_POR_ACCION.logro_legendary, categoria: 'social',
    descripcion: 'Alcanza el nivel 5 (Analista)',
    condicion: d => d.xpTotal >= 3500,
  },
];

export function evaluarLogros(data: LogroConditionData): Set<string> {
  const desbloqueados = new Set<string>();
  for (const logro of LOGROS) {
    try {
      if (logro.condicion(data)) desbloqueados.add(logro.id);
    } catch { /* condición falló silenciosamente */ }
  }
  return desbloqueados;
}

// XP total incluyendo logros desbloqueados
export function calcularXPTotal(
  transactions:         any[],
  categoriasPagadas:    number,
  retosCompletados:     number,
  leccionesCompletadas: number,
  logrosDesbloqueados:  Set<string>,
): number {
  const xpBase =
    transactions.length  * XP_POR_ACCION.transaccion +
    categoriasPagadas    * XP_POR_ACCION.pago        +
    retosCompletados     * XP_POR_ACCION.reto         +
    leccionesCompletadas * XP_POR_ACCION.leccion;

  const xpLogros = LOGROS
    .filter(l => logrosDesbloqueados.has(l.id))
    .reduce((s, l) => s + l.xp, 0);

  return xpBase + xpLogros;
}

// ─── Hábitos ─────────────────────────────────────────────────────────────────
export interface HabitoFinanciero {
  id:            string;
  nombre:        string;
  descripcion:   string;
  iconName:      string;
  iconColor:     string;
  iconBg:        string;
  xpPorAccion:   number;
  progreso:      number;
  progresoLabel: string;
  color:         string;
  xpGanado:      number;
  xpMax:         number;
}

export function getHabitos(
  transactions:         Transaction[],
  categoriasPagadas:    number,
  retosCompletados:     string[],
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
      id: 'registrar_gastos', nombre: 'Registrar gastos', descripcion: 'Registra al menos un movimiento cada día del mes',
      iconName: 'trending-down', iconColor: '#6366F1', iconBg: '#EEF2FF',
      xpPorAccion: XP_POR_ACCION.transaccion,
      progreso: Math.min(diasConTx / 30, 1), progresoLabel: `${diasConTx} / 30 días`,
      color: '#6366F1', xpGanado: diasConTx * XP_POR_ACCION.transaccion, xpMax: 30 * XP_POR_ACCION.transaccion,
    },
    {
      id: 'respetar_presupuesto', nombre: 'Pagar compromisos', descripcion: 'Marca tus pagos del mes como completados',
      iconName: 'shield', iconColor: '#10B981', iconBg: '#D1FAE5',
      xpPorAccion: XP_POR_ACCION.pago,
      progreso: Math.min(categoriasPagadas / 4, 1), progresoLabel: `${Math.min(categoriasPagadas, 4)} / 4`,
      color: '#10B981', xpGanado: Math.min(categoriasPagadas, 4) * XP_POR_ACCION.pago, xpMax: 4 * XP_POR_ACCION.pago,
    },
    {
      id: 'completar_retos', nombre: 'Completar retos', descripcion: 'Supera desafíos financieros para ganar XP extra',
      iconName: 'zap', iconColor: '#F59E0B', iconBg: '#FEF3C7',
      xpPorAccion: XP_POR_ACCION.reto,
      progreso: Math.min(retosCompletados.length / 4, 1), progresoLabel: `${retosCompletados.length} / 4 retos`,
      color: '#F59E0B', xpGanado: retosCompletados.length * XP_POR_ACCION.reto, xpMax: 4 * XP_POR_ACCION.reto,
    },
    {
      id: 'lecciones_academia', nombre: 'Academia financiera', descripcion: 'Aprende y sube de nivel más rápido',
      iconName: 'book-open', iconColor: '#8B5CF6', iconBg: '#EDE9FE',
      xpPorAccion: XP_POR_ACCION.leccion,
      progreso: Math.min(leccionesCompletadas.length / 12, 1), progresoLabel: `${leccionesCompletadas.length} / 12`,
      color: '#8B5CF6', xpGanado: leccionesCompletadas.length * XP_POR_ACCION.leccion, xpMax: 12 * XP_POR_ACCION.leccion,
    },
  ];
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export interface JugadorRanking {
  id:          string;
  nombre:      string;
  iniciales:   string;
  titulo:      string;
  nivel:       number;
  xp:          number;
  avatarBg:    string;
  avatarColor: string;
  esUsuario:   boolean;
}

const FICTICIOS: Omit<JugadorRanking, 'esUsuario'>[] = [
  { id: 'f1', nombre: 'Valentina Ríos',  iniciales: 'VR', titulo: 'Gurú Financiero', nivel: 10, xp: 31200, avatarBg: '#FEF3C7', avatarColor: '#B45309' },
  { id: 'f2', nombre: 'Andrés Mora',     iniciales: 'AM', titulo: 'Inversionista',   nivel: 9,  xp: 22400, avatarBg: '#FED7AA', avatarColor: '#C2410C' },
  { id: 'f3', nombre: 'Camila Torres',   iniciales: 'CT', titulo: 'Asesor',          nivel: 8,  xp: 15800, avatarBg: '#CFFAFE', avatarColor: '#0E7490' },
  { id: 'f4', nombre: 'Santiago López',  iniciales: 'SL', titulo: 'Maestro',         nivel: 7,  xp: 11200, avatarBg: '#FEE2E2', avatarColor: '#991B1B' },
  { id: 'f5', nombre: 'Mariana Castro',  iniciales: 'MC', titulo: 'Experto',         nivel: 6,  xp: 7400,  avatarBg: '#FCE7F3', avatarColor: '#9D174D' },
  { id: 'f6', nombre: 'Felipe Vargas',   iniciales: 'FV', titulo: 'Analista',        nivel: 5,  xp: 4200,  avatarBg: '#EDE9FE', avatarColor: '#5B21B6' },
  { id: 'f7', nombre: 'Luciana Herrera', iniciales: 'LH', titulo: 'Estratega',       nivel: 4,  xp: 2300,  avatarBg: '#FEF3C7', avatarColor: '#92400E' },
  { id: 'f8', nombre: 'Mateo Jiménez',   iniciales: 'MJ', titulo: 'Gestor',          nivel: 3,  xp: 1100,  avatarBg: '#D1FAE5', avatarColor: '#065F46' },
  { id: 'f9', nombre: 'Isabella Pérez',  iniciales: 'IP', titulo: 'Aprendiz',        nivel: 2,  xp: 450,   avatarBg: '#DBEAFE', avatarColor: '#1E40AF' },
];

export function getLeaderboard(
  nombreUsuario: string,
  xpUsuario:     number,
  nivelUsuario:  number,
  tituloUsuario: string,
): JugadorRanking[] {
  const initials = (nombreUsuario ?? 'Tú')
    .split(' ').slice(0, 2).map(w => (w[0] ?? '').toUpperCase()).join('') || 'Tú';

  const usuario: JugadorRanking = {
    id: 'me', nombre: nombreUsuario ?? 'Tú', iniciales: initials,
    titulo: tituloUsuario, nivel: nivelUsuario, xp: xpUsuario,
    avatarBg: '#EEF2FF', avatarColor: '#4338CA', esUsuario: true,
  };

  return [...FICTICIOS.map(j => ({ ...j, esUsuario: false })), usuario]
    .sort((a, b) => b.xp - a.xp);
}

// ─── Nodos habilidades (legacy — mantenidos por compatibilidad) ───────────────
export type NodoEstado = 'done' | 'active' | 'locked';
export interface NodoHabilidad {
  id: string; label: string; iconName: string;
  estado: NodoEstado; xpRequerido: number; descripcion: string;
}
const NODOS: Omit<NodoHabilidad, 'estado'>[] = [
  { id: 'presupuesto', label: 'Presupuesto básico',  iconName: 'dollar-sign', xpRequerido: 0,    descripcion: 'Crea y gestiona tu presupuesto mensual' },
  { id: 'seguimiento', label: 'Seguimiento gastos',  iconName: 'bar-chart-2', xpRequerido: 300,  descripcion: 'Registra y analiza tus gastos diarios' },
  { id: 'metas',       label: 'Metas de ahorro',     iconName: 'target',      xpRequerido: 800,  descripcion: 'Define y alcanza metas financieras' },
  { id: 'analisis',    label: 'Análisis avanzado',   iconName: 'trending-up', xpRequerido: 1800, descripcion: 'Proyecciones y reportes pro' },
];
export function getNodosHabilidades(xpTotal: number, _leccionesCompletadas: string[]): NodoHabilidad[] {
  return NODOS.map((nodo, i) => {
    const siguiente = NODOS[i + 1];
    let estado: NodoEstado;
    if (siguiente && xpTotal >= siguiente.xpRequerido) estado = 'done';
    else if (xpTotal >= nodo.xpRequerido) estado = 'active';
    else estado = 'locked';
    return { ...nodo, estado };
  });
}

// ─── Recompensas (legacy — reemplazadas por desbloqueos de nivel) ─────────────
export interface Recompensa {
  id: string; nombre: string; descripcion: string; costoXP: number;
  iconName: string; iconColor: string; iconBg: string; disponible: boolean; canjeada: boolean;
}
export function getRecompensas(xpActual: number, canjeadas: string[]): Recompensa[] {
  return NIVELES.map(n => ({
    id:          n.unlock.id,
    nombre:      n.unlock.nombre,
    descripcion: n.unlock.descripcion,
    costoXP:     n.xpRequired,
    iconName:    n.unlock.icono,
    iconColor:   n.color,
    iconBg:      n.gradient[0] + '22',
    disponible:  xpActual >= n.xpRequired,
    canjeada:    canjeadas.includes(n.unlock.id),
  }));
}
