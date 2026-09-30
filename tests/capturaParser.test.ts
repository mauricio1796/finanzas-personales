/**
 * Parser de mensajes bancarios — casos tomados de alertas reales (SMS y
 * correos de Banco de Bogotá, AV Villas, PSE y Nequi, sep-2026).
 * Ejecutar con: npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsearMonto,
  parsearFecha,
  parsearMensaje,
  dividirMensajes,
  detectarEntidad,
  type MovimientoDetectado,
  type ResultadoParseo,
} from '../src/utils/capturaParser.ts';

const ahora = new Date(2026, 8, 30, 12, 0, 0);
const opts = { ahora };

const mov = (r: ResultadoParseo): MovimientoDetectado => {
  assert.equal(r.estado, 'movimiento', `esperaba movimiento, llegó ${JSON.stringify(r)}`);
  return (r as { movimiento: MovimientoDetectado }).movimiento;
};
const local = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// ─── Mensajes reales ──────────────────────────────────────────────────────────

const BOGOTA_APPLE = 'Banco de Bogota: Tu compra por 23,900 fue aprobada con Tarjeta Crédito 0897 el 29/09/26 23:56:33 en APPLE.COM/BILL ¿Dudas? Llama a la Servilinea ...';
const BOGOTA_ADOBE = 'Banco de Bogota: Tu compra por 39,151 fue aprobada con Tarjeta Crédito 0897 el 30/09/26 08:41:51 en ADOBE ¿Dudas? Llama a la Servilinea ...';
const BOGOTA_MOVIL = 'Banco de Bogota: Tu compra por 82,150 fue aprobada con Tarjeta Crédito 0897 el 30/09/26 09:33:56 en PAGO FACTURA MOVIL ¿Dudas? Llama a la Servilinea ...';
const BOGOTA_RECHAZADA = 'Banco de Bogota: Tu compra por 39,151 fue RECHAZADA por mora en pago de Tarjeta Crédito0897 el 27/09/2608:23:06 en Adobe ¿Dudas? Llama a la Servilinea ...';
const AVV_PSE_CTA = 'AVVillas. 29/09/26 08:42 PAGO PSE DE TU CTA 4513 POR $ 252,624 EN INTERNET. TU SALDO ES $ 3,971,961';
const PSE_SMS_PEXTO = 'Estimado cliente, usted ha realizado un Pago PSE en la pagina del Pexto Capital SAS por un valor de $252,624.00 y ha sido Exitoso';
const PSE_SMS_FNA = 'Estimado cliente, usted ha realizado un Pago PSE en la pagina del FONDO NACIONAL DEL AHORRO por un valor de $200,000.00 y ha sido Exitoso';
const AVV_BREB_TERCERO = 'AVVillas, 29/09/26 09:59 Enviaste $ 20,000 a YUNERI TATIANA VALER por Bre-B de tu cuenta 4513 a BANCA DIGITAL NEQUI';
const AVV_BREB_PROPIA = 'AVVillas, 29/09/26 15:44 Enviaste $ 100,000 a RICARDO MOSQUERA por Bre-B de tu cuenta 4513 a BANCA DIGITAL NEQUI';
const AVV_LOGIN = '29-09-26 08:42 RICARDO MOSQUERA: Iniciaste sesion en Banca Virtual AV Villas. Si no fuiste tu, contactanos. AV Villas no te pedira validacion por link o llamada';
const PSE_CORREO = `¡Hola, Mauricio Mosquera!
Estado de la Transacción: Aprobada
Los siguientes son los datos de tu transacción:
Valor: $ 200.000,00
Empresa: FONDO NACIONAL DEL AHORRO
Descripción: Ahorro Voluntario
Fecha de la transacción: 29/09/2026
CUS: 692627540
Gracias por utilizar nuestro servicio.`;
const NEQUI_CORREO = `¡Realizaste un envío por Bre-B y todo salió bien!
¡Hola, RICARDO MOSQUERA!
Enviaste de manera exitosa 14.200 a la llave 0092824864 de JEINNER GUTIERREZ el 30 de septiembre de 2026 a las 8:50 a.m. Revisa el detalle en los movimientos de tu app o descarga el comprobante si lo necesitas.
Recuerda que también puedes usar la llave que elegiste con Nequi para recibir plata de otros bancos de manera rápida y fácil 24/7.`;

describe('parsearMonto: todos los formatos vistos', () => {
  test('coma de miles', () => {
    assert.equal(parsearMonto('39,151'), 39151);
    assert.equal(parsearMonto('$ 252,624'), 252624);
    assert.equal(parsearMonto('3,971,961'), 3971961);
  });
  test('coma de miles con centavos', () => assert.equal(parsearMonto('$200,000.00'), 200000));
  test('punto de miles', () => assert.equal(parsearMonto('14.200'), 14200));
  test('punto de miles con centavos', () => assert.equal(parsearMonto('$ 200.000,00'), 200000));
  test('sin separadores', () => assert.equal(parsearMonto('5000'), 5000));
  test('basura', () => {
    assert.equal(parsearMonto('abc'), null);
    assert.equal(parsearMonto('0'), null);
    assert.equal(parsearMonto('1,2,3'), null);
  });
});

describe('parsearFecha', () => {
  test('dd/mm/yy con segundos', () => {
    const f = parsearFecha('el 29/09/26 23:56:33 en');
    assert.equal(local(f!.fecha.toISOString()), '2026-09-29 23:56');
    assert.equal(f!.conHora, true);
  });
  test('hora pegada al año (Banco de Bogotá)', () => {
    const f = parsearFecha('el 27/09/2608:23:06 en Adobe');
    assert.equal(local(f!.fecha.toISOString()), '2026-09-27 08:23');
  });
  test('guiones', () => assert.equal(local(parsearFecha('29-09-26 08:42 X')!.fecha.toISOString()), '2026-09-29 08:42'));
  test('año de 4 dígitos sin hora', () => {
    const f = parsearFecha('Fecha: 29/09/2026');
    assert.equal(f!.conHora, false);
    assert.equal(f!.fecha.getDate(), 29);
  });
  test('fecha en palabras con a.m./p.m.', () => {
    assert.equal(local(parsearFecha('el 30 de septiembre de 2026 a las 8:50 a.m.')!.fecha.toISOString()), '2026-09-30 08:50');
    assert.equal(local(parsearFecha('el 1 de octubre de 2026 a las 3:05 p.m.')!.fecha.toISOString()), '2026-10-01 15:05');
  });
  test('una palabra que empieza por P después de la hora no es "p.m."', () => {
    assert.equal(local(parsearFecha('29/09/26 08:42 PAGO PSE')!.fecha.toISOString()), '2026-09-29 08:42');
    assert.equal(local(parsearFecha('29/09/26 08:42 AUTORIZADO')!.fecha.toISOString()), '2026-09-29 08:42');
  });
  test('fechas imposibles', () => {
    assert.equal(parsearFecha('31/02/26'), null);
    assert.equal(parsearFecha('sin fecha'), null);
  });
});

describe('Banco de Bogotá', () => {
  test('compra aprobada con tarjeta de crédito', () => {
    const m = mov(parsearMensaje(BOGOTA_APPLE, opts));
    assert.equal(m.monto, 23900);
    assert.equal(m.tipo, 'compra');
    assert.equal(m.canal, 'tarjeta');
    assert.equal(m.comercio, 'APPLE.COM/BILL');
    assert.equal(m.ultimos4, '0897');
    assert.equal(m.entidad, 'bogota');
    assert.equal(local(m.fecha), '2026-09-29 23:56');
    assert.equal(m.fechaConHora, true);
    assert.ok(m.confianza >= 0.9);
  });
  test('otros comercios', () => {
    assert.equal(mov(parsearMensaje(BOGOTA_ADOBE, opts)).comercio, 'ADOBE');
    const movil = mov(parsearMensaje(BOGOTA_MOVIL, opts));
    assert.equal(movil.comercio, 'PAGO FACTURA MOVIL');
    assert.equal(movil.monto, 82150);
  });
  test('compra RECHAZADA se ignora', () => {
    assert.deepEqual(parsearMensaje(BOGOTA_RECHAZADA, opts), { estado: 'ignorado', motivo: 'rechazada' });
  });
});

describe('AV Villas y PSE', () => {
  test('pago PSE desde la cuenta: toma el pago, NO el saldo', () => {
    const m = mov(parsearMensaje(AVV_PSE_CTA, opts));
    assert.equal(m.monto, 252624);
    assert.equal(m.tipo, 'pago');
    assert.equal(m.canal, 'pse');
    assert.equal(m.ultimos4, '4513');
    assert.equal(m.entidad, 'avvillas');
    assert.equal(m.comercio, undefined, '"INTERNET" no es un comercio');
    assert.equal(local(m.fecha), '2026-09-29 08:42');
  });
  test('SMS de PSE con el comercio', () => {
    const m = mov(parsearMensaje(PSE_SMS_PEXTO, opts));
    assert.equal(m.monto, 252624);
    assert.equal(m.comercio, 'Pexto Capital SAS');
    assert.equal(m.fechaConHora, false, 'el SMS no trae fecha');
    assert.equal(m.fechaEstimada, true);
    const fna = mov(parsearMensaje(PSE_SMS_FNA, opts));
    assert.equal(fna.monto, 200000);
    assert.equal(fna.comercio, 'FONDO NACIONAL DEL AHORRO');
  });
  test('sin fecha en el texto usa la hora de llegada de la notificación', () => {
    const recibidoEn = new Date(2026, 8, 29, 8, 43);
    const m = mov(parsearMensaje(PSE_SMS_PEXTO, { ahora, recibidoEn }));
    assert.equal(local(m.fecha), '2026-09-29 08:43');
    assert.equal(m.fechaConHora, true);
    assert.equal(m.fechaEstimada, false);
  });
  test('PSE no exitoso se ignora', () => {
    const r = parsearMensaje(PSE_SMS_FNA.replace('Exitoso', 'Rechazado'), opts);
    assert.deepEqual(r, { estado: 'ignorado', motivo: 'rechazada' });
  });
  test('Bre-B a un tercero', () => {
    const m = mov(parsearMensaje(AVV_BREB_TERCERO, opts));
    assert.equal(m.tipo, 'transferencia');
    assert.equal(m.canal, 'breb');
    assert.equal(m.monto, 20000);
    assert.equal(m.destinatario, 'YUNERI TATIANA VALER');
    assert.equal(m.destino, 'BANCA DIGITAL NEQUI');
    assert.equal(m.ultimos4, '4513');
    assert.equal(m.entidad, 'avvillas');
  });
  test('Bre-B a sí mismo', () => {
    const m = mov(parsearMensaje(AVV_BREB_PROPIA, opts));
    assert.equal(m.destinatario, 'RICARDO MOSQUERA');
    assert.equal(m.monto, 100000);
  });
  test('aviso de inicio de sesión se ignora, pero enseña el nombre del titular', () => {
    assert.deepEqual(parsearMensaje(AVV_LOGIN, opts), { estado: 'ignorado', motivo: 'seguridad', titular: 'RICARDO MOSQUERA' });
  });
  test('Bre-B con el nombre en minúsculas y nombres de 3 palabras', () => {
    const reina = mov(parsearMensaje('AVVillas, 29/09/26 09:04 Enviaste $ 231,000 a reina mosquera por Bre-B de tu cuenta 4513 a BANCA DIGITAL NEQUI', opts));
    assert.equal(reina.monto, 231000);
    assert.equal(reina.destinatario, 'reina mosquera');
    assert.equal(local(reina.fecha), '2026-09-29 09:04');
    const jhon = mov(parsearMensaje('AVVillas, 29/09/26 09:34 Enviaste $ 310,000 a JHON ALEXANDER GOMEZ por Bre-B de tu cuenta 4513 a BANCA DIGITAL NEQUI', opts));
    assert.equal(jhon.monto, 310000);
    assert.equal(jhon.destinatario, 'JHON ALEXANDER GOMEZ');
  });
});

describe('Correos', () => {
  test('correo de PSE', () => {
    const m = mov(parsearMensaje(PSE_CORREO, opts));
    assert.equal(m.monto, 200000);
    assert.equal(m.comercio, 'FONDO NACIONAL DEL AHORRO');
    assert.equal(m.detalle, 'Ahorro Voluntario');
    assert.equal(m.referencia, '692627540');
    assert.equal(m.plantilla, 'pse_correo');
    assert.equal(m.fecha.slice(0, 10) <= '2026-09-29', true);
    assert.equal(new Date(m.fecha).getDate(), 29);
    assert.equal(m.fechaConHora, false);
  });
  test('correo de PSE en una sola línea', () => {
    const m = mov(parsearMensaje(PSE_CORREO.replace(/\n/g, ' '), opts));
    assert.equal(m.comercio, 'FONDO NACIONAL DEL AHORRO');
    assert.equal(m.detalle, 'Ahorro Voluntario');
  });
  test('correo de PSE rechazado', () => {
    const r = parsearMensaje(PSE_CORREO.replace('Aprobada', 'Rechazada'), opts);
    assert.deepEqual(r, { estado: 'ignorado', motivo: 'rechazada' });
  });
  test('correo de Nequi por Bre-B', () => {
    const m = mov(parsearMensaje(NEQUI_CORREO, opts));
    assert.equal(m.tipo, 'transferencia');
    assert.equal(m.monto, 14200);
    assert.equal(m.destinatario, 'JEINNER GUTIERREZ');
    assert.equal(m.entidad, 'nequi');
    assert.equal(local(m.fecha), '2026-09-30 08:50');
    assert.ok(!JSON.stringify(m).includes('0092824864'), 'la llave del destinatario no se guarda');
  });
});

describe('Otros bancos (formatos conocidos) y genérico', () => {
  test('Bancolombia compra', () => {
    const m = mov(parsearMensaje('Bancolombia le informa Compra por $45.000,00 en EXITO COLOMBIA 29/09/2026 12:34 T.Cred *1234. Inquietudes al 018000931987.', opts));
    assert.equal(m.monto, 45000);
    assert.equal(m.comercio, 'EXITO COLOMBIA');
    assert.equal(m.ultimos4, '1234');
    assert.equal(m.entidad, 'bancolombia');
    assert.equal(local(m.fecha), '2026-09-29 12:34');
  });
  test('Bancolombia compraste', () => {
    const m = mov(parsearMensaje('Bancolombia: Compraste $18.500,00 en RAPPI*RESTAURANTE con tu T.Deb *9876, el 29/09/2026 a las 20:15.', opts));
    assert.equal(m.monto, 18500);
    assert.equal(m.comercio, 'RAPPI*RESTAURANTE');
    assert.equal(m.ultimos4, '9876');
  });
  test('notificación tipo Nequi "Pagaste"', () => {
    const m = mov(parsearMensaje('Nequi: Pagaste $12.000 en D1 SAS', opts));
    assert.equal(m.tipo, 'pago');
    assert.equal(m.monto, 12000);
    assert.equal(m.comercio, 'D1 SAS');
    assert.equal(m.entidad, 'nequi');
    assert.equal(m.plantilla, 'generico');
    assert.ok(m.confianza < 0.85, 'lo genérico siempre pasa por confirmación');
  });
  test('ingreso', () => {
    const m = mov(parsearMensaje('Nequi: Recibiste $50.000 de MARIA PEREZ', opts));
    assert.equal(m.tipo, 'ingreso');
    assert.equal(m.destinatario, 'MARIA PEREZ');
  });
  test('genérico ignora el saldo', () => {
    const m = mov(parsearMensaje('Davivienda: Saldo disponible $ 1.000.000. Pagaste $ 30.000 en CLARO', opts));
    assert.equal(m.monto, 30000);
  });
  test('códigos de verificación se ignoran', () => {
    assert.deepEqual(parsearMensaje('Bancolombia: tu clave dinamica es 123456. No la compartas.', opts), { estado: 'ignorado', motivo: 'seguridad' });
  });
  test('texto sin nada bancario', () => {
    assert.deepEqual(parsearMensaje('Hola, ¿cómo estás?', opts), { estado: 'desconocido' });
    assert.deepEqual(parsearMensaje('   ', opts), { estado: 'desconocido' });
  });
  test('una fecha futura imposible no se usa', () => {
    const m = mov(parsearMensaje('Banco de Bogota: Tu compra por 10,000 fue aprobada con Tarjeta Crédito 0897 el 29/09/29 10:00:00 en X ¿Dudas?', opts));
    assert.equal(m.fecha, ahora.toISOString());
    assert.equal(m.fechaConHora, false);
  });
  test('detectarEntidad: el emisor es el primero mencionado; "dale" común no cuenta', () => {
    assert.equal(detectarEntidad('AVVillas ... a BANCA DIGITAL NEQUI'), 'avvillas');
    assert.equal(detectarEntidad('dale click aquí'), undefined);
    assert.equal(detectarEntidad('Pagaste con dale! $5.000'), 'dale');
  });
});

describe('dividirMensajes', () => {
  test('hilo de SMS pegado de corrido', () => {
    const partes = dividirMensajes(`${AVV_LOGIN}\n${PSE_SMS_PEXTO}\n${AVV_PSE_CTA}\n${AVV_BREB_TERCERO}`);
    assert.equal(partes.length, 4);
    assert.ok(partes[0].includes('Iniciaste sesion'));
    assert.ok(partes[0].includes('no te pedira validacion'), 'no corta "AV Villas no pide…" a la mitad');
  });
  test('separados por líneas en blanco', () => {
    const partes = dividirMensajes(`${BOGOTA_APPLE}\n\n${BOGOTA_ADOBE}\n\n\n${BOGOTA_MOVIL}`);
    assert.equal(partes.length, 3);
  });
  test('un correo multilínea es un solo mensaje', () => {
    assert.equal(dividirMensajes(PSE_CORREO).length, 1);
    assert.equal(dividirMensajes(NEQUI_CORREO).length, 1);
  });
  test('varios mensajes de Banco de Bogotá en un solo párrafo', () => {
    assert.equal(dividirMensajes(`${BOGOTA_APPLE} ${BOGOTA_ADOBE}`).length, 2);
  });
});
