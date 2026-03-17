import { Transaction, Category } from '../types';

// ── Helpers de fecha ───────────────────────────────────────────────────────────

export function getMesLabel(mes: number): string {
  return new Date(2025, mes, 1)
    .toLocaleDateString('es-CO', { month: 'short' })
    .replace('.', '');
}

export function getMesLabelLargo(mes: number, año: number): string {
  return new Date(año, mes, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

export function getDiaLabel(dia: number): string {
  return ['D', 'L', 'M', 'X', 'J', 'V', 'S'][dia] ?? '?';
}

// ── Filtros de transacciones ───────────────────────────────────────────────────

export function txDelMes(
  transactions: Transaction[],
  mes: number,
  año: number,
): Transaction[] {
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === mes && d.getFullYear() === año;
  });
}

export function txDelRango(
  transactions: Transaction[],
  mesesAtras: number,
): Transaction[] {
  const now = new Date();
  const desde = new Date(now.getFullYear(), now.getMonth() - mesesAtras + 1, 1);
  return transactions.filter(t => new Date(t.date) >= desde);
}

// ── Cálculos de totales ────────────────────────────────────────────────────────

export function totalGastos(txs: Transaction[]): number {
  return txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
}

export function totalIngresos(txs: Transaction[]): number {
  return txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
}

export function gastosPorCategoria(txs: Transaction[]): Record<string, number> {
  return txs
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
}

// ── GRÁFICO 1: Barras comparativas mes vs mes ──────────────────────────────────

export interface BarData {
  label: string;
  gastoActual: number;
  gastoAnterior: number;
  mes: number;
  año: number;
}

export function getBarData(transactions: Transaction[], numMeses: number): BarData[] {
  const now = new Date();
  return Array.from({ length: numMeses }, (_, i) => {
    const offset = numMeses - 1 - i;
    const fecha = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const mes = fecha.getMonth();
    const año = fecha.getFullYear();
    const txActual = txDelMes(transactions, mes, año);
    const txAnterior = txDelMes(transactions, mes, año - 1);
    return {
      label: getMesLabel(mes),
      gastoActual: totalGastos(txActual),
      gastoAnterior: totalGastos(txAnterior),
      mes,
      año,
    };
  });
}

// ── GRÁFICO 2: Área acumulada de ahorro ───────────────────────────────────────

export interface AreaPoint {
  label: string;
  ahorro: number;
  mes: number;
  año: number;
}

export function getAreaData(
  transactions: Transaction[],
  numMeses: number,
  monthlySalary: number,
): AreaPoint[] {
  const now = new Date();
  let acumulado = 0;
  return Array.from({ length: numMeses }, (_, i) => {
    const offset = numMeses - 1 - i;
    const fecha = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const mes = fecha.getMonth();
    const año = fecha.getFullYear();
    const txs = txDelMes(transactions, mes, año);
    const ingresos = totalIngresos(txs);
    const gastos = totalGastos(txs);
    const ingresosEfectivos = ingresos > 0 ? ingresos : monthlySalary;
    acumulado += Math.max(0, ingresosEfectivos - gastos);
    return { label: getMesLabel(mes), ahorro: acumulado, mes, año };
  });
}

// ── GRÁFICO 3: Mapa de calor ──────────────────────────────────────────────────

export interface HeatCell {
  semana: number;
  dia: number;
  monto: number;
  count: number;
}

export function getHeatmapData(
  transactions: Transaction[],
  mes: number,
  año: number,
): HeatCell[] {
  const cells: HeatCell[] = [];
  for (let semana = 0; semana < 4; semana++) {
    for (let dia = 0; dia < 7; dia++) {
      cells.push({ semana, dia, monto: 0, count: 0 });
    }
  }
  const primerDia = new Date(año, mes, 1);
  const offsetInicio = primerDia.getDay();
  txDelMes(transactions, mes, año)
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const d = new Date(t.date);
      const diaDelMes = d.getDate() - 1;
      const posicion = diaDelMes + offsetInicio;
      const semana = Math.floor(posicion / 7);
      const dia = posicion % 7;
      if (semana < 4) {
        const cell = cells.find(c => c.semana === semana && c.dia === dia);
        if (cell) {
          cell.monto += t.amount;
          cell.count += 1;
        }
      }
    });
  return cells;
}

export function getHeatIntensity(monto: number, maxMonto: number): number {
  if (maxMonto === 0 || monto === 0) return 0;
  return Math.min(monto / maxMonto, 1);
}

export function getHeatColor(intensity: number, isDark: boolean): string {
  if (intensity === 0) return isDark ? '#252528' : '#F3F4F6';
  if (intensity < 0.2)  return isDark ? '#1E1B4B' : '#EEF2FF';
  if (intensity < 0.4)  return isDark ? '#3730A3' : '#C7D2FE';
  if (intensity < 0.7)  return isDark ? '#4F46E5' : '#818CF8';
  return isDark ? '#818CF8' : '#4F46E5';
}

// ── GRÁFICO 4: Treemap ────────────────────────────────────────────────────────

export interface TreemapNode {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  flex: number;
}

export interface TreemapRow {
  nodes: TreemapNode[];
  height: number;
}

