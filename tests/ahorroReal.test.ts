/**
 * Ahorro real: que la app nunca muestre ahorro que el usuario no hizo.
 *
 * Lo que estas pruebas protegen: la gráfica "Ahorro acumulado" contaba cada mes
 * sin movimientos como un salario completo ahorrado y truncaba los meses en rojo
 * a 0. Un usuario recién llegado veía 6 salarios "ahorrados".
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAhorroRealMes, getSerieAhorro, compararAhorroMeses, calcularMetricasFinancieras, esCategoriaAhorro,
} from '../src/utils/ingresoUtils.ts';
import { analizarEstadisticas } from '../src/utils/statsCoach.ts';
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

describe('compararAhorroMeses', () => {
  test('mes anterior sin registros → sin datos, sin % y ahorro 0 (no el salario)', () => {
    const c = compararAhorroMeses([mov(1_000_000, 8)], SALARIO, 8, 2026);
    assert.equal(c.anterior.tieneDatos, false);
    assert.equal(c.anterior.ahorro, 0);
    assert.equal(c.cambioGastoPct, null);
  });

  test('ambos meses con la misma regla: ahorro y % de gasto comparables', () => {
    const c = compararAhorroMeses([mov(2_000_000, 7), mov(1_500_000, 8)], SALARIO, 8, 2026);
    assert.equal(c.anterior.ahorro, 2_000_000);
    assert.equal(c.actual.ahorro, 2_500_000);
    assert.equal(c.cambioGastoPct, -25);
  });

  test('enero compara contra diciembre del año anterior', () => {
    const dic: Transaction = { ...mov(1_000_000, 0), date: new Date(2025, 11, 10).toISOString() };
    const c = compararAhorroMeses([dic], SALARIO, 0, 2026);
    assert.equal(c.mesAnterior, 11);
    assert.equal(c.añoAnterior, 2025);
    assert.equal(c.anterior.gastado, 1_000_000);
  });
});

describe('movimientos de ahorro (categoría "Ahorro")', () => {
  const ahorro = (amount: number, type: 'expense' | 'income' = 'expense'): Transaction =>
    ({ ...mov(amount, 8, type), category: 'Ahorro' });

  test('reconoce variantes del nombre', () => {
    assert.ok(esCategoriaAhorro('Ahorro'));
    assert.ok(esCategoriaAhorro('ahorros'));
    assert.ok(esCategoriaAhorro(' Ahorro emergencia'));
    assert.ok(!esCategoriaAhorro('Alimentación'));
    assert.ok(!esCategoriaAhorro(undefined));
  });

  test('apartar como gasto NO baja el ahorro del mes', () => {
    const r = getAhorroRealMes([mov(1_000_000, 8), ahorro(500_000)], SALARIO, 8, 2026);
    assert.equal(r.gastado, 1_000_000);
    assert.equal(r.apartado, 500_000);
    assert.equal(r.ahorro, 3_000_000);
  });

  test('apartar registrado como ingreso NO infla el ingreso', () => {
    const r = getAhorroRealMes([ahorro(500_000, 'income')], SALARIO, 8, 2026);
    assert.equal(r.ingreso, SALARIO);
    assert.equal(r.apartado, 500_000);
  });

  test('motor: lo apartado sale del disponible pero suma al ahorro y no es déficit', () => {
    const m = calcularMetricasFinancieras([mov(3_800_000, 8), ahorro(500_000)], [], SALARIO, 8, 2026);
    assert.equal(m.totalGastado, 3_800_000);
    assert.equal(m.totalApartado, 500_000);
    assert.equal(m.balanceDisponible, -300_000);
    assert.equal(m.enDeficit, false);
    assert.equal(m.ahorroProyectado, 200_000);
  });

  test('motor: un presupuesto de Ahorro no es un compromiso pendiente', () => {
    const cats = [{ name: 'Ahorro', tipo: 'gasto', budget: 800_000, isSelected: true, diaPago: 15, pagado: false }];
    const m = calcularMetricasFinancieras([mov(1_000_000, 8)], cats, SALARIO, 8, 2026);
    assert.equal(m.totalPendiente, 0);
    assert.equal(m.ahorroProyectado, 3_000_000);
  });

  test('Finn en Estadísticas no cuenta lo apartado como gasto', () => {
    const a = analizarEstadisticas({
      transactions: [mov(1_000_000, 8), ahorro(500_000)], categories: [],
      metricas: calcularMetricasFinancieras([], [], SALARIO, 8, 2026),
      mes: 8, año: 2026, barData: [], areaData: [], hoy: HOY,
    });
    assert.equal(a.totalGastosMes, 1_000_000);
  });
});

describe('retiro de ahorro (plata que vuelve de una meta)', () => {
  const mv = (amount: number, category: string, type: 'expense' | 'income'): Transaction =>
    ({ ...mov(amount, 8, type), category });

  test('retirar devuelve al disponible y NO cambia el ahorro del mes', () => {
    const txs = [mov(1_000_000, 8), mv(500_000, 'Ahorro', 'expense'), mv(200_000, 'Retiro de ahorro', 'income')];
    const r = getAhorroRealMes(txs, SALARIO, 8, 2026);
    assert.equal(r.apartado, 300_000);
    assert.equal(r.ingreso, SALARIO);
    assert.equal(r.ahorro, 3_000_000);
    const m = calcularMetricasFinancieras(txs, [], SALARIO, 8, 2026);
    assert.equal(m.totalApartado, 300_000);
    assert.equal(m.balanceDisponible, 2_700_000);
    assert.equal(m.ahorroProyectado, 3_000_000);
  });

  test('Finn en Estadísticas no cuenta el retiro como ingreso', () => {
    const a = analizarEstadisticas({
      transactions: [mv(200_000, 'Retiro de ahorro', 'income')], categories: [],
      metricas: calcularMetricasFinancieras([], [], SALARIO, 8, 2026),
      mes: 8, año: 2026, barData: [], areaData: [], hoy: HOY,
    });
    assert.equal(a.totalIngresosMes, 0);
  });
});
