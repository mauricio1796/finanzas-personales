/**
 * Motor de captura automática: decide qué hacer con cada movimiento que el
 * parser reconoció en un mensaje del banco.
 *
 *   movimiento → ¿duplicado? → ¿con qué medio? → ¿qué categoría? → registrar | por confirmar
 *
 * - Duplicados: la misma compra suele llegar por varios canales (dos SMS del
 *   mismo banco, SMS + correo de PSE). Se fusionan en un solo movimiento.
 * - Categoría: 1) reglas que Finn aprendió de tus correcciones, 2) diccionario
 *   de comercios colombianos, 3) Finn IA (lo hace CapturaService, fuera de
 *   este módulo). Sin certeza suficiente, el usuario confirma.
 * - Nunca se registra solo una transferencia, un ingreso ni un retiro: Finn no
 *   puede saber para qué fue; van a la bandeja "Por confirmar".
 *
 * Sin dependencias en tiempo de ejecución (solo tipos): se prueba con `npm test`.
 */

import type { Category, MedioPago, OrigenTransaccion, Transaction } from '../types';
import type { MovimientoDetectado, ResultadoParseo, MotivoIgnorado } from './capturaParser';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ReglaComercio {
  /** normalizarComercio(comercio) */
  clave: string;
  categoryId: string;
  categoryName: string;
  usos: number;
  actualizadaEn: string;
}

export type FuenteSugerencia = 'regla' | 'diccionario' | 'finn';

export interface SugerenciaCategoria {
  categoryId: string;
  categoryName: string;
  confianza: number;
  fuente: FuenteSugerencia;
}

export interface CapturaPendiente {
  id: string;
  movimiento: MovimientoDetectado;
  huella: string;
  medioId?: string;
  sugerencia?: SugerenciaCategoria;
  /** Finn cree que no es un gasto (envío entre tus cuentas, retiro, ya registrado). */
  sugerirIgnorar: boolean;
  motivo: string;
  origen: OrigenTransaccion;
  creadaEn: string;
}

export type EstadoItem = 'registrado' | 'por_confirmar' | 'duplicado' | 'ignorado' | 'no_reconocido';

export interface ItemResultado {
  estado: EstadoItem;
  motivo: string;
  movimiento?: MovimientoDetectado;
  txId?: string;
  pendienteId?: string;
  categoria?: string;
  medioId?: string;
}

export interface ContextoMotor {
  categories: Category[];
  medios: MedioPago[];
  reglas: ReglaComercio[];
  transactions: Transaction[];
  pendientes: CapturaPendiente[];
  /**
   * Nombres del usuario: el de su perfil y los que sus bancos usan como
   * titular (aprendidos de los avisos de inicio de sesión).
   */
  nombresUsuario?: string[];
  /** Huellas de avisos que el usuario descartó: no vuelven a la bandeja. */
  huellasIgnoradas?: string[];
  origen: OrigenTransaccion;
  ahora: Date;
}

export interface ResultadoLote {
  items: ItemResultado[];
  /** Transacciones listas para agregar. */
  registrar: Transaction[];
  /** Lista completa de pendientes tras el lote (reemplaza a la anterior). */
  pendientes: CapturaPendiente[];
  /** Transacciones ya registradas a las que un duplicado les aporta datos (p. ej. el comercio). */
  enriquecer: { id: string; update: Partial<Transaction> }[];
  /** Nombres de titular que aparecieron en este lote (para recordarlos). */
  titulares: string[];
}

/** Umbral para registrar sin preguntar. */
export const CONFIANZA_AUTO = 0.85;

/** Opciones de categoría al confirmar un ingreso (mismas que el registro rápido). */
export const OPCIONES_INGRESO = [
  { id: 'salario', label: 'Salario' },
  { id: 'freelance', label: 'Freelance' },
  { id: 'negocio', label: 'Negocio' },
  { id: 'inversiones', label: 'Inversiones' },
  { id: 'otros', label: 'Otros' },
];

