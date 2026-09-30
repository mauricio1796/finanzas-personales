/**
 * Medios de pago (Billetera): catálogo, validación y cálculos puros.
 *
 * Seguridad (PCI DSS): la app NUNCA pide ni guarda el número completo de la
 * tarjeta, el CVV, la fecha de vencimiento ni claves. Solo alias, franquicia y
 * los últimos 4 dígitos. `contieneNumeroSensible` bloquea en el cliente que el
 * usuario escriba un número de tarjeta o de cuenta en el alias; el servidor lo
 * vuelve a comprobar con un CHECK (migración 20260930_medios_pago).
 *
 * Sin dependencias de React Native: se prueba con `npm test`.
 */

import type { Franquicia, MedioPago, TipoMedioPago, Transaction } from '../types';

// ─── Catálogo ─────────────────────────────────────────────────────────────────

export interface TipoMedioInfo {
  id: TipoMedioPago;
  label: string;
  descripcion: string;
  icon: string;
}

export const TIPOS_MEDIO: TipoMedioInfo[] = [
  { id: 'credito',   label: 'Tarjeta de crédito', descripcion: 'Con cupo, fecha de corte y de pago', icon: 'credit-card' },
  { id: 'debito',    label: 'Tarjeta débito',     descripcion: 'Descuenta de tu cuenta',             icon: 'credit-card' },
  { id: 'billetera', label: 'Billetera digital',  descripcion: 'Nequi, Daviplata, Movii…',           icon: 'smartphone'  },
  { id: 'cuenta',    label: 'Cuenta bancaria',    descripcion: 'Transferencias y Bre-B',             icon: 'briefcase'   },
  { id: 'efectivo',  label: 'Efectivo',           descripcion: 'Billetes y monedas',                 icon: 'dollar-sign' },
];

export interface EntidadInfo {
  id: string;
  nombre: string;
  /** Color de la tarjeta en la Billetera. */
  color: string;
  /** Color del texto sobre `color`. */
  texto: string;
  tipos: TipoMedioPago[];
}

const BANCO: TipoMedioPago[] = ['credito', 'debito', 'cuenta'];

export const ENTIDADES: EntidadInfo[] = [
  { id: 'bancolombia', nombre: 'Bancolombia',          color: '#FDDA24', texto: '#1A1A1A', tipos: BANCO },
  { id: 'davivienda',  nombre: 'Davivienda',           color: '#E1111C', texto: '#FFFFFF', tipos: BANCO },
  { id: 'bbva',        nombre: 'BBVA',                 color: '#004481', texto: '#FFFFFF', tipos: BANCO },
  { id: 'bogota',      nombre: 'Banco de Bogotá',      color: '#0A3C7D', texto: '#FFFFFF', tipos: BANCO },
  { id: 'occidente',   nombre: 'Banco de Occidente',   color: '#0058A3', texto: '#FFFFFF', tipos: BANCO },
  { id: 'popular',     nombre: 'Banco Popular',        color: '#00843D', texto: '#FFFFFF', tipos: BANCO },
  { id: 'avvillas',    nombre: 'AV Villas',            color: '#C8102E', texto: '#FFFFFF', tipos: BANCO },
  { id: 'cajasocial',  nombre: 'Banco Caja Social',    color: '#0072BC', texto: '#FFFFFF', tipos: BANCO },
  { id: 'colpatria',   nombre: 'Scotiabank Colpatria', color: '#EC111A', texto: '#FFFFFF', tipos: BANCO },
  { id: 'itau',        nombre: 'Itaú',                 color: '#EC7000', texto: '#FFFFFF', tipos: BANCO },
  { id: 'falabella',   nombre: 'Banco Falabella',      color: '#2E7D32', texto: '#FFFFFF', tipos: BANCO },
  { id: 'nu',          nombre: 'Nu',                   color: '#820AD1', texto: '#FFFFFF', tipos: ['credito', 'debito', 'cuenta'] },
  { id: 'lulo',        nombre: 'Lulo Bank',            color: '#1FB57A', texto: '#FFFFFF', tipos: ['credito', 'debito', 'cuenta'] },
  { id: 'rappipay',    nombre: 'RappiPay',             color: '#FF441F', texto: '#FFFFFF', tipos: ['credito', 'debito', 'billetera'] },
  { id: 'nequi',       nombre: 'Nequi',                color: '#DA0081', texto: '#FFFFFF', tipos: ['billetera', 'debito'] },
  { id: 'daviplata',   nombre: 'Daviplata',            color: '#EF3340', texto: '#FFFFFF', tipos: ['billetera', 'debito'] },
  { id: 'movii',       nombre: 'Movii',                color: '#6C2DC7', texto: '#FFFFFF', tipos: ['billetera', 'debito'] },
  { id: 'dale',        nombre: 'dale!',                color: '#00A3E0', texto: '#FFFFFF', tipos: ['billetera'] },
  { id: 'efectivo',    nombre: 'Efectivo',             color: '#15803D', texto: '#FFFFFF', tipos: ['efectivo'] },
  { id: 'otra',        nombre: 'Otra entidad',         color: '#334155', texto: '#FFFFFF', tipos: ['credito', 'debito', 'billetera', 'cuenta'] },
];

