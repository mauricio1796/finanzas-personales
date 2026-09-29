/**
 * Evidencia de ahorro: el cambio se mide contra una línea base honesta.
 *
 * Lo que estas pruebas protegen: que la app no afirme "ahorras más con Finn"
 * sin un punto de partida real, y que el mes a medias en que el usuario empezó
 * a registrar (ahorro inflado) nunca se use como base.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getSerieAhorro } from '../src/utils/ingresoUtils.ts';
import { resolverPuntoPartida, puntoPartidaDeclarado, calcularEvidenciaAhorro } from '../src/utils/ahorroEvidencia.ts';
import type { Transaction } from '../src/types/index.ts';

const SALARIO = 4_000_000;
const HOY = new Date(2026, 8, 20); // 20 sep 2026

let seq = 0;
const gasto = (amount: number, mes: number, dia = 10): Transaction => ({
  id: String(++seq), amount, category: 'Mercado', type: 'expense',
  date: new Date(2026, mes, dia).toISOString(),
});
const serie = (txs: Transaction[]) => getSerieAhorro(txs, SALARIO, 24, HOY);

describe('resolverPuntoPartida', () => {
  test('lo declarado por el usuario manda', () => {
    const d = puntoPartidaDeclarado(150_000, HOY);
    assert.deepEqual(resolverPuntoPartida(d, serie([gasto(1_000_000, 6), gasto(1_000_000, 7)])), d);
  });

  test('declarar "nada" es una base válida de 0', () => {
    const d = puntoPartidaDeclarado(0, HOY);
    assert.equal(resolverPuntoPartida(d, [])?.ahorroMensual, 0);
  });

  test('sin declarar: usa el primer mes COMPLETO, no el de arranque (parcial)', () => {
    // Empezó el 25 de junio (mes parcial, "ahorro" inflado); julio es su primer mes completo.
    const p = resolverPuntoPartida(undefined, serie([
      gasto(200_000, 5, 25), gasto(3_600_000, 6), gasto(3_000_000, 7),
    ]));
    assert.equal(p?.fuente, 'calculado');
    assert.equal(p?.ahorroMensual, 400_000);
    assert.equal(new Date(p!.fecha).getMonth(), 6);
  });

  test('sin un mes completo cerrado todavía → null (no se afirma nada)', () => {
    assert.equal(resolverPuntoPartida(undefined, serie([gasto(500_000, 7, 20), gasto(500_000, 8)])), null);
    assert.equal(resolverPuntoPartida(null, []), null);
  });

  test('salta meses sin registros al buscar la base', () => {
    const p = resolverPuntoPartida(undefined, serie([gasto(100_000, 4, 28), gasto(3_500_000, 6)]));
    assert.equal(new Date(p!.fecha).getMonth(), 6);
    assert.equal(p?.ahorroMensual, 500_000);
  });

  test('declarado se normaliza: sin negativos, redondeado', () => {
    assert.equal(puntoPartidaDeclarado(-5, HOY).ahorroMensual, 0);
    assert.equal(puntoPartidaDeclarado(1234.6, HOY).ahorroMensual, 1235);
  });
});

describe('calcularEvidenciaAhorro', () => {
  // Arranca el 25 de mayo (parcial). Junio es el primer mes completo.
  const txs = [
    gasto(200_000, 4, 25),        // may (arranque, parcial: no cuenta)
    gasto(3_600_000, 5),          // jun: ahorra 400k
    gasto(3_400_000, 6),          // jul: ahorra 600k
    gasto(3_200_000, 7),          // ago: ahorra 800k
    gasto(500_000, 8),            // sep (en curso: no cuenta)
  ];

  test('sin base → sin_base, no afirma nada', () => {
    const ev = calcularEvidenciaAhorro(serie([]), null);
    assert.equal(ev.estado, 'sin_base');
    assert.equal(ev.extraAcumulado, 0);
  });

  test('base calculada (junio): mide jul y ago contra 400k', () => {
    const s = serie(txs);
    const ev = calcularEvidenciaAhorro(s, resolverPuntoPartida(undefined, s));
    assert.equal(ev.estado, 'listo');
    assert.equal(ev.mesesMedidos, 2);
    assert.equal(ev.extraAcumulado, 200_000 + 400_000);
    assert.equal(ev.promedioMensual, 700_000);
    assert.equal(ev.mejoraMensual, 300_000);
  });

  test('base declarada en el onboarding: cuenta desde ese mes, sin el de arranque', () => {
    const d = puntoPartidaDeclarado(300_000, new Date(2026, 4, 25));
    const ev = calcularEvidenciaAhorro(serie(txs), d);
    assert.deepEqual(ev.meses.map(p => p.mes), [5, 6, 7]);
    assert.equal(ev.extraAcumulado, 100_000 + 300_000 + 500_000);
  });

  test('ahorrar menos que antes da un número negativo (honesto)', () => {
    const d = puntoPartidaDeclarado(1_000_000, new Date(2026, 4, 25));
    const ev = calcularEvidenciaAhorro(serie(txs), d);
    assert.ok(ev.extraAcumulado < 0);
    assert.equal(ev.extraAcumulado, -600_000 - 400_000 - 200_000);
  });

  test('con base pero sin mes cerrado posterior → midiendo', () => {
    const s = serie([gasto(200_000, 6, 25), gasto(3_600_000, 7), gasto(100_000, 8)]);
    const ev = calcularEvidenciaAhorro(s, resolverPuntoPartida(undefined, s));
    assert.equal(ev.estado, 'midiendo');
    assert.equal(ev.base?.ahorroMensual, 400_000);
  });
});
