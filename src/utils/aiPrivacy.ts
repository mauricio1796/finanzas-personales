/**
 * Minimización de datos personales antes de enviarlos al proveedor de IA.
 *
 * Finn necesita el contexto financiero (montos, categorías, metas) para
 * responder, pero NO necesita identificadores: nombre, correo, teléfono,
 * números de documento o de tarjeta. Estas funciones eliminan esos patrones
 * del texto libre (descripciones de movimientos, nombres de metas, mensajes)
 * sin tocar los montos, que se escriben con separadores de miles o tienen
 * menos dígitos que un documento.
 *
 * Módulo puro (sin React Native): cubierto por tests/aiPrivacy.test.ts.
 */

const EMAIL_RE   = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// 13–19 dígitos con espacios o guiones opcionales (tarjetas, cuentas)
const CARD_RE    = /\b(?:\d[ -]?){12,18}\d\b/g;
// Celulares colombianos (+57 opcional, empiezan por 3, 10 dígitos) y fijos con indicativo 60X
const PHONE_RE   = /(?:\+?57[ -]?)?\b(?:3\d{2}|60\d)[ -]?\d{3}[ -]?\d{4}\b/g;
// Documento precedido de su sigla: CC 1.234.567.890, NIT 900123456-7, cédula 12345678, pasaporte AB123456
const DOC_RE     = /\b(?:c\.?\s?c\.?|c[ée]dula|nit|t\.?\s?i\.?|pasaporte|documento|doc\.?)\s*(?:n[°ºo.]?\s*)?[:#]?\s*[A-Za-z]{0,2}[\d.\- ]{5,15}\d\b/gi;
// Secuencias de 10+ dígitos sin separadores (celulares, cuentas, cédulas nuevas).
// Umbral en 10 para no borrar montos grandes escritos sin puntos ("45000000");
// una cédula antigua de 8 dígitos sin su sigla no se detecta (riesgo aceptado).
const LONG_NUM_RE = /(?<![\d.,$])\d{10,}(?![\d.,])/g;

/** Elimina identificadores personales de un texto libre. */
export function redactarPII(texto: string | null | undefined): string {
  if (!texto) return '';
  return String(texto)
    .replace(EMAIL_RE, '[correo]')
    .replace(DOC_RE, '[documento]')
    .replace(CARD_RE, '[número]')
    .replace(PHONE_RE, '[teléfono]')
    .replace(LONG_NUM_RE, '[número]');
}

/**
 * Quita del texto el nombre del usuario (si lo menciona en un mensaje o en
 * una descripción), para que no viaje al proveedor de IA.
 */
export function quitarNombre(texto: string, nombre: string | null | undefined): string {
  const n = (nombre ?? '').trim();
  if (n.length < 3) return texto;
  const partes = n.split(/\s+/).filter(p => p.length >= 3);
  let out = texto;
  for (const p of partes) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Límites Unicode (\b de JS no reconoce letras con tilde como "í" o "ñ").
    out = out.replace(new RegExp(`(?<!\\p{L})${esc}(?!\\p{L})`, 'giu'), '[usuario]');
  }
  return out;
}

/** Aplica ambas protecciones. */
export function minimizarParaIA(texto: string | null | undefined, nombre?: string | null): string {
  return quitarNombre(redactarPII(texto), nombre);
}
