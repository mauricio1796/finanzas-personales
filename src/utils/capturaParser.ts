/**
 * Parser de mensajes bancarios colombianos (SMS, notificaciones, correos).
 *
 * Convierte el texto de una alerta del banco en un movimiento estructurado
 * (monto, comercio, fecha, últimos 4 dígitos, entidad) o lo descarta con un
 * motivo (compra rechazada, aviso de seguridad…). Todo ocurre en el
 * dispositivo: el texto crudo nunca se guarda ni sale del teléfono.
 *
 * Primero se prueban plantillas estrictas por banco (alta confianza) y, si
 * ninguna aplica, un parser genérico (confianza media: el usuario confirma).
 *
 * Sin dependencias en tiempo de ejecución: se prueba con `npm test`.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoMovimiento = 'compra' | 'pago' | 'transferencia' | 'retiro' | 'ingreso';
export type CanalMovimiento = 'tarjeta' | 'pse' | 'breb' | 'cuenta' | 'billetera' | 'desconocido';

export interface MovimientoDetectado {
  monto: number;
  tipo: TipoMovimiento;
  canal: CanalMovimiento;
  /** ISO. */
  fecha: string;
  /** false si el mensaje solo trae el día (o ninguna fecha). */
  fechaConHora: boolean;
  /** true si el texto no traía fecha y se usó la hora actual (fecha aproximada). */
  fechaEstimada: boolean;
  comercio?: string;
  /** Detalle adicional útil para categorizar ("Ahorro Voluntario"). */
  detalle?: string;
  /** Persona a quien se envió (transferencias). Nunca se envía a la IA. */
  destinatario?: string;
  /** Entidad destino de una transferencia ("BANCA DIGITAL NEQUI"). */
  destino?: string;
  ultimos4?: string;
  /** Id del catálogo de entidades (utils/mediosPago). */
  entidad?: string;
  /** Referencia única del banco (CUS de PSE). */
  referencia?: string;
  /** Plantilla que lo reconoció. */
  plantilla: string;
  /** Certeza del parseo, 0–1. */
  confianza: number;
}

export type MotivoIgnorado = 'rechazada' | 'seguridad' | 'sin_monto';

export type ResultadoParseo =
  | { estado: 'movimiento'; movimiento: MovimientoDetectado }
  | { estado: 'ignorado'; motivo: MotivoIgnorado; titular?: string }
  | { estado: 'desconocido' };

export interface OpcionesParseo {
  /** Cuándo llegó el mensaje (notificación). Se usa si el texto no trae fecha. */
  recibidoEn?: Date;
  ahora?: Date;
}

// ─── Montos ───────────────────────────────────────────────────────────────────

/**
 * Montos en cualquiera de los formatos que usan los bancos colombianos:
 * "39,151" · "$ 252,624" · "$200,000.00" · "14.200" · "$ 200.000,00".
 * El último separador seguido de exactamente 2 dígitos son centavos (se
 * descartan); de 3 dígitos, separador de miles.
 */
