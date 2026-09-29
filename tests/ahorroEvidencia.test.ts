/**
 * Evidencia de ahorro: el cambio se mide contra una línea base honesta.
 *
 * Lo que estas pruebas protegen: que la app no afirme "ahorras más con Finn"
 * sin un punto de partida real, y que el mes a medias en que el usuario empezó
 * a registrar (ahorro inflado) nunca se use como base.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getSerieAhorro, gastosConsumoPorCategoria } from '../src/utils/ingresoUtils.ts';
import {
  resolverPuntoPartida, puntoPartidaDeclarado, calcularEvidenciaAhorro, calcularDesgloseMes, calcularHitos,
  rachaMesesAhorrando, mensajeCierreMes, textoCompartirLogro,
} from '../src/utils/ahorroEvidencia.ts';
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

describe('calcularDesgloseMes', () => {
  const base = { comprasEvitadas: [], apartado: 0, fraccionMes: 1 };

  test('detecta categorías con gasto menor a su promedio (top 3, sin ruido)', () => {
    const d = calcularDesgloseMes({
      ...base,
      gastoPorCategoria: { Domicilios: 100_000, Mercado: 795_000, Ropa: 0 },
      previos: [{ Domicilios: 300_000, Mercado: 800_000, Ropa: 150_000 }, { Domicilios: 260_000, Mercado: 800_000, Ropa: 50_000 }],
    });
    assert.deepEqual(d.acciones.map(a => [a.titulo, a.monto]), [
      ['Gastaste menos en Domicilios que tu promedio', 180_000],
      ['Gastaste menos en Ropa que tu promedio', 100_000],
    ]);
    assert.equal(d.gastoEvitado, 280_000);
  });

  test('sin meses previos no se afirma "gastaste menos"', () => {
    const d = calcularDesgloseMes({ ...base, gastoPorCategoria: {}, previos: [] });
    assert.equal(d.acciones.length, 0);
  });

  test('mes en curso temprano (<80%) no compara: evitaría falsos positivos', () => {
    const d = calcularDesgloseMes({
      ...base, fraccionMes: 0.5, gastoPorCategoria: {}, previos: [{ Arriendo: 1_500_000 }],
    });
    assert.equal(d.acciones.length, 0);
  });

  test('compras evitadas suman al gasto evitado; lo apartado va aparte', () => {
    const d = calcularDesgloseMes({
      ...base, gastoPorCategoria: {}, previos: [],
      comprasEvitadas: [{ monto: 250_000 }], apartado: 400_000,
    });
    assert.equal(d.gastoEvitado, 250_000);
    assert.equal(d.apartado, 400_000);
    assert.deepEqual(d.acciones.map(a => a.tipo), ['compra_evitada', 'apartado']);
  });
});

describe('gastosConsumoPorCategoria', () => {
  test('sin registros → null; excluye movimientos de ahorro', () => {
    assert.equal(gastosConsumoPorCategoria([], 8, 2026), null);
    const g = gastosConsumoPorCategoria([
      gasto(100_000, 8), { ...gasto(500_000, 8), category: 'Ahorro' },
    ], 8, 2026);
    assert.deepEqual(g, { Mercado: 100_000 });
  });
});

describe('calcularHitos', () => {
  const hito = (hs: ReturnType<typeof calcularHitos>, id: string) => hs.find(h => h.id === id)!.alcanzado;

  test('usuario nuevo: ningún hito (el mes de arranque no cuenta)', () => {
    const hs = calcularHitos(serie([gasto(100_000, 8, 2)]), null);
    assert.ok(hs.every(h => !h.alcanzado));
  });

  test('3 meses seguidos positivos y primer millón con meses cerrados', () => {
    const s = serie([gasto(100_000, 4, 28), gasto(3_600_000, 5), gasto(3_500_000, 6), gasto(3_400_000, 7)]);
    const hs = calcularHitos(s, resolverPuntoPartida(undefined, s));
    assert.equal(hito(hs, 'mes_positivo'), true);
    assert.equal(hito(hs, 'tres_seguidos'), true);
    assert.equal(hito(hs, 'primer_millon'), true);   // 400k + 500k + 600k
    assert.equal(hito(hs, 'supera_base'), true);     // jul/ago > base de junio (400k)
  });

  test('un mes sin registros corta la racha', () => {
    const s = serie([gasto(100_000, 2, 28), gasto(3_000_000, 3), gasto(3_000_000, 4), gasto(3_000_000, 6)]);
    assert.equal(hito(calcularHitos(s, null), 'tres_seguidos'), false);
  });
});

describe('rachaMesesAhorrando', () => {
  test('cuenta meses cerrados seguidos en positivo hasta el último cerrado', () => {
    const s = serie([gasto(100_000, 3, 28), gasto(5_000_000, 4), gasto(3_000_000, 5), gasto(3_000_000, 6), gasto(3_000_000, 7)]);
    assert.equal(rachaMesesAhorrando(s), 3); // jun, jul, ago (may fue negativo)
  });

  test('no registrar NO suma racha (antes premiaba días sin gastos)', () => {
    const s = serie([gasto(100_000, 3, 28), gasto(3_000_000, 4), gasto(3_000_000, 5)]); // jul y ago sin datos
    assert.equal(rachaMesesAhorrando(s), 0);
  });

  test('el mes de arranque y el mes en curso no cuentan', () => {
    assert.equal(rachaMesesAhorrando(serie([gasto(100_000, 7, 20), gasto(100_000, 8)])), 0);
  });
});

describe('mensajeCierreMes', () => {
  test('mes cerrado por encima de la base: cifra y % frente al punto de partida', () => {
    const m = mensajeCierreMes({ nombreMes: 'Agosto', ahorroMes: 900_000, base: 600_000, cerrado: true });
    assert.equal(m.titulo, 'Cerraste Agosto ahorrando $900.000');
    assert.match(m.cuerpo, /\$300\.000 más que tu punto de partida \(\+50%\)/);
  });

  test('mes cerrado por debajo de la base: lo dice sin maquillar', () => {
    const m = mensajeCierreMes({ nombreMes: 'Agosto', ahorroMes: 200_000, base: 600_000, cerrado: true });
    assert.match(m.cuerpo, /\$400\.000 por debajo/);
  });

  test('mes en rojo', () => {
    const m = mensajeCierreMes({ nombreMes: 'Agosto', ahorroMes: -150_000, base: null, cerrado: true });
    assert.equal(m.titulo, 'Agosto cerró en rojo');
    assert.match(m.cuerpo, /\$150\.000/);
  });

  test('sin punto de partida no inventa la comparación', () => {
    const m = mensajeCierreMes({ nombreMes: 'Agosto', ahorroMes: 500_000, base: null, cerrado: true });
    assert.doesNotMatch(m.cuerpo, /punto de partida/);
  });

  test('penúltimo día: "vas ahorrando" con la cifra en curso', () => {
    const m = mensajeCierreMes({ nombreMes: 'septiembre', ahorroMes: 700_000, base: 500_000, cerrado: false });
    assert.equal(m.titulo, 'Mañana cierra el mes');
    assert.match(m.cuerpo, /^Vas ahorrando \$700\.000, \$200\.000 más que tu punto de partida/);
  });
});

describe('textoCompartirLogro', () => {
  const base = puntoPartidaDeclarado(500_000, HOY);

  test('comparte % de mejora, racha e hito — NUNCA montos', () => {
    const t = textoCompartirLogro({
      evidencia: { estado: 'listo', mejoraMensual: 250_000, base }, racha: 3, hito: 'Primer millón ahorrado',
    })!;
    assert.match(t, /Ahorro un 50% más al mes/);
    assert.match(t, /3 meses seguidos/);
    assert.match(t, /Primer millón ahorrado/);
    assert.doesNotMatch(t, /\$\s?\d/); // ningún monto en pesos
  });

  test('base declarada en 0: mensaje sin porcentaje infinito', () => {
    const t = textoCompartirLogro({
      evidencia: { estado: 'listo', mejoraMensual: 300_000, base: puntoPartidaDeclarado(0, HOY) }, racha: 0,
    })!;
    assert.match(t, /Antes no ahorraba nada/);
  });

  test('sin logro real → null (no hay botón de compartir)', () => {
    assert.equal(textoCompartirLogro({ evidencia: { estado: 'listo', mejoraMensual: -10, base }, racha: 1 }), null);
    assert.equal(textoCompartirLogro({ evidencia: { estado: 'sin_base', mejoraMensual: 0, base: null }, racha: 0 }), null);
  });
});
