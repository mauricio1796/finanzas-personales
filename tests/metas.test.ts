/**
 * Metas unificadas: `metas[]` es la única fuente de verdad y `goal` se deriva.
 *
 * Lo que estas pruebas protegen: antes `goal` (Finn, alertas, PDF) y `metas`
 * (pantalla Metas, Home) eran dos sistemas; una meta creada en la pantalla
 * nunca recibía la alerta del 85% ni salía en el reporte.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  metaPrincipal, goalDesdeMeta, metaDesdeGoal, migrarGoalLegado, metasCercaDeCumplirse,
  idAbonoMeta, idRetiroMeta, montoVinculadoMeta, sobranteParaApartar,
} from '../src/utils/metasUtils.ts';
import type { Meta, FinancialGoal } from '../src/types/index.ts';

const meta = (over: Partial<Meta>): Meta => ({
  id: 'm1', nombre: 'Viaje', montoObjetivo: 1_000_000, montoActual: 0, emoji: '✈️',
  color: '#10B981', completada: false, creadaEn: '2026-06-01T00:00:00.000Z', ...over,
});

const legado = (over: Partial<FinancialGoal> = {}): FinancialGoal => ({
  id: 'g1', userId: 'u1', type: 'savings', title: 'Fondo de emergencia', targetAmount: 3_000_000,
  currentAmount: 500_000, priority: 'high', isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});

describe('metaPrincipal', () => {
  test('sin metas → null', () => {
    assert.equal(metaPrincipal([]), null);
  });

  test('prefiere la activa con fecha límite más próxima', () => {
    const p = metaPrincipal([
      meta({ id: 'a', fechaLimite: '2027-01-01' }),
      meta({ id: 'b', fechaLimite: '2026-12-01' }),
      meta({ id: 'c' }),
    ]);
    assert.equal(p?.id, 'b');
  });

  test('sin fechas → la creada más recientemente', () => {
    const p = metaPrincipal([
      meta({ id: 'vieja', creadaEn: '2026-01-01T00:00:00.000Z' }),
      meta({ id: 'nueva', creadaEn: '2026-08-01T00:00:00.000Z' }),
    ]);
    assert.equal(p?.id, 'nueva');
  });

  test('solo completadas → la última completada (logro "meta cumplida")', () => {
    const p = metaPrincipal([meta({ id: 'hecha', completada: true, montoActual: 1_000_000 })]);
    assert.equal(p?.id, 'hecha');
  });
});

describe('goalDesdeMeta', () => {
  test('expone la meta con la forma de FinancialGoal', () => {
    const g = goalDesdeMeta(meta({ montoActual: 900_000, fechaLimite: '2026-12-01' }), 'u1');
    assert.equal(g.id, 'm1');
    assert.equal(g.title, 'Viaje');
    assert.equal(g.targetAmount, 1_000_000);
    assert.equal(g.currentAmount, 900_000);
    assert.equal(g.deadline, '2026-12-01');
  });
});

describe('metaDesdeGoal (setGoal de Finn)', () => {
  test('actualizar la principal conserva progreso, emoji y aportes', () => {
    const existente = meta({ montoActual: 300_000, aportes: [{ monto: 300_000, fecha: '2026-07-01' }] });
    const base = goalDesdeMeta(existente, 'u1');
    const m = metaDesdeGoal({ ...base, name: 'Viaje a Cartagena', targetAmount: 2_000_000 } as any, existente);
    assert.equal(m?.id, 'm1');
    assert.equal(m?.nombre, 'Viaje a Cartagena');
    assert.equal(m?.montoObjetivo, 2_000_000);
    assert.equal(m?.montoActual, 300_000);
    assert.equal(m?.emoji, '✈️');
    assert.equal(m?.aportes?.length, 1);
  });

  test('sin monto objetivo no crea meta', () => {
    assert.equal(metaDesdeGoal({ title: 'Algo' }), null);
  });
});

describe('migrarGoalLegado', () => {
  test('el goal guardado pasa a metas una sola vez', () => {
    const r1 = migrarGoalLegado([], legado());
    assert.equal(r1.metas.length, 1);
    assert.equal(r1.migrada?.id, 'goal_g1');
    assert.equal(r1.migrada?.nombre, 'Fondo de emergencia');
    const r2 = migrarGoalLegado(r1.metas, legado());
    assert.equal(r2.migrada, null);
    assert.equal(r2.metas.length, 1);
  });

  test('un goal inactivo (ya retirado) no se migra', () => {
    assert.equal(migrarGoalLegado([], legado({ isActive: false })).migrada, null);
  });

  test('la vista derivada de una meta existente no se duplica', () => {
    const existente = meta({ id: 'm9' });
    const derivado = goalDesdeMeta(existente, 'u1');
    assert.equal(migrarGoalLegado([existente], derivado).migrada, null);
  });
});

describe('metasCercaDeCumplirse', () => {
  test('incluye todas las activas ≥85% y <100%', () => {
    const r = metasCercaDeCumplirse([
      meta({ id: 'a', montoActual: 900_000 }),
      meta({ id: 'b', montoActual: 500_000 }),
      meta({ id: 'c', montoActual: 1_000_000, completada: true }),
      meta({ id: 'd', montoActual: 850_000 }),
    ]);
    assert.deepEqual(r.map(x => x.meta.id), ['a', 'd']);
    assert.equal(r[0].restante, 100_000);
  });
});

describe('dinero de las metas', () => {
  const tx = (id: string, amount: number) => ({ id, amount });

  test('vinculado = abonos con movimiento − retiros con movimiento', () => {
    const txs = [
      tx(idAbonoMeta('m1', 1), 300_000), tx(idAbonoMeta('m1', 2), 200_000),
      tx(idRetiroMeta('m1', 3), 100_000), tx(idAbonoMeta('m2', 4), 999_000), tx('otra', 50_000),
    ];
    assert.equal(montoVinculadoMeta(txs, 'm1'), 400_000);
  });

  test('ids con guion bajo no se cruzan entre metas (goal_g1 vs goal_g10)', () => {
    const txs = [tx(idAbonoMeta('goal_g10', 1), 700_000)];
    assert.equal(montoVinculadoMeta(txs, 'goal_g1'), 0);
  });

  test('abonos viejos sin movimiento no se "devuelven" (vinculado 0)', () => {
    assert.equal(montoVinculadoMeta([], 'm1'), 0);
  });

  test('sobrante: mes en curso descuenta pendientes; mes cerrado no', () => {
    const m = { balanceDisponible: 800_000, balanceFinal: 300_000 };
    assert.equal(sobranteParaApartar(m, true), 300_000);
    assert.equal(sobranteParaApartar(m, false), 800_000);
    assert.equal(sobranteParaApartar({ balanceDisponible: -5, balanceFinal: -9 }, false), 0);
  });
});
