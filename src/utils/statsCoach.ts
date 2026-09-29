/**
 * Finn en Estadísticas — lectura en vivo de lo que muestra la pantalla.
 *
 * Toma los mismos datos que dibujan las gráficas (dona, barras, ahorro, mapa de
 * calor, treemap) y produce:
 *   1. Un "pulso financiero" 0–100 calculado localmente (sin IA, instantáneo).
 *   2. Señales priorizadas en lenguaje natural (déficit, proyección, presupuestos…).
 *   3. Un bloque de contexto que describe la pantalla para que Finn (IA) pueda
 *      explicar "esta gráfica" con los mismos números que ve el usuario.
 *
 * Módulo puro (sin React Native): cubierto por tests/statsCoach.test.ts.
 */

// Solo imports de tipos: el módulo se prueba con `node --test` sin bundler.
import type { Transaction, Category } from '../types';
import type { MetricasFinancieras } from './ingresoUtils';
import type { BarData, AreaPoint } from './statsUtils';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type StatsTab = 'resumen' | 'tendencia' | 'calor' | 'distribucion';

export type StatsChartId = 'donut' | 'barras' | 'ahorro' | 'calor' | 'mapa';

export const TAB_LABELS: Record<StatsTab, string> = {
  resumen:      'Resumen',
  tendencia:    'Tendencia',
  calor:        'Mapa de calor',
  distribucion: 'Mapa de gastos',
};

export const CHART_LABELS: Record<StatsChartId, string> = {
  donut:  'Gastos por categoría (dona)',
  barras: 'Gastos mensuales (barras)',
  ahorro: 'Ahorro acumulado (área)',
  calor:  'Intensidad de gasto (mapa de calor)',
  mapa:   'Distribución de gastos (treemap)',
};

export type EstadoPulso = 'saludable' | 'estable' | 'riesgo' | 'critico' | 'sin_datos';

export interface PulsoFinanciero {
  /** null cuando el mes no tiene movimientos. */
  score:    number | null;
  estado:   EstadoPulso;
  etiqueta: string;
  resumen:  string;
  componentes: { ahorro: number; presupuestos: number; tendencia: number; registro: number };
}

export type TipoSenal = 'alerta' | 'atencion' | 'positivo' | 'info';

export interface SenalFinn {
  tipo:      TipoSenal;
  texto:     string;
  prioridad: number;
}

export interface CategoriaAnalizada {
  nombre:      string;
  gastado:     number;
  /** % del gasto total del mes. */
  pctDelTotal: number;
  presupuesto: number;
  /** % del presupuesto usado; null si la categoría no tiene presupuesto. */
  pctPresupuesto: number | null;
}

export interface EntradaStats {
  transactions: Transaction[];
  categories:   Category[];
  metricas:     MetricasFinancieras;
  mes:          number;
  año:          number;
  barData:      BarData[];
  areaData:     AreaPoint[];
  metaAhorro?:  number;
  hoy?:         Date;
}

export interface ProyeccionMes {
  /** Gasto total estimado al cierre. */
  total:        number;
  /** Ya gastado a hoy. */
  gastadoHoy:   number;
  /** Fijos ya pagados + compromisos pendientes (no se extrapolan). */
  fijos:        number;
  /** Gasto variable estimado para el mes completo. */
  variable:     number;
  /** Ingreso del mes contra el que se compara. */
  ingreso:      number;
  /** Margen estimado al cierre (ingreso − total); negativo = déficit. */
  margen:       number;
  /** Cuánto pesa el historial en la estimación (0 = solo el ritmo de este mes). */
  pesoHistorial: number;
  confianza:    'baja' | 'media' | 'alta';
}