// ─── Normalización ────────────────────────────────────────────────────────────

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const SUFIJOS = new Set(['sas', 'sa', 'ltda', 'inc', 'llc', 'colombia', 'col', 'co', 'www', 'bill']);

/** "RAPPI*RESTAURANTE 123" → "rappi restaurante"; "Pexto Capital SAS" → "pexto capital". */
export function normalizarComercio(comercio: string | undefined): string {
  if (!comercio) return '';
  const tokens = sinTildes(comercio.toLowerCase())
    .replace(/s\.a\.s\.?|s\.a\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(t => t && !/^\d+$/.test(t) && !SUFIJOS.has(t));
  return tokens.join(' ').trim();
}

const normalizarNombre = (s: string) => sinTildes(s.toLowerCase()).trim();

// ─── Diccionario de comercios colombianos ─────────────────────────────────────

interface EntradaDiccionario {
  re: RegExp;
  /** Nombres de categoría en orden de preferencia (se busca el primero que el usuario tenga). */
  categorias: string[];
  confianza: number;
}

/** Se evalúa sobre `normalizarComercio(comercio + detalle)`, en este orden. */
export const DICCIONARIO: EntradaDiccionario[] = [
  { re: /\b(fondo nacional del ahorro|fna|ahorro voluntario|cdt|fiducuenta|fiducia|fondo de inversion|pension voluntaria)\b/, categorias: ['Ahorros', 'Ahorro'], confianza: 0.92 },
  { re: /\b(netflix|spotify|disney|hbo|prime video|youtube|apple com|icloud|google (one|play|storage)|adobe|microsoft|office 365|canva|chatgpt|openai|deezer|crunchyroll|paramount|star plus|dropbox)\b/, categorias: ['Suscripciones', 'Entretenimiento'], confianza: 0.92 },
  { re: /\b(uber|didi|cabify|indrive|picap|taxi|transmilenio|tullave|metro de medellin|civica|sitp|terpel|primax|esso|mobil|texaco|biomax|peaje|parqueadero|parking|gasolina|eds)\b/, categorias: ['Transporte'], confianza: 0.9 },
  { re: /\b(exito|carulla|jumbo|olimpica|d1|ara|makro|pricesmart|surtimax|isimo|colsubsidio|supermercado|oxxo|justo y bueno|merqueo|farmatodo mercado)\b/, categorias: ['Mercado'], confianza: 0.9 },
  { re: /\b(claro|movistar|tigo|wom|etb|epm|enel|codensa|vanti|gas natural|acueducto|emcali|celsia|afinia|air e|triple a|directv|factura movil|recarga)\b/, categorias: ['Servicios'], confianza: 0.9 },
  { re: /\b(restaurante|frisby|kfc|mcdonald|burger|crepes|el corral|juan valdez|starbucks|tostao|oma|dominos|pizza|subway|sushi|wok|presto|qbano|ifood|domicilios)\b/, categorias: ['Restaurantes', 'Comida'], confianza: 0.9 },
  { re: /\brappi\b/, categorias: ['Restaurantes', 'Comida', 'Mercado'], confianza: 0.75 },
  { re: /\b(cruz verde|locatel|drogueria|farmacia|farmatodo|colsanitas|sanitas|nueva eps|laboratorio|clinica|hospital|odontolog\w*|optica)\b/, categorias: ['Salud'], confianza: 0.9 },
  { re: /\b(smart ?fit|bodytech|stark|gimnasio|gym|spinning)\b/, categorias: ['Gimnasio'], confianza: 0.9 },
  { re: /\b(cine colombia|cinemark|procinal|cinepolis|royal films|tuboleta|eticket|ticketmaster|teatro)\b/, categorias: ['Cine / Planes', 'Entretenimiento'], confianza: 0.9 },
  { re: /\b(avianca|latam|wingo|clic air|satena|booking|airbnb|despegar|expedia|hotel|hostal)\b/, categorias: ['Viajes'], confianza: 0.9 },
  { re: /\b(zara|koaj|arturo calle|studio f|adidas|nike|bershka|pull and bear|stradivarius|tennis|mario hernandez|velez|totto|h m)\b/, categorias: ['Ropa'], confianza: 0.88 },
  { re: /\b(universidad|colegio|icetex|platzi|udemy|coursera|domestika|libreria|panamericana)\b/, categorias: ['Educación'], confianza: 0.88 },
  { re: /\b(arriendo|arrendamiento|inmobiliaria|administracion)\b/, categorias: ['Arriendo'], confianza: 0.88 },
  { re: /\b(soat|seguro|seguros|allianz|mapfre|liberty|seguros bolivar)\b/, categorias: ['Seguros'], confianza: 0.88 },
  { re: /\b(veterinari\w*|puppis|laika|mascota\w*)\b/, categorias: ['Mascotas'], confianza: 0.88 },
  { re: /\b(peluqueria|barberia|spa|sephora|natura|yanbal|jolie|cosmetic\w*)\b/, categorias: ['Cuidado Personal'], confianza: 0.85 },
  { re: /\b(pago tarjeta|abono tarjeta|prestamo|cuota credito|credito)\b/, categorias: ['Deudas'], confianza: 0.8 },
  { re: /\b(mercado ?libre|amazon|temu|shein|aliexpress|alkosto|ktronix|homecenter|falabella)\b/, categorias: ['Otros'], confianza: 0.7 },
];

// ─── Categorización ───────────────────────────────────────────────────────────

/** Categoría del usuario (de gasto, de primer nivel) que corresponde a un nombre del diccionario. */
function buscarCategoria(nombre: string, categories: Category[]): Category | undefined {
  const objetivo = normalizarNombre(nombre);
  const candidatas = categories.filter(c => !c.parentCategoryId && c.tipo !== 'ingreso');
  return candidatas.find(c => normalizarNombre(c.name) === objetivo)
    // "Ahorro" ↔ "Ahorros", "Cine / Planes" ↔ "Cine"
    ?? candidatas.find(c => {
      const n = normalizarNombre(c.name);
      const primera = (s: string) => s.split(/[\s/]+/)[0];
      return n.startsWith(objetivo) || objetivo.startsWith(n) || primera(n) === primera(objetivo);
    });
}

function coincideClave(clave: string, comercio: string): boolean {
  if (!clave || !comercio) return false;
  return clave === comercio || comercio.startsWith(clave + ' ') || clave.startsWith(comercio + ' ');
}

export function categorizar(
  mov: Pick<MovimientoDetectado, 'comercio' | 'detalle'>,
  categories: Category[],
  reglas: ReglaComercio[],
): SugerenciaCategoria | null {
  const comercio = normalizarComercio(mov.comercio);

  // 1. Lo que el usuario ya le enseñó a Finn.
  if (comercio) {
    const regla = [...reglas]
      .filter(r => coincideClave(r.clave, comercio))
      .sort((a, b) => b.clave.length - a.clave.length)[0];
    if (regla) {
      const cat = categories.find(c => c.id === regla.categoryId) ?? buscarCategoria(regla.categoryName, categories);
      if (cat) return { categoryId: cat.id, categoryName: cat.name, confianza: 0.97, fuente: 'regla' };
    }
  }

  // 2. Diccionario.
  const texto = normalizarComercio(`${mov.comercio ?? ''} ${mov.detalle ?? ''}`);
  if (!texto) return null;
  for (const e of DICCIONARIO) {
    if (!e.re.test(texto)) continue;
    for (const nombre of e.categorias) {
      const cat = buscarCategoria(nombre, categories);
      if (cat) return { categoryId: cat.id, categoryName: cat.name, confianza: e.confianza, fuente: 'diccionario' };
    }
    return null; // se reconoció el comercio pero el usuario no tiene esa categoría
  }
  return null;
}

/** Guarda (o refuerza) la regla comercio → categoría. */
export function aprenderRegla(
  reglas: ReglaComercio[],
  comercio: string | undefined,
  cat: Pick<Category, 'id' | 'name'>,
  ahora: Date = new Date(),
): ReglaComercio[] {
  const clave = normalizarComercio(comercio);
  if (!clave) return reglas;
  const existente = reglas.find(r => r.clave === clave);
  const nueva: ReglaComercio = {
    clave,
    categoryId: cat.id,
    categoryName: cat.name,
    usos: existente && existente.categoryId === cat.id ? existente.usos + 1 : 1,
    actualizadaEn: ahora.toISOString(),
  };
  return [...reglas.filter(r => r.clave !== clave), nueva];
}

// ─── Medio de pago ────────────────────────────────────────────────────────────

const TIPOS_POR_CANAL: Record<string, MedioPago['tipo'][]> = {
  tarjeta: ['credito', 'debito'],
  pse: ['cuenta', 'debito', 'billetera'],
  breb: ['cuenta', 'billetera', 'debito'],
  cuenta: ['cuenta', 'debito', 'billetera'],
  billetera: ['billetera'],
};

/** Medio del usuario al que pertenece el movimiento (por últimos 4 y entidad), o null si es ambiguo. */
export function resolverMedio(
  mov: Pick<MovimientoDetectado, 'ultimos4' | 'entidad' | 'canal'>,
  medios: MedioPago[],
): MedioPago | null {
  const activos = medios.filter(m => !m.archivado);
  if (mov.ultimos4) {
    const porNumero = activos.filter(m => m.ultimos4 === mov.ultimos4);
    if (porNumero.length === 1) return porNumero[0];
    if (porNumero.length > 1) return porNumero.find(m => m.entidad === mov.entidad) ?? null;
  }
  if (!mov.entidad) return null;
  // Sin coincidencia por número: por entidad, solo entre medios sin número registrado
  // o si el mensaje no traía número.
  let candidatos = activos.filter(m => m.entidad === mov.entidad && (!mov.ultimos4 || !m.ultimos4));
  if (candidatos.length > 1) {
    const tipos = TIPOS_POR_CANAL[mov.canal];
    if (tipos) candidatos = candidatos.filter(m => tipos.includes(m.tipo));
  }
  return candidatos.length === 1 ? candidatos[0] : null;
}

// ─── Transferencias propias ───────────────────────────────────────────────────

const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el']);
const tokensNombre = (s: string | undefined) =>
  new Set(normalizarNombre(s ?? '').split(/[^a-z]+/).filter(t => t.length >= 3 && !PALABRAS_VACIAS.has(t)));

/**
 * ¿Un envío a sí mismo? (p. ej. de AV Villas a su propio Nequi). El
 * destinatario debe ser uno de los nombres del usuario: todas las palabras
 * de uno contenidas en el otro, con al menos dos (nombre + apellido).
 * Compartir solo el apellido NO basta: "REINA MOSQUERA" es un familiar, y
 * lo que se le envía sí es un gasto.
 */
export function esTransferenciaPropia(
  mov: Pick<MovimientoDetectado, 'destinatario'>,
  nombresUsuario: (string | undefined)[] | undefined,
): boolean {
  const destinatario = tokensNombre(mov.destinatario);
  if (destinatario.size < 2) return false;
  return (nombresUsuario ?? []).some(nombre => {
    const usuario = tokensNombre(nombre);
    if (usuario.size < 2) return false;
    const [menor, mayor] = destinatario.size <= usuario.size ? [destinatario, usuario] : [usuario, destinatario];
    return [...menor].every(t => mayor.has(t));
  });
}

// ─── Duplicados ───────────────────────────────────────────────────────────────

interface Comparable {
  monto: number;
  fecha: string;
  fechaConHora: boolean;
  fechaEstimada: boolean;
  ultimos4?: string;
  plantilla?: string;
  tipo: MovimientoDetectado['tipo'];
  referencia?: string;
}

const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const salida = (t: Comparable['tipo']) => t === 'compra' || t === 'pago';

/** ¿Dos avisos describen la misma operación? */
export function esMismoMovimiento(a: Comparable, b: Comparable): boolean {
  if (a.referencia && b.referencia) return a.referencia === b.referencia;
  if (a.monto !== b.monto) return false;
  if (a.tipo !== b.tipo && !(salida(a.tipo) && salida(b.tipo))) return false;
  if (a.ultimos4 && b.ultimos4 && a.ultimos4 !== b.ultimos4) return false;
  const fa = new Date(a.fecha);
  const fb = new Date(b.fecha);
  const delta = Math.abs(fa.getTime() - fb.getTime());
  // Un mismo canal no se repite a sí mismo con otra hora: son dos compras iguales.
  if (a.plantilla && a.plantilla === b.plantilla && a.fechaConHora && b.fechaConHora) return delta < 60_000;
  // Sin fecha real (se usó la hora al pegar) la ventana es amplia.
  if (a.fechaEstimada || b.fechaEstimada) return delta <= 72 * 3_600_000;
  if (a.fechaConHora && b.fechaConHora) return delta <= 20 * 60_000;
  return mismoDia(fa, fb);
}

/** Une dos avisos de la misma operación conservando lo mejor de cada uno. */
export function fusionarMovimientos(a: MovimientoDetectado, b: MovimientoDetectado): MovimientoDetectado {
  const rankFecha = (m: MovimientoDetectado) => (m.fechaEstimada ? 0 : m.fechaConHora ? 2 : 1);
  const mejorFecha = rankFecha(b) > rankFecha(a) ? b : a;
  return {
    ...b,
    ...Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)),
    fecha: mejorFecha.fecha,
    fechaConHora: mejorFecha.fechaConHora,
    fechaEstimada: mejorFecha.fechaEstimada,
    confianza: Math.max(a.confianza, b.confianza),
  } as MovimientoDetectado;
}

