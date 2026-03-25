import { Transaction } from '../types';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type FiltroTipo    = 'todos' | 'ingresos' | 'gastos';
export type FiltroOrden   = 'reciente' | 'antiguo' | 'mayor' | 'menor';
export type FiltroPeriodo = 'todo' | 'hoy' | 'semana' | 'mes' | 'mes_anterior' | '3meses';

export interface FiltrosActivos {
  tipo:      FiltroTipo;
  orden:     FiltroOrden;
  periodo:   FiltroPeriodo;
  categoria: string | null;
  busqueda:  string;
}

export interface TransaccionAgrupada {
  fechaLabel:    string;
  fechaISO:      string;
  esHoy:         boolean;
  esAyer:        boolean;
  transacciones: Transaction[];
  totalGastos:   number;
  totalIngresos: number;
}

export interface EstadisticasHistorial {
  totalTransacciones: number;
  totalGastos:        number;
  totalIngresos:      number;
  balance:            number;
  promedioGasto:      number;
  categoriaMasGasto:  string;
  diaMaxGasto:        string;
}

// ── Filtrado ──────────────────────────────────────────────────────────────────

export function filtrarTransacciones(
  transactions: Transaction[],
  filtros: FiltrosActivos,
): Transaction[] {
  const now = new Date();
  let result = [...transactions];

  const getDesde = (): Date | null => {
    switch (filtros.periodo) {
      case 'hoy': {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case 'semana': {
        const d = new Date(now);
        const dia = d.getDay();
        d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case 'mes':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'mes_anterior':
        return new Date(now.getFullYear(), now.getMonth() - 1, 1);
      case '3meses':
        return new Date(now.getFullYear(), now.getMonth() - 2, 1);
      default:
        return null;
    }
  };

  const getHasta = (): Date | null => {
    if (filtros.periodo === 'mes_anterior') {
      return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }
    return null;
  };

  const desde = getDesde();
  const hasta = getHasta();

  if (desde) result = result.filter(t => new Date(t.date) >= desde);
  if (hasta) result = result.filter(t => new Date(t.date) <= hasta);

  if (filtros.tipo === 'ingresos') result = result.filter(t => t.type === 'income');
  if (filtros.tipo === 'gastos')   result = result.filter(t => t.type === 'expense');

  if (filtros.categoria) {
    result = result.filter(t => t.category === filtros.categoria);
  }

  if (filtros.busqueda.trim()) {
    const q = filtros.busqueda.toLowerCase();
    result = result.filter(t =>
      t.category.toLowerCase().includes(q) ||
      (t.description?.toLowerCase() ?? '').includes(q) ||
      String(Math.round(t.amount)).includes(q),
    );
  }

  result.sort((a, b) => {
    switch (filtros.orden) {
      case 'reciente': return new Date(b.date).getTime() - new Date(a.date).getTime();
      case 'antiguo':  return new Date(a.date).getTime() - new Date(b.date).getTime();
      case 'mayor':    return b.amount - a.amount;
      case 'menor':    return a.amount - b.amount;
    }
  });

  return result;
}

// ── Agrupación por fecha ──────────────────────────────────────────────────────

export function agruparPorFecha(
  transactions: Transaction[],
  filtroOrden: FiltroOrden,
): TransaccionAgrupada[] {
  const now      = new Date();
  const hoyStr   = now.toDateString();
  const ayerDate = new Date(now);
  ayerDate.setDate(now.getDate() - 1);
  const ayerStr  = ayerDate.toDateString();

  const grupos = new Map<string, Transaction[]>();

  transactions.forEach(t => {
    const key = new Date(t.date).toDateString();
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(t);
  });

  const result: TransaccionAgrupada[] = [];

  grupos.forEach((txs, key) => {
    const d      = new Date(txs[0].date);
    const esHoy  = key === hoyStr;
    const esAyer = key === ayerStr;

    let fechaLabel: string;
    if (esHoy) {
      fechaLabel = 'Hoy';
    } else if (esAyer) {
      fechaLabel = 'Ayer';
    } else {
      const esEsteAnio = d.getFullYear() === now.getFullYear();
      fechaLabel = d.toLocaleDateString('es-CO', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        ...(esEsteAnio ? {} : { year: 'numeric' }),
      });
    }

    result.push({
      fechaLabel,
      fechaISO:      d.toISOString(),
      esHoy,
      esAyer,
      transacciones: txs,
      totalGastos:   txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      totalIngresos: txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    });
  });

  return result.sort((a, b) =>
    filtroOrden === 'antiguo'
      ? new Date(a.fechaISO).getTime() - new Date(b.fechaISO).getTime()
      : new Date(b.fechaISO).getTime() - new Date(a.fechaISO).getTime(),
  );
}

// ── Estadísticas del período filtrado ────────────────────────────────────────

export function calcularEstadisticasHistorial(
  transactions: Transaction[],
): EstadisticasHistorial {
  if (transactions.length === 0) {
    return {
      totalTransacciones: 0,
      totalGastos:        0,
      totalIngresos:      0,
      balance:            0,
      promedioGasto:      0,
      categoriaMasGasto:  '—',
      diaMaxGasto:        '—',
    };
  }

  const gastos   = transactions.filter(t => t.type === 'expense');
  const ingresos = transactions.filter(t => t.type === 'income');

  const totalGastos   = gastos.reduce((s, t) => s + t.amount, 0);
  const totalIngresos = ingresos.reduce((s, t) => s + t.amount, 0);

  const porCategoria: Record<string, number> = {};
  gastos.forEach(t => {
    porCategoria[t.category] = (porCategoria[t.category] || 0) + t.amount;
  });
  const catMayor = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0];

  const porDia: Record<string, number> = {};
  gastos.forEach(t => {
    const d = new Date(t.date).toLocaleDateString('es-CO', { weekday: 'long' });
    porDia[d] = (porDia[d] || 0) + t.amount;
  });
  const diaMayor = Object.entries(porDia).sort((a, b) => b[1] - a[1])[0];

  return {
    totalTransacciones: transactions.length,
    totalGastos,
    totalIngresos,
    balance:            totalIngresos - totalGastos,
    promedioGasto:      gastos.length > 0 ? totalGastos / gastos.length : 0,
    categoriaMasGasto:  catMayor?.[0] ?? '—',
    diaMaxGasto:        diaMayor?.[0] ?? '—',
  };
}

// ── Categorías únicas presentes en las transacciones ────────────────────────

export function getCategoriasFiltro(transactions: Transaction[]): string[] {
  return [...new Set(transactions.map(t => t.category))].sort();
}

// ── Ícono Feather por categoría ──────────────────────────────────────────────

export function getIconoTx(categoryName: string, type: 'income' | 'expense'): string {
  if (type === 'income') return 'arrow-up-circle';
  const iconMap: Record<string, string> = {
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
    'Otros':           'more-horizontal',
    'Restaurantes':    'coffee',
    'Delivery':        'truck',
    'Suscripciones':   'repeat',
    'Viajes':          'globe',
    'Regalos':         'gift',
    'Hogar':           'tool',
    'Deudas':          'credit-card',
    'Belleza':         'scissors',
    'Tecnología':      'monitor',
    'Seguros':         'shield',
    'Ninos':           'users',
    'Freelance':       'code',
    'Inversiones':     'trending-up',
  };
  return iconMap[categoryName] ?? 'tag';
}