export interface AnalisisStats {
  pulso:           PulsoFinanciero;
  senales:         SenalFinn[];
  categorias:      CategoriaAnalizada[];
  totalGastosMes:  number;
  totalIngresosMes: number;
  txnCount:        number;
  esMesActual:     boolean;
  diasMes:         number;
  /** Días del mes ya vividos (todo el mes si es un mes pasado). */
  diasTranscurridos: number;
  diasSinGasto:    number;
  /** Gasto estimado al cierre del mes; solo para el mes en curso con datos suficientes. */
  proyeccionGasto: number | null;
  proyeccion:      ProyeccionMes | null;
  /** % de variación vs el mes anterior, comparando a la misma altura del mes. */
  cambioVsMesAnterior: number | null;
  /** Gasto por día de la semana (0 = domingo). */
  porDiaSemana:    { dia: number; monto: number; count: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
const pct = (n: number) => `${Math.round(n)}%`;

const DIAS_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

// Mismas definiciones que statsUtils (duplicadas para mantener el módulo sin dependencias).
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const getMesLabel = (mes: number) => MESES_CORTOS[mes] ?? '';
const getMesLabelLargo = (mes: number, año: number) => `${MESES_LARGOS[mes] ?? ''} de ${año}`;

function txDelMes(transactions: Transaction[], mes: number, año: number): Transaction[] {
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === mes && d.getFullYear() === año;
  });
}

