import { Transaction, Category } from '../types';
import { MetricasFinancieras } from './ingresoUtils';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type VeredictoSimulador = 'si_puedes' | 'con_cuidado' | 'mejor_no' | 'no_recomendado';

export interface ResultadoSimulacion {
  monto: number;
  veredicto: VeredictoSimulador;
  titulo: string;
  subtitulo: string;
  colorVeredicto: string;
  iconoVeredicto: string;

  balanceAntes: number;
  balanceDespues: number;
  nuevoPorcentajeGastado: number;

  equivalencias: Equivalencia[];
  categoriasSugeridas: CategoriaImpacto[];
  planAhorro: PlanAhorro;

  gastadoPrevioSimilar: number;
  vecesComprasSimilares: number;
  consejoFinn: string;
}

export interface Equivalencia {
  icono: string;
  descripcion: string;
  cantidad: string;
}

export interface CategoriaImpacto {
  categoria: Category;
  gastadoActual: number;
  presupuestoRestante: number;
  puedeAbsorber: boolean;
  pctDelPresupuesto: number;
}

export interface PlanAhorro {
  diasParaAhorrar: number;
  semanasSiGuardas10Pct: number;
  mesesSiApartas20Pct: number;
  montoAhorroSugerido: number;
}

// ── Colores de veredicto — constantes de la función, no del tema ──────────────

const COLORES_VEREDICTO = {
  si_puedes:      '#10B981',
  con_cuidado:    '#F59E0B',
  mejor_no:       '#EF4444',
  no_recomendado: '#EF4444',
};

const INFO_VEREDICTO = {
  si_puedes:      { titulo: '¡Sí puedes!',  subtitulo: 'Tienes margen suficiente',         icono: 'check-circle'   },
  con_cuidado:    { titulo: 'Con cuidado',   subtitulo: 'Es posible pero afecta tu ahorro', icono: 'alert-circle'   },
  mejor_no:       { titulo: 'Mejor no',      subtitulo: 'Impactaría mucho tu presupuesto',  icono: 'x-circle'       },
  no_recomendado: { titulo: 'No alcanza',    subtitulo: 'No tienes balance suficiente',     icono: 'alert-triangle' },
};

// ── Función principal ─────────────────────────────────────────────────────────