/** La huella marca con "~" las fechas que no venían en el mensaje. */
const huellaEstimada = (huella: string | undefined) => !!huella && huella.includes('|~');

function comparableDeTx(tx: Transaction, medios: MedioPago[]): Comparable {
  const capturada = !!tx.source && tx.source !== 'manual' && tx.source !== 'recibo';
  const estimada = huellaEstimada(tx.dedupeHash);
  return {
    monto: tx.amount,
    fecha: tx.date,
    // La fecha de un gasto manual es cuando se anotó, no cuando se pagó: se compara por día.
    fechaConHora: capturada && !estimada,
    fechaEstimada: estimada,
    ultimos4: medios.find(m => m.id === tx.paymentMethodId)?.ultimos4,
    tipo: tx.type === 'income' ? 'ingreso' : 'compra',
  };
}

// ─── Huella ───────────────────────────────────────────────────────────────────

/** Identificador estable de un aviso (se guarda en transactions.dedupe_hash). */
export function huellaMovimiento(m: MovimientoDetectado): string {
  if (m.referencia) return `v1|ref|${m.referencia}`.substring(0, 128);
  const d = new Date(m.fecha);
  const p = (n: number) => String(n).padStart(2, '0');
  const dia = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const cuando = m.fechaEstimada ? `~${dia}` : m.fechaConHora ? `${dia}${p(d.getHours())}${p(d.getMinutes())}` : dia;
  return `v1|${m.monto}|${cuando}|${m.ultimos4 ?? ''}|${m.plantilla}`.substring(0, 128);
}

