import { Transaction, Category } from '../types';

// ── Gasto de una categoría en el mes especificado ──────────────────────────────
export function getGastoCategoria(
  categoryName: string,
  transactions: Transaction[],
  mes: number,
  año: number,
  categoryId?: string, // para resolver transacciones que guardaron el ID
): number {
  return transactions
    .filter(t => {
      const d = new Date(t.date);
      const matchName = t.category === categoryName;
      const matchId   = categoryId ? t.category === categoryId : false;
      return (
        t.type === 'expense' &&
        (matchName || matchId) &&
        d.getMonth() === mes &&
        d.getFullYear() === año
      );
    })
    .reduce((s, t) => s + t.amount, 0);
}

// ── Gasto total de todas las categorías activas este mes ───────────────────────
export function getGastoTotalMes(
  transactions: Transaction[],
  mes: number,
  año: number,
): number {
  return transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === mes && d.getFullYear() === año;
    })
    .reduce((s, t) => s + t.amount, 0);
}

// ── Presupuesto total asignado entre todas las categorías activas ───────────────
export function getPresupuestoTotal(categories: Category[]): number {
  return categories
    .filter(c => c.isSelected && (c.budget ?? 0) > 0)
    .reduce((s, c) => s + (c.budget ?? 0), 0);
}

// ── Estado semáforo ────────────────────────────────────────────────────────────
export type EstadoCategoria = 'ok' | 'warning' | 'over' | 'paid' | 'no_budget';

export function getEstadoCategoria(
  gastado: number,
  budget: number,
  pagado: boolean,
): EstadoCategoria {
  if (pagado) return 'paid';
  if (!budget || budget === 0) return 'no_budget';
  const pct = gastado / budget;
  if (pct > 1) return 'over';
  if (pct >= 0.8) return 'warning';
  return 'ok';
}

// ── Color semáforo ─────────────────────────────────────────────────────────────
export function getColorEstado(estado: EstadoCategoria, colors: any): string {
  switch (estado) {
    case 'paid':      return colors.income;
    case 'over':      return colors.expense;
    case 'warning':   return colors.warning;
    case 'ok':        return colors.income;
    case 'no_budget': return colors.textTertiary;
  }
}

// ── Ícono Feather por nombre de categoría ──────────────────────────────────────
export function getIconoCategoria(nombre: string): string {
  const map: Record<string, string> = {
    'Alimentación':    'shopping-cart',
    'Transporte':      'map-pin',
    'Vivienda':        'home',
    'Arriendo':        'home',
    'Salud':           'heart',
    'Educación':       'book-open',
    'Entretenimiento': 'tv',
    'Ropa':            'shopping-bag',
    'Servicios':       'zap',
    'Telefonía':       'phone',
    'Gym / Sport':     'activity',
    'Mascotas':        'feather',
    'Ahorro':          'dollar-sign',
    'Deudas':          'credit-card',
    'Salario':         'briefcase',
    'Otros':           'more-horizontal',
  };
  return map[nombre] ?? 'tag';
}

// ── Color de fondo del ícono por categoría ─────────────────────────────────────
export function getBgIconoCategoria(
  nombre: string,
  isDark: boolean,
): { bg: string; color: string } {
  const paleta: Record<string, { bgDark: string; bgLight: string; colorDark: string; colorLight: string }> = {
    'Alimentación':    { bgDark: '#1E1B4B', bgLight: '#EEF2FF', colorDark: '#818CF8', colorLight: '#6366F1' },
    'Transporte':      { bgDark: '#1C1007', bgLight: '#FEF3C7', colorDark: '#FBBF24', colorLight: '#F59E0B' },
    'Vivienda':        { bgDark: '#064E3B', bgLight: '#D1FAE5', colorDark: '#34D399', colorLight: '#10B981' },
    'Arriendo':        { bgDark: '#064E3B', bgLight: '#D1FAE5', colorDark: '#34D399', colorLight: '#10B981' },
    'Salud':           { bgDark: '#450A0A', bgLight: '#FEE2E2', colorDark: '#F87171', colorLight: '#EF4444' },
    'Educación':       { bgDark: '#1E1B4B', bgLight: '#EDE9FE', colorDark: '#A78BFA', colorLight: '#8B5CF6' },
    'Entretenimiento': { bgDark: '#2E1065', bgLight: '#EDE9FE', colorDark: '#A78BFA', colorLight: '#8B5CF6' },
    'Ropa':            { bgDark: '#3B1F6A', bgLight: '#FDF2F8', colorDark: '#C084FC', colorLight: '#A855F7' },
    'Servicios':       { bgDark: '#1C1007', bgLight: '#FEF3C7', colorDark: '#FBBF24', colorLight: '#F59E0B' },
    'Telefonía':       { bgDark: '#1C1007', bgLight: '#FEF3C7', colorDark: '#FBBF24', colorLight: '#F59E0B' },
    'Gym / Sport':     { bgDark: '#064E3B', bgLight: '#D1FAE5', colorDark: '#34D399', colorLight: '#10B981' },
    'Mascotas':        { bgDark: '#1A2E1A', bgLight: '#DCFCE7', colorDark: '#4ADE80', colorLight: '#22C55E' },
    'Ahorro':          { bgDark: '#0C2340', bgLight: '#DBEAFE', colorDark: '#60A5FA', colorLight: '#3B82F6' },
    'Deudas':          { bgDark: '#3D1515', bgLight: '#FEE2E2', colorDark: '#F87171', colorLight: '#EF4444' },
    'Salario':         { bgDark: '#064E3B', bgLight: '#D1FAE5', colorDark: '#34D399', colorLight: '#10B981' },
    'Otros':           { bgDark: '#252528', bgLight: '#F3F4F6', colorDark: '#71717A', colorLight: '#6B7280' },
  };
  const p = paleta[nombre] ?? paleta['Otros']!;
  return {
    bg:    isDark ? p.bgDark    : p.bgLight,
    color: isDark ? p.colorDark : p.colorLight,
  };
}

// ── Generar ID único para nueva categoría ──────────────────────────────────────
export function generarIdCategoria(): string {
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Texto de estado legible ────────────────────────────────────────────────────
export function getLabelEstado(estado: EstadoCategoria, pct: number): string {
  switch (estado) {
    case 'paid':      return 'Pagado';
    case 'over':      return `Excedido +${pct - 100}%`;
    case 'warning':   return `${pct}% · Cuidado`;
    case 'ok':        return `${pct}%`;
    case 'no_budget': return 'Sin presupuesto';
  }
}