export function simularDecision(
  monto: number,
  transactions: Transaction[],
  categories: Category[],
  metricas: MetricasFinancieras,
): ResultadoSimulacion {
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

  // ── Veredicto ────────────────────────────────────────────────────────────────
  const pctDelBalance = metricas.balanceDisponible > 0
    ? (monto / metricas.balanceDisponible) * 100
    : 999;
  const pctDelIngreso = metricas.ingresoEfectivo > 0
    ? (monto / metricas.ingresoEfectivo) * 100
    : 999;

  let veredicto: VeredictoSimulador;
  if (monto > metricas.balanceDisponible) {
    veredicto = 'no_recomendado';
  } else if (pctDelBalance > 50 || pctDelIngreso > 30) {
    veredicto = 'mejor_no';
  } else if (pctDelBalance > 25 || pctDelIngreso > 15) {
    veredicto = 'con_cuidado';
  } else {
    veredicto = 'si_puedes';
  }

  const info = INFO_VEREDICTO[veredicto];

  // ── Balance después ───────────────────────────────────────────────────────────
  const balanceDespues = Math.max(0, metricas.balanceDisponible - monto);
  const nuevoPctGastado = metricas.ingresoEfectivo > 0
    ? Math.round(((metricas.totalGastado + monto) / metricas.ingresoEfectivo) * 100)
    : 0;

  // ── Equivalencias ─────────────────────────────────────────────────────────────
  const equivalencias: Equivalencia[] = [];

  if (metricas.gastoPromedioRecomendadoDia > 0) {
    const dias = Math.round(monto / metricas.gastoPromedioRecomendadoDia);
    if (dias > 0) equivalencias.push({
      icono: 'calendar',
      descripcion: 'días de tu presupuesto diario',
      cantidad: `${dias} día${dias !== 1 ? 's' : ''}`,
    });
  }

  if (metricas.ingresoEfectivo > 0) {
    const pct = Math.round((monto / metricas.ingresoEfectivo) * 100);
    equivalencias.push({
      icono: 'percent',
      descripcion: 'de tu ingreso mensual',
      cantidad: `${pct}%`,
    });
  }

  const ahorroSemanal = (metricas.ingresoEfectivo * 0.2) / 4;
  if (ahorroSemanal > 0) {
    const semanas = Math.ceil(monto / ahorroSemanal);
    equivalencias.push({
      icono: 'clock',
      descripcion: 'semanas ahorrando el 20%',
      cantidad: `${semanas} semana${semanas !== 1 ? 's' : ''}`,
    });
  }

  equivalencias.push({
    icono: 'dollar-sign',
    descripcion: 'te quedaría disponible',
    cantidad: fmt(balanceDespues),
  });

  // ── Categorías que pueden absorber el gasto ───────────────────────────────────
  const now = new Date();
  const gastosPorCat: Record<string, number> = {};
  transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense'
        && d.getMonth() === now.getMonth()
        && d.getFullYear() === now.getFullYear();
    })
    .forEach(t => { gastosPorCat[t.category] = (gastosPorCat[t.category] || 0) + t.amount; });

  const categoriasSugeridas: CategoriaImpacto[] = (categories as any[])
    .filter((c: any) => c.isSelected && c.tipo === 'gasto' && (c.budget ?? 0) > 0)
    .map((c: any) => {
      const gastado = gastosPorCat[c.name] ?? 0;
      const restante = Math.max(0, (c.budget as number) - gastado);
      return {
        categoria: c as Category,
        gastadoActual: gastado,
        presupuestoRestante: restante,
        puedeAbsorber: restante >= monto,
        pctDelPresupuesto: c.budget > 0 ? Math.round((monto / c.budget) * 100) : 999,
      };
    })
    .sort((a: CategoriaImpacto, b: CategoriaImpacto) => {
      if (a.puedeAbsorber && !b.puedeAbsorber) return -1;
      if (!a.puedeAbsorber && b.puedeAbsorber) return 1;
      return b.presupuestoRestante - a.presupuestoRestante;
    })
    .slice(0, 4);

  // ── Plan de ahorro ────────────────────────────────────────────────────────────
  const ahorroMensual10 = metricas.ingresoEfectivo * 0.10;
  const ahorroMensual20 = metricas.ingresoEfectivo * 0.20;
  const diasGanando = metricas.gastoPromedioRecomendadoDia > 0
    ? Math.ceil(monto / metricas.gastoPromedioRecomendadoDia)
    : 0;

  const planAhorro: PlanAhorro = {
    diasParaAhorrar:       diasGanando,
    semanasSiGuardas10Pct: ahorroMensual10 > 0 ? Math.ceil(monto / (ahorroMensual10 / 4)) : 999,
    mesesSiApartas20Pct:   ahorroMensual20 > 0 ? Math.ceil(monto / ahorroMensual20) : 999,
    montoAhorroSugerido:   Math.round(ahorroMensual10),
  };

  // ── Historial de gastos similares ─────────────────────────────────────────────
  const rangoMin = monto * 0.8;
  const rangoMax = monto * 1.2;
  const similares = transactions.filter(t => {
    const d = new Date(t.date);
    const esUltimos30Dias = (now.getTime() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
    return t.type === 'expense' && t.amount >= rangoMin && t.amount <= rangoMax && esUltimos30Dias;
  });
  const gastadoPrevioSimilar = similares.reduce((s, t) => s + t.amount, 0);

  // ── Consejo de Finn ───────────────────────────────────────────────────────────
  let consejoFinn = '';
  switch (veredicto) {
    case 'si_puedes':
      consejoFinn = similares.length > 0
        ? `Has hecho ${similares.length} compra${similares.length > 1 ? 's' : ''} similar${similares.length > 1 ? 'es' : ''} este mes (${fmt(gastadoPrevioSimilar)}). Esta compra es razonable dado tu balance actual.`
        : `Tienes suficiente margen. Esta compra representa el ${Math.round(pctDelBalance)}% de tu balance disponible.`;
      break;
    case 'con_cuidado':
      consejoFinn = categoriasSugeridas.find(c => c.puedeAbsorber)
        ? `Si la registras en ${categoriasSugeridas.find(c => c.puedeAbsorber)!.categoria.name}, aún entras en presupuesto. Pero reducirá tu ahorro proyectado.`
        : `Esta compra consumiría el ${Math.round(pctDelBalance)}% de tu balance. Considera esperar ${planAhorro.semanasSiGuardas10Pct} semanas para ahorrarla.`;
      break;
    case 'mejor_no':
      consejoFinn = `Esta compra representa el ${Math.round(pctDelIngreso)}% de tu ingreso mensual. Te recomiendo esperarla y ahorrar ${fmt(planAhorro.montoAhorroSugerido)}/mes para tenerla en ${planAhorro.mesesSiApartas20Pct} mes${planAhorro.mesesSiApartas20Pct !== 1 ? 'es' : ''}.`;
      break;
    case 'no_recomendado':
      consejoFinn = `Tu balance disponible es ${fmt(metricas.balanceDisponible)}, insuficiente para ${fmt(monto)}. Necesitas ${fmt(monto - metricas.balanceDisponible)} adicionales.`;
      break;
  }

  return {
    monto,
    veredicto,
    titulo: info.titulo,
    subtitulo: info.subtitulo,
    colorVeredicto: COLORES_VEREDICTO[veredicto],
    iconoVeredicto: info.icono,
    balanceAntes: metricas.balanceDisponible,
    balanceDespues,
    nuevoPorcentajeGastado: nuevoPctGastado,
    equivalencias,
    categoriasSugeridas,
    planAhorro,
    gastadoPrevioSimilar,
    vecesComprasSimilares: similares.length,
    consejoFinn,
  };
}