export const CATEGORIA_COLORES: Record<string, string> = {
  'Alimentación':    '#312E81',
  'Transporte':      '#1E3A5F',
  'Vivienda':        '#064E3B',
  'Arriendo':        '#064E3B',
  'Entretenimiento': '#2E1065',
  'Servicios':       '#451A03',
  'Telefonía':       '#451A03',
  'Salud':           '#450A0A',
  'Educación':       '#1E1B4B',
  'Ropa':            '#3B1F6A',
  'Gym / Sport':     '#1A3A1A',
  'Mascotas':        '#1A2E1A',
  'Ahorro':          '#0C2340',
  'Deudas':          '#3D1515',
  'Otros':           '#252528',
};

export function getTreemapData(
  transactions: Transaction[],
  mes: number,
  año: number,
): TreemapRow[] {
  const gastos = gastosPorCategoria(txDelMes(transactions, mes, año));
  const total = Object.values(gastos).reduce((s, v) => s + v, 0);
  if (total === 0) return [];

  const sorted = Object.entries(gastos)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: Math.round((amount / total) * 100),
      color: CATEGORIA_COLORES[name] || '#252528',
      flex: amount / total,
    }));

  if (sorted.length === 0) return [];

  const rows: TreemapRow[] = [];
  if (sorted.length >= 1) rows.push({ nodes: sorted.slice(0, 2), height: 90 });
  if (sorted.length >= 3) rows.push({ nodes: sorted.slice(2, 5), height: 70 });
  if (sorted.length >= 6) rows.push({ nodes: sorted.slice(5),    height: 50 });
  return rows;
}

// ── GRÁFICO 5: Donut ──────────────────────────────────────────────────────────

export interface DonutSegment {
  label: string;
  amount: number;
  percentage: number;
  color: string;
  dashLength: number;  // length of the dash (pct * C)
  staticOffset: number; // cumulative offset for positioning
}

const C = 251.3; // circumference of circle r=40

export function getDonutData(
  transactions: Transaction[],
  mes: number,
  año: number,
  monthlySalary: number,
  primaryColor: string,
  incomeColor: string,
  warningColor: string,
): DonutSegment[] {
  const txs = txDelMes(transactions, mes, año);
  const gastos = totalGastos(txs);
  const ingresos = totalIngresos(txs);
  const base = monthlySalary > 0 ? monthlySalary : (ingresos || 1);

  const pctGastos    = Math.min(gastos / base, 1);
  const pctAhorro    = Math.max(0, Math.min((ingresos - gastos) / base, 1));
  const pctPendiente = Math.max(0, 1 - pctGastos - pctAhorro);

  const segments: DonutSegment[] = [];
  let offset = 0;

  const add = (label: string, amount: number, pct: number, color: string) => {
    const dash = pct * C;
    segments.push({
      label,
      amount,
      percentage: Math.round(pct * 100),
      color,
      dashLength: dash,
      staticOffset: offset,
    });
    offset += dash;
  };

  add('Gastos',    gastos,                              pctGastos,    primaryColor);
  add('Ahorro',    Math.max(0, ingresos - gastos),      pctAhorro,    incomeColor);
  add('Pendiente', base * pctPendiente,                 pctPendiente, warningColor);

  return segments.filter(s => s.percentage > 0);
}

// ── Métricas resumen ───────────────────────────────────────────────────────────

export interface ResumenMetricas {
  totalGastado: number;
  disponible: number;
  pctDelSalario: number;
  cambioPctVsMesAnterior: number;
  promedioGastoDiario: number;
  diaMayorGasto: string;
  categoriaMayorGasto: string;
}

export function getResumenMetricas(
  transactions: Transaction[],
  mes: number,
  año: number,
  monthlySalary: number,
): ResumenMetricas {
  const txs = txDelMes(transactions, mes, año);
  const gastos = totalGastos(txs);
  const ingresos = totalIngresos(txs);
  const base = monthlySalary > 0 ? monthlySalary : (ingresos || 1);

  const mesAnt = mes === 0 ? 11 : mes - 1;
  const añoAnt = mes === 0 ? año - 1 : año;
  const gastosMesAnt = totalGastos(txDelMes(transactions, mesAnt, añoAnt));
  const cambioPct = gastosMesAnt > 0
    ? Math.round(((gastos - gastosMesAnt) / gastosMesAnt) * 100)
    : 0;

  const diasEnMes = new Date(año, mes + 1, 0).getDate();
  const promedioDiario = gastos / (diasEnMes || 1);

  const gastosPorDia: Record<string, number> = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    const key = new Date(t.date).toLocaleDateString('es-CO', { weekday: 'long' });
    gastosPorDia[key] = (gastosPorDia[key] || 0) + t.amount;
  });
  const diaMayor = Object.entries(gastosPorDia).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  const gastosCat = gastosPorCategoria(txs);
  const catMayor = Object.entries(gastosCat).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  return {
    totalGastado: gastos,
    disponible: Math.max(0, (ingresos > 0 ? ingresos : base) - gastos),
    pctDelSalario: Math.round((gastos / base) * 100),
    cambioPctVsMesAnterior: cambioPct,
    promedioGastoDiario: promedioDiario,
    diaMayorGasto: diaMayor,
    categoriaMayorGasto: catMayor,
  };
}

export function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = ((prev.x + curr.x) / 2).toFixed(1);
    d += ` C ${cpx},${prev.y.toFixed(1)} ${cpx},${curr.y.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
  }
  return d;
}