// ─── Decisión ─────────────────────────────────────────────────────────────────

export interface Decision {
  accion: 'registrar' | 'revisar';
  motivo: string;
  sugerirIgnorar: boolean;
}

export function decidir(
  mov: MovimientoDetectado,
  sugerencia: SugerenciaCategoria | null,
  ctx: Pick<ContextoMotor, 'nombresUsuario'>,
): Decision {
  switch (mov.tipo) {
    case 'transferencia':
      return esTransferenciaPropia(mov, ctx.nombresUsuario)
        ? { accion: 'revisar', motivo: 'Parece un envío entre tus cuentas: no es un gasto.', sugerirIgnorar: true }
        : { accion: 'revisar', motivo: `Envío${mov.destinatario ? ` a ${mov.destinatario}` : ''}: dinos para qué fue.`, sugerirIgnorar: false };
    case 'ingreso':
      return { accion: 'revisar', motivo: 'Recibiste dinero: confirma si es un ingreso.', sugerirIgnorar: false };
    case 'retiro':
      return { accion: 'revisar', motivo: 'Retiro de efectivo: no es un gasto hasta que lo uses.', sugerirIgnorar: true };
    default:
      if (!sugerencia) {
        return { accion: 'revisar', motivo: mov.comercio ? `¿En qué categoría va ${mov.comercio}?` : 'El mensaje no dice el comercio: elige la categoría.', sugerirIgnorar: false };
      }
      if (sugerencia.confianza >= CONFIANZA_AUTO && mov.confianza >= CONFIANZA_AUTO) {
        return { accion: 'registrar', motivo: `${sugerencia.categoryName} (${etiquetaFuente(sugerencia.fuente)})`, sugerirIgnorar: false };
      }
      return { accion: 'revisar', motivo: `¿Va en ${sugerencia.categoryName}?`, sugerirIgnorar: false };
  }
}

