/**
 * Regresión de la política de PIN (BUG-24) y del cálculo de bloqueo (BUG-16).
 *
 * `validarFortalezaPin` es pura, así que se prueba directamente. La espera
 * exponencial se replica aquí como contrato esperado: si alguien cambia la
 * curva de backoff en PinService, esta prueba lo obliga a hacerlo a conciencia.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validarFortalezaPin, MAX_INTENTOS, calcularEsperaMs } from '../src/utils/pinPolicy.ts';

describe('validarFortalezaPin (BUG-24)', () => {
  test('rechaza los PINs más obvios', () => {
    for (const pin of ['0000', '1111', '1234', '4321', '2580', '1212']) {
      assert.equal(validarFortalezaPin(pin).valido, false, `${pin} debería rechazarse`);
    }
  });

  test('rechaza secuencias ascendentes y descendentes', () => {
    assert.equal(validarFortalezaPin('2345').valido, false);
    assert.equal(validarFortalezaPin('6789').valido, false);
    assert.equal(validarFortalezaPin('9876').valido, false);
  });

  test('rechaza un mismo dígito repetido', () => {
    assert.equal(validarFortalezaPin('7777').valido, false);
  });

  test('rechaza formatos que no son 4 dígitos', () => {
    for (const pin of ['123', '12345', 'abcd', '12a4', '']) {
      assert.equal(validarFortalezaPin(pin).valido, false, `${pin} debería rechazarse`);
    }
  });

  test('acepta PINs razonables', () => {
    for (const pin of ['8317', '2947', '5063', '9142']) {
      const r = validarFortalezaPin(pin);
      assert.equal(r.valido, true, `${pin} debería aceptarse: ${r.motivo ?? ''}`);
    }
  });

  test('siempre explica el motivo del rechazo', () => {
    const r = validarFortalezaPin('1234');
    assert.equal(r.valido, false);
    assert.ok(r.motivo && r.motivo.length > 0, 'debe informar al usuario por qué');
  });
});

describe('curva de bloqueo por intentos (BUG-16)', () => {
  const esperaMs = calcularEsperaMs;

  test('no bloquea antes de agotar los intentos', () => {
    for (let i = 0; i < MAX_INTENTOS; i++) assert.equal(esperaMs(i), 0);
  });

  test('bloquea al alcanzar el máximo y crece exponencialmente', () => {
    assert.equal(esperaMs(5), 1 * 60_000);
    assert.equal(esperaMs(6), 2 * 60_000);
    assert.equal(esperaMs(7), 4 * 60_000);
    assert.equal(esperaMs(8), 8 * 60_000);
  });

  test('la espera tiene un tope de 60 minutos', () => {
    assert.equal(esperaMs(50), 60 * 60_000);
    assert.equal(esperaMs(999), 60 * 60_000);
  });

  test('fuerza bruta de 10.000 combinaciones deja de ser viable', () => {
    // Antes: matar y reabrir la app reiniciaba el contador -> intentos ilimitados.
    // Ahora, tras los primeros fallos cada tanda cuesta minutos de espera.
    let total = 0;
    for (let fallos = MAX_INTENTOS; fallos < MAX_INTENTOS + 20; fallos++) {
      total += esperaMs(fallos);
    }
    const horas = total / 3_600_000;
    assert.ok(horas > 10, `la espera acumulada debería ser prohibitiva, fue ${horas}h`);
  });
});