export function parsearMonto(texto: string): number | null {
  const limpio = texto.replace(/[$\s]/g, '').replace(/COP/i, '');
  if (!/^\d[\d.,]*$/.test(limpio)) return null;
  let entero = limpio;
  const m = limpio.match(/^(.*\d)[.,](\d{2})$/);
  if (m && /[.,]/.test(limpio)) entero = m[1];
  // Separadores de miles: grupos de exactamente 3 dígitos.
  if (/[.,]/.test(entero) && !/^\d{1,3}([.,]\d{3})+$/.test(entero)) return null;
  const n = parseInt(entero.replace(/[.,]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─── Fechas ───────────────────────────────────────────────────────────────────

const MESES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7,
  septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

interface FechaParseada { fecha: Date; conHora: boolean }

function construirFecha(d: number, m: number, a: number, h?: number, mi?: number, s?: number): Date | null {
  const año = a < 100 ? 2000 + a : a;
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  if (h !== undefined && (h > 23 || (mi ?? 0) > 59)) return null;
  const f = new Date(año, m, d, h ?? 12, mi ?? 0, s ?? 0);
  return f.getMonth() === m ? f : null;
}

/**
 * Busca la primera fecha del texto. Soporta:
 * "29/09/26 23:56:33", "27/09/2608:23:06" (hora pegada), "29-09-26 08:42",
 * "29/09/2026" y "30 de septiembre de 2026 a las 8:50 a.m.".
 */
export function parsearFecha(texto: string): FechaParseada | null {
  // Año de 4 dígitos solo si no va pegado a una hora ("2608:23" es 26 + 08:23).
  const num = texto.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4}(?![\d:])|\d{2})\s*(?:a las\s*)?(?:(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\.?\s*m\b\.?)?)?/i);
  if (num) {
    let h = num[4] !== undefined ? parseInt(num[4], 10) : undefined;
    if (h !== undefined && num[7]) h = ajustar12h(h, num[7]);
    const f = construirFecha(
      parseInt(num[1], 10), parseInt(num[2], 10) - 1, parseInt(num[3], 10),
      h, num[5] !== undefined ? parseInt(num[5], 10) : undefined, num[6] !== undefined ? parseInt(num[6], 10) : undefined,
    );
    if (f) return { fecha: f, conHora: h !== undefined };
  }

  const larga = texto.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})(?:\s+a\s+las\s+(\d{1,2}):(\d{2})(?:\s*([ap])\.?\s*m\b\.?)?)?/i);
  if (larga) {
    const mes = MESES[larga[2].toLowerCase()];
    if (mes !== undefined) {
      let h = larga[4] !== undefined ? parseInt(larga[4], 10) : undefined;
      if (h !== undefined && larga[6]) h = ajustar12h(h, larga[6]);
      const f = construirFecha(parseInt(larga[1], 10), mes, parseInt(larga[3], 10), h, larga[5] !== undefined ? parseInt(larga[5], 10) : undefined);
      if (f) return { fecha: f, conHora: h !== undefined };
    }
  }
  return null;
}

function ajustar12h(h: number, ampm: string): number {
  const pm = ampm.toLowerCase() === 'p';
  if (pm && h < 12) return h + 12;
  if (!pm && h === 12) return 0;
  return h;
}

/** Fecha del movimiento: la del texto si es creíble; si no, la de llegada o ahora. */
function resolverFecha(texto: string, opts: OpcionesParseo): { fecha: string; fechaConHora: boolean; fechaEstimada: boolean } {
  const ahora = opts.ahora ?? new Date();
  const p = parsearFecha(texto);
  // Una fecha futura (más de 1 día) o de hace más de un año es un mal parseo.
  if (p && p.fecha.getTime() <= ahora.getTime() + 86_400_000 && ahora.getTime() - p.fecha.getTime() < 366 * 86_400_000) {
    return { fecha: p.fecha.toISOString(), fechaConHora: p.conHora, fechaEstimada: false };
  }
  if (opts.recibidoEn) return { fecha: opts.recibidoEn.toISOString(), fechaConHora: true, fechaEstimada: false };
  return { fecha: ahora.toISOString(), fechaConHora: false, fechaEstimada: true };
}

// ─── Entidades ────────────────────────────────────────────────────────────────

const ENTIDAD_PATRONES: [RegExp, string][] = [
  [/banco de bogot[aá]/i, 'bogota'],
  [/av\s?villas/i, 'avvillas'],
  [/bancolombia/i, 'bancolombia'],
  [/davivienda/i, 'davivienda'],
  [/daviplata/i, 'daviplata'],
  [/\bnequi\b/i, 'nequi'],
  [/\bbbva\b/i, 'bbva'],
  [/banco de occidente/i, 'occidente'],
  [/banco popular/i, 'popular'],
  [/caja social/i, 'cajasocial'],
  [/colpatria|scotiabank/i, 'colpatria'],
  [/\bita[uú]\b/i, 'itau'],
  [/banco falabella/i, 'falabella'],
  [/\blulo\b/i, 'lulo'],
  [/rappi\s?pay|rappicard/i, 'rappipay'],
  [/\bmovii\b/i, 'movii'],
  // Marcas cortas o que son palabras comunes: solo con su forma inequívoca.
  [/\bdale!/i, 'dale'],
  [/\bNu (?:Colombia|Bank)\b|^Nu:|tu tarjeta Nu\b/, 'nu'],
];