export const FRANQUICIAS: { id: Franquicia; label: string }[] = [
  { id: 'visa',       label: 'Visa' },
  { id: 'mastercard', label: 'Mastercard' },
  { id: 'amex',       label: 'American Express' },
  { id: 'diners',     label: 'Diners' },
  { id: 'otra',       label: 'Otra' },
];

export function entidadPorId(id: string | undefined): EntidadInfo {
  return ENTIDADES.find(e => e.id === id) ?? ENTIDADES[ENTIDADES.length - 1];
}

export function entidadesParaTipo(tipo: TipoMedioPago): EntidadInfo[] {
  return ENTIDADES.filter(e => e.tipos.includes(tipo));
}

export function tipoInfo(tipo: TipoMedioPago): TipoMedioInfo {
  return TIPOS_MEDIO.find(t => t.id === tipo) ?? TIPOS_MEDIO[0];
}

export const esTarjeta = (tipo: TipoMedioPago) => tipo === 'credito' || tipo === 'debito';

// ─── Validación ───────────────────────────────────────────────────────────────

/**
 * ¿Parece un número de tarjeta o de cuenta? 6 o más dígitos seguidos, aunque
 * estén separados por espacios, guiones o puntos ("4111 1111 1111 1111").
 */
export function contieneNumeroSensible(texto: string): boolean {
  return /\d(?:[\s.-]?\d){5,}/.test(texto);
}

/** Solo acepta exactamente 4 dígitos; cualquier otra cosa devuelve null. */
export function normalizarUltimos4(texto: string | undefined): string | null {
  const digitos = (texto ?? '').replace(/\D/g, '');
  return /^\d{4}$/.test(digitos) ? digitos : null;
}

export interface MedioPagoInput {
  tipo: TipoMedioPago;
  entidad: string;
  alias: string;
  ultimos4?: string;
  franquicia?: Franquicia;
  cupo?: number;
  diaCorte?: number;
  diaPago?: number;
}

export type ErroresMedio = Partial<Record<'alias' | 'ultimos4' | 'cupo' | 'diaCorte' | 'diaPago' | 'entidad', string>>;

const diaValido = (d: number | undefined) => d === undefined || (Number.isInteger(d) && d >= 1 && d <= 31);

export function validarMedioPago(input: MedioPagoInput): { ok: boolean; errores: ErroresMedio } {
  const errores: ErroresMedio = {};
  const alias = input.alias.trim();

  if (!alias) errores.alias = 'Ponle un nombre para reconocerlo.';
  else if (alias.length > 40) errores.alias = 'Máximo 40 caracteres.';
  else if (contieneNumeroSensible(alias)) {
    errores.alias = 'Por tu seguridad, no escribas números de tarjeta ni de cuenta.';
  }

  if (!ENTIDADES.some(e => e.id === input.entidad)) errores.entidad = 'Elige la entidad.';

  if (input.ultimos4 !== undefined && input.ultimos4 !== '') {
    if (!esTarjeta(input.tipo) && input.tipo !== 'cuenta' && input.tipo !== 'billetera') {
      errores.ultimos4 = 'Este medio no lleva número.';
    } else if (!normalizarUltimos4(input.ultimos4)) {
      errores.ultimos4 = 'Escribe solo los últimos 4 dígitos.';
    }
  }

  if (input.tipo === 'credito') {
    if (input.cupo !== undefined && (!Number.isFinite(input.cupo) || input.cupo < 0)) errores.cupo = 'Cupo inválido.';
    if (!diaValido(input.diaCorte)) errores.diaCorte = 'Un día entre 1 y 31.';
    if (!diaValido(input.diaPago)) errores.diaPago = 'Un día entre 1 y 31.';
  }

  return { ok: Object.keys(errores).length === 0, errores };
}