const etiquetaFuente = (f: FuenteSugerencia) =>
  f === 'regla' ? 'como la última vez' : f === 'finn' ? 'según Finn' : 'comercio conocido';

// ─── Construcción de la transacción ───────────────────────────────────────────

export function construirTransaccion(
  mov: MovimientoDetectado,
  opts: {
    id: string;
    categoria: { id?: string; name: string };
    medioId?: string | null;
    huella: string;
    origen: OrigenTransaccion;
    esIngreso?: boolean;
  },
): Transaction {
  const descripcion = mov.comercio
    ?? (mov.destinatario ? `${mov.tipo === 'ingreso' ? 'De' : 'Envío a'} ${mov.destinatario}` : undefined)
    ?? mov.detalle;
  return {
    id: opts.id,
    amount: mov.monto,
    category: opts.categoria.name,
    ...(opts.categoria.id ? { categoryId: opts.categoria.id } : {}),
    date: mov.fecha,
    type: (opts.esIngreso ?? mov.tipo === 'ingreso') ? 'income' : 'expense',
    ...(descripcion ? { description: descripcion.substring(0, 80) } : {}),
    ...(mov.comercio ? { merchant: mov.comercio.substring(0, 120) } : {}),
    ...(opts.medioId ? { paymentMethodId: opts.medioId } : {}),
    source: opts.origen,
    dedupeHash: opts.huella,
  };
}

