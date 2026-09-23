/**
 * Regresión de la resolución de transacciones de Finn (BUG-03).
 *
 * El riesgo original: cuando el modelo no resolvía el id, la app modificaba la
 * ÚLTIMA transacción del usuario —sin relación con lo pedido y sin confirmar—
 * e informaba éxito. Estas pruebas fijan que ante cualquier ambigüedad NO se
 * toque nada.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolverTransaccionesCandidatas } from '../src/utils/categoryResolver.ts';
import type { Transaction } from '../src/types/index.ts';

const tx = (
  id: string, amount: number, category: string, dia: number,
  type: 'income' | 'expense' = 'expense',
): Transaction => ({
  id, amount, category, type,
  date: new Date(2026, 8, dia).toISOString(),
});

const datos: Transaction[] = [
  tx('t1', 30_000,  'Alimentación', 1),
  tx('t2', 50_000,  'Transporte',   5),
  tx('t3', 120_000, 'Servicios',    9),
  tx('t4', 90_000,  'Alimentación', 12),
];

describe('resolución por id', () => {
  test('un id existente resuelve exactamente esa transacción', () => {
    const r = resolverTransaccionesCandidatas({ id: 't2' }, datos);
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 't2');
  });

  test('un id inventado por el modelo no resuelve nada', () => {
    // Antes esto caía al fallback y terminaba tocando `sorted[0]`.
    const r = resolverTransaccionesCandidatas({ id: 'inventado-999' }, datos);
    assert.equal(r.length, 0);
  });
});

describe('sin id: no se adivina', () => {
  test('sin ningún criterio no devuelve candidatos', () => {
    assert.equal(resolverTransaccionesCandidatas({}, datos).length, 0);
  });

  test('una petición vaga no selecciona la última transacción', () => {
    const r = resolverTransaccionesCandidatas({ descripcion: 'el gasto de ayer' }, datos);
    assert.equal(r.length, 0, 'no debe elegir ninguna por su cuenta');
  });

  test('categoría con varias coincidencias devuelve TODAS (ambiguo)', () => {
    const r = resolverTransaccionesCandidatas({ categoria: 'Alimentación' }, datos);
    assert.equal(r.length, 2, 'quien llama debe pedir aclaración, no elegir');
  });

  test('categoría con una sola coincidencia resuelve sin ambigüedad', () => {
    const r = resolverTransaccionesCandidatas({ categoria: 'Servicios' }, datos);
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 't3');
  });

  test('categoría + monto identifican una transacción concreta', () => {
    const r = resolverTransaccionesCandidatas(
      { categoria: 'Alimentación', monto_original: 90_000 }, datos,
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 't4');
  });

  test('tolera diferencias de tildes y mayúsculas', () => {
    const r = resolverTransaccionesCandidatas({ categoria: 'alimentacion', monto_original: 30_000 }, datos);
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 't1');
  });

  test('un monto que no existe no devuelve nada', () => {
    const r = resolverTransaccionesCandidatas({ categoria: 'Alimentación', monto_original: 777 }, datos);
    assert.equal(r.length, 0);
  });

  test('duplicados exactos resuelven a la más reciente', () => {
    const conDuplicados = [...datos, tx('t5', 90_000, 'Alimentación', 20)];
    const r = resolverTransaccionesCandidatas(
      { categoria: 'Alimentación', monto_original: 90_000 }, conDuplicados,
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 't5', 'la más reciente es la que el usuario acaba de crear');
  });

  test('el filtro por tipo se respeta', () => {
    const conIngreso = [...datos, tx('t6', 30_000, 'Alimentación', 2, 'income')];
    const r = resolverTransaccionesCandidatas(
      { categoria: 'Alimentación', monto_original: 30_000, tipo: 'income' }, conIngreso,
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 't6');
  });
});

describe('garantía anti-regresión', () => {
  test('ninguna entrada ambigua devuelve jamás exactamente 1 candidato', () => {
    // Si alguien reintrodujera un fallback tipo `sorted[0]`, estas entradas
    // volverían a resolver a 1 y la prueba fallaría.
    const entradasVagas = [
      {},
      { descripcion: 'eso' },
      { motivo: 'me equivoqué' },
      { monto: 5000 },              // `monto` es el valor NUEVO, no identifica
    ];
    for (const entrada of entradasVagas) {
      const r = resolverTransaccionesCandidatas(entrada, datos);
      assert.notEqual(r.length, 1, `entrada vaga no debe resolver a una sola: ${JSON.stringify(entrada)}`);
    }
  });
});