/**
 * Construye el MedioPago listo para guardar a partir del formulario. Descarta
 * los campos que no aplican al tipo (franquicia solo en tarjetas; cupo y
 * fechas solo en crédito) para que coincida con los CHECK del servidor.
 */
export function construirMedioPago(
  input: MedioPagoInput,
  existentes: MedioPago[],
  ahora: Date = new Date(),
  id?: string,
): MedioPago {
  const entidad = entidadPorId(input.entidad);
  const ultimos4 = normalizarUltimos4(input.ultimos4);
  const esCredito = input.tipo === 'credito';
  const activos = existentes.filter(m => !m.archivado && m.id !== id);
  return {
    id: id ?? `pm_${ahora.getTime()}`,
    tipo: input.tipo,
    entidad: entidad.id,
    alias: input.alias.trim(),
    ...(ultimos4 && input.tipo !== 'efectivo' ? { ultimos4 } : {}),
    ...(esTarjeta(input.tipo) && input.franquicia ? { franquicia: input.franquicia } : {}),
    color: entidad.color,
    ...(esCredito && input.cupo !== undefined ? { cupo: Math.round(input.cupo) } : {}),
    ...(esCredito && input.diaCorte !== undefined ? { diaCorte: input.diaCorte } : {}),
    ...(esCredito && input.diaPago !== undefined ? { diaPago: input.diaPago } : {}),
    // El primero que se agrega queda como predeterminado.
    predeterminado: activos.length === 0,
    archivado: false,
    creadoEn: ahora.toISOString(),
  };
}

// ─── Presentación ─────────────────────────────────────────────────────────────

/** "Visa Oro ••1234" */
export function etiquetaMedio(m: Pick<MedioPago, 'alias' | 'ultimos4'>): string {
  return m.ultimos4 ? `${m.alias} ••${m.ultimos4}` : m.alias;
}

/** "Crédito · Visa · Bancolombia" */
export function descripcionMedio(m: MedioPago): string {
  const partes: string[] = [];
  const tipo = { credito: 'Crédito', debito: 'Débito', billetera: 'Billetera', cuenta: 'Cuenta', efectivo: 'Efectivo' }[m.tipo];
  partes.push(tipo);
  if (m.franquicia && m.franquicia !== 'otra') {
    partes.push(FRANQUICIAS.find(f => f.id === m.franquicia)?.label ?? '');
  }
  if (m.entidad !== 'efectivo' && m.entidad !== 'otra') partes.push(entidadPorId(m.entidad).nombre);
  return partes.filter(Boolean).join(' · ');
}

// ─── Colección ────────────────────────────────────────────────────────────────

/** Activos, con el predeterminado primero y luego por antigüedad. */
export function mediosActivos(medios: MedioPago[]): MedioPago[] {
  return medios
    .filter(m => !m.archivado)
    .sort((a, b) => {
      if (a.predeterminado !== b.predeterminado) return a.predeterminado ? -1 : 1;
      return a.creadoEn.localeCompare(b.creadoEn);
    });
}

export function medioPredeterminado(medios: MedioPago[]): MedioPago | null {
  return medios.find(m => m.predeterminado && !m.archivado) ?? null;
}

/** Deja `id` como único predeterminado. Devuelve solo los que cambiaron. */
export function aplicarPredeterminado(medios: MedioPago[], id: string): MedioPago[] {
  return medios
    .filter(m => (m.id === id) !== m.predeterminado)
    .map(m => ({ ...m, predeterminado: m.id === id }));
}

/** Un medio con movimientos se archiva (conserva el historial); sin movimientos se elimina. */
export function tieneMovimientos(medioId: string, transactions: Transaction[]): boolean {
  return transactions.some(t => t.paymentMethodId === medioId);
}

// ─── Fechas de tarjeta de crédito ─────────────────────────────────────────────

const diasDelMes = (año: number, mes: number) => new Date(año, mes + 1, 0).getDate();

/** Fecha del día `dia` en ese mes; si el mes es más corto, el último día (31 → 30 de junio). */
export function fechaConDia(año: number, mes: number, dia: number): Date {
  const d = new Date(año, mes, 1);
  return new Date(d.getFullYear(), d.getMonth(), Math.min(dia, diasDelMes(d.getFullYear(), d.getMonth())));
}

