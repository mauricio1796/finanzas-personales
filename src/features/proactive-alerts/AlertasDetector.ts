/**
 * AlertasDetector — reglas de detección puras.
 * Recibe datos en memoria y devuelve AlertaCandidato[].
 * Sin efectos secundarios, sin llamadas de red, sin estado.
 */

import type { Transaction, Category } from '../../types';
import type { AlertaCandidato, DetectorParams, TipoAlerta } from './types';

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function parseDate(d: string): Date {
  return new Date(d);
}

function mismoMesAño(d: Date, mes: number, año: number): boolean {
  return d.getMonth() === mes && d.getFullYear() === año;
}

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
}

// ── Transacciones del mes ─────────────────────────────────────────────────────

function txDelMes(transactions: Transaction[], mes: number, año: number): Transaction[] {
  return transactions.filter(t => {
    if ((t as any).deleted_at) return false;
    const d = parseDate(t.date);
    return mismoMesAño(d, mes, año) && t.type === 'expense';
  });
}

function gastoPorCategoria(txs: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txs) {
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return map;
}

// ── Regla 1 & 2: Presupuesto al 80% y al 100% ────────────────────────────────

function detectarPresupuesto(
  transactions: Transaction[],
  categories: Category[],
  now: Date,
): AlertaCandidato[] {
  const mes  = now.getMonth();
  const año  = now.getFullYear();
  const gastoMap = gastoPorCategoria(txDelMes(transactions, mes, año));
  const alertas: AlertaCandidato[] = [];

  for (const cat of categories) {
    if ((cat as any).deleted_at) continue;
    if (!cat.budget || cat.budget <= 0) continue;
    if ((cat as any).tipo === 'ingreso') continue;
    if (cat.parentCategoryId) continue; // solo categorías principales

    const gastado = gastoMap.get(cat.name) ?? 0;
    const pct     = gastado / cat.budget;

    if (pct >= 1.0) {
      alertas.push({
        tipo:          'presupuesto_100pct',
        referencia_id: cat.id,
        mensaje:       `Superaste el presupuesto de ${cat.name}. Llevas ${fmt(gastado)} de ${fmt(cat.budget)} este mes.`,
        esPremium:     false,
      });
    } else if (pct >= 0.8) {
      const restante = cat.budget - gastado;
      alertas.push({
        tipo:          'presupuesto_80pct',
        referencia_id: cat.id,
        mensaje:       `Llevas el ${Math.round(pct * 100)}% de tu presupuesto en ${cat.name}. Solo te quedan ${fmt(restante)} este mes.`,
        esPremium:     false,
      });
    }
  }

  return alertas;
}

// ── Regla 3: Gasto +35% vs mes anterior ──────────────────────────────────────

function detectarAumentoCategoria(
  transactions: Transaction[],
  categories: Category[],
  now: Date,
): AlertaCandidato[] {
  const mes     = now.getMonth();
    const año     = now.getFullYear();
  const mesPrev = mes === 0 ? 11 : mes - 1;
  const añoPrev = mes === 0 ? año - 1 : año;

  const gastoActual  = gastoPorCategoria(txDelMes(transactions, mes,     año));
  const gastoPrevio  = gastoPorCategoria(txDelMes(transactions, mesPrev, añoPrev));
  const alertas: AlertaCandidato[] = [];

  const catNames = new Set([...gastoActual.keys(), ...gastoPrevio.keys()]);
  for (const nombre of catNames) {
    const actual  = gastoActual.get(nombre) ?? 0;
    const previo  = gastoPrevio.get(nombre) ?? 0;
    if (previo < 10_000) continue; // sin base suficiente
    if (actual < 10_000) continue;

    const incremento = (actual - previo) / previo;
    if (incremento >= 0.35) {
      alertas.push({
        tipo:          'gasto_aumento_categoria',
        referencia_id: nombre,
        mensaje:       `Este mes gastaste ${Math.round(incremento * 100)}% más en ${nombre} que el mes pasado (${fmt(actual)} vs ${fmt(previo)}).`,
        esPremium:     false,
      });
    }
  }

  return alertas;
}

// ── Regla 4: Gasto anómalo puntual — Premium ──────────────────────────────────

