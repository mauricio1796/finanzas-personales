/**
 * Traducción de errores de Face ID / huella.
 *
 * Lo que estas pruebas protegen: que ningún error se interprete como éxito,
 * que cancelar no muestre un mensaje de error, y que los casos que solo el
 * usuario puede resolver (permiso negado, sin biometría configurada) ofrezcan
 * ir a Ajustes en vez de fallar en silencio.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { traducirErrorBiometria } from '../src/utils/biometriaPolicy.ts';

const ERRORES = [
  'user_cancel', 'user_fallback', 'system_cancel', 'app_cancel', 'authentication_failed', 'lockout',
  'not_enrolled', 'passcode_not_set', 'not_available', 'missing_usage_description',
  'unknown: -1004, algo', '', 'invalid_context', 'timeout',
];

describe('traducirErrorBiometria', () => {
  test('ningún error se traduce como éxito', () => {
    for (const e of ERRORES) {
      for (const plat of ['ios', 'android']) {
        assert.equal(traducirErrorBiometria(e, plat, 'Face ID').ok, false, `${e} en ${plat}`);
      }
    }
  });

  test('cancelar o elegir el PIN no muestra mensaje', () => {
    for (const e of ['user_cancel', 'user_fallback']) {
      const r = traducirErrorBiometria(e, 'ios', 'Face ID');
      assert.equal(r.motivo, 'cancelado');
      assert.equal(r.mensaje, null);
    }
  });

  test('una interrupción del sistema se marca para reintentar, sin mensaje', () => {
    for (const e of ['system_cancel', 'app_cancel']) {
      const r = traducirErrorBiometria(e, 'ios', 'Face ID');
      assert.equal(r.motivo, 'interrumpido');
      assert.equal(r.mensaje, null);
    }
  });

  test('iOS: permiso de Face ID negado → ofrece Ajustes', () => {
    const r = traducirErrorBiometria('not_available', 'ios', 'Face ID');
    assert.equal(r.motivo, 'sin_permiso');
    assert.equal(r.abrirAjustes, true);
    assert.match(r.mensaje!, /Ajustes/);
  });

  test('Android: not_available no habla de permisos de iOS', () => {
    const r = traducirErrorBiometria('not_available', 'android', 'huella');
    assert.equal(r.motivo, 'no_soportado');
    assert.doesNotMatch(r.mensaje!, /Face ID/);
  });

  test('build sin NSFaceIDUsageDescription (Expo Go) se explica en vez de fallar callado', () => {
    const r = traducirErrorBiometria('missing_usage_description', 'ios', 'Face ID');
    assert.equal(r.motivo, 'no_soportado');
    assert.ok(r.mensaje);
  });

  test('bloqueo por intentos del sistema pide el código del teléfono', () => {
    const r = traducirErrorBiometria('lockout', 'ios', 'Face ID');
    assert.equal(r.motivo, 'bloqueado_sistema');
    assert.match(r.mensaje!, /código/);
  });

  test('errores desconocidos tienen mensaje genérico con el nombre correcto', () => {
    const r = traducirErrorBiometria('unknown: -1004, algo', 'android', 'huella');
    assert.equal(r.motivo, 'error');
    assert.match(r.mensaje!, /huella/);
  });
});