// ─── Lote ─────────────────────────────────────────────────────────────────────

const MOTIVO_IGNORADO: Record<MotivoIgnorado, string> = {
  rechazada: 'Compra rechazada: no se cobró.',
  seguridad: 'Aviso de seguridad: no es un movimiento.',
  sin_monto: 'No encontramos el monto.',
};

/**
 * Procesa los resultados del parser en orden. Puro: no guarda nada; quien
 * llama agrega `registrar`, reemplaza los pendientes y aplica `enriquecer`.
 */
export function procesarLote(parseados: ResultadoParseo[], ctx: ContextoMotor): ResultadoLote {
  const items: ItemResultado[] = [];
  const registrar: Transaction[] = [];
  const enriquecer: ResultadoLote['enriquecer'] = [];
  let pendientes = [...ctx.pendientes];
  const huellasTx = new Set(ctx.transactions.map(t => t.dedupeHash).filter(Boolean) as string[]);
  const ignoradas = new Set(ctx.huellasIgnoradas ?? []);
  let secuencia = 0;
  const nuevoId = (prefijo: string) => `${prefijo}_${ctx.ahora.getTime()}_${secuencia++}`;

  // Los avisos de inicio de sesión dicen el nombre del titular: se usan en
  // todo el lote (el aviso puede venir después de la transferencia).
  const conocidos = new Set((ctx.nombresUsuario ?? []).map(n => normalizarNombre(n)));
  const titulares = [...new Set(parseados.flatMap(r => (r.estado === 'ignorado' && r.titular ? [r.titular] : [])))]
    .filter(t => !conocidos.has(normalizarNombre(t)));
  ctx = { ...ctx, nombresUsuario: [...(ctx.nombresUsuario ?? []), ...titulares] };

  for (const r of parseados) {
    if (r.estado === 'desconocido') { items.push({ estado: 'no_reconocido', motivo: 'No parece un mensaje del banco.' }); continue; }
    if (r.estado === 'ignorado') { items.push({ estado: 'ignorado', motivo: MOTIVO_IGNORADO[r.motivo] }); continue; }

    let mov = r.movimiento;
    const huella = huellaMovimiento(mov);

    if (ignoradas.has(huella)) {
      items.push({ estado: 'duplicado', motivo: 'Ya lo habías descartado.', movimiento: mov });
      continue;
    }

    // ── ¿Ya registrado? ──────────────────────────────────────────────────────
    const todasTx = [...ctx.transactions, ...registrar];
    const txIgual = huellasTx.has(huella)
      ? todasTx.find(t => t.dedupeHash === huella)
      : todasTx.find(t => esMismoMovimiento(comparableDeTx(t, ctx.medios), mov));
    if (txIgual) {
      const capturada = !!txIgual.source && txIgual.source !== 'manual' && txIgual.source !== 'recibo';
      if (capturada || huellasTx.has(huella)) {
        // El otro aviso puede aportar lo que le faltaba: el comercio o la fecha real.
        const update: Partial<Transaction> = {};
        if (!txIgual.merchant && mov.comercio) {
          update.merchant = mov.comercio;
          if (!txIgual.description) update.description = mov.comercio.substring(0, 80);
        }
        if (huellaEstimada(txIgual.dedupeHash) && !mov.fechaEstimada) update.date = mov.fecha;
        if (Object.keys(update).length > 0) {
          // Si se registró en este mismo lote, se corrige antes de guardarla.
          const iReg = registrar.indexOf(txIgual);
          if (iReg >= 0) registrar[iReg] = { ...txIgual, ...update };
          else enriquecer.push({ id: txIgual.id, update });
        }
        items.push({ estado: 'duplicado', motivo: 'Ya estaba registrado.', movimiento: mov, txId: txIgual.id });
        continue;
      }
      // Coincide con un gasto que el usuario anotó a mano: que él decida.
      const medioManual = resolverMedio(mov, ctx.medios);
      const sugManual = categorizar(mov, ctx.categories, ctx.reglas);
      const p: CapturaPendiente = {
        id: nuevoId('pend'), movimiento: mov, huella,
        ...(medioManual ? { medioId: medioManual.id } : {}),
        ...(sugManual ? { sugerencia: sugManual } : {}),
        sugerirIgnorar: true,
        motivo: `Parece que ya lo anotaste a mano (${txIgual.description || txIgual.category}).`,
        origen: ctx.origen, creadaEn: ctx.ahora.toISOString(),
      };
      pendientes = [p, ...pendientes];
      items.push({ estado: 'por_confirmar', motivo: p.motivo, movimiento: mov, pendienteId: p.id });
      continue;
    }

    // ── ¿Ya está en la bandeja? Se fusiona (p. ej. el segundo SMS trae el comercio) ──
    const previo = pendientes.find(p => p.huella === huella || esMismoMovimiento(p.movimiento, mov));
    if (previo) {
      mov = fusionarMovimientos(previo.movimiento, mov);
      pendientes = pendientes.filter(p => p !== previo);
    }

    const medio = resolverMedio(mov, ctx.medios);
    const sugerencia = mov.tipo === 'compra' || mov.tipo === 'pago' ? categorizar(mov, ctx.categories, ctx.reglas) : null;
    const decision = decidir(mov, sugerencia, ctx);

    if (decision.accion === 'registrar' && sugerencia) {
      const tx = construirTransaccion(mov, {
        id: nuevoId('cap'), categoria: { id: sugerencia.categoryId, name: sugerencia.categoryName },
        medioId: medio?.id, huella, origen: ctx.origen,
      });
      registrar.push(tx);
      huellasTx.add(huella);
      items.push({ estado: 'registrado', motivo: decision.motivo, movimiento: mov, txId: tx.id, categoria: sugerencia.categoryName, ...(medio ? { medioId: medio.id } : {}) });
      continue;
    }

    const p: CapturaPendiente = {
      id: previo?.id ?? nuevoId('pend'),
      movimiento: mov, huella: previo?.huella ?? huella,
      ...(medio ? { medioId: medio.id } : {}),
      ...(sugerencia ? { sugerencia } : {}),
      sugerirIgnorar: decision.sugerirIgnorar,
      motivo: decision.motivo,
      origen: ctx.origen,
      creadaEn: ctx.ahora.toISOString(),
    };
    pendientes = [p, ...pendientes];
    items.push({
      estado: previo ? 'duplicado' : 'por_confirmar',
      motivo: previo ? 'Mismo movimiento que ya estaba por confirmar: se unieron.' : decision.motivo,
      movimiento: mov, pendienteId: p.id,
      ...(sugerencia ? { categoria: sugerencia.categoryName } : {}),
      ...(medio ? { medioId: medio.id } : {}),
    });
  }

  return { items, registrar, pendientes, enriquecer, titulares };
}