function detectarGastoAnomalo(
  transactions: Transaction[],
  now: Date,
): AlertaCandidato[] {
  // Requiere al menos 3 meses de historial por categoría
  const alertas: AlertaCandidato[] = [];
  const mes = now.getMonth();
  const año = now.getFullYear();

  // Agrupar gastos mensuales por categoría de los últimos 6 meses
  const historial = new Map<string, number[]>();
  for (let i = 1; i <= 6; i++) {
    const m = mes - i < 0 ? mes - i + 12 : mes - i;
    const y = mes - i < 0 ? año - 1 : año;
    const gastos = gastoPorCategoria(txDelMes(transactions, m, y));
    gastos.forEach((monto, cat) => {
      if (!historial.has(cat)) historial.set(cat, []);
      historial.get(cat)!.push(monto);
    });
  }

  // Gasto actual del mes en curso
  const gastoActual = gastoPorCategoria(txDelMes(transactions, mes, año));

  gastoActual.forEach((actual, cat) => {
    const hist = historial.get(cat) ?? [];
    if (hist.length < 3) return;

    const media = hist.reduce((a, b) => a + b, 0) / hist.length;
    const varianza = hist.reduce((a, b) => a + Math.pow(b - media, 2), 0) / hist.length;
    const stddev = Math.sqrt(varianza);
    if (stddev < 1_000) return; // varianza muy baja, no significativa

    if (actual > media + 2.5 * stddev) {
      alertas.push({
        tipo:          'gasto_anomalo',
        referencia_id: cat,
        mensaje:       `Detecté un gasto inusualmente alto en ${cat}: ${fmt(actual)}, cuando tu promedio es ${fmt(media)}.`,
        esPremium:     true,
      });
    }
  });

  return alertas;
}

// ── Regla 5: Compromiso próximo con saldo ajustado ───────────────────────────

function detectarCompromisosProximos(
  transactions: Transaction[],
  categories: Category[],
  salary: number,
  now: Date,
): AlertaCandidato[] {
  const mes    = now.getMonth();
  const año    = now.getFullYear();
  const diaHoy = now.getDate();
  const alertas: AlertaCandidato[] = [];

  // Saldo disponible = ingresos mes - gastos mes
  const txMes = transactions.filter(t => {
    if ((t as any).deleted_at) return false;
    return mismoMesAño(parseDate(t.date), mes, año);
  });
  const ingresosMes = txMes.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const gastosMes   = txMes.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const saldoReal   = (ingresosMes || salary) - gastosMes;

  for (const cat of categories) {
    if ((cat as any).deleted_at) continue;
    if ((cat as any).pagado) continue;
    if (!(cat as any).dia_pago) continue;
    if ((cat as any).tipo !== 'fijo') continue;
    if (!cat.budget || cat.budget <= 0) continue;

    const diasRestantes = (cat as any).dia_pago - diaHoy;
    if (diasRestantes < 1 || diasRestantes > 3) continue;

    if (saldoReal < cat.budget * 1.1) {
      alertas.push({
        tipo:          'compromiso_saldo_ajustado',
        referencia_id: cat.id,
        mensaje:       `${cat.name} vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''} y tu saldo disponible (${fmt(saldoReal)}) es ajustado para cubrir ${fmt(cat.budget)}.`,
        esPremium:     false,
      });
    }
  }

  return alertas;
}

// ── Regla 6: Ritmo de gasto insostenible ─────────────────────────────────────

function detectarRitmoInsostenible(
  transactions: Transaction[],
  salary: number,
  now: Date,
): AlertaCandidato[] {
  if (salary <= 0) return [];

  const mes    = now.getMonth();
  const año    = now.getFullYear();
  const diaHoy = now.getDate();
  if (diaHoy < 5) return []; // muy pocos datos al inicio del mes

  const gastosMes = txDelMes(transactions, mes, año).reduce((a, t) => a + t.amount, 0);
  const diasEnMes = new Date(año, mes + 1, 0).getDate();
  const ritmo     = gastosMes / diaHoy;
  const proyeccion = ritmo * diasEnMes;

  if (proyeccion > salary * 0.95 && gastosMes > salary * 0.4) {
    return [{
      tipo:          'ritmo_insostenible',
      referencia_id: 'global',
      mensaje:       `A este ritmo, gastarías ${fmt(proyeccion)} este mes. Tu ingreso mensual es ${fmt(salary)}. Considera ajustar tus gastos.`,
      esPremium:     false,
    }];
  }
  return [];
}

// ── Regla 7: Racha de ahorro positiva ────────────────────────────────────────

