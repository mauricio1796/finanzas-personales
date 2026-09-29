import type { Transaction } from '../types';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type TipoIngreso = 'fijo' | 'variable' | 'extra' | 'inversion';

export interface IngresoConfig {
  tipo: TipoIngreso;
  label: string;
  icono: string;
  descripcion: string;
}

export const TIPOS_INGRESO: IngresoConfig[] = [
  { tipo: 'fijo',      label: 'Salario',   icono: 'briefcase',   descripcion: 'Ingreso fijo mensual' },
  { tipo: 'variable',  label: 'Freelance', icono: 'code',        descripcion: 'Proyecto o servicio puntual' },
  { tipo: 'extra',     label: 'Extra',     icono: 'plus-circle', descripcion: 'Bonos, comisiones, ventas' },
  { tipo: 'inversion', label: 'Inversión', icono: 'trending-up', descripcion: 'Rendimientos, dividendos' },
];

// ── Movimientos de ahorro ──────────────────────────────────────────────────────

/** "Ahorro", "Ahorros", "Ahorro emergencia"… (sin tildes ni mayúsculas). */
export function esCategoriaAhorro(nombre: string | undefined | null): boolean {
  if (!nombre) return false;
  const n = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  return n.startsWith('ahorro');
}

/**
 * Apartar plata para ahorrar no es consumo ni ingreso: es ahorro. Antes un
 * movimiento en "Ahorro" como gasto BAJABA el ahorro del mes, y como ingreso
 * (el catálogo la lista entre los ingresos) inflaba el ingreso.
 *
 * Se cuenta como apartado sea cual sea su `type`: el usuario que registra
 * "Ahorro $200.000" quiso decir que guardó, lo elija en gastos o en ingresos.
 */
export function esMovimientoAhorro(t: Pick<Transaction, 'category'>): boolean {
  return esCategoriaAhorro(t.category);
}

/** Gasto de consumo: todo `expense` salvo lo apartado para ahorro. */
export const esGastoConsumo = (t: Transaction) => t.type === 'expense' && !esMovimientoAhorro(t);
/** Ingreso real: todo `income` salvo lo apartado para ahorro. */
export const esIngresoGanado = (t: Transaction) => t.type === 'income' && !esMovimientoAhorro(t);

// ── Ingreso efectivo del mes ───────────────────────────────────────────────────

/**
 * Ingreso efectivo = salario base + ingresos extra registrados ese mes.
 * El salario siempre se suma; los ingresos extra son adicionales.
 */
export function getIngresoEfectivoMes(
  transactions: Transaction[],
  monthlySalary: number,
  mes: number,
  año: number,
): number {
  const extraIncome = transactions
    .filter(t => {
      const d = new Date(t.date);
      return esIngresoGanado(t) && d.getMonth() === mes && d.getFullYear() === año;
    })
    .reduce((s, t) => s + t.amount, 0);

  // Balance = salary set during onboarding + any registered income transactions
  return monthlySalary + extraIncome;
}

/**
 * Solo los ingresos extra del mes (sin incluir el salario base).
 */
export function getIngresosExtraMes(
  transactions: Transaction[],
  mes: number,
  año: number,
): number {
  return transactions
    .filter(t => {
      const d = new Date(t.date);
      return esIngresoGanado(t) && d.getMonth() === mes && d.getFullYear() === año;
    })
    .reduce((s, t) => s + t.amount, 0);
}

/**
 * true si hay al menos una transacción income en el mes dado.
 */
export function esIngresoReal(
  transactions: Transaction[],
  mes: number,
  año: number,
): boolean {
  return transactions.some(t => {
    const d = new Date(t.date);
    return esIngresoGanado(t) && d.getMonth() === mes && d.getFullYear() === año;
  });
}

/**
 * Transacciones income del mes, ordenadas más reciente primero.
 */