/**
 * Tras fusionar, un pendiente puede haber ganado el comercio y ya tener
 * categoría segura: lo registra. Se usa también cuando Finn IA sugiere.
 */
export function promoverPendiente(
  p: CapturaPendiente,
  sugerencia: SugerenciaCategoria,
  ctx: Pick<ContextoMotor, 'nombresUsuario' | 'ahora'>,
  id: string,
): Transaction | null {
  if (p.sugerirIgnorar) return null;
  const d = decidir(p.movimiento, sugerencia, ctx);
  if (d.accion !== 'registrar') return null;
  return construirTransaccion(p.movimiento, {
    id, categoria: { id: sugerencia.categoryId, name: sugerencia.categoryName },
    medioId: p.medioId, huella: p.huella, origen: p.origen,
  });
}

// ─── Aviso al usuario ─────────────────────────────────────────────────────────

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

/**
 * Texto del aviso de Finn para un movimiento detectado desde una notificación.
 * null si no hay nada que contar (duplicado, ignorado, no reconocido).
 */
export function resumenAviso(item: ItemResultado): { titulo: string; cuerpo: string } | null {
  const m = item.movimiento;
  if (!m) return null;
  const quien = m.comercio ?? m.destinatario ?? m.detalle;
  const monto = fmtCOP(m.monto);
  if (item.estado === 'registrado') {
    return {
      titulo: 'Finn registró una compra',
      cuerpo: `${monto}${quien ? ` en ${quien}` : ''} → ${item.categoria ?? 'Gastos'}`,
    };
  }
  if (item.estado === 'por_confirmar') {
    const que = m.tipo === 'transferencia' ? 'un envío' : m.tipo === 'ingreso' ? 'un ingreso' : m.tipo === 'retiro' ? 'un retiro' : 'un pago';
    return {
      titulo: `Finn detectó ${que} de ${monto}`,
      cuerpo: `${quien ? `${quien}. ` : ''}Toca para confirmarlo.`,
    };
  }
  return null;
}