/** Entidad que envía el mensaje (la primera mencionada, que suele ser el emisor). */
export function detectarEntidad(texto: string): string | undefined {
  let mejor: { id: string; pos: number } | undefined;
  for (const [re, id] of ENTIDAD_PATRONES) {
    const m = re.exec(texto);
    if (m && (!mejor || m.index < mejor.pos)) mejor = { id, pos: m.index };
  }
  return mejor?.id;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

const limpiarNombre = (s: string | undefined) => {
  const t = (s ?? '').replace(/\s+/g, ' ').replace(/[.,;:\s]+$/, '').trim();
  return t.length > 0 ? t.substring(0, 80) : undefined;
};

/** Palabras que los bancos ponen donde iría el comercio pero no lo son. */
const COMERCIO_GENERICO = /^(internet|compra|comercio|establecimiento|pago|n\/a)$/i;
const comercioValido = (s: string | undefined) => {
  const c = limpiarNombre(s);
  return c && !COMERCIO_GENERICO.test(c) ? c : undefined;
};

const MONTO = String.raw`\$?\s*(\d[\d.,]*\d|\d)`;

function movimiento(
  base: Omit<MovimientoDetectado, 'fecha' | 'fechaConHora' | 'fechaEstimada'>,
  texto: string,
  opts: OpcionesParseo,
): ResultadoParseo {
  return { estado: 'movimiento', movimiento: { ...base, ...resolverFecha(texto, opts) } };
}

// ─── Plantillas estrictas por banco ───────────────────────────────────────────

type Plantilla = (t: string, opts: OpcionesParseo) => ResultadoParseo | null;

const PLANTILLAS: Plantilla[] = [
  // Banco de Bogotá — "Tu compra por 23,900 fue aprobada con Tarjeta Crédito 0897 el 29/09/26 23:56:33 en APPLE.COM/BILL ¿Dudas?…"
  (t, opts) => {
    const m = t.match(new RegExp(String.raw`Tu compra por\s+${MONTO}\s+fue\s+(aprobada|rechazada)[\s\S]*?Tarjeta\s*(Cr[eé]dito|D[eé]bito)\s*(\d{4})\s+el\s+[\d/: -]+?\s*en\s+(.+?)(?:\s*¿|\s*$)`, 'i'));
    if (!m) return null;
    if (/rechazada/i.test(m[2])) return { estado: 'ignorado', motivo: 'rechazada' };
    const monto = parsearMonto(m[1]);
    if (!monto) return { estado: 'ignorado', motivo: 'sin_monto' };
    return movimiento({
      monto, tipo: 'compra', canal: 'tarjeta', comercio: comercioValido(m[5]), ultimos4: m[4],
      entidad: detectarEntidad(t) ?? 'bogota', plantilla: 'bogota_compra', confianza: 0.95,
    }, t, opts);
  },

  // AV Villas — "PAGO PSE DE TU CTA 4513 POR $ 252,624 EN INTERNET. TU SALDO ES $ 3,971,961"
  (t, opts) => {
    const m = t.match(new RegExp(String.raw`PAGO PSE DE TU (?:CTA|CUENTA)\s*\*?(\d{4})\s+POR\s+${MONTO}\s+EN\s+(.+?)(?:\.\s*TU SALDO|\.|$)`, 'i'));
    if (!m) return null;
    const monto = parsearMonto(m[2]);
    if (!monto) return { estado: 'ignorado', motivo: 'sin_monto' };
    return movimiento({
      monto, tipo: 'pago', canal: 'pse', comercio: comercioValido(m[3]), ultimos4: m[1],
      entidad: detectarEntidad(t), plantilla: 'pse_cuenta', confianza: 0.9,
    }, t, opts);
  },

  // SMS de PSE — "usted ha realizado un Pago PSE en la pagina del FONDO NACIONAL DEL AHORRO por un valor de $200,000.00 y ha sido Exitoso"
  (t, opts) => {
    const m = t.match(new RegExp(String.raw`Pago PSE en la p[aá]gina del?\s+(.+?)\s+por un valor de\s+${MONTO}\s+y ha sido\s+(\w+)`, 'i'));
    if (!m) return null;
    if (!/exitos/i.test(m[3])) return { estado: 'ignorado', motivo: 'rechazada' };
    const monto = parsearMonto(m[2]);
    if (!monto) return { estado: 'ignorado', motivo: 'sin_monto' };
    return movimiento({
      monto, tipo: 'pago', canal: 'pse', comercio: comercioValido(m[1]),
      entidad: detectarEntidad(t), plantilla: 'pse_sms', confianza: 0.9,
    }, t, opts);
  },

  // Correo de PSE — "Valor: $ 200.000,00 / Empresa: … / Descripción: … / Fecha de la transacción: 29/09/2026 / CUS: …"
  (t, opts) => {
    if (!/Valor:/i.test(t) || !/(Empresa|Comercio):/i.test(t)) return null;
    const estado = t.match(/Estado de la Transacci[oó]n:\s*(\w+)/i)?.[1];
    if (estado && !/aprobad|exitos/i.test(estado)) return { estado: 'ignorado', motivo: 'rechazada' };
    const valor = t.match(new RegExp(String.raw`Valor:\s*${MONTO}`, 'i'));
    const monto = valor ? parsearMonto(valor[1]) : null;
    if (!monto) return { estado: 'ignorado', motivo: 'sin_monto' };
    const campo = (nombre: string) => t.match(new RegExp(`${nombre}:[ \\t]*([^\\n\\r]+?)(?=\\s+(?:Descripci|Fecha de|CUS:|Valor:|Empresa:|Gracias)|[\\n\\r]|$)`, 'i'))?.[1];
    const fechaTxt = t.match(/Fecha de la transacci[oó]n:\s*([^\n\r]+)/i)?.[1] ?? '';
    return movimiento({
      monto, tipo: 'pago', canal: 'pse',
      comercio: comercioValido(campo('(?:Empresa|Comercio)')),
      detalle: limpiarNombre(campo('Descripci[oó]n')),
      referencia: t.match(/CUS:\s*(\d{4,20})/i)?.[1],
      entidad: undefined, plantilla: 'pse_correo', confianza: 0.95,
    }, fechaTxt || t, opts);
  },

  // Bre-B desde una cuenta — "AVVillas, 29/09/26 09:59 Enviaste $ 20,000 a YUNERI TATIANA VALER por Bre-B de tu cuenta 4513 a BANCA DIGITAL NEQUI"
  (t, opts) => {
    const m = t.match(new RegExp(String.raw`Enviaste\s+${MONTO}\s+a\s+(.+?)\s+por\s+Bre-?B\s+de tu cuenta\s*\*?(\d{4})(?:\s+a\s+(.+?))?\s*$`, 'i'));
    if (!m) return null;
    const monto = parsearMonto(m[1]);
    if (!monto) return { estado: 'ignorado', motivo: 'sin_monto' };
    return movimiento({
      monto, tipo: 'transferencia', canal: 'breb', destinatario: limpiarNombre(m[2]),
      destino: limpiarNombre(m[4]), ultimos4: m[3],
      entidad: detectarEntidad(t), plantilla: 'breb_cuenta', confianza: 0.95,
    }, t, opts);
  },

  // Correo de Nequi (Bre-B) — "Enviaste de manera exitosa 14.200 a la llave 0092824864 de JEINNER GUTIERREZ el 30 de septiembre de 2026 a las 8:50 a.m."
  (t, opts) => {
    const m = t.match(new RegExp(String.raw`Enviaste de manera exitosa\s+${MONTO}\s+a la llave\s+\S+\s+de\s+(.+?)\s+el\s+\d`, 'i'));
    if (!m) return null;
    const monto = parsearMonto(m[1]);
    if (!monto) return { estado: 'ignorado', motivo: 'sin_monto' };
    return movimiento({
      monto, tipo: 'transferencia', canal: 'breb', destinatario: limpiarNombre(m[2]),
      // La llave (celular o documento) no se guarda: es dato personal del destinatario.
      entidad: detectarEntidad(t) ?? 'nequi', plantilla: 'breb_nequi_correo', confianza: 0.95,
    }, t, opts);
  },

  // Bancolombia — "Bancolombia le informa Compra por $45.000,00 en EXITO COLOMBIA 30/09/2026 12:34 T.Cred *1234."
  //               "Bancolombia: Compraste $45.000,00 en EXITO con tu T.Deb *1234, el 30/09/2026 a las 12:34."
  (t, opts) => {
    const m = t.match(new RegExp(String.raw`Compra(?:ste| por)\s+${MONTO}\s+en\s+(.+?)\s+(?:con tu\s+|\d{1,2}/\d{1,2}/\d{2,4}[\s\S]*?)?T\.?\s?(Cred|Deb)\w*\.?\s*\*?(\d{4})`, 'i'));
    if (!m) return null;
    const monto = parsearMonto(m[1]);
    if (!monto) return { estado: 'ignorado', motivo: 'sin_monto' };
    const comercio = m[2].replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}.*$/, '');
    return movimiento({
      monto, tipo: 'compra', canal: 'tarjeta', comercio: comercioValido(comercio), ultimos4: m[4],
      entidad: detectarEntidad(t), plantilla: 'bancolombia_compra', confianza: 0.9,
    }, t, opts);
  },
];

