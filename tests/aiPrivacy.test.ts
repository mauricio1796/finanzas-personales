/**
 * Minimización de datos hacia el proveedor de IA (Finn).
 *
 * Lo que estas pruebas protegen: que identificadores personales (correo,
 * teléfono, documento, tarjeta, nombre) no salgan en el texto que se envía al
 * modelo, SIN destruir los montos que Finn necesita para responder.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { redactarPII, quitarNombre, minimizarParaIA } from '../src/utils/aiPrivacy.ts';

describe('redactarPII', () => {
  test('elimina correos', () => {
    assert.equal(redactarPII('Pago a juan.perez@gmail.com por arriendo'), 'Pago a [correo] por arriendo');
  });

  test('elimina celulares colombianos y fijos', () => {
    assert.equal(redactarPII('Nequi 3101234567'), 'Nequi [teléfono]');
    assert.equal(redactarPII('+57 310 123 4567'), '[teléfono]');
    assert.equal(redactarPII('Fijo 601 234 5678'), 'Fijo [teléfono]');
  });

  test('elimina números de tarjeta', () => {
    assert.equal(redactarPII('Tarjeta 4111 1111 1111 1111 vence'), 'Tarjeta [número] vence');
  });

  test('elimina documentos con su sigla', () => {
    assert.equal(redactarPII('Mi CC 1.023.456.789'), 'Mi [documento]');
    assert.equal(redactarPII('NIT 900123456-7'), '[documento]');
    assert.equal(redactarPII('cédula 52123456'), '[documento]');
  });

  test('conserva montos formateados y sin formato', () => {
    const t = 'Gasté $1.250.000 en mercado, 45000 en taxi y 45000000 en el carro';
    assert.equal(redactarPII(t), t);
  });

  test('conserva fechas', () => {
    assert.equal(redactarPII('Pagué 150000 de luz el 2026-09-24'), 'Pagué 150000 de luz el 2026-09-24');
  });

  test('tolera vacíos', () => {
    assert.equal(redactarPII(''), '');
    assert.equal(redactarPII(null), '');
    assert.equal(redactarPII(undefined), '');
  });
});

describe('quitarNombre', () => {
  test('quita nombre y apellido, con tildes', () => {
    assert.equal(quitarNombre('Hola, soy Ramírez', 'Andrés Ramírez'), 'Hola, soy [usuario]');
    assert.equal(quitarNombre('ricardo gastó 20000', 'Ricardo'), '[usuario] gastó 20000');
  });

  test('no toca palabras que solo contienen el nombre', () => {
    assert.equal(quitarNombre('Anabel compró pan', 'Ana'), 'Anabel compró pan');
  });

  test('ignora nombres muy cortos o vacíos', () => {
    assert.equal(quitarNombre('Yo compré', 'Yo'), 'Yo compré');
    assert.equal(quitarNombre('texto', ''), 'texto');
  });
});

test('minimizarParaIA combina ambas protecciones', () => {
  assert.equal(
    minimizarParaIA('Laura: pagar a laura@x.co 3001112233', 'Laura'),
    '[usuario]: pagar a [correo] [teléfono]',
  );
});
