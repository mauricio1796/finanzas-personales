import { Transaction } from '../types';

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

// ── Ingreso efectivo del mes ───────────────────────────────────────────────────

/**
 * Ingreso efectivo = suma de transacciones income del mes.
 * Si no hay ninguna, usa monthlySalary como fallback estimado.
 * Este valor es LA BASE de todos los cálculos del sistema.
 */
export function getIngresoEfectivoMes(
  transactions: Transaction[],
  monthlySalary: number,
  mes: number,
  año: number,
): number {
  const ingresosTx = transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === 'income' && d.getMonth() === mes && d.getFullYear() === año;
    })
    .reduce((s, t) => s + t.amount, 0);

  return ingresosTx > 0 ? ingresosTx : monthlySalary;
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
    return t.type === 'income' && d.getMonth() === mes && d.getFullYear() === año;
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
      return t.type === 'income' && d.getMonth() === mes && d.getFullYear() === año;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ── Métricas financieras ───────────────────────────────────────────────────────

export interface MetricasFinancieras {
  ingresoEfectivo: number;
  esIngresoReal: boolean;
  totalGastado: number;
  totalPendiente: number;
  balanceDisponible: number;
  balanceFinal: number;
  porcentajeGastado: number;
  porcentajePendiente: number;
  porcentajeLibre: number;
  ahorroProyectado: number;
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
  transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === mes && d.getFullYear() === año;
    })
    .forEach(t => {
      gastosPorCat[t.category] = (gastosPorCat[t.category] || 0) + t.amount;
    });

  const totalGastado = Object.values(gastosPorCat).reduce((s, v) => s + v, 0);

  // Compromisos CON diaPago: se descuenta el presupuesto completo si no está pagado
  const compromisosDiaPago = categories
    .filter((c: any) => c.isSelected && c.diaPago && !c.pagado && c.tipo === 'gasto' && (c.budget ?? 0) > 0)
    .reduce((s: number, c: any) => s + c.budget, 0);

  // Presupuestos SIN diaPago (ej. categorías agregadas desde Finn IA):
  // se descuenta solo lo que falta gastar (budget - gastado en esa categoría)
  const presupuestosSinDia = categories
    .filter((c: any) => c.isSelected && !c.diaPago && !c.pagado && c.tipo === 'gasto' && (c.budget ?? 0) > 0)
    .reduce((s: number, c: any) => {
      const gastado = gastosPorCat[c.name] ?? 0;
      return s + Math.max(0, (c.budget as number) - gastado);
    }, 0);

  const totalPendiente = compromisosDiaPago + presupuestosSinDia;

  const balanceDisponible = Math.max(0, ingresoEfectivo - totalGastado);
  const balanceFinal = Math.max(0, ingresoEfectivo - totalGastado - totalPendiente);

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
    totalPendiente,
    balanceDisponible,
    balanceFinal,
    porcentajeGastado:    pctGastado,
    porcentajePendiente:  pctPendiente,
    porcentajeLibre:      pctLibre,
    ahorroProyectado:     balanceFinal,
    diasRestantesMes:     diasRestantes,
    gastoPromedioRecomendadoDia: diasRestantes > 0 ? Math.round(balanceFinal / diasRestantes) : 0,
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
      return t.type === 'expense' && d.getMonth() === mes && d.getFullYear() === año;
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
- Ingreso del mes: ${f(metricas.ingresoEfectivo)} ${metricas.esIngresoReal ? '(registrado)' : '(estimado del perfil)'}
- Salario base configurado: ${f(profile?.monthlySalary || 0)}

GASTOS:
- Total gastado: ${f(metricas.totalGastado)} (${metricas.porcentajeGastado}% del ingreso)
- Top categorías: ${topGastos || 'ninguno aún'}

PENDIENTES:
- Total pendiente: ${f(metricas.totalPendiente)} (${metricas.porcentajePendiente}% del ingreso)
- Categorías: ${catsPendientes || 'ninguna'}

BALANCE:
- Disponible ahora: ${f(metricas.balanceDisponible)}
- Balance final proyectado: ${f(metricas.balanceFinal)} (${metricas.porcentajeLibre}%)
- Ahorro proyectado: ${f(metricas.ahorroProyectado)}
- Días restantes: ${metricas.diasRestantesMes}
- Presupuesto diario recomendado: ${f(metricas.gastoPromedioRecomendadoDia)}/día`.trim()];

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