// ─── Filtros ──────────────────────────────────────────────────────────────────

const SEGURIDAD = /inici(?:a|ó|o)ste sesi[oó]n|c[oó]digo (?:de )?(?:verificaci[oó]n|seguridad|confirmaci[oó]n)|clave (?:din[aá]mica|temporal|segura)|\bOTP\b|no compartas|contrase[nñ]a|token/i;
const RECHAZO = /rechazad|declinad|no (?:fue|ha sido) (?:aprobad|exitos)|fallid|no exitos|no se pudo realizar/i;

// ─── Parser genérico ──────────────────────────────────────────────────────────

const VERBOS: [RegExp, TipoMovimiento, CanalMovimiento][] = [
  [/\b(?:compraste|compra (?:por|de|aprobada)|compra\b)/i, 'compra', 'tarjeta'],
  [/\b(?:pagaste|pago (?:por|de|a)|pago exitoso|realizaste un pago)/i, 'pago', 'desconocido'],
  [/\b(?:retiraste|retiro (?:por|de))/i, 'retiro', 'cuenta'],
  [/\b(?:enviaste|transferiste|transferencia (?:por|de|a))/i, 'transferencia', 'cuenta'],
  [/\b(?:recibiste|te (?:enviaron|consignaron|transfirieron)|abono (?:por|de)|consignaci[oó]n (?:por|de))/i, 'ingreso', 'cuenta'],
];

