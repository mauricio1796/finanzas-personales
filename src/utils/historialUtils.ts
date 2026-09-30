import type { Transaction } from '../types';
import { esGastoConsumo, esIngresoGanado, esMovimientoAhorro, montoApartado } from './ingresoUtils';

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** 'ahorro': lo apartado y retirado del ahorro (no es gasto ni ingreso). */
export type FiltroTipo    = 'todos' | 'ingresos' | 'gastos' | 'ahorro';
export type FiltroOrden   = 'reciente' | 'antiguo' | 'mayor' | 'menor';
export type FiltroPeriodo = 'todo' | 'hoy' | 'semana' | 'mes' | 'mes_anterior' | '3meses';

export interface FiltrosActivos {
  tipo:      FiltroTipo;
  orden:     FiltroOrden;
  periodo:   FiltroPeriodo;
  categoria: string | null;
  busqueda:  string;
  /** MedioPago.id; null/ausente = todos los medios. */
  medio?:    string | null;
}

export interface TransaccionAgrupada {
  fechaLabel:    string;
  fechaISO:      string;
  esHoy:         boolean;
  esAyer:        boolean;
  transacciones: Transaction[];
  /** Gasto de consumo (sin lo apartado para ahorro). */
  totalGastos:   number;
  /** Ingresos ganados (sin retiros de ahorro). */
  totalIngresos: number;
  /** Neto movido al ahorro ese día (apartado − retirado). */
  totalApartado: number;
}

export interface EstadisticasHistorial {
  totalTransacciones: number;
  totalGastos:        number;
  totalIngresos:      number;
  /** Neto movido al ahorro en el período (apartado − retirado). No es gasto. */
  totalApartado:      number;
  /**
   * BUG-05 — NETO DE LOS MOVIMIENTOS FILTRADOS, no el "balance disponible".
   *
   * Es deliberadamente distinto del balance del Dashboard: aquí el usuario
   * puede filtrar por "hoy", "esta semana" o "3 meses", periodos para los que
   * un balance mensual (salario base − gastos del mes) no significa nada. Lo
   * que esta cifra resume es exactamente la suma de lo que se ve en la lista.
   *
   * El bug original no era la fórmula sino la ETIQUETA: se mostraba como
   * "Balance", así que contradecía al Dashboard a ojos del usuario. La pantalla
   * ahora lo rotula "Neto". Para el balance disponible real, la única fuente de
   * verdad es `calcularMetricasFinancieras` en ingresoUtils.ts.
   */
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

  if (filtros.tipo === 'ingresos') result = result.filter(esIngresoGanado);
  if (filtros.tipo === 'gastos')   result = result.filter(esGastoConsumo);
  if (filtros.tipo === 'ahorro')   result = result.filter(esMovimientoAhorro);

  if (filtros.categoria) {
    result = result.filter(t => t.category === filtros.categoria);
  }

  if (filtros.medio) {
    result = result.filter(t => t.paymentMethodId === filtros.medio);
  }

  if (filtros.busqueda.trim()) {
    const q = filtros.busqueda.toLowerCase();
    result = result.filter(t =>
      t.category.toLowerCase().includes(q) ||
      (t.description?.toLowerCase() ?? '').includes(q) ||
      (t.merchant?.toLowerCase() ?? '').includes(q) ||
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
      totalGastos:   txs.filter(esGastoConsumo).reduce((s, t) => s + t.amount, 0),
      totalIngresos: txs.filter(esIngresoGanado).reduce((s, t) => s + t.amount, 0),
      totalApartado: txs.reduce((s, t) => s + montoApartado(t), 0),
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
      totalApartado:      0,
      balance:            0,
      promedioGasto:      0,
      categoriaMasGasto:  '—',
      diaMaxGasto:        '—',
    };
  }

  // Apartar o retirar ahorro no es gasto ni ingreso: el neto es ingreso − consumo
  // (lo que se ahorró en el período), igual que en el motor.
  const gastos   = transactions.filter(esGastoConsumo);
  const ingresos = transactions.filter(esIngresoGanado);

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
    totalApartado:      transactions.reduce((s, t) => s + montoApartado(t), 0),
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