function detectarRachaAhorro(
  transactions: Transaction[],
  now: Date,
): AlertaCandidato[] {
  // Días consecutivos recientes sin gastos
  let racha = 0;
  for (let i = 1; i <= 7; i++) {
    const dia = new Date(now);
    dia.setDate(now.getDate() - i);
    const tieneGasto = transactions.some(t => {
      if ((t as any).deleted_at || t.type !== 'expense') return false;
      const d = parseDate(t.date);
      return d.getDate() === dia.getDate() &&
             d.getMonth() === dia.getMonth() &&
             d.getFullYear() === dia.getFullYear();
    });
    if (!tieneGasto) racha++;
    else break;
  }

  if (racha >= 3) {
    return [{
      tipo:          'racha_ahorro',
      referencia_id: 'global',
      mensaje:       `¡Llevas ${racha} días seguidos sin gastos! Mantén ese ritmo de ahorro.`,
      esPremium:     false,
    }];
  }
  return [];
}

// ── Regla 8: Meta de ahorro al 85%+ ──────────────────────────────────────────

function detectarMetaCerca(goal: DetectorParams['goal']): AlertaCandidato[] {
  if (!goal || !goal.targetAmount || goal.targetAmount <= 0) return [];
  const pct = (goal.currentAmount ?? 0) / goal.targetAmount;
  if (pct >= 0.85 && pct < 1.0) {
    const restante = goal.targetAmount - (goal.currentAmount ?? 0);
    return [{
      tipo:          'meta_cerca',
      referencia_id: goal.id ?? 'meta',
      mensaje:       `Estás al ${Math.round(pct * 100)}% de tu meta "${goal.title}". Solo te faltan ${fmt(restante)} para lograrlo.`,
      esPremium:     false,
    }];
  }
  return [];
}

// ── Insight diario — Premium ──────────────────────────────────────────────────

function generarInsightDiario(
  transactions: Transaction[],
  categories: Category[],
  salary: number,
  now: Date,
): AlertaCandidato {
  const mes  = now.getMonth();
  const año  = now.getFullYear();
  const gastoMap = gastoPorCategoria(txDelMes(transactions, mes, año));
  const totalGastado = [...gastoMap.values()].reduce((a, b) => a + b, 0);

  // Categoría con mayor gasto
  let maxCat   = '';
  let maxMonto = 0;
  gastoMap.forEach((m, c) => { if (m > maxMonto) { maxMonto = m; maxCat = c; } });

  const diasEnMes = new Date(año, mes + 1, 0).getDate();
  const diaHoy    = now.getDate();
  const pctMes    = Math.round((diaHoy / diasEnMes) * 100);
  const pctGasto  = salary > 0 ? Math.round((totalGastado / salary) * 100) : 0;

  let mensaje = '';
  if (totalGastado === 0) {
    mensaje = `Aún no tienes gastos registrados este mes. Empieza a registrar para que Finn te ayude mejor.`;
  } else if (maxCat) {
    mensaje = `Llevas ${fmt(totalGastado)} gastados (${pctGasto}% de tu ingreso) y vamos en el día ${diaHoy} de ${diasEnMes}. Tu mayor gasto: ${maxCat} con ${fmt(maxMonto)}.`;
  } else {
    mensaje = `Llevas ${fmt(totalGastado)} gastados este mes, el ${pctGasto}% de tu ingreso al día ${pctMes}% del mes.`;
  }

  return {
    tipo:          'insight_diario',
    referencia_id: 'global',
    mensaje,
    esPremium:     true,
  };
}

// ── Función principal: detectar todas las alertas ────────────────────────────

export function detectarAlertas(params: DetectorParams): AlertaCandidato[] {
  const { transactions, categories, profile, goal, isPremium, prefs } = params;
  if (!prefs.alertas_activas) return [];

  const now    = new Date();
  const salary = profile?.monthlySalary ?? 0;
  const result: AlertaCandidato[] = [];

  if (prefs.alertas_presupuesto) {
    result.push(...detectarPresupuesto(transactions, categories, now));
    result.push(...detectarAumentoCategoria(transactions, categories, now));
  }

  if (prefs.alertas_anomalias && isPremium) {
    result.push(...detectarGastoAnomalo(transactions, now));
  }

  if (prefs.alertas_compromisos) {
    result.push(...detectarCompromisosProximos(transactions, categories, salary, now));
  }

  if (prefs.alertas_ritmo) {
    result.push(...detectarRitmoInsostenible(transactions, salary, now));
  }

  if (prefs.alertas_ahorro) {
    result.push(...detectarRachaAhorro(transactions, now));
  }

  if (prefs.alertas_metas) {
    result.push(...detectarMetaCerca(goal));
  }

  if (prefs.insight_diario_activo && isPremium) {
    result.push(generarInsightDiario(transactions, categories, salary, now));
  }

  // Quitar duplicados por (tipo, referencia_id) — puede ocurrir si hay subcategorías
  const seen = new Set<string>();
  return result.filter(a => {
    const key = `${a.tipo}:${a.referencia_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
