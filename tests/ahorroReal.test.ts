/**
 * Ahorro real: que la app nunca muestre ahorro que el usuario no hizo.
 *
 * Lo que estas pruebas protegen: la gráfica "Ahorro acumulado" contaba cada mes
 * sin movimientos como un salario completo ahorrado y truncaba los meses en rojo
 * a 0. Un usuario recién llegado veía 6 salarios "ahorrados".
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getAhorroRealMes, getSerieAhorro } from '../src/utils/ingresoUtils.ts';
import type { Transaction } from '../src/types/index.ts';

const SALARIO = 4_000_000;
const HOY = new Date(2026, 8, 20); // 20 sep 2026

let seq = 0;
const mov = (amount: number, mes: number, type: 'expense' | 'income' = 'expense', dia = 10): Transaction => ({
  id: String(++seq), amount, category: type === 'income' ? 'Freelance' : 'Mercado',
  date: new Date(2026, mes, dia).toISOString(), type,
});

describe('getAhorroRealMes', () => {
  test('mes sin movimientos → sin datos y ahorro 0 (no el salario)', () => {
    const r = getAhorroRealMes([], SALARIO, 5, 2026);
    assert.equal(r.tieneDatos, false);
    assert.equal(r.ahorro, 0);
  });

  test('usa la convención del motor: salario + ingresos registrados − gastos', () => {
    const r = getAhorroRealMes([mov(1_000_000, 5), mov(500_000, 5, 'income')], SALARIO, 5, 2026);
    assert.equal(r.ingreso, 4_500_000);
    assert.equal(r.ahorro, 3_500_000);
  });

  test('mes en rojo conserva el signo', () => {
    const r = getAhorroRealMes([mov(5_000_000, 5)], SALARIO, 5, 2026);
    assert.equal(r.ahorro, -1_000_000);
  });
});

describe('getSerieAhorro', () => {
  test('usuario sin registros → serie vacía', () => {
    assert.deepEqual(getSerieAhorro([], SALARIO, 6, HOY), []);
  });

  test('usuario nuevo (solo este mes) → un punto, no 6 salarios', () => {
    const s = getSerieAhorro([mov(1_000_000, 8)], SALARIO, 6, HOY);
    assert.equal(s.length, 1);
    assert.equal(s[0].acumulado, 3_000_000);
    assert.equal(s[0].enCurso, true);
  });

  test('mes intermedio sin registros no suma y queda marcado', () => {
    const s = getSerieAhorro([mov(3_000_000, 6), mov(3_000_000, 8)], SALARIO, 6, HOY);
    assert.deepEqual(s.map(p => p.mes), [6, 7, 8]);
    assert.equal(s[1].sinDatos, true);
    assert.equal(s[1].acumulado, 1_000_000);
    assert.equal(s[2].acumulado, 2_000_000);
  });

  test('un mes en rojo resta del acumulado', () => {
    const s = getSerieAhorro([mov(3_000_000, 7), mov(5_000_000, 8)], SALARIO, 6, HOY);
    assert.deepEqual(s.map(p => p.acumulado), [1_000_000, 0]);
  });

  test('cruza el cambio de año', () => {
    const enero = new Date(2027, 0, 15);
    const dic: Transaction = { ...mov(1_000_000, 11), date: new Date(2026, 11, 10).toISOString() };
    const s = getSerieAhorro([dic], SALARIO, 3, enero);
    assert.deepEqual(s.map(p => [p.mes, p.año]), [[11, 2026], [0, 2027]]);
    assert.equal(s[1].sinDatos, true);
  });
});