function parsearGenerico(t: string, opts: OpcionesParseo): ResultadoParseo | null {
  const verbo = VERBOS.find(([re]) => re.test(t));
  if (!verbo) return null;
  const [reVerbo, tipo, canalBase] = verbo;
  const desde = t.search(reVerbo);

  // Primer monto después del verbo que no sea un saldo.
  const reMonto = /(?:\$\s*|COP\s*|por\s+)(\d[\d.,]*\d|\d)/gi;
  reMonto.lastIndex = Math.max(0, desde);
  let monto: number | null = null;
  let finMonto = -1;
  for (let m = reMonto.exec(t); m; m = reMonto.exec(t)) {
    const antes = t.slice(Math.max(0, m.index - 20), m.index);
    if (/saldo|disponible|cupo/i.test(antes)) continue;
    monto = parsearMonto(m[1]);
    if (monto) { finMonto = m.index + m[0].length; break; }
  }
  if (!monto) return { estado: 'ignorado', motivo: 'sin_monto' };

  const resto = t.slice(finMonto);
  const ultimos4 = t.match(/(?:\*|terminad[ao] en\s*|T\.?\s?(?:Cred|Deb)\w*\.?\s*\*?|(?:cta|cuenta|tarjeta)\s*(?:\w+\s*)?\*?)(\d{4})\b/i)?.[1];
  const esTarjeta = /tarjeta|T\.?\s?(?:Cred|Deb)|cr[eé]dito|d[eé]bito/i.test(t);

  let comercio: string | undefined;
  let destinatario: string | undefined;
  if (tipo === 'transferencia') {
    destinatario = limpiarNombre(resto.match(/^\s*a\s+(?:la cuenta\s+\S+\s+de\s+)?([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ ]{2,60}?)(?=\s+(?:el|por|desde|a|de|con)\b|[.,]|$)/)?.[1]);
  } else if (tipo === 'ingreso') {
    destinatario = limpiarNombre(resto.match(/^\s*de\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ ]{2,60}?)(?=\s+(?:el|por|en|a|con)\b|[.,]|$)/)?.[1]);
  } else {
    comercio = comercioValido(resto.match(/^\s*(?:en|a)\s+(.+?)(?=\s+(?:con|el|desde|T\.|\d{1,2}\/)|[,.](?:\s|$)|\s*¿|$)/i)?.[1]);
  }

  return movimiento({
    monto, tipo,
    canal: esTarjeta && tipo !== 'transferencia' && tipo !== 'ingreso' ? 'tarjeta' : /bre-?b/i.test(t) ? 'breb' : /\bpse\b/i.test(t) ? 'pse' : canalBase,
    ...(comercio ? { comercio } : {}),
    ...(destinatario ? { destinatario } : {}),
    ...(ultimos4 ? { ultimos4 } : {}),
    entidad: detectarEntidad(t),
    plantilla: 'generico',
    confianza: comercio || destinatario ? 0.7 : 0.55,
  }, t, opts);
}

