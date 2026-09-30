/**
 * Medios de pago (Billetera) — fase 0 de la captura automática de compras.
 * Ejecutar con: npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  contieneNumeroSensible,
  normalizarUltimos4,
  validarMedioPago,
  construirMedioPago,
  etiquetaMedio,
  descripcionMedio,
  mediosActivos,
  medioPredeterminado,
  aplicarPredeterminado,
  tieneMovimientos,
  fechaConDia,
  cicloFacturacion,
  proximaFechaPago,
  diasHasta,
  resumenMedio,
  gastoPorMedio,
  entidadPorId,
  entidadesParaTipo,
} from '../src/utils/mediosPago.ts';
import type { MedioPago, Transaction } from '../src/types/index.ts';

const medio = (id: string, extra: Partial<MedioPago> = {}): MedioPago => ({
  id, tipo: 'debito', entidad: 'bancolombia', alias: 'Débito', color: '#FDDA24',
  predeterminado: false, archivado: false, creadoEn: '2026-09-01T00:00:00.000Z', ...extra,
});

const tx = (id: string, amount: number, date: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id, amount, category: 'Comida', date, type: 'expense', ...extra });

// Fechas locales (el cálculo de ciclos trabaja en hora local del teléfono).
const local = (a: number, m: number, d: number, h = 12) => new Date(a, m - 1, d, h);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('Seguridad: nunca números de tarjeta o cuenta', () => {
  test('detecta un número de tarjeta aunque tenga espacios o guiones', () => {
    assert.equal(contieneNumeroSensible('4111111111111111'), true);
    assert.equal(contieneNumeroSensible('Mi tarjeta 4111 1111 1111 1111'), true);
    assert.equal(contieneNumeroSensible('4111-1111-1111-1111'), true);
    assert.equal(contieneNumeroSensible('Cuenta 123.456.789'), true);
  });

  test('permite alias normales con pocos dígitos', () => {
    assert.equal(contieneNumeroSensible('Visa Oro'), false);
    assert.equal(contieneNumeroSensible('Nequi 2'), false);
    assert.equal(contieneNumeroSensible('Tarjeta 1234'), false);
    assert.equal(contieneNumeroSensible('Mastercard Black 12345'), false);
  });

  test('ultimos4 acepta solo exactamente 4 dígitos', () => {
    assert.equal(normalizarUltimos4('1234'), '1234');
    assert.equal(normalizarUltimos4(' 12-34 '), '1234');
    assert.equal(normalizarUltimos4('123'), null);
    assert.equal(normalizarUltimos4('41111111'), null);
    assert.equal(normalizarUltimos4(''), null);
    assert.equal(normalizarUltimos4(undefined), null);
  });

  test('validarMedioPago rechaza el alias con número completo', () => {
    const r = validarMedioPago({ tipo: 'credito', entidad: 'bancolombia', alias: '4111 1111 1111 1111' });
    assert.equal(r.ok, false);
    assert.match(r.errores.alias!, /seguridad/);
  });

  test('validarMedioPago rechaza ultimos4 inválido', () => {
    const r = validarMedioPago({ tipo: 'debito', entidad: 'bancolombia', alias: 'Débito', ultimos4: '12345' });
    assert.equal(r.ok, false);
    assert.ok(r.errores.ultimos4);
  });
});

describe('validarMedioPago', () => {
  test('acepta una tarjeta de crédito completa', () => {
    const r = validarMedioPago({
      tipo: 'credito', entidad: 'davivienda', alias: 'Visa Oro', ultimos4: '9876',
      franquicia: 'visa', cupo: 5_000_000, diaCorte: 15, diaPago: 5,
    });
    assert.deepEqual(r, { ok: true, errores: {} });
  });

  test('exige alias y entidad conocida', () => {
    const r = validarMedioPago({ tipo: 'billetera', entidad: 'inventada', alias: '   ' });
    assert.equal(r.ok, false);
    assert.ok(r.errores.alias);
    assert.ok(r.errores.entidad);
  });

  test('días de corte y pago entre 1 y 31', () => {
    const r = validarMedioPago({ tipo: 'credito', entidad: 'bbva', alias: 'TC', diaCorte: 0, diaPago: 32 });
    assert.ok(r.errores.diaCorte);
    assert.ok(r.errores.diaPago);
  });

  test('efectivo no lleva número', () => {
    const r = validarMedioPago({ tipo: 'efectivo', entidad: 'efectivo', alias: 'Efectivo', ultimos4: '1234' });
    assert.ok(r.errores.ultimos4);
  });
});

describe('construirMedioPago', () => {
  const ahora = new Date('2026-09-30T15:00:00.000Z');

  test('el primero queda como predeterminado y toma el color de la entidad', () => {
    const m = construirMedioPago({ tipo: 'billetera', entidad: 'nequi', alias: 'Nequi' }, [], ahora);
    assert.equal(m.predeterminado, true);
    assert.equal(m.color, entidadPorId('nequi').color);
    assert.equal(m.id, `pm_${ahora.getTime()}`);
  });

  test('los siguientes no son predeterminados', () => {
    const m = construirMedioPago({ tipo: 'billetera', entidad: 'nequi', alias: 'Nequi' }, [medio('a')], ahora);
    assert.equal(m.predeterminado, false);
  });

  test('un archivado no cuenta para decidir el predeterminado', () => {
    const m = construirMedioPago({ tipo: 'billetera', entidad: 'nequi', alias: 'Nequi' }, [medio('a', { archivado: true })], ahora);
    assert.equal(m.predeterminado, true);
  });

  test('descarta campos que no aplican al tipo (coincide con los CHECK del servidor)', () => {
    const m = construirMedioPago({
      tipo: 'debito', entidad: 'bancolombia', alias: 'Débito', franquicia: 'visa',
      cupo: 100, diaCorte: 10, diaPago: 20, ultimos4: '1234',
    }, [], ahora);
    assert.equal(m.franquicia, 'visa');
    assert.equal(m.ultimos4, '1234');
    assert.equal(m.cupo, undefined);
    assert.equal(m.diaCorte, undefined);
    assert.equal(m.diaPago, undefined);

    const b = construirMedioPago({ tipo: 'billetera', entidad: 'nequi', alias: 'Nequi', franquicia: 'visa' }, [], ahora);
    assert.equal(b.franquicia, undefined);
  });

  test('editar conserva el id', () => {
    const m = construirMedioPago({ tipo: 'credito', entidad: 'bbva', alias: 'TC' }, [medio('pm_1')], ahora, 'pm_1');
    assert.equal(m.id, 'pm_1');
    assert.equal(m.predeterminado, true, 'excluye el propio medio al contar activos');
  });
});

describe('Presentación y colección', () => {
  test('etiquetas', () => {
    assert.equal(etiquetaMedio({ alias: 'Visa Oro', ultimos4: '1234' }), 'Visa Oro ••1234');
    assert.equal(etiquetaMedio({ alias: 'Efectivo' }), 'Efectivo');
    assert.equal(
      descripcionMedio(medio('x', { tipo: 'credito', franquicia: 'visa', entidad: 'bancolombia' })),
      'Crédito · Visa · Bancolombia',
    );
    assert.equal(descripcionMedio(medio('x', { tipo: 'efectivo', entidad: 'efectivo' })), 'Efectivo');
  });

  test('entidadesParaTipo filtra el catálogo', () => {
    const billeteras = entidadesParaTipo('billetera').map(e => e.id);
    assert.ok(billeteras.includes('nequi'));
    assert.ok(billeteras.includes('daviplata'));
    assert.ok(!billeteras.includes('bbva'));
  });

  test('mediosActivos: predeterminado primero, sin archivados', () => {
    const lista = mediosActivos([
      medio('a', { creadoEn: '2026-01-01' }),
      medio('b', { creadoEn: '2026-02-01', predeterminado: true }),
      medio('c', { archivado: true }),
    ]);
    assert.deepEqual(lista.map(m => m.id), ['b', 'a']);
  });

  test('medioPredeterminado ignora archivados', () => {
    assert.equal(medioPredeterminado([medio('a', { predeterminado: true, archivado: true })]), null);
    assert.equal(medioPredeterminado([medio('a'), medio('b', { predeterminado: true })])?.id, 'b');
  });

  test('aplicarPredeterminado devuelve solo los cambiados', () => {
    const cambios = aplicarPredeterminado([medio('a', { predeterminado: true }), medio('b'), medio('c')], 'b');
    assert.deepEqual(cambios.map(m => [m.id, m.predeterminado]), [['a', false], ['b', true]]);
  });

  test('tieneMovimientos', () => {
    const txs = [tx('1', 100, '2026-09-01T12:00:00Z', { paymentMethodId: 'a' })];
    assert.equal(tieneMovimientos('a', txs), true);
    assert.equal(tieneMovimientos('b', txs), false);
  });
});

describe('Fechas de tarjeta de crédito', () => {
  test('fechaConDia ajusta meses cortos', () => {
    assert.equal(ymd(fechaConDia(2026, 1, 31)), '2026-02-28');
    assert.equal(ymd(fechaConDia(2028, 1, 31)), '2028-02-29');
    assert.equal(ymd(fechaConDia(2026, 12, 5)), '2027-01-05', 'desborde de mes pasa al año siguiente');
  });

  test('ciclo antes del corte: termina este mes', () => {
    const c = cicloFacturacion(15, local(2026, 9, 10));
    assert.equal(ymd(c.inicio), '2026-08-16');
    assert.equal(ymd(c.fin), '2026-09-15');
  });

  test('ciclo el mismo día del corte lo incluye', () => {
    const c = cicloFacturacion(15, local(2026, 9, 15, 23));
    assert.equal(ymd(c.fin), '2026-09-15');
  });

  test('ciclo después del corte: termina el mes siguiente', () => {
    const c = cicloFacturacion(15, local(2026, 9, 20));
    assert.equal(ymd(c.inicio), '2026-09-16');
    assert.equal(ymd(c.fin), '2026-10-15');
  });

  test('corte 31 en febrero y cambio de año', () => {
    const feb = cicloFacturacion(31, local(2026, 2, 10));
    assert.equal(ymd(feb.inicio), '2026-02-01');
    assert.equal(ymd(feb.fin), '2026-02-28');
    const dic = cicloFacturacion(5, local(2026, 12, 20));
    assert.equal(ymd(dic.inicio), '2026-12-06');
    assert.equal(ymd(dic.fin), '2027-01-05');
  });

  test('próxima fecha de pago', () => {
    assert.equal(ymd(proximaFechaPago(5, local(2026, 9, 3))), '2026-09-05');
    assert.equal(ymd(proximaFechaPago(5, local(2026, 9, 5))), '2026-09-05');
    assert.equal(ymd(proximaFechaPago(5, local(2026, 9, 6))), '2026-10-05');
    assert.equal(diasHasta(proximaFechaPago(5, local(2026, 9, 30)), local(2026, 9, 30)), 5);
  });
});

describe('Resúmenes', () => {
  const hoy = local(2026, 9, 20);
  const txs: Transaction[] = [
    tx('1', 100_000, local(2026, 9, 18).toISOString(), { paymentMethodId: 'tc' }),
    tx('2', 50_000, local(2026, 9, 10).toISOString(), { paymentMethodId: 'tc' }),   // ciclo anterior
    tx('3', 30_000, local(2026, 9, 17).toISOString(), { paymentMethodId: 'tc', type: 'income' }),
    tx('4', 20_000, local(2026, 9, 19).toISOString(), { paymentMethodId: 'nequi' }),
    tx('5', 10_000, local(2026, 9, 19).toISOString()),
    tx('6', 99_000, local(2026, 8, 30).toISOString(), { paymentMethodId: 'tc' }),   // mes anterior
  ];

  test('débito: gasto del mes, sin ciclo ni cupo', () => {
    const r = resumenMedio(medio('nequi', { tipo: 'billetera' }), txs, hoy);
    assert.equal(r.gastoMes, 20_000);
    assert.equal(r.movimientosMes, 1);
    assert.equal(r.ciclo, undefined);
    assert.equal(r.cupo, undefined);
  });

  test('crédito: ciclo, cupo y próximo pago', () => {
    const tc = medio('tc', { tipo: 'credito', cupo: 1_000_000, diaCorte: 15, diaPago: 5 });
    const r = resumenMedio(tc, txs, hoy);
    assert.equal(r.gastoMes, 150_000, 'mes calendario: 18 y 10 de sep (el ingreso no cuenta)');
    assert.equal(r.ciclo?.gasto, 100_000, 'ciclo 16 sep – 15 oct: solo el del 18');
    assert.deepEqual(r.cupo, { total: 1_000_000, usado: 100_000, disponible: 900_000, pct: 0.1 });
    assert.equal(ymd(r.proximoPago!.fecha), '2026-10-05');
    assert.equal(r.proximoPago!.dias, 15);
  });

  test('crédito sin día de corte usa el mes para el cupo; el cupo no baja de 0', () => {
    const tc = medio('tc', { tipo: 'credito', cupo: 100_000 });
    const r = resumenMedio(tc, txs, hoy);
    assert.equal(r.cupo?.usado, 150_000);
    assert.equal(r.cupo?.disponible, 0);
    assert.equal(r.cupo?.pct, 1);
  });

  test('gastoPorMedio agrupa el mes, incluye "sin medio" y ordena', () => {
    const g = gastoPorMedio(txs, 2026, 8);
    assert.deepEqual(g, [
      { medioId: 'tc', total: 150_000, n: 2 },
      { medioId: 'nequi', total: 20_000, n: 1 },
      { medioId: null, total: 10_000, n: 1 },
    ]);
  });
});