export function getDesgloseMes(
  transactions: Transaction[],
  mes: number,
  año: number,
): Transaction[] {
  return transactions
    .filter(t => {
      const d = new Date(t.date);
      return esIngresoGanado(t) && d.getMonth() === mes && d.getFullYear() === año;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ── Ahorro real por mes ────────────────────────────────────────────────────────

export interface AhorroMes {
  /** true si el usuario registró al menos un movimiento ese mes. */
  tieneDatos: boolean;
  /** Salario base + ingresos registrados (misma convención que el motor). */
  ingreso: number;
  /** Gasto de consumo (sin lo apartado para ahorro). */
  gastado: number;
  /** Lo registrado en la categoría Ahorro. Ya está incluido en `ahorro`. */
  apartado: number;
  /** ingreso − gastado, con signo: un mes en rojo resta. */
  ahorro: number;
}

/**
 * Ahorro de un mes calculado solo con lo que pasó: movimientos registrados.
 * No descuenta compromisos pendientes (eso es una proyección del mes en curso
 * y depende del estado actual de las categorías, no del mes consultado).
 *
 * Un mes sin movimientos NO es un mes de ahorro completo: es un mes sin datos.
 */
export function getAhorroRealMes(
  transactions: Transaction[],
  monthlySalary: number,
  mes: number,
  año: number,
): AhorroMes {
  let ingresos = 0;
  let gastado = 0;
  let apartado = 0;
  let tieneDatos = false;
  for (const t of transactions) {
    const d = new Date(t.date);
    if (d.getMonth() !== mes || d.getFullYear() !== año) continue;
    tieneDatos = true;
    if (esMovimientoAhorro(t)) apartado += t.amount;
    else if (t.type === 'income') ingresos += t.amount;
    else if (t.type === 'expense') gastado += t.amount;
  }
  if (!tieneDatos) return { tieneDatos: false, ingreso: 0, gastado: 0, apartado: 0, ahorro: 0 };
  const ingreso = monthlySalary + ingresos;
  return { tieneDatos, ingreso, gastado, apartado, ahorro: ingreso - gastado };
}

export interface ComparacionAhorro {
  actual: AhorroMes;
  anterior: AhorroMes;
  mesAnterior: number;
  añoAnterior: number;
  /** % de cambio del gasto vs el mes anterior. null si el anterior no tiene datos. */
  cambioGastoPct: number | null;
}

/**
 * Compara un mes con el anterior usando solo lo registrado en cada uno.
 * Antes se reutilizaba `calcularMetricasFinancieras` para el mes pasado, que
 * le aplicaba los compromisos pendientes de HOY y, sin registros, suponía el
 * salario completo como ahorro.
 */
export function compararAhorroMeses(
  transactions: Transaction[],
  monthlySalary: number,
  mes: number,
  año: number,
): ComparacionAhorro {
  const mesAnterior = mes === 0 ? 11 : mes - 1;
  const añoAnterior = mes === 0 ? año - 1 : año;
  const actual   = getAhorroRealMes(transactions, monthlySalary, mes, año);
  const anterior = getAhorroRealMes(transactions, monthlySalary, mesAnterior, añoAnterior);
  const cambioGastoPct = anterior.tieneDatos && anterior.gastado > 0
    ? Math.round(((actual.gastado - anterior.gastado) / anterior.gastado) * 100)
    : null;
  return { actual, anterior, mesAnterior, añoAnterior, cambioGastoPct };
}

export interface PuntoAhorro {
  mes: number;
  año: number;
  /** Ahorro de ese mes (con signo). 0 si no hay datos. */
  ahorroMes: number;
  /** Suma de `ahorroMes` desde el primer mes con registros. */
  acumulado: number;
  sinDatos: boolean;
  /** Mes actual: la cifra todavía puede cambiar. */
  enCurso: boolean;
}

/**
 * Serie de ahorro acumulado de los últimos `numMeses`, empezando en el primer
 * mes con registros (un usuario nuevo no "ahorró" los meses antes de llegar).
 * Los meses intermedios sin registros no suman; los meses en rojo restan.
 */
export function getSerieAhorro(
  transactions: Transaction[],
  monthlySalary: number,
  numMeses: number,
  hoy: Date = new Date(),
): PuntoAhorro[] {
  const meses = Array.from({ length: numMeses }, (_, i) => {
    const f = new Date(hoy.getFullYear(), hoy.getMonth() - (numMeses - 1 - i), 1);
    return { mes: f.getMonth(), año: f.getFullYear() };
  });
  const datos = meses.map(m => getAhorroRealMes(transactions, monthlySalary, m.mes, m.año));
  const inicio = datos.findIndex(d => d.tieneDatos);
  if (inicio === -1) return [];

  let acumulado = 0;
  return meses.slice(inicio).map((m, i) => {
    const d = datos[inicio + i];
    acumulado += d.ahorro;
    return {
      ...m,
      ahorroMes: d.ahorro,
      acumulado,
      sinDatos: !d.tieneDatos,
      enCurso: m.mes === hoy.getMonth() && m.año === hoy.getFullYear(),
    };
  });
}

// ── Métricas financieras ───────────────────────────────────────────────────────

export interface MetricasFinancieras {
  ingresoEfectivo: number;
  esIngresoReal: boolean;
  /** Gasto de consumo del mes. No incluye lo apartado para ahorro. */
  totalGastado: number;
  /** Lo registrado en la categoría Ahorro este mes: ahorro, no gasto. */
  totalApartado: number;
  totalPendiente: number;
  /**
   * Ingreso del mes menos lo ya gastado. Valor REAL con signo: si es negativo,
   * el usuario gastó más de lo que ingresó (BUG-01). Antes se truncaba a 0 con
   * `Math.max`, lo que ocultaba precisamente la situación más crítica que la
   * app debería advertir. Lo apartado para ahorro ya no está disponible.
   */
  balanceDisponible: number;
  /** Disponible menos los compromisos pendientes. También con signo real. */
  balanceFinal: number;
  porcentajeGastado: number;
  porcentajePendiente: number;
  porcentajeLibre: number;
  /**
   * Ahorro proyectado: lo que sobra más lo ya apartado, acotado a 0, porque un
   * ahorro negativo no existe — eso es un déficit (`balanceFinal` / `enDeficit`).
   */
  ahorroProyectado: number;
  /** true si los gastos de consumo del mes ya superan el ingreso. */
  enDeficit: boolean;
  /** Magnitud del déficit (positiva). 0 si no hay déficit. */
  montoDeficit: number;
  diasRestantesMes: number;
  gastoPromedioRecomendadoDia: number;
}

export function calcularMetricasFinancieras(
  transactions: Transaction[],
  categories: any[],
  monthlySalary: number,
  mes: number,
  año: number,
): MetricasFinancieras {
  const ingresoEfectivo = getIngresoEfectivoMes(transactions, monthlySalary, mes, año);
  const ingresoRealBool = esIngresoReal(transactions, mes, año);

  // Gastos del mes por categoría (para no double-contar presupuestos sin diaPago)
  const gastosPorCat: Record<string, number> = {};
  let totalApartado = 0;
  transactions
    .filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === mes && d.getFullYear() === año;
    })
    .forEach(t => {
      if (esMovimientoAhorro(t)) totalApartado += t.amount;
      else if (t.type === 'expense') gastosPorCat[t.category] = (gastosPorCat[t.category] || 0) + t.amount;
    });

  const totalGastado = Object.values(gastosPorCat).reduce((s, v) => s + v, 0);

  // Un presupuesto de "Ahorro" no es un compromiso de gasto: no se descuenta.
  const esCompromiso = (c: any) =>
    c.isSelected && !c.pagado && c.tipo === 'gasto' && (c.budget ?? 0) > 0 && !esCategoriaAhorro(c.name);

  // Compromisos CON diaPago: se descuenta el presupuesto completo si no está pagado
  const compromisosDiaPago = categories
    .filter((c: any) => esCompromiso(c) && c.diaPago)
    .reduce((s: number, c: any) => s + c.budget, 0);

  // Presupuestos SIN diaPago (ej. categorías agregadas desde Finn IA):
  // se descuenta solo lo que falta gastar (budget - gastado en esa categoría)
  const presupuestosSinDia = categories
    .filter((c: any) => esCompromiso(c) && !c.diaPago)
    .reduce((s: number, c: any) => {
      const gastado = gastosPorCat[c.name] ?? 0;
      return s + Math.max(0, (c.budget as number) - gastado);
    }, 0);

  const totalPendiente = compromisosDiaPago + presupuestosSinDia;

  // BUG-01: valores reales con signo. Truncarlos a 0 ocultaba el déficit, que
  // es justamente la señal que el semáforo financiero y Finn deben ver.
  const saldoConsumo = ingresoEfectivo - totalGastado;
  const balanceDisponible = saldoConsumo - totalApartado;
  const balanceFinal = balanceDisponible - totalPendiente;

  const pctGastado   = ingresoEfectivo > 0 ? Math.min(100, Math.round((totalGastado   / ingresoEfectivo) * 100)) : 0;
  const pctPendiente = ingresoEfectivo > 0 ? Math.min(100 - pctGastado, Math.round((totalPendiente / ingresoEfectivo) * 100)) : 0;
  const pctLibre     = Math.max(0, 100 - pctGastado - pctPendiente);

  const hoy = new Date();
  const ultimoDia = new Date(año, mes + 1, 0).getDate();
  const diasRestantes =
    mes === hoy.getMonth() && año === hoy.getFullYear()
      ? Math.max(1, ultimoDia - hoy.getDate())
      : 1;

  return {
    ingresoEfectivo,
    esIngresoReal:  ingresoRealBool,
    totalGastado,
    totalApartado,
    totalPendiente,
    balanceDisponible,
    balanceFinal,
    porcentajeGastado:    pctGastado,
    porcentajePendiente:  pctPendiente,
    porcentajeLibre:      pctLibre,
    // Lo apartado ya es ahorro; el ahorro total no puede ser negativo.
    ahorroProyectado:     Math.max(0, balanceFinal + totalApartado),
    // Déficit = el consumo superó el ingreso. Apartar para ahorrar no es déficit.
    enDeficit:            saldoConsumo < 0,
    montoDeficit:         saldoConsumo < 0 ? Math.abs(saldoConsumo) : 0,
    diasRestantesMes:     diasRestantes,
    // Sin saldo proyectado no hay presupuesto diario que recomendar.
    gastoPromedioRecomendadoDia:
      diasRestantes > 0 ? Math.round(Math.max(0, balanceFinal) / diasRestantes) : 0,
  };
}

// ── Tipos extras para contexto enriquecido ────────────────────────────────────

export interface ContextoExtraIA {
  metas?: Array<{ nombre: string; objetivo: number; actual: number; completada: boolean }>;
  deudas?: Array<{ nombre: string; saldo: number; cuota: number }>;
  recurrentes?: Array<{ nombre: string; monto: number; activo: boolean }>;
  nivel?: { level: number; experience: number; title: string };
  memoriaFinn?: string; // contexto de memoria persistente de Finn
}

// ── Contexto para IA ───────────────────────────────────────────────────────────

export function buildContextoIA(
  metricas: MetricasFinancieras,
  categories: any[],
  transactions: Transaction[],
  profile: any,
  mes: number,
  año: number,
  extra?: ContextoExtraIA,
): string {
  const f = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
  const mesLabel = new Date(año, mes, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  const gastosPorCat: Record<string, number> = {};
  transactions
    .filter(t => {
      const d = new Date(t.date);
      return esGastoConsumo(t) && d.getMonth() === mes && d.getFullYear() === año;
    })
    .forEach(t => { gastosPorCat[t.category] = (gastosPorCat[t.category] || 0) + t.amount; });

  const topGastos = Object.entries(gastosPorCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, monto]) => `${cat}: ${f(monto)}`)
    .join(', ');

  const catsPendientes = categories
    .filter((c: any) => c.isSelected && !c.pagado && c.tipo === 'gasto' && (c.budget ?? 0) > 0)
    .map((c: any) => c.diaPago ? `${c.name} (día ${c.diaPago}: ${f(c.budget)})` : `${c.name} (presupuesto: ${f(c.budget)})`)
    .join(', ');

  const partes: string[] = [`
CONTEXTO FINANCIERO — ${mesLabel}
Usuario: ${profile?.name || 'Usuario'} | Empleo: ${profile?.employmentType || 'no especificado'} | Preocupación principal: ${profile?.mainFinancialConcern || 'no especificada'}

INGRESOS:
- Salario base: ${f(profile?.monthlySalary || 0)}
- Ingresos extra registrados: ${f(metricas.ingresoEfectivo - (profile?.monthlySalary || 0))}
- Total ingresado: ${f(metricas.ingresoEfectivo)}

GASTOS:
- Total gastado: ${f(metricas.totalGastado)} (${metricas.porcentajeGastado}% del ingreso)
- Top categorías: ${topGastos || 'ninguno aún'}

PENDIENTES:
- Total pendiente: ${f(metricas.totalPendiente)} (${metricas.porcentajePendiente}% del ingreso)
- Categorías: ${catsPendientes || 'ninguna'}

BALANCE:
- Disponible ahora: ${f(metricas.balanceDisponible)} (ingreso total − gastos registrados)
- Balance final proyectado: ${f(metricas.balanceFinal)} (${metricas.porcentajeLibre}%)
- Ahorro proyectado: ${f(metricas.ahorroProyectado)}
- Días restantes: ${metricas.diasRestantesMes}
- Presupuesto diario recomendado: ${f(metricas.gastoPromedioRecomendadoDia)}/día

SALDO POR CATEGORÍA (presupuesto − gastado):
${categories
  .filter((c: any) => c.isSelected && (c.budget ?? 0) > 0)
  .map((c: any) => {
    const gastado    = gastosPorCat[c.name] ?? 0;
    const restante   = (c.budget as number) - gastado;
    const estado     = restante < 0 ? 'EXCEDIDO' : gastado === 0 ? 'sin usar' : 'disponible';
    return `  ${c.name}: ${f(Math.abs(restante))} ${estado} (presupuesto ${f(c.budget)}, gastado ${f(gastado)})`;
  })
  .join('\n') || '  Sin categorías con presupuesto'}`.trim()];

  // Metas de ahorro
  if (extra?.metas && extra.metas.length > 0) {
    const metasActivas = extra.metas.filter(m => !m.completada);
    if (metasActivas.length > 0) {
      const metasStr = metasActivas.map(m => {
        const pct = m.objetivo > 0 ? Math.round((m.actual / m.objetivo) * 100) : 0;
        return `${m.nombre}: ${f(m.actual)}/${f(m.objetivo)} (${pct}%)`;
      }).join(' | ');
      partes.push(`\nMETAS DE AHORRO:\n- ${metasStr}`);
    }
  }

  // Deudas activas
  if (extra?.deudas && extra.deudas.length > 0) {
    const deudasActivas = extra.deudas.filter(d => d.saldo > 0);
    if (deudasActivas.length > 0) {
      const totalDeudas = deudasActivas.reduce((s, d) => s + d.saldo, 0);
      const deudasStr = deudasActivas.map(d => `${d.nombre}: ${f(d.saldo)} (cuota ${f(d.cuota)})`).join(' | ');
      partes.push(`\nDEUDAS ACTIVAS:\n- Total: ${f(totalDeudas)}\n- Detalle: ${deudasStr}`);
    }
  }

  // Gastos recurrentes activos
  if (extra?.recurrentes && extra.recurrentes.length > 0) {
    const activos = extra.recurrentes.filter(r => r.activo);
    if (activos.length > 0) {
      const totalRec = activos.reduce((s, r) => s + r.monto, 0);
      partes.push(`\nGASTOS RECURRENTES: ${activos.length} activos | Total mensual: ${f(totalRec)}`);
    }
  }

  // Nivel de gamificación
  if (extra?.nivel) {
    partes.push(`\nNIVEL FINANCIERO: ${extra.nivel.title} (Nivel ${extra.nivel.level} | ${extra.nivel.experience} XP)`);
  }

  // Memoria persistente de Finn
  if (extra?.memoriaFinn) {
    partes.push(`\n${extra.memoriaFinn}`);
  }

  return partes.join('\n');
}