// ─── API ──────────────────────────────────────────────────────────────────────

export function parsearMensaje(texto: string, opts: OpcionesParseo = {}): ResultadoParseo {
  const t = texto.replace(/\u00a0/g, ' ').trim();
  if (!t) return { estado: 'desconocido' };

  for (const plantilla of PLANTILLAS) {
    const r = plantilla(t, opts);
    if (r) return r;
  }

  if (SEGURIDAD.test(t)) {
    // "29-09-26 08:42 RICARDO MOSQUERA: Iniciaste sesion…": el banco dice el
    // nombre del titular. Sirve para reconocer envíos a sus propias cuentas.
    const titular = t.match(/^\d{2}[-/]\d{2}[-/]\d{2,4}\s+\d{1,2}:\d{2}\s+([A-ZÁÉÍÓÚÑ]{2,}(?: [A-ZÁÉÍÓÚÑ]{2,}){1,4}):/)?.[1];
    return titular ? { estado: 'ignorado', motivo: 'seguridad', titular } : { estado: 'ignorado', motivo: 'seguridad' };
  }
  if (RECHAZO.test(t)) return { estado: 'ignorado', motivo: 'rechazada' };

  return parsearGenerico(t, opts) ?? { estado: 'desconocido' };
}

/**
 * Separa un bloque pegado con varios mensajes. Corta en líneas en blanco y,
 * dentro de un párrafo, antes de cada encabezado típico de alerta bancaria
 * ("Banco de Bogota:", "AVVillas,", "29-09-26 08:42 NOMBRE:", "Estimado cliente").
 */
export function dividirMensajes(texto: string): string[] {
  const normal = texto.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
  // Un correo pegado trae muchas líneas cortas: se trata como un solo mensaje.
  if (/Valor:[\s\S]*(Empresa|Comercio):/i.test(normal) || /Enviaste de manera exitosa/i.test(normal)) {
    return [normal.trim()];
  }
  const encabezado = /(?=(?:Banco de Bogot[aá]:|AV ?Villas[.,]\s*\d{2}\/|Bancolombia(?: le informa|:)|Estimado cliente|Davivienda:|Nequi:|\d{2}-\d{2}-\d{2} \d{2}:\d{2} [A-ZÁÉÍÓÚÑ ]+:))/i;
  return normal
    .split(/\n\s*\n/)
    .flatMap(p => p.replace(/\s*\n\s*/g, ' ').split(encabezado))
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
