/**
 * Política de consentimiento (Ley 1581 de 2012, art. 9).
 *
 * Lo que estas pruebas protegen: que la app solo se use con autorizaciones
 * obligatorias vigentes, que un cambio de versión exija aceptar de nuevo y que
 * la fusión con el servidor respete el registro más reciente.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cumpleObligatorios, fusionarConsentimientos, type ConsentState } from '../src/utils/consentPolicy.ts';

const V = { privacy: '1.0.0', terms: '1.0.0' };
const at = '2026-09-24T10:00:00.000Z';

const completo: ConsentState = {
  privacy: { granted: true, version: '1.0.0', at },
  terms: { granted: true, version: '1.0.0', at },
  age_confirmation: { granted: true, version: '1.0.0', at },
};

describe('cumpleObligatorios', () => {
  test('acepta el estado completo', () => {
    assert.equal(cumpleObligatorios(completo, V), true);
  });

  test('rechaza estado vacío', () => {
    assert.equal(cumpleObligatorios({}, V), false);
  });

  test('exige la mayoría de edad', () => {
    const { age_confirmation: _a, ...sinEdad } = completo;
    assert.equal(cumpleObligatorios(sinEdad, V), false);
  });

  test('una revocación invalida', () => {
    assert.equal(cumpleObligatorios({ ...completo, privacy: { granted: false, version: '1.0.0', at } }, V), false);
  });

  test('un cambio de versión de la política obliga a aceptar de nuevo', () => {
    assert.equal(cumpleObligatorios(completo, { privacy: '1.1.0', terms: '1.0.0' }), false);
    assert.equal(cumpleObligatorios(completo, { privacy: '1.0.0', terms: '2.0.0' }), false);
  });

  test('las autorizaciones opcionales no bloquean', () => {
    assert.equal(cumpleObligatorios({ ...completo, ai_processing: { granted: false, version: '1.0.0', at } }, V), true);
  });
});

describe('fusionarConsentimientos', () => {
  test('gana el registro más reciente del servidor', () => {
    const local: ConsentState = { ai_processing: { granted: true, version: '1.0.0', at } };
    const r = fusionarConsentimientos(local, [
      { consent_type: 'ai_processing', document_version: '1.0.0', granted: false, created_at: '2026-09-25T00:00:00.000Z' },
    ]);
    assert.equal(r.ai_processing?.granted, false);
  });

  test('conserva el local si es más reciente que el del servidor', () => {
    const local: ConsentState = { marketing: { granted: false, version: '1.0.0', at: '2026-09-26T00:00:00.000Z' } };
    const r = fusionarConsentimientos(local, [
      { consent_type: 'marketing', document_version: '1.0.0', granted: true, created_at: '2026-09-25T00:00:00.000Z' },
    ]);
    assert.equal(r.marketing?.granted, false);
  });

  test('agrega tipos que solo existen en el servidor', () => {
    const r = fusionarConsentimientos({}, [
      { consent_type: 'privacy', document_version: '1.0.0', granted: true, created_at: at },
    ]);
    assert.deepEqual(r.privacy, { granted: true, version: '1.0.0', at });
  });
});
