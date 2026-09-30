/**
 * Motor de captura automática — escenario completo con alertas reales.
 * Ejecutar con: npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parsearMensaje, dividirMensajes, type MovimientoDetectado } from '../src/utils/capturaParser.ts';
import {
  normalizarComercio,
  categorizar,
  aprenderRegla,
  resolverMedio,
  esTransferenciaPropia,
  esMismoMovimiento,
  fusionarMovimientos,
  huellaMovimiento,
  decidir,
  procesarLote,
  promoverPendiente,
  resumenAviso,
  type ContextoMotor,
  type ReglaComercio,
} from '../src/utils/capturaMotor.ts';
import type { Category, MedioPago, Transaction } from '../src/types/index.ts';

// ─── Datos ────────────────────────────────────────────────────────────────────

const NOMBRES = ['Mercado', 'Transporte', 'Arriendo', 'Servicios', 'Entretenimiento', 'Salud', 'Educación', 'Ropa',
  'Mascotas', 'Seguros', 'Suscripciones', 'Gimnasio', 'Restaurantes', 'Cine / Planes', 'Viajes', 'Regalos',
  'Cuidado Personal', 'Deudas', 'Ahorros', 'Otros'];
const CATEGORIAS: Category[] = NOMBRES.map((name, i) => ({ id: String(i + 1), name, isSelected: true, tipo: 'gasto' }) as Category);
const cat = (name: string) => CATEGORIAS.find(c => c.name === name)!;

const medio = (id: string, extra: Partial<MedioPago>): MedioPago => ({
  id, tipo: 'debito', entidad: 'otra', alias: id, color: '#000000',
  predeterminado: false, archivado: false, creadoEn: '2026-09-01T00:00:00.000Z', ...extra,
});
const TC_BOGOTA = medio('tc_bogota', { tipo: 'credito', entidad: 'bogota', ultimos4: '0897' });
const CTA_AVV = medio('cta_avv', { tipo: 'cuenta', entidad: 'avvillas', ultimos4: '4513' });
const NEQUI = medio('nequi', { tipo: 'billetera', entidad: 'nequi' });
const MEDIOS = [TC_BOGOTA, CTA_AVV, NEQUI];

const ahora = new Date(2026, 8, 30, 12, 0, 0);

const ctxBase = (extra: Partial<ContextoMotor> = {}): ContextoMotor => ({
  categories: CATEGORIAS, medios: MEDIOS, reglas: [], transactions: [], pendientes: [],
  nombresUsuario: ['Mauricio Mosquera'], origen: 'texto', ahora, ...extra,
});

const HILO = [
  '29-09-26 08:42 RICARDO MOSQUERA: Iniciaste sesion en Banca Virtual AV Villas. Si no fuiste tu, contactanos. AV Villas no te pedira validacion por link o llamada',
  'Estimado cliente, usted ha realizado un Pago PSE en la pagina del Pexto Capital SAS por un valor de $252,624.00 y ha sido Exitoso',
  'AVVillas. 29/09/26 08:42 PAGO PSE DE TU CTA 4513 POR $ 252,624 EN INTERNET. TU SALDO ES $ 3,971,961',
  'AVVillas, 29/09/26 09:59 Enviaste $ 20,000 a YUNERI TATIANA VALER por Bre-B de tu cuenta 4513 a BANCA DIGITAL NEQUI',
  'AVVillas, 29/09/26 15:44 Enviaste $ 100,000 a RICARDO MOSQUERA por Bre-B de tu cuenta 4513 a BANCA DIGITAL NEQUI',
  'Banco de Bogota: Tu compra por 39,151 fue RECHAZADA por mora en pago de Tarjeta Crédito0897 el 27/09/2608:23:06 en Adobe ¿Dudas? Llama a la Servilinea ...',
  'Banco de Bogota: Tu compra por 23,900 fue aprobada con Tarjeta Crédito 0897 el 29/09/26 23:56:33 en APPLE.COM/BILL ¿Dudas? Llama a la Servilinea ...',
  'Banco de Bogota: Tu compra por 39,151 fue aprobada con Tarjeta Crédito 0897 el 30/09/26 08:41:51 en ADOBE ¿Dudas? Llama a la Servilinea ...',
  'Banco de Bogota: Tu compra por 82,150 fue aprobada con Tarjeta Crédito 0897 el 30/09/26 09:33:56 en PAGO FACTURA MOVIL ¿Dudas? Llama a la Servilinea ...',
  'Estimado cliente, usted ha realizado un Pago PSE en la pagina del FONDO NACIONAL DEL AHORRO por un valor de $200,000.00 y ha sido Exitoso',
  `Estado de la Transacción: Aprobada
Valor: $ 200.000,00
Empresa: FONDO NACIONAL DEL AHORRO
Descripción: Ahorro Voluntario
Fecha de la transacción: 29/09/2026
CUS: 692627540`,
  'Enviaste de manera exitosa 14.200 a la llave 0092824864 de JEINNER GUTIERREZ el 30 de septiembre de 2026 a las 8:50 a.m. Recuerda que también puedes usar la llave que elegiste con Nequi',
];

const parsear = (textos: string[]) => textos.map(t => parsearMensaje(t, { ahora }));
const mov = (texto: string): MovimientoDetectado => {
  const r = parsearMensaje(texto, { ahora });
  assert.equal(r.estado, 'movimiento');
  return (r as { movimiento: MovimientoDetectado }).movimiento;
};

// ─── Piezas ───────────────────────────────────────────────────────────────────

describe('normalizarComercio', () => {
  test('quita sufijos legales, números y símbolos', () => {
    assert.equal(normalizarComercio('Pexto Capital SAS'), 'pexto capital');
    assert.equal(normalizarComercio('RAPPI*RESTAURANTE 123'), 'rappi restaurante');
    assert.equal(normalizarComercio('APPLE.COM/BILL'), 'apple com');
    assert.equal(normalizarComercio('Éxito Colombia S.A.'), 'exito');
    assert.equal(normalizarComercio(undefined), '');
  });
});

describe('categorizar', () => {
  test('diccionario de comercios colombianos', () => {
    assert.equal(categorizar({ comercio: 'APPLE.COM/BILL' }, CATEGORIAS, [])?.categoryName, 'Suscripciones');
    assert.equal(categorizar({ comercio: 'ADOBE' }, CATEGORIAS, [])?.categoryName, 'Suscripciones');
    assert.equal(categorizar({ comercio: 'PAGO FACTURA MOVIL' }, CATEGORIAS, [])?.categoryName, 'Servicios');
    assert.equal(categorizar({ comercio: 'EXITO COLOMBIA' }, CATEGORIAS, [])?.categoryName, 'Mercado');
    assert.equal(categorizar({ comercio: 'UBER *TRIP' }, CATEGORIAS, [])?.categoryName, 'Transporte');
    assert.equal(categorizar({ comercio: 'FONDO NACIONAL DEL AHORRO' }, CATEGORIAS, [])?.categoryName, 'Ahorros');
  });

  test('el detalle también cuenta ("Ahorro Voluntario")', () => {
    assert.equal(categorizar({ comercio: 'ENTIDAD X', detalle: 'Ahorro Voluntario' }, CATEGORIAS, [])?.categoryName, 'Ahorros');
  });

  test('"Ahorro" del diccionario encuentra la categoría "Ahorros" del usuario y viceversa', () => {
    const soloAhorro = [{ id: 'a', name: 'Ahorro', isSelected: true, tipo: 'gasto' } as Category];
    assert.equal(categorizar({ comercio: 'FNA' }, soloAhorro, [])?.categoryId, 'a');
  });

  test('comercio desconocido o categoría que el usuario no tiene → null', () => {
    assert.equal(categorizar({ comercio: 'Pexto Capital SAS' }, CATEGORIAS, []), null);
    assert.equal(categorizar({ comercio: 'NETFLIX' }, [cat('Mercado')], []), null);
    assert.equal(categorizar({}, CATEGORIAS, []), null);
  });

  test('las reglas aprendidas ganan al diccionario', () => {
    const reglas = aprenderRegla([], 'ADOBE', cat('Educación'), ahora);
    const s = categorizar({ comercio: 'ADOBE' }, CATEGORIAS, reglas);
    assert.equal(s?.categoryName, 'Educación');
    assert.equal(s?.fuente, 'regla');
    assert.ok(s!.confianza > 0.95);
  });

  test('la regla coincide por prefijo de palabras', () => {
    const reglas = aprenderRegla([], 'Pexto Capital SAS', cat('Deudas'), ahora);
    assert.equal(categorizar({ comercio: 'PEXTO CAPITAL' }, CATEGORIAS, reglas)?.categoryName, 'Deudas');
    assert.equal(categorizar({ comercio: 'PEXTOS' }, CATEGORIAS, reglas), null);
  });

  test('una regla a una categoría borrada se ignora', () => {
    const reglas: ReglaComercio[] = [{ clave: 'adobe', categoryId: 'borrada', categoryName: 'Inexistente', usos: 1, actualizadaEn: '' }];
    assert.equal(categorizar({ comercio: 'ADOBE' }, CATEGORIAS, reglas)?.fuente, 'diccionario');
  });

  test('aprenderRegla reemplaza y cuenta usos', () => {
    let r = aprenderRegla([], 'Pexto', cat('Deudas'), ahora);
    r = aprenderRegla(r, 'PEXTO', cat('Deudas'), ahora);
    assert.equal(r.length, 1);
    assert.equal(r[0].usos, 2);
    r = aprenderRegla(r, 'pexto', cat('Otros'), ahora);
    assert.equal(r[0].usos, 1);
    assert.equal(r[0].categoryName, 'Otros');
  });
});

describe('resolverMedio', () => {
  test('por últimos 4', () => {
    assert.equal(resolverMedio({ ultimos4: '0897', entidad: 'bogota', canal: 'tarjeta' }, MEDIOS)?.id, 'tc_bogota');
    assert.equal(resolverMedio({ ultimos4: '4513', entidad: 'avvillas', canal: 'breb' }, MEDIOS)?.id, 'cta_avv');
  });
  test('por entidad cuando no hay número', () => {
    assert.equal(resolverMedio({ entidad: 'nequi', canal: 'breb' }, MEDIOS)?.id, 'nequi');
  });
  test('número desconocido no se asigna a otro medio de la misma entidad que sí tiene número', () => {
    assert.equal(resolverMedio({ ultimos4: '9999', entidad: 'bogota', canal: 'tarjeta' }, MEDIOS), null);
  });
  test('ambiguo → null; archivados no cuentan', () => {
    const dos = [medio('a', { entidad: 'nequi', tipo: 'billetera' }), medio('b', { entidad: 'nequi', tipo: 'billetera' })];
    assert.equal(resolverMedio({ entidad: 'nequi', canal: 'billetera' }, dos), null);
    assert.equal(resolverMedio({ ultimos4: '0897', canal: 'tarjeta' }, [{ ...TC_BOGOTA, archivado: true }]), null);
    assert.equal(resolverMedio({ canal: 'pse' }, MEDIOS), null);
  });
});

describe('esTransferenciaPropia', () => {
  test('el destinatario es el titular que dice el banco', () => {
    assert.equal(esTransferenciaPropia({ destinatario: 'RICARDO MOSQUERA' }, ['Mauricio Mosquera', 'RICARDO MOSQUERA']), true);
  });
  test('nombre del perfil, con o sin tildes y mayúsculas', () => {
    assert.equal(esTransferenciaPropia({ destinatario: 'MAURICIO MOSQUERA' }, ['Mauricio Mosquera']), true);
    assert.equal(esTransferenciaPropia({ destinatario: 'RICARDO MOSQUERA' }, ['Mauricio Ricardo Mosquera Pérez']), true);
  });
  test('compartir solo el apellido NO es un envío propio (familiares)', () => {
    assert.equal(esTransferenciaPropia({ destinatario: 'reina mosquera' }, ['Mauricio Mosquera', 'RICARDO MOSQUERA']), false);
    assert.equal(esTransferenciaPropia({ destinatario: 'RICARDO MOSQUERA' }, ['Mauricio Mosquera']), false);
  });
  test('un tercero o sin datos', () => {
    assert.equal(esTransferenciaPropia({ destinatario: 'YUNERI TATIANA VALER' }, ['Mauricio Mosquera', 'RICARDO MOSQUERA']), false);
    assert.equal(esTransferenciaPropia({ destinatario: 'RICARDO MOSQUERA' }, undefined), false);
    assert.equal(esTransferenciaPropia({ destinatario: 'MOSQUERA' }, ['MOSQUERA']), false, 'una sola palabra no basta');
  });
});

describe('Duplicados', () => {
  const pexto = mov(HILO[1]);
  const ctaPexto = mov(HILO[2]);
  test('SMS sin fecha + SMS con hora del mismo pago = mismo movimiento', () => {
    assert.equal(esMismoMovimiento(pexto, ctaPexto), true);
  });
  test('la fusión conserva comercio, número y la fecha real', () => {
    const f = fusionarMovimientos(pexto, ctaPexto);
    assert.equal(f.comercio, 'Pexto Capital SAS');
    assert.equal(f.ultimos4, '4513');
    assert.equal(f.fecha, ctaPexto.fecha);
    assert.equal(f.fechaEstimada, false);
  });
  test('dos compras iguales por el mismo canal a distinta hora NO son duplicado', () => {
    const a = mov('Banco de Bogota: Tu compra por 5,000 fue aprobada con Tarjeta Crédito 0897 el 30/09/26 08:00:00 en TIENDA ¿Dudas?');
    const b = mov('Banco de Bogota: Tu compra por 5,000 fue aprobada con Tarjeta Crédito 0897 el 30/09/26 08:10:00 en TIENDA ¿Dudas?');
    assert.equal(esMismoMovimiento(a, b), false);
    assert.equal(esMismoMovimiento(a, a), true);
  });
  test('distinta tarjeta o distinto monto no es duplicado', () => {
    assert.equal(esMismoMovimiento(ctaPexto, { ...ctaPexto, ultimos4: '1111' }), false);
    assert.equal(esMismoMovimiento(ctaPexto, { ...ctaPexto, monto: 1 }), false);
  });
  test('misma referencia (CUS) siempre es el mismo', () => {
    assert.equal(esMismoMovimiento({ ...pexto, referencia: 'X' }, { ...ctaPexto, monto: 9, referencia: 'X' }), true);
  });
  test('huella estable y marca las fechas estimadas', () => {
    assert.equal(huellaMovimiento(ctaPexto), huellaMovimiento(mov(HILO[2])));
    assert.ok(huellaMovimiento(pexto).includes('|~'));
    assert.equal(huellaMovimiento(mov(HILO[10])), 'v1|ref|692627540');
  });
});

describe('decidir', () => {
  test('compra con comercio conocido se registra sola', () => {
    const m = mov(HILO[6]);
    const d = decidir(m, categorizar(m, CATEGORIAS, []), { nombresUsuario: ['Mauricio Mosquera'] });
    assert.equal(d.accion, 'registrar');
  });
  test('transferencias, ingresos y retiros nunca se registran solos', () => {
    const ctx = { nombresUsuario: ['Mauricio Mosquera'] };
    assert.equal(decidir(mov(HILO[3]), null, ctx).accion, 'revisar');
    assert.equal(decidir(mov('Nequi: Recibiste $50.000 de MARIA PEREZ'), null, ctx).accion, 'revisar');
    const retiro = decidir(mov('Bancolombia le informa Retiro por $200.000 en CAJERO CENTRO'), null, ctx);
    assert.equal(retiro.accion, 'revisar');
    assert.equal(retiro.sugerirIgnorar, true);
  });
  test('genérico con categoría conocida igual pide confirmación (confianza del parseo baja)', () => {
    const m = mov('Nequi: Pagaste $12.000 en NETFLIX');
    const d = decidir(m, categorizar(m, CATEGORIAS, []), {});
    assert.equal(d.accion, 'revisar');
    assert.match(d.motivo, /Suscripciones/);
  });
});

// ─── Escenario completo ───────────────────────────────────────────────────────

describe('procesarLote con el hilo real de mensajes', () => {
  const r = procesarLote(parsear(HILO), ctxBase());
  const estados = r.items.map(i => i.estado);

  test('estado de cada mensaje', () => {
    assert.deepEqual(estados, [
      'ignorado',       // inicio de sesión
      'por_confirmar',  // Pexto (comercio desconocido)
      'duplicado',      // mismo pago Pexto por SMS de la cuenta → se une
      'por_confirmar',  // Bre-B a tercero
      'por_confirmar',  // Bre-B a sí mismo (sugiere ignorar)
      'ignorado',       // compra rechazada
      'registrado',     // Apple → Suscripciones
      'registrado',     // Adobe → Suscripciones
      'registrado',     // Factura móvil → Servicios
      'registrado',     // FNA → Ahorros
      'duplicado',      // correo PSE del mismo pago al FNA
      'por_confirmar',  // Nequi Bre-B a tercero
    ]);
  });

  test('registra 4 transacciones con categoría, medio y origen', () => {
    assert.equal(r.registrar.length, 4);
    const [apple, adobe, movil, fna] = r.registrar;
    assert.equal(apple.category, 'Suscripciones');
    assert.equal(apple.categoryId, cat('Suscripciones').id);
    assert.equal(apple.paymentMethodId, 'tc_bogota');
    assert.equal(apple.merchant, 'APPLE.COM/BILL');
    assert.equal(apple.source, 'texto');
    assert.equal(apple.type, 'expense');
    assert.equal(apple.amount, 23900);
    assert.equal(adobe.amount, 39151);
    assert.equal(movil.category, 'Servicios');
    assert.equal(fna.category, 'Ahorros');
    assert.equal(fna.amount, 200000);
    assert.ok(r.registrar.every(t => t.dedupeHash));
    assert.equal(new Set(r.registrar.map(t => t.id)).size, 4, 'ids únicos');
  });

  test('el correo del FNA corrige la fecha estimada del SMS (29/09 en vez de hoy)', () => {
    const fna = r.registrar[3];
    assert.equal(new Date(fna.date).getDate(), 29);
  });

  test('la rechazada no se registró', () => {
    assert.ok(!r.registrar.some(t => t.amount === 39151 && new Date(t.date).getDate() === 27));
  });

  test('bandeja: Pexto unido con número de cuenta y medio AV Villas', () => {
    const pexto = r.pendientes.find(p => p.movimiento.monto === 252624)!;
    assert.equal(pexto.movimiento.comercio, 'Pexto Capital SAS');
    assert.equal(pexto.movimiento.ultimos4, '4513');
    assert.equal(pexto.medioId, 'cta_avv');
    assert.equal(pexto.sugerirIgnorar, false);
    assert.equal(r.pendientes.filter(p => p.movimiento.monto === 252624).length, 1);
  });

  test('aprende el titular del aviso de inicio de sesión', () => {
    assert.deepEqual(r.titulares, ['RICARDO MOSQUERA']);
  });

  test('sin el aviso de sesión, el envío a RICARDO no se asume propio', () => {
    const r2 = procesarLote(parsear([HILO[4]]), ctxBase());
    assert.equal(r2.pendientes[0].sugerirIgnorar, false);
    const r3 = procesarLote(parsear([HILO[4]]), ctxBase({ nombresUsuario: ['Mauricio Mosquera', 'RICARDO MOSQUERA'] }));
    assert.equal(r3.pendientes[0].sugerirIgnorar, true);
    assert.deepEqual(r3.titulares, []);
  });

  test('envío a un familiar con el mismo apellido es un gasto por confirmar', () => {
    const r2 = procesarLote(parsear([
      HILO[0],
      'AVVillas, 29/09/26 09:04 Enviaste $ 231,000 a reina mosquera por Bre-B de tu cuenta 4513 a BANCA DIGITAL NEQUI',
    ]), ctxBase());
    const p = r2.pendientes[0];
    assert.equal(p.sugerirIgnorar, false);
    assert.match(p.motivo, /reina mosquera/);
    assert.equal(p.medioId, 'cta_avv');
  });

  test('bandeja: envío propio sugiere ignorar; a terceros no', () => {
    const propia = r.pendientes.find(p => p.movimiento.monto === 100000)!;
    const tercero = r.pendientes.find(p => p.movimiento.monto === 20000)!;
    const nequi = r.pendientes.find(p => p.movimiento.monto === 14200)!;
    assert.equal(propia.sugerirIgnorar, true);
    assert.equal(tercero.sugerirIgnorar, false);
    assert.equal(nequi.medioId, 'nequi');
    assert.equal(r.pendientes.length, 4);
  });

  test('pegar lo mismo otra vez no duplica nada', () => {
    const r2 = procesarLote(parsear(HILO), ctxBase({ transactions: r.registrar, pendientes: r.pendientes }));
    assert.equal(r2.registrar.length, 0);
    assert.equal(r2.pendientes.length, 4);
    assert.ok(r2.items.every(i => ['ignorado', 'duplicado'].includes(i.estado)), JSON.stringify(r2.items.map(i => i.estado)));
  });

  test('lo descartado no vuelve', () => {
    const tercero = r.pendientes.find(p => p.movimiento.monto === 20000)!;
    const r2 = procesarLote(parsear([HILO[3]]), ctxBase({ huellasIgnoradas: [tercero.huella] }));
    assert.equal(r2.items[0].estado, 'duplicado');
    assert.equal(r2.pendientes.length, 0);
  });

  test('tras aprender una regla, el siguiente pago a Pexto se registra solo', () => {
    const reglas = aprenderRegla([], 'Pexto Capital SAS', cat('Deudas'), ahora);
    const r2 = procesarLote(parsear([HILO[1].replace('252,624', '300,000')]), ctxBase({ reglas }));
    assert.equal(r2.items[0].estado, 'registrado');
    assert.equal(r2.registrar[0].category, 'Deudas');
  });

  test('un gasto anotado a mano el mismo día pasa a confirmar sugiriendo ignorar', () => {
    const manual: Transaction = {
      id: 'm1', amount: 23900, category: 'Suscripciones', type: 'expense',
      date: new Date(2026, 8, 29, 10, 0).toISOString(), description: 'iCloud',
    };
    const r2 = procesarLote(parsear([HILO[6]]), ctxBase({ transactions: [manual] }));
    assert.equal(r2.items[0].estado, 'por_confirmar');
    assert.equal(r2.pendientes[0].sugerirIgnorar, true);
    assert.match(r2.pendientes[0].motivo, /a mano/);
  });

  test('un duplicado de algo ya guardado le aporta el comercio', () => {
    const sinComercio = procesarLote(parsear([HILO[2]]), ctxBase({ reglas: [] }));
    // Sin comercio va a la bandeja; lo registramos manualmente simulando la confirmación.
    const p = sinComercio.pendientes[0];
    const tx = promoverPendiente({ ...p, movimiento: { ...p.movimiento, confianza: 0.95 } },
      { categoryId: '18', categoryName: 'Deudas', confianza: 0.99, fuente: 'regla' }, ctxBase(), 'tx1');
    assert.ok(tx);
    const r2 = procesarLote(parsear([HILO[1]]), ctxBase({ transactions: [tx!] }));
    assert.equal(r2.items[0].estado, 'duplicado');
    assert.deepEqual(r2.enriquecer, [{ id: 'tx1', update: { merchant: 'Pexto Capital SAS', description: 'Pexto Capital SAS' } }]);
  });
});

describe('promoverPendiente', () => {
  test('no promueve lo que sugiere ignorar ni lo de baja confianza', () => {
    const r = procesarLote(parsear([HILO[4]]), ctxBase());
    const sug = { categoryId: '20', categoryName: 'Otros', confianza: 0.99, fuente: 'finn' as const };
    assert.equal(promoverPendiente(r.pendientes[0], sug, ctxBase(), 'x'), null);
    const pexto = procesarLote(parsear([HILO[1]]), ctxBase()).pendientes[0];
    assert.equal(promoverPendiente(pexto, { ...sug, confianza: 0.5 }, ctxBase(), 'x'), null);
    const tx = promoverPendiente(pexto, sug, ctxBase(), 'x');
    assert.equal(tx?.category, 'Otros');
    assert.equal(tx?.dedupeHash, pexto.huella);
  });
});

describe('dividir + procesar un pegado de corrido', () => {
  test('el hilo pegado en un solo bloque produce el mismo resultado', () => {
    const bloque = HILO.slice(0, 10).join('\n');
    const partes = dividirMensajes(bloque);
    assert.equal(partes.length, 10);
    const r = procesarLote(partes.map(t => parsearMensaje(t, { ahora })), ctxBase());
    assert.equal(r.registrar.length, 4);
  });
});

describe('resumenAviso (aviso de Finn desde una notificación)', () => {
  const r = procesarLote(parsear(HILO), ctxBase());
  test('compra registrada', () => {
    assert.deepEqual(resumenAviso(r.items[6]), { titulo: 'Finn registró una compra', cuerpo: '$23.900 en APPLE.COM/BILL → Suscripciones' });
  });
  test('envío por confirmar', () => {
    assert.deepEqual(resumenAviso(r.items[3]), { titulo: 'Finn detectó un envío de $20.000', cuerpo: 'YUNERI TATIANA VALER. Toca para confirmarlo.' });
  });
  test('pago sin comercio conocido', () => {
    assert.equal(resumenAviso(r.items[1])?.titulo, 'Finn detectó un pago de $252.624');
  });
  test('duplicados, ignorados y no reconocidos no avisan', () => {
    assert.equal(resumenAviso(r.items[0]), null);
    assert.equal(resumenAviso(r.items[2]), null);
    assert.equal(resumenAviso(r.items[5]), null);
    assert.equal(resumenAviso({ estado: 'no_reconocido', motivo: '' }), null);
  });
});
