/**
 * Regresión de la relación transacción → categoría (BUG-10, BUG-21).
 * Ejecutar con: npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarNombre,
  encontrarCategoriaDeTx,
  migrarTransaccionesACategoryId,
  renombrarCategoriaEnTransacciones,
} from '../src/utils/categoryResolver.ts';
import type { Category, Transaction } from '../src/types/index.ts';

const cat = (id: string, name: string): Category =>
  ({ id, name, isSelected: true, tipo: 'gasto' }) as Category;

const tx = (id: string, category: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id, amount: 1000, category, date: '2026-09-01T10:00:00.000Z', type: 'expense', ...extra });

describe('normalizarNombre', () => {
  test('ignora tildes, mayúsculas y espacios sobrantes', () => {
    assert.equal(normalizarNombre('  Alimentación '), 'alimentacion');
    assert.equal(normalizarNombre('ALIMENTACION'), 'alimentacion');
    assert.equal(normalizarNombre('Educación'), 'educacion');
  });

  test('tolera valores vacíos sin lanzar', () => {
    assert.equal(normalizarNombre(undefined), '');
    assert.equal(normalizarNombre(null), '');
    assert.equal(normalizarNombre(''), '');
  });
});

describe('encontrarCategoriaDeTx', () => {
  const cats = [cat('c1', 'Alimentación'), cat('c2', 'Transporte')];

  test('prefiere categoryId cuando existe', () => {
    const encontrada = encontrarCategoriaDeTx(tx('t1', 'NombreViejo', { categoryId: 'c1' }), cats);
    assert.equal(encontrada?.id, 'c1');
  });

  test('resuelve por nombre exacto', () => {
    assert.equal(encontrarCategoriaDeTx(tx('t2', 'Transporte'), cats)?.id, 'c2');
  });

  test('BUG-21: resuelve pese a diferencias de tildes y mayúsculas', () => {
    assert.equal(encontrarCategoriaDeTx(tx('t3', 'alimentacion'), cats)?.id, 'c1');
    assert.equal(encontrarCategoriaDeTx(tx('t4', ' ALIMENTACIÓN '), cats)?.id, 'c1');
  });

  test('resuelve un id guardado en category por versiones antiguas', () => {
    assert.equal(encontrarCategoriaDeTx(tx('t5', 'c2'), cats)?.id, 'c2');
  });

  test('devuelve undefined si la categoría ya no existe', () => {
    assert.equal(encontrarCategoriaDeTx(tx('t6', 'Borrada'), cats), undefined);
  });
});

describe('migrarTransaccionesACategoryId', () => {
  const cats = [cat('c1', 'Alimentación'), cat('c2', 'Transporte')];

  test('asigna categoryId y canoniza el nombre visible', () => {
    const migradas = migrarTransaccionesACategoryId([tx('t1', 'alimentacion')], cats);
    assert.ok(migradas);
    assert.equal(migradas![0].categoryId, 'c1');
    assert.equal(migradas![0].category, 'Alimentación');
  });

  test('es idempotente: no reescribe lo ya migrado', () => {
    const ya = [tx('t1', 'Alimentación', { categoryId: 'c1' })];
    assert.equal(migrarTransaccionesACategoryId(ya, cats), null);
  });

  test('no pierde el histórico de una categoría eliminada', () => {
    const huerfana = tx('t9', 'CategoriaBorrada');
    const migradas = migrarTransaccionesACategoryId([huerfana], cats);
    // Sin cambios que aplicar: la transacción conserva su nombre original.
    assert.equal(migradas, null);
    assert.equal(huerfana.category, 'CategoriaBorrada');
  });

  test('sin categorías no intenta migrar nada', () => {
    assert.equal(migrarTransaccionesACategoryId([tx('t1', 'Lo que sea')], []), null);
  });

  test('no altera el monto ni el tipo al migrar', () => {
    const original = tx('t1', 'alimentacion', { amount: 45_000, type: 'expense' });
    const migradas = migrarTransaccionesACategoryId([original], cats)!;
    assert.equal(migradas[0].amount, 45_000);
    assert.equal(migradas[0].type, 'expense');
    assert.equal(migradas[0].id, 't1');
  });
});

describe('renombrarCategoriaEnTransacciones (BUG-10)', () => {
  test('el gasto histórico sigue a la categoría renombrada', () => {
    const txs = [
      tx('t1', 'Alimentación', { categoryId: 'c1' }),
      tx('t2', 'Transporte',   { categoryId: 'c2' }),
    ];
    const res = renombrarCategoriaEnTransacciones(txs, 'c1', 'Alimentación', 'Comida')!;
    assert.equal(res[0].category, 'Comida');
    assert.equal(res[0].categoryId, 'c1');
    // La otra categoría no se toca.
    assert.equal(res[1].category, 'Transporte');
  });

  test('también arrastra transacciones aún sin migrar, por nombre anterior', () => {
    const txs = [tx('t1', 'alimentacion')]; // sin categoryId
    const res = renombrarCategoriaEnTransacciones(txs, 'c1', 'Alimentación', 'Comida')!;
    assert.equal(res[0].category, 'Comida');
    assert.equal(res[0].categoryId, 'c1');
  });

  test('renombrar al mismo nombre no genera cambios', () => {
    const txs = [tx('t1', 'Alimentación', { categoryId: 'c1' })];
    assert.equal(renombrarCategoriaEnTransacciones(txs, 'c1', 'Alimentación', 'Alimentación'), null);
  });

  test('el total gastado de la categoría se conserva tras el rename', () => {
    const txs = [
      tx('t1', 'Alimentación', { categoryId: 'c1', amount: 30_000 }),
      tx('t2', 'Alimentación', { categoryId: 'c1', amount: 20_000 }),
    ];
    const totalAntes = txs
      .filter(t => t.category === 'Alimentación')
      .reduce((s, t) => s + t.amount, 0);

    const res = renombrarCategoriaEnTransacciones(txs, 'c1', 'Alimentación', 'Mercado')!;
    const totalDespues = res
      .filter(t => t.category === 'Mercado')
      .reduce((s, t) => s + t.amount, 0);

    assert.equal(totalAntes, 50_000);
    // Antes de la corrección esto daba 0: el histórico desaparecía del presupuesto.
    assert.equal(totalDespues, 50_000);
  });
});
