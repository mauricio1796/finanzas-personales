/**
 * Regresión del entitlement Premium (BUG-07).
 *
 * Lo que estas pruebas protegen: que un caché LOCAL manipulado no pueda otorgar
 * Premium. Antes bastaba con escribir `{isPremium:true}` en AsyncStorage.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  decidirDesdeCache,
  entitlementVigente,
  PREMIUM_LIBRE,
  DIAS_GRACIA_SIN_CONEXION,
  type CachePremium,
} from '../src/utils/premiumPolicy.ts';

const AHORA = new Date('2026-09-23T12:00:00.000Z').getTime();
const dias = (n: number) => n * 86_400_000;

const cache = (over: Partial<CachePremium> = {}): CachePremium => ({
  isPremium: true,
  plan: 'anual',
  fechaInicio: new Date(AHORA - dias(30)).toISOString(),
  fechaVencimiento: new Date(AHORA + dias(300)).toISOString(),
  verificadoEn: new Date(AHORA - dias(1)).toISOString(),
  ...over,
});

describe('entitlementVigente', () => {
  test('vale si está marcado y no ha vencido', () => {
    assert.equal(entitlementVigente(cache(), AHORA), true);
  });

  test('no vale si ya venció', () => {
    assert.equal(
      entitlementVigente(cache({ fechaVencimiento: new Date(AHORA - dias(1)).toISOString() }), AHORA),
      false,
    );
  });

  test('no vale sin fecha de vencimiento', () => {
    assert.equal(entitlementVigente(cache({ fechaVencimiento: null }), AHORA), false);
  });

  test('no vale si isPremium es false', () => {
    assert.equal(entitlementVigente(cache({ isPremium: false }), AHORA), false);
  });

  test('una fecha corrupta no otorga nada', () => {
    assert.equal(entitlementVigente(cache({ fechaVencimiento: 'no-es-fecha' }), AHORA), false);
  });
});

describe('decidirDesdeCache — el caché nunca es autoridad (BUG-07)', () => {
  test('ATAQUE: caché escrito a mano sin marca de verificación NO otorga Premium', () => {
    // Exactamente lo que hacía el bug original: escribir isPremium:true a mano.
    const falsificado: CachePremium = {
      isPremium: true,
      plan: 'anual',
      fechaInicio: new Date(AHORA).toISOString(),
      fechaVencimiento: new Date(AHORA + dias(3650)).toISOString(),
      // sin `verificadoEn`: el servidor nunca confirmó esto
    };
    assert.deepEqual(decidirDesdeCache(falsificado, AHORA), PREMIUM_LIBRE);
  });

  test('ATAQUE: verificadoEn corrupto tampoco otorga Premium', () => {
    assert.deepEqual(
      decidirDesdeCache(cache({ verificadoEn: 'ayer por la tarde' }), AHORA),
      PREMIUM_LIBRE,
    );
  });

  test('sin caché, no hay Premium', () => {
    assert.deepEqual(decidirDesdeCache(null, AHORA), PREMIUM_LIBRE);
  });

  test('caché vencido no otorga Premium aunque esté verificado', () => {
    assert.deepEqual(
      decidirDesdeCache(cache({ fechaVencimiento: new Date(AHORA - dias(1)).toISOString() }), AHORA),
      PREMIUM_LIBRE,
    );
  });
});

describe('decidirDesdeCache — gracia sin conexión para quien sí pagó', () => {
  test('respeta un caché verificado recientemente', () => {
    const r = decidirDesdeCache(cache(), AHORA);
    assert.equal(r.isPremium, true);
    assert.equal(r.plan, 'anual');
  });

  test('sigue valiendo justo dentro del período de gracia', () => {
    const casi = new Date(AHORA - dias(DIAS_GRACIA_SIN_CONEXION - 0.5)).toISOString();
    assert.equal(decidirDesdeCache(cache({ verificadoEn: casi }), AHORA).isPremium, true);
  });

  test('deja de valer pasado el período de gracia', () => {
    const viejo = new Date(AHORA - dias(DIAS_GRACIA_SIN_CONEXION + 1)).toISOString();
    assert.deepEqual(decidirDesdeCache(cache({ verificadoEn: viejo }), AHORA), PREMIUM_LIBRE);
  });

  test('el resultado no arrastra la marca interna de verificación', () => {
    const r = decidirDesdeCache(cache(), AHORA) as Record<string, unknown>;
    assert.equal('verificadoEn' in r, false);
  });
});