// Mismo criterio que esMovimientoAhorro (ingresoUtils): lo apartado en "Ahorro"
// no es gasto ni ingreso.
const esAhorro = (t: Transaction) =>
  (t.category ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().startsWith('ahorro');
const esGasto   = (t: Transaction) => t.type === 'expense' && !esAhorro(t);
const esIngreso = (t: Transaction) => t.type === 'income' && !esAhorro(t);

const totalGastos = (txs: Transaction[]) =>
  txs.filter(esGasto).reduce((s, t) => s + t.amount, 0);

function gastosPorCategoria(txs: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  txs.filter(esGasto).forEach(t => { out[t.category] = (out[t.category] ?? 0) + t.amount; });
  return out;
}

function gastosHastaDia(transactions: Transaction[], mes: number, año: number, dia: number): number {
  return totalGastos(txDelMes(transactions, mes, año).filter(t => new Date(t.date).getDate() <= dia));
}

// ── Análisis ──────────────────────────────────────────────────────────────────

export function analizarEstadisticas(e: EntradaStats): AnalisisStats {
  const hoy = e.hoy ?? new Date();
  const { mes, año, metricas } = e;
  const txs = txDelMes(e.transactions, mes, año);
  const gastos = txs.filter(esGasto);
  const totalGastosMes = totalGastos(txs);
  const totalIngresosMes = txs.filter(esIngreso).reduce((s, t) => s + t.amount, 0);

  const diasMes = new Date(año, mes + 1, 0).getDate();
  const esMesActual = hoy.getMonth() === mes && hoy.getFullYear() === año;
  const diasTranscurridos = esMesActual ? hoy.getDate() : diasMes;

  // Días sin gasto
  const diasConGasto = new Set(gastos.map(t => new Date(t.date).getDate()));
  const diasSinGasto = Math.max(0, diasTranscurridos - [...diasConGasto].filter(d => d <= diasTranscurridos).length);

  // Por día de la semana
  const porDiaSemana = Array.from({ length: 7 }, (_, dia) => ({ dia, monto: 0, count: 0 }));
  gastos.forEach(t => {
    const d = porDiaSemana[new Date(t.date).getDay()];
    d.monto += t.amount;
    d.count += 1;
  });

  // Categorías: gasto real vs presupuesto
  const porCat = gastosPorCategoria(txs);
  const presupuestos = new Map<string, number>();
  e.categories
    .filter(c => !c.parentCategoryId && (c.budget ?? 0) > 0)
    .forEach(c => presupuestos.set(c.name, c.budget ?? 0));
  const nombres = new Set([...Object.keys(porCat), ...presupuestos.keys()]);
  const categorias: CategoriaAnalizada[] = [...nombres]
    .map(nombre => {
      const gastado = porCat[nombre] ?? 0;
      const presupuesto = presupuestos.get(nombre) ?? 0;
      return {
        nombre,
        gastado,
        pctDelTotal: totalGastosMes > 0 ? (gastado / totalGastosMes) * 100 : 0,
        presupuesto,
        pctPresupuesto: presupuesto > 0 ? (gastado / presupuesto) * 100 : null,
      };
    })
    .sort((a, b) => b.gastado - a.gastado);

  const proyeccion = esMesActual
    ? proyectarCierre(e, gastos, totalGastosMes, diasTranscurridos, diasMes)
    : null;
  const proyeccionGasto = proyeccion?.total ?? null;

  // Tendencia: a la misma altura del mes (un mes a medias contra uno completo
  // siempre parecería una mejora).
  const mesAnt = mes === 0 ? 11 : mes - 1;
  const añoAnt = mes === 0 ? año - 1 : año;
  const diasMesAnt = new Date(añoAnt, mesAnt + 1, 0).getDate();
  const gastoAntComparable = gastosHastaDia(e.transactions, mesAnt, añoAnt, Math.min(diasTranscurridos, diasMesAnt));
  const gastoActualComparable = esMesActual
    ? gastosHastaDia(e.transactions, mes, año, diasTranscurridos)
    : totalGastosMes;
  const cambioVsMesAnterior = gastoAntComparable > 0
    ? Math.round(((gastoActualComparable - gastoAntComparable) / gastoAntComparable) * 100)
    : null;

  const base = {
    categorias, totalGastosMes, totalIngresosMes, txnCount: txs.length, esMesActual,
    diasMes, diasTranscurridos, diasSinGasto, proyeccionGasto, proyeccion, cambioVsMesAnterior, porDiaSemana,
  };
  const pulso = calcularPulso(e, base);
  const senales = detectarSenales(e, base);
  return { ...base, pulso, senales };
}

type BaseAnalisis = Omit<AnalisisStats, 'pulso' | 'senales'>;

/** Categorías cuyo gasto es un pago fijo del mes (arriendo, servicios con día de pago…). */
function categoriasFijas(categories: Category[]): Set<string> {
  return new Set(categories.filter(c => c.diaPago != null || c.tipo === 'fijo').map(c => c.name));
}

/**
 * Proyección al cierre del mes en curso.
 *
 * - Los fijos (categorías con día de pago o tipo "fijo") no se extrapolan: el
 *   arriendo del día 1 no se repite cada día. Se suman tal cual, junto con los
 *   compromisos que siguen pendientes.
 * - El gasto variable mezcla el ritmo de este mes con el promedio variable de
 *   los últimos 3 meses. Al inicio del mes pesa más el historial (4 días no
 *   dicen mucho); hacia el final, manda lo que realmente pasó.
 */
function proyectarCierre(
  e: EntradaStats, gastos: Transaction[], totalGastosMes: number, diasTranscurridos: number, diasMes: number,
): ProyeccionMes | null {
  const fijas = categoriasFijas(e.categories);
  const fijoPagado = gastos.filter(t => fijas.has(t.category)).reduce((s, t) => s + t.amount, 0);
  const variableHoy = totalGastosMes - fijoPagado;

  // Promedio variable de meses anteriores con movimientos
  const historico: number[] = [];
  for (let k = 1; k <= 3; k++) {
    const d = new Date(e.año, e.mes - k, 1);
    const txs = txDelMes(e.transactions, d.getMonth(), d.getFullYear()).filter(esGasto);
    if (txs.length === 0) continue;
    historico.push(txs.filter(t => !fijas.has(t.category)).reduce((s, t) => s + t.amount, 0));
  }
  const promedioHist = historico.length ? historico.reduce((s, v) => s + v, 0) / historico.length : null;

  if (promedioHist === null && (diasTranscurridos < 3 || gastos.length === 0)) return null;

  const avance = diasTranscurridos / diasMes;
  const ritmo = (variableHoy / diasTranscurridos) * diasMes;
  // Con historial: su peso cae de 1 a 0 a medida que avanza el mes.
  const pesoHistorial = promedioHist === null ? 0 : Math.max(0, 1 - avance);
  const variableEstimado = promedioHist === null
    ? ritmo
    : pesoHistorial * promedioHist + (1 - pesoHistorial) * ritmo;
  // Nunca menos de lo ya gastado.
  const variable = Math.max(variableHoy, variableEstimado);
  const pendiente = e.metricas.totalPendiente ?? 0;
  const fijos = fijoPagado + pendiente;
  const total = Math.max(totalGastosMes, fijos + variable);
  const ingreso = e.metricas.ingresoEfectivo;

  const confianza: ProyeccionMes['confianza'] =
    avance >= 0.6 || (historico.length >= 2 && avance >= 0.25) ? 'alta'
      : avance >= 0.3 || historico.length >= 1 ? 'media'
        : 'baja';

  return {
    total, gastadoHoy: totalGastosMes, fijos, variable, ingreso,
    margen: ingreso - total, pesoHistorial, confianza,
  };
}

function calcularPulso(e: EntradaStats, a: BaseAnalisis): PulsoFinanciero {
  const mesLbl = getMesLabel(e.mes);
  if (a.txnCount === 0) {
    return {
      score: null, estado: 'sin_datos', etiqueta: 'Sin datos',
      resumen: `Aún no hay movimientos en ${mesLbl}. Registra tus gastos y te cuento cómo vas.`,
      componentes: { ahorro: 0, presupuestos: 0, tendencia: 0, registro: 0 },
    };
  }

  const ingreso = e.metricas.ingresoEfectivo;
  const gastoRef = a.proyeccionGasto ?? a.totalGastosMes;

  // Ahorro (0–40)
  let ahorro = 15;
  if (ingreso > 0) {
    const tasa = (ingreso - gastoRef) / ingreso;
    ahorro = tasa >= 0.2 ? 40 : tasa >= 0.1 ? 30 : tasa >= 0 ? 18 : tasa >= -0.1 ? 6 : 0;
  }

  // Presupuestos (0–25)
  const conPresupuesto = a.categorias.filter(c => c.pctPresupuesto !== null);
  let presupuestos = 15;
  if (conPresupuesto.length > 0) {
    const excedidas = conPresupuesto.filter(c => (c.pctPresupuesto ?? 0) > 100).length;
    const cerca = conPresupuesto.filter(c => (c.pctPresupuesto ?? 0) >= 90 && (c.pctPresupuesto ?? 0) <= 100).length;
    presupuestos = Math.round(25 * Math.max(0, 1 - (excedidas + cerca * 0.5) / conPresupuesto.length));
  }

  // Tendencia (0–20)
  const c = a.cambioVsMesAnterior;
  const tendencia = c === null ? 14 : c <= 0 ? 20 : c <= 10 ? 14 : c <= 25 ? 8 : 2;

  // Hábito de registro (0–15)
  const registro = a.txnCount >= 10 ? 15 : a.txnCount >= 4 ? 10 : 5;

  let score = ahorro + presupuestos + tendencia + registro;
  if (e.metricas.enDeficit) score = Math.min(score, 30);

  const estado: EstadoPulso =
    score >= 75 ? 'saludable' : score >= 55 ? 'estable' : score >= 35 ? 'riesgo' : 'critico';
  const etiqueta = { saludable: 'Saludable', estable: 'Estable', riesgo: 'En riesgo', critico: 'Crítico', sin_datos: 'Sin datos' }[estado];

  const resumen = {
    saludable: `Tus finanzas de ${mesLbl} se ven sanas: gastas por debajo de lo que entra.`,
    estable:   `${capitalize(mesLbl)} va estable, pero hay puntos que vale la pena vigilar.`,
    riesgo:    `${capitalize(mesLbl)} viene apretado: tu margen se está reduciendo.`,
    critico:   `${capitalize(mesLbl)} está en rojo: tus gastos van por encima de tus ingresos.`,
    sin_datos: '',
  }[estado];

  return { score, estado, etiqueta, resumen, componentes: { ahorro, presupuestos, tendencia, registro } };
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function detectarSenales(e: EntradaStats, a: BaseAnalisis): SenalFinn[] {
  const out: SenalFinn[] = [];
  const m = e.metricas;
  const ingreso = m.ingresoEfectivo;
  const mesLbl = getMesLabel(e.mes);
  const mesAntLbl = getMesLabel(e.mes === 0 ? 11 : e.mes - 1);

  if (a.txnCount === 0) return out;

  if (m.enDeficit) {
    out.push({ tipo: 'alerta', prioridad: 100, texto: `Tus gastos ya superan tu ingreso del mes por ${fmt(m.montoDeficit)}.` });
  } else if (a.proyeccionGasto !== null && ingreso > 0 && a.proyeccionGasto > ingreso) {
    out.push({
      tipo: 'alerta', prioridad: 90,
      texto: `A este ritmo cerrarías ${mesLbl} gastando ${fmt(a.proyeccionGasto)}, ${fmt(a.proyeccionGasto - ingreso)} más de lo que entra.`,
    });
  }

  const excedidas = a.categorias
    .filter(c => (c.pctPresupuesto ?? 0) > 100)
    .sort((x, y) => (y.gastado - y.presupuesto) - (x.gastado - x.presupuesto));
  if (excedidas.length > 0) {
    const top = excedidas[0];
    const extra = excedidas.length > 1 ? ` (y ${excedidas.length - 1} más)` : '';
    out.push({
      tipo: 'atencion', prioridad: 80,
      texto: `Te pasaste del presupuesto de ${top.nombre} por ${fmt(top.gastado - top.presupuesto)}${extra}.`,
    });
  }

  if (a.cambioVsMesAnterior !== null) {
    const ref = a.esMesActual ? `${mesAntLbl} a esta altura` : mesAntLbl;
    if (a.cambioVsMesAnterior >= 15) {
      out.push({ tipo: 'atencion', prioridad: 70, texto: `Llevas un ${a.cambioVsMesAnterior}% más de gasto que en ${ref}.` });
    } else if (a.cambioVsMesAnterior <= -10) {
      out.push({ tipo: 'positivo', prioridad: 55, texto: `Vas un ${Math.abs(a.cambioVsMesAnterior)}% por debajo de ${ref}. ¡Bien!` });
    }
  }

  const top = a.categorias[0];
  if (top && top.gastado > 0 && top.pctDelTotal >= 40 && a.categorias.filter(c => c.gastado > 0).length > 1) {
    out.push({ tipo: 'info', prioridad: 60, texto: `${top.nombre} se lleva el ${pct(top.pctDelTotal)} de tus gastos del mes.` });
  }

  const gastosCount = a.porDiaSemana.reduce((s, d) => s + d.count, 0);
  if (gastosCount >= 5 && a.totalGastosMes > 0) {
    const pico = [...a.porDiaSemana].sort((x, y) => y.monto - x.monto)[0];
    const share = (pico.monto / a.totalGastosMes) * 100;
    if (share >= 30) {
      out.push({ tipo: 'info', prioridad: 45, texto: `Los ${DIAS_PLURAL[pico.dia]} concentran el ${pct(share)} de lo que gastas.` });
    }
  }

  if (ingreso > 0 && !m.enDeficit) {
    const gastoRef = a.proyeccionGasto ?? a.totalGastosMes;
    const tasa = ((ingreso - gastoRef) / ingreso) * 100;
    if (tasa >= 20) {
      out.push({
        tipo: 'positivo', prioridad: 50,
        texto: a.esMesActual
          ? `Vas camino a ahorrar cerca del ${pct(tasa)} de tu ingreso este mes.`
          : `Ahorraste cerca del ${pct(tasa)} de tu ingreso en ${mesLbl}.`,
      });
    }
  }

  if (a.diasTranscurridos >= 7 && a.diasSinGasto / a.diasTranscurridos >= 0.4) {
    out.push({ tipo: 'positivo', prioridad: 30, texto: `${a.diasSinGasto} de ${a.diasTranscurridos} días sin ningún gasto.` });
  }

  return out.sort((x, y) => y.prioridad - x.prioridad);
}

// ── Contexto para la IA ───────────────────────────────────────────────────────

export interface VistaStats {
  tab:     StatsTab;
  chart?:  StatsChartId | null;
}

/**
 * Describe lo que el usuario está viendo en Estadísticas. Se añade al contexto
 * financiero general de Finn (ver RealAIService.contextoPantalla).
 */
export function buildContextoEstadisticas(a: AnalisisStats, e: EntradaStats, vista: VistaStats): string {
  const m = e.metricas;
  const mesLargo = getMesLabelLargo(e.mes, e.año);
  const lineas: string[] = [];

  lineas.push('PANTALLA ACTUAL — ESTADÍSTICAS (el usuario está viendo estas gráficas en vivo):');
  lineas.push(`- Pestaña abierta: ${TAB_LABELS[vista.tab]}. Mes seleccionado: ${mesLargo}${a.esMesActual ? ` (mes en curso, día ${a.diasTranscurridos} de ${a.diasMes})` : ' (mes cerrado)'}.`);
  if (vista.chart) lineas.push(`- Gráfica en foco: ${CHART_LABELS[vista.chart]}. Si dice "esta gráfica", se refiere a esta.`);

  const p = a.pulso;
  lineas.push(`- Pulso financiero calculado por la app: ${p.score === null ? 'sin datos' : `${p.score}/100 (${p.etiqueta})`}.`);

  lineas.push('');
  lineas.push('RESUMEN DEL MES:');
  lineas.push(`- Ingreso efectivo ${fmt(m.ingresoEfectivo)}${m.esIngresoReal ? '' : ' (salario del perfil)'} · Gastado ${fmt(m.totalGastado)} (${m.porcentajeGastado}%) · Balance ${fmt(m.balanceDisponible)} · Pendiente por pagar ${fmt(m.totalPendiente)}.`);
  lineas.push(`- ${a.txnCount} movimientos · presupuesto diario recomendado ${fmt(m.gastoPromedioRecomendadoDia)} · ${a.diasSinGasto} días sin gasto.`);
  if (a.proyeccion) {
    const p = a.proyeccion;
    lineas.push(`- Proyección al cierre (confianza ${p.confianza}): ${fmt(p.total)} = fijos y pendientes ${fmt(p.fijos)} + variable estimado ${fmt(p.variable)}. Margen estimado: ${fmt(p.margen)}.`);
  }
  if (a.cambioVsMesAnterior !== null) lineas.push(`- Variación vs mes anterior (a la misma altura del mes): ${a.cambioVsMesAnterior > 0 ? '+' : ''}${a.cambioVsMesAnterior}%.`);

  const conGasto = a.categorias.filter(c => c.gastado > 0);
  lineas.push('');
  lineas.push('DONA / TREEMAP — GASTO POR CATEGORÍA:');
  if (conGasto.length === 0) lineas.push('- Sin gastos este mes.');
  conGasto.slice(0, 8).forEach(c => {
    const presu = c.pctPresupuesto !== null
      ? ` · presupuesto ${fmt(c.presupuesto)} (${pct(c.pctPresupuesto)} usado${c.pctPresupuesto > 100 ? ', EXCEDIDO' : ''})`
      : '';
    lineas.push(`- ${c.nombre}: ${fmt(c.gastado)} (${pct(c.pctDelTotal)} del total)${presu}`);
  });
  if (conGasto.length > 8) lineas.push(`- …y ${conGasto.length - 8} categorías menores.`);

  lineas.push('');
  lineas.push(`BARRAS — GASTO DE LOS ÚLTIMOS ${e.barData.length} MESES (actual vs mismo mes del año anterior):`);
  lineas.push('- ' + e.barData.map(b => `${b.label} ${fmt(b.gastoActual)}${b.gastoAnterior > 0 ? ` (año ant. ${fmt(b.gastoAnterior)})` : ''}`).join(' · '));

  const ultimo = e.areaData[e.areaData.length - 1]?.ahorro ?? 0;
  lineas.push('');
  lineas.push('ÁREA — AHORRO ACUMULADO (desde el primer mes con registros, máx. 6 meses):');
  if (e.areaData.length === 0) {
    lineas.push('- Sin registros todavía: no hay ahorro que mostrar.');
  } else {
    lineas.push(`- ${e.areaData.map(d =>
      `${d.label} ${fmt(d.ahorro)}${d.sinDatos ? ' (sin registros ese mes)' : d.enCurso ? ' (mes en curso)' : ''}`,
    ).join(' · ')}`);
  }
  if ((e.metaAhorro ?? 0) > 0) {
    lineas.push(`- Meta de ahorro ${fmt(e.metaAhorro!)}: progreso ${pct(Math.min(100, (ultimo / e.metaAhorro!) * 100))}.`);
  }

  lineas.push('');
  lineas.push('MAPA DE CALOR — GASTO POR DÍA DE LA SEMANA:');
  const semana = a.porDiaSemana
    .filter(d => d.count > 0)
    .sort((x, y) => y.monto - x.monto)
    .map(d => `${DIAS_PLURAL[d.dia]} ${fmt(d.monto)} (${d.count} mov.)`)
    .join(' · ');
  lineas.push(`- ${semana || 'Sin gastos.'}`);

  if (a.senales.length > 0) {
    lineas.push('');
    lineas.push('SEÑALES QUE LA APP YA LE MUESTRA AL USUARIO:');
    a.senales.slice(0, 5).forEach(s => lineas.push(`- ${s.texto}`));
  }

  lineas.push('');
  lineas.push('CÓMO RESPONDER EN ESTA PANTALLA:');
  lineas.push('- Actúa como guía que interpreta las gráficas: qué significan, qué destaca y UNA acción concreta.');
  lineas.push('- Usa solo estos números; no los repitas todos, elige los 2 o 3 que importan.');
  lineas.push('- Si preguntan cómo leer una gráfica, explica brevemente qué representa cada eje/color antes de interpretarla.');

  return lineas.join('\n');
}

// ── Preguntas sugeridas ───────────────────────────────────────────────────────

const PREGUNTAS_TAB: Record<StatsTab, string[]> = {
  resumen:      ['¿Cómo está mi salud financiera este mes?', '¿En qué se me está yendo la plata?', '¿Cuánto puedo gastar por día?'],
  tendencia:    ['¿Mis gastos van subiendo o bajando?', '¿Voy bien con mi ahorro?', '¿Qué mes fue el peor y por qué?'],
  calor:        ['¿Qué días gasto más?', '¿Tengo gastos hormiga?', '¿Cómo leo este mapa de calor?'],
  distribucion: ['¿Qué categoría debería recortar?', '¿Mi distribución de gastos es sana?', '¿Cómo leo este mapa?'],
};

const PREGUNTA_CHART: Record<StatsChartId, string> = {
  donut:  'Explícame la gráfica de gastos por categoría',
  barras: 'Explícame la gráfica de gastos mensuales',
  ahorro: 'Explícame la gráfica de ahorro acumulado',
  calor:  'Explícame el mapa de calor de mis gastos',
  mapa:   'Explícame el mapa de distribución de mis gastos',
};

export function preguntaDeGrafica(chart: StatsChartId): string {
  return PREGUNTA_CHART[chart];
}

export function preguntasSugeridas(tab: StatsTab): string[] {
  return PREGUNTAS_TAB[tab];
}

// ── Respuesta local (sin IA) ──────────────────────────────────────────────────

/**
 * Lectura que Finn puede dar sin conexión o sin autorización de IA: el pulso y
 * las señales más importantes. Nunca inventa nada que no esté en el análisis.
 */
export function respuestaLocalStats(a: AnalisisStats): string {
  if (a.pulso.estado === 'sin_datos') return a.pulso.resumen;
  const partes = [`Tu pulso financiero está en ${a.pulso.score}/100 (${a.pulso.etiqueta.toLowerCase()}). ${a.pulso.resumen}`];
  const top = a.senales.slice(0, 2).map(s => s.texto);
  if (top.length > 0) partes.push(`Lo más importante: ${top.join(' ')}`);
  return partes.join('\n\n');
}
