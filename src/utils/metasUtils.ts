/**
 * Metas de ahorro: una sola fuente de verdad (`metas[]`).
 *
 * La app tenía dos sistemas en paralelo: `goal` (FinancialGoal, que usaban
 * Finn, alertas, PDF, notificaciones y gamificación) y `metas[]` (la pantalla
 * Metas y el Home). Una meta creada en la pantalla Metas nunca llegaba a las
 * alertas ni al reporte. Ahora `goal` es un valor DERIVADO de `metas[]` —la
 * meta principal— y lo que escribe Finn se guarda como meta.
 *
 * Módulo puro (solo imports de tipos): cubierto por tests/metas.test.ts.
 */

import type { Meta, FinancialGoal } from '../types';

const PREFIJO_LEGADO = 'goal_';
const EMOJI_DEFECTO = '🎯';
const COLOR_DEFECTO = '#6366F1';

/**
 * Meta principal: la activa con la fecha límite más próxima; sin fechas, la
 * creada más recientemente. Si no hay activas, la última completada (para que
 * logros como "meta cumplida" sigan viéndola).
 */
export function metaPrincipal(metas: Meta[]): Meta | null {
  const activas = metas.filter(m => !m.completada);
  if (activas.length > 0) {
    return [...activas].sort((a, b) => {
      const fa = a.fechaLimite ? Date.parse(a.fechaLimite) : NaN;
      const fb = b.fechaLimite ? Date.parse(b.fechaLimite) : NaN;
      if (!isNaN(fa) && !isNaN(fb) && fa !== fb) return fa - fb;
      if (!isNaN(fa) !== !isNaN(fb)) return isNaN(fa) ? 1 : -1;
      return Date.parse(b.creadaEn) - Date.parse(a.creadaEn);
    })[0];
  }
  const completadas = metas.filter(m => m.completada);
  if (completadas.length === 0) return null;
  return [...completadas].sort((a, b) => Date.parse(b.creadaEn) - Date.parse(a.creadaEn))[0];
}

/** Vista FinancialGoal de una meta, para los consumidores que aún leen `goal`. */
export function goalDesdeMeta(meta: Meta, userId: string): FinancialGoal {
  return {
    id:            meta.id,
    userId,
    type:          'savings',
    title:         meta.nombre,
    targetAmount:  meta.montoObjetivo,
    currentAmount: meta.montoActual,
    deadline:      meta.fechaLimite,
    priority:      'high',
    isActive:      !meta.completada,
    createdAt:     meta.creadaEn,
    updatedAt:     meta.aportes?.[meta.aportes.length - 1]?.fecha ?? meta.creadaEn,
  };
}

/**
 * Convierte un FinancialGoal (el guardado antes de unificar, o el que escribe
 * Finn con `setGoal`) en una meta. Si `existente` se pasa, se actualiza esa
 * meta conservando su progreso, emoji, color y aportes.
 *
 * Devuelve null si el goal no tiene monto objetivo: sin objetivo no hay meta.
 */
export function metaDesdeGoal(
  goal: Partial<FinancialGoal> & { name?: string },
  existente?: Meta,
  ahora: Date = new Date(),
): Meta | null {
  const objetivo = goal.targetAmount ?? existente?.montoObjetivo ?? 0;
  if (!(objetivo > 0)) return null;
  // AgentService envía el nombre NUEVO en `name` junto al `title` viejo que trae
  // del spread de la meta actual: `name` manda.
  const nombre = (goal.name ?? goal.title ?? existente?.nombre ?? 'Mi meta').trim() || 'Mi meta';
  const actual = Math.min(Math.max(0, goal.currentAmount ?? existente?.montoActual ?? 0), objetivo);
  return {
    id:          existente?.id ?? (goal.id ? PREFIJO_LEGADO + goal.id : Date.now().toString()),
    nombre,
    montoObjetivo: objetivo,
    montoActual: actual,
    emoji:       existente?.emoji ?? EMOJI_DEFECTO,
    color:       existente?.color ?? COLOR_DEFECTO,
    fechaLimite: goal.deadline ?? existente?.fechaLimite,
    completada:  actual >= objetivo,
    creadaEn:    existente?.creadaEn ?? goal.createdAt ?? ahora.toISOString(),
    ...(existente?.aportes ? { aportes: existente.aportes } : {}),
  };
}

/**
 * Migración única del goal guardado antes de unificar. Devuelve las metas con
 * la meta migrada (si aplica) y si hubo cambio. Idempotente: un goal ya
 * migrado (mismo id) o inactivo no se vuelve a agregar.
 */
export function migrarGoalLegado(
  metas: Meta[],
  goal: FinancialGoal | null | undefined,
): { metas: Meta[]; migrada: Meta | null } {
  if (!goal || goal.isActive === false) return { metas, migrada: null };
  const meta = metaDesdeGoal(goal);
  // Ya migrado, o es la vista derivada de una meta existente (mismo id).
  if (!meta || metas.some(m => m.id === meta.id || m.id === goal.id)) return { metas, migrada: null };
  return { metas: [meta, ...metas], migrada: meta };
}

/** Metas activas al `umbral` o más de su objetivo (sin completar). */
export function metasCercaDeCumplirse(metas: Meta[], umbral = 0.85): { meta: Meta; pct: number; restante: number }[] {
  return metas
    .filter(m => !m.completada && m.montoObjetivo > 0)
    .map(m => ({ meta: m, pct: m.montoActual / m.montoObjetivo, restante: m.montoObjetivo - m.montoActual }))
    .filter(x => x.pct >= umbral && x.pct < 1);
}