const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Ciclo de facturación que contiene `hoy`: desde el día siguiente al corte
 * anterior hasta el corte (inclusive). Corte el 15 y hoy 20 de sep → 16 sep – 15 oct.
 */
export function cicloFacturacion(diaCorte: number, hoy: Date = new Date()): { inicio: Date; fin: Date } {
  const h = inicioDelDia(hoy);
  const corteEsteMes = fechaConDia(h.getFullYear(), h.getMonth(), diaCorte);
  const fin = h <= corteEsteMes ? corteEsteMes : fechaConDia(h.getFullYear(), h.getMonth() + 1, diaCorte);
  const corteAnterior = fechaConDia(fin.getFullYear(), fin.getMonth() - 1, diaCorte);
  const inicio = new Date(corteAnterior.getFullYear(), corteAnterior.getMonth(), corteAnterior.getDate() + 1);
  return { inicio, fin };
}

/** Próxima fecha de pago (hoy incluido). */
export function proximaFechaPago(diaPago: number, hoy: Date = new Date()): Date {
  const h = inicioDelDia(hoy);
  const esteMes = fechaConDia(h.getFullYear(), h.getMonth(), diaPago);
  return h <= esteMes ? esteMes : fechaConDia(h.getFullYear(), h.getMonth() + 1, diaPago);
}

export function diasHasta(fecha: Date, hoy: Date = new Date()): number {
  return Math.round((inicioDelDia(fecha).getTime() - inicioDelDia(hoy).getTime()) / 86_400_000);
}

// ─── Resúmenes ────────────────────────────────────────────────────────────────

function sumaGastos(transactions: Transaction[], medioId: string, desde: Date, hastaInclusive: Date): { total: number; n: number } {
  const d = desde.getTime();
  const h = new Date(hastaInclusive.getFullYear(), hastaInclusive.getMonth(), hastaInclusive.getDate() + 1).getTime();
  let total = 0;
  let n = 0;
  for (const t of transactions) {
    if (t.type !== 'expense' || t.paymentMethodId !== medioId) continue;
    const ms = new Date(t.date).getTime();
    if (ms >= d && ms < h) { total += t.amount; n++; }
  }
  return { total, n };
}

export interface ResumenMedio {
  gastoMes: number;
  movimientosMes: number;
  /** Solo crédito con día de corte. */
  ciclo?: { inicio: Date; fin: Date; gasto: number };
  /** Solo crédito con cupo: estimado con lo registrado en Finn, no es el saldo del banco. */
  cupo?: { total: number; usado: number; disponible: number; pct: number };
  proximoPago?: { fecha: Date; dias: number };
}

export function resumenMedio(medio: MedioPago, transactions: Transaction[], hoy: Date = new Date()): ResumenMedio {
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const mes = sumaGastos(transactions, medio.id, inicioMes, finMes);
  const r: ResumenMedio = { gastoMes: mes.total, movimientosMes: mes.n };

  if (medio.tipo !== 'credito') return r;

  let usado = mes.total;
  if (medio.diaCorte) {
    const { inicio, fin } = cicloFacturacion(medio.diaCorte, hoy);
    const gasto = sumaGastos(transactions, medio.id, inicio, fin).total;
    r.ciclo = { inicio, fin, gasto };
    usado = gasto;
  }
  if (medio.cupo && medio.cupo > 0) {
    r.cupo = {
      total: medio.cupo,
      usado,
      disponible: Math.max(0, medio.cupo - usado),
      pct: Math.min(1, usado / medio.cupo),
    };
  }
  if (medio.diaPago) {
    const fecha = proximaFechaPago(medio.diaPago, hoy);
    r.proximoPago = { fecha, dias: diasHasta(fecha, hoy) };
  }
  return r;
}

export interface GastoPorMedio {
  medioId: string | null;
  total: number;
  n: number;
}

/** Gasto del mes agrupado por medio (null = sin medio asignado), de mayor a menor. */
export function gastoPorMedio(transactions: Transaction[], año: number, mes: number): GastoPorMedio[] {
  const mapa = new Map<string | null, GastoPorMedio>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const d = new Date(t.date);
    if (d.getFullYear() !== año || d.getMonth() !== mes) continue;
    const key = t.paymentMethodId ?? null;
    const actual = mapa.get(key) ?? { medioId: key, total: 0, n: 0 };
    actual.total += t.amount;
    actual.n++;
    mapa.set(key, actual);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}
