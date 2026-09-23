/**
 * Regresión del motor financiero central (BUG-01, BUG-05, BUG-12, BUG-22).
 *
 * `calcularMetricasFinancieras` es la ÚNICA fuente de verdad del balance. Estas
 * pruebas fijan su contrato para que Dashboard, Estadísticas, widget, PDF y
 * Finn no vuelvan a divergir.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularMetricasFinancieras,
  getIngresoEfectivoMes,
  getIngresosExtraMes,
} from '../src/utils/ingresoUtils.ts';
import type { Transaction } from '../src/types/index.ts';

const MES = 8;   // septiembre (0-indexado)
const ANIO = 2026;

const gasto = (amount: number, category = 'Alimentación', dia = 5): Transaction => ({
  id: `g${Math.random()}`, amount, category,
  date: new Date(ANIO, MES, dia).toISOString(), type: 'expense',
});

const ingreso = (amount: number, dia = 3): Transaction => ({
  id: `i${Math.random()}`, amount, category: 'Freelance',
  date: new Date(ANIO, MES, dia).toISOString(), type: 'income',
});

const metricas = (txs: Transaction[], salario: number, cats: any[] = []) =>
  calcularMetricasFinancieras(txs, cats, salario, MES, ANIO);

describe('BUG-01: el déficit ya no se oculta', () => {
  test('gastar más que el ingreso da balance NEGATIVO, no 0', () => {
    const m = metricas([gasto(1_500_000)], 1_000_000);
    // Antes: Math.max(0, ...) devolvía 0 y el usuario no veía el déficit.
    assert.equal(m.balanceDisponible, -500_000);
    assert.equal(m.enDeficit, true);
    assert.equal(m.montoDeficit, 500_000);
  });

  test('el ahorro proyectado nunca es negativo (un déficit no es ahorro)', () => {
    const m = metricas([gasto(1_500_000)], 1_000_000);
    assert.equal(m.ahorroProyectado, 0);
    assert.ok(m.balanceFinal < 0, 'el balance final sí conserva el signo real');
  });

  test('sin déficit, las banderas quedan limpias', () => {
    const m = metricas([gasto(300_000)], 1_000_000);
    assert.equal(m.balanceDisponible, 700_000);
    assert.equal(m.enDeficit, false);
    assert.equal(m.montoDeficit, 0);
  });

  test('gastar exactamente el ingreso no cuenta como déficit', () => {
    const m = metricas([gasto(1_000_000)], 1_000_000);
    assert.equal(m.balanceDisponible, 0);
    assert.equal(m.enDeficit, false);
  });

  test('el presupuesto diario recomendado nunca es negativo', () => {
    const m = metricas([gasto(5_000_000)], 1_000_000);
    assert.ok(m.gastoPromedioRecomendadoDia >= 0);
  });
});

describe('ingreso efectivo = salario base + ingresos extra', () => {
  test('el salario del perfil cuenta aunque no haya transacción de ingreso', () => {
    // Esta es la raíz de BUG-05/BUG-12: las pantallas que sumaban solo
    // transacciones ignoraban el salario y mostraban otro número.
    assert.equal(getIngresoEfectivoMes([], 2_000_000, MES, ANIO), 2_000_000);
  });

  test('los ingresos extra se suman al salario', () => {
    const txs = [ingreso(500_000)];
    assert.equal(getIngresoEfectivoMes(txs, 2_000_000, MES, ANIO), 2_500_000);
    assert.equal(getIngresosExtraMes(txs, MES, ANIO), 500_000);
  });

  test('no se mezclan ingresos de otros meses', () => {
    const otroMes: Transaction = {
      id: 'x', amount: 999_999, category: 'Freelance',
      date: new Date(ANIO, MES - 1, 10).toISOString(), type: 'income',
    };
    assert.equal(getIngresoEfectivoMes([otroMes], 1_000_000, MES, ANIO), 1_000_000);
  });
});

describe('casos límite de la auditoría', () => {
  test('usuario nuevo: sin datos no rompe ni divide por cero', () => {
    const m = metricas([], 0);
    assert.equal(m.ingresoEfectivo, 0);
    assert.equal(m.totalGastado, 0);
    assert.equal(m.porcentajeGastado, 0);
    assert.equal(m.balanceDisponible, 0);
    assert.equal(m.enDeficit, false);
  });

  test('salario 0 con gastos: déficit completo, sin NaN ni Infinity', () => {
    const m = metricas([gasto(50_000)], 0);
    assert.equal(m.balanceDisponible, -50_000);
    assert.equal(m.porcentajeGastado, 0); // sin ingreso no hay porcentaje que calcular
    assert.ok(Number.isFinite(m.porcentajeGastado));
  });

  test('montos de $0 no alteran el balance', () => {
    const m = metricas([gasto(0), ingreso(0)], 1_000_000);
    assert.equal(m.balanceDisponible, 1_000_000);
  });

  test('dos movimientos el mismo día se suman ambos', () => {
    const m = metricas([gasto(10_000, 'Alimentación', 5), gasto(15_000, 'Alimentación', 5)], 1_000_000);
    assert.equal(m.totalGastado, 25_000);
  });

  test('montos grandes se mantienen exactos (sin error de coma flotante)', () => {
    const m = metricas([gasto(999_999_999)], 1_000_000_000);
    assert.equal(m.balanceDisponible, 1);
  });

  test('los porcentajes nunca superan 100 ni bajan de 0', () => {
    const m = metricas([gasto(10_000_000)], 1_000_000);
    assert.ok(m.porcentajeGastado <= 100 && m.porcentajeGastado >= 0);
    assert.ok(m.porcentajeLibre >= 0);
  });
});

describe('consistencia entre pantallas (BUG-05, BUG-12, BUG-22)', () => {
  const txs = [gasto(300_000), gasto(150_000), ingreso(200_000)];
  const salario = 2_000_000;

  test('un mismo conjunto de datos produce un único balance', () => {
    // Dashboard, Estadísticas, ExportarReporte y pdfUtils llaman todos a esta
    // función con los mismos argumentos: por construcción no pueden divergir.
    const a = metricas(txs, salario);
    const b = metricas([...txs], salario);
    assert.equal(a.balanceDisponible, b.balanceDisponible);
    assert.equal(a.ingresoEfectivo, b.ingresoEfectivo);
    assert.equal(a.totalGastado, b.totalGastado);
  });

  test('el balance cuadra con la aritmética esperada', () => {
    const m = metricas(txs, salario);
    assert.equal(m.ingresoEfectivo, salario + 200_000);
    assert.equal(m.totalGastado, 450_000);
    assert.equal(m.balanceDisponible, salario + 200_000 - 450_000);
  });

  test('editar el monto de una transacción cambia el resultado (BUG-13)', () => {
    const antes = metricas([gasto(100_000)], salario);
    const despues = metricas([gasto(400_000)], salario);
    assert.notEqual(antes.balanceDisponible, despues.balanceDisponible);
    assert.equal(antes.balanceDisponible - despues.balanceDisponible, 300_000);
  });
});
