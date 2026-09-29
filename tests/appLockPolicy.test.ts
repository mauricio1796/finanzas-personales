/**
 * Bloqueo por inactividad.
 *
 * Lo que estas pruebas protegen: que la app pida PIN/Face ID tras el tiempo
 * elegido, que no lo haga por salidas breves o intencionales (cámara,
 * compartir), y que un reloj manipulado no sirva para evitar el bloqueo.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { debeBloquear, graciaMs, esOpcionBloqueo, OPCION_BLOQUEO_DEFAULT } from '../src/utils/appLockPolicy.ts';

const T0 = 1_000_000;

describe('debeBloquear', () => {
  test('por defecto: 1 minuto de gracia', () => {
    assert.equal(OPCION_BLOQUEO_DEFAULT, '1min');
    assert.equal(debeBloquear(T0, T0 + 59_000, '1min'), false);
    assert.equal(debeBloquear(T0, T0 + 60_000, '1min'), true);
  });

  test('"Al salir" bloquea siempre que la app estuvo en segundo plano', () => {
    assert.equal(debeBloquear(T0, T0, 'inmediato'), true);
    assert.equal(debeBloquear(T0, T0 + 500, 'inmediato'), true);
  });

  test('5 minutos', () => {
    assert.equal(debeBloquear(T0, T0 + 4 * 60_000, '5min'), false);
    assert.equal(debeBloquear(T0, T0 + 5 * 60_000, '5min'), true);
  });

  test('"Al abrir" nunca bloquea al volver del segundo plano', () => {
    assert.equal(graciaMs('al_abrir'), null);
    assert.equal(debeBloquear(T0, T0 + 24 * 3_600_000, 'al_abrir'), false);
  });

  test('una salida intencional (cámara, compartir) no bloquea', () => {
    assert.equal(debeBloquear(T0, T0 + 30_000, 'inmediato', true), false);
  });

  test('reloj movido hacia atrás → bloquea', () => {
    assert.equal(debeBloquear(T0, T0 - 10 * 60_000, '5min'), true);
  });

  test('valida la preferencia guardada', () => {
    assert.equal(esOpcionBloqueo('1min'), true);
    assert.equal(esOpcionBloqueo('10min'), false);
    assert.equal(esOpcionBloqueo(null), false);
  });
});
