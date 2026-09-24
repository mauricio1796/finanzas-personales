/**
 * Resolución estable de la relación transacción → categoría (BUG-10, BUG-21).
 *
 * El problema original: `Transaction.category` guardaba el NOMBRE de la
 * categoría. Al renombrar una categoría, todas las transacciones históricas
 * quedaban apuntando a un nombre que ya no existía, así que dejaban de contar
 * para el presupuesto de esa categoría — el gasto "desaparecía" de los informes.
 * Además, las comparaciones exactas de string (`===`) fallaban en silencio ante
 * diferencias de mayúsculas o tildes ("Alimentacion" vs "Alimentación").
 *
 * La solución: cada transacción lleva `categoryId`, un identificador estable que
 * no cambia al renombrar. `category` se conserva como el nombre visible y se
 * mantiene sincronizado con el nombre actual de la categoría, de modo que toda
 * la lógica de agregación existente (que indexa por nombre) sigue funcionando
 * sin reescribirla, pero ya no pierde el histórico.
 */

import type { Transaction, Category } from '../types';

/** Normaliza para comparar: sin tildes, sin espacios extra, en minúsculas. */
export function normalizarNombre(valor: string | undefined | null): string {
  if (!valor) return '';
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Encuentra la categoría de una transacción tolerando los tres formatos que
 * conviven en datos reales: `categoryId` nuevo, un id guardado en `category`
 * por versiones viejas, o el nombre de la categoría.
 */
export function encontrarCategoriaDeTx(
  tx: Pick<Transaction, 'category' | 'categoryId'>,
  categories: Category[],
): Category | undefined {
  if (tx.categoryId) {
    const porId = categories.find(c => c.id === tx.categoryId);
    if (porId) return porId;
  }
  const valor = tx.category;
  if (!valor) return undefined;

  const porIdLegado = categories.find(c => c.id === valor);
  if (porIdLegado) return porIdLegado;

  const objetivo = normalizarNombre(valor);
  return categories.find(c => normalizarNombre(c.name) === objetivo);
}

/**
 * Asigna `categoryId` a las transacciones que aún no lo tienen y realinea el
 * nombre visible con el nombre actual de la categoría.
 *
 * Idempotente y no destructiva: una transacción cuya categoría ya no existe
 * (categoría eliminada) conserva intacto su nombre original, para no perder la
 * información histórica de en qué se gastó.
 *
 * Devuelve `null` si no hubo ningún cambio, para poder evitar reescrituras y
 * renders innecesarios.
 */
export function migrarTransaccionesACategoryId(
  transactions: Transaction[],
  categories: Category[],
): Transaction[] | null {
  if (categories.length === 0) return null;

  let huboCambios = false;
  const migradas = transactions.map(tx => {
    const cat = encontrarCategoriaDeTx(tx, categories);
    if (!cat) return tx;

    const necesitaId     = tx.categoryId !== cat.id;
    const necesitaNombre = tx.category !== cat.name;
    if (!necesitaId && !necesitaNombre) return tx;

    huboCambios = true;
    return { ...tx, categoryId: cat.id, category: cat.name };
  });

  return huboCambios ? migradas : null;
}

/**
 * Devuelve TODAS las transacciones que encajan con lo que pidió el usuario a
 * Finn (BUG-03).
 *
 * Vive aquí porque comparte la normalización de nombres y porque este módulo no
 * tiene dependencias de React Native, lo que lo hace verificable con pruebas.
 *
 * Es deliberadamente conservadora: no "adivina" una transacción cuando los
 * datos no alcanzan. Quien la llama decide qué hacer con 0 o con >1 resultados
 * — nunca se elige una al azar, porque eso modificaba datos financieros
 * equivocados sin que el usuario se enterara.
 */
export function resolverTransaccionesCandidatas(
  input: Record<string, any>,
  transactions: Transaction[],
): Transaction[] {
  // 1. Id exacto: la única vía realmente inequívoca.
  if (input.id) {
    const porId = transactions.find(t => t.id === input.id);
    if (porId) return [porId];
  }

  // 2. Sin id, se exige al menos un criterio concreto. Sin criterios no se
  //    devuelve nada (antes, esto terminaba tocando la última transacción).
  const tieneCategoria = typeof input.categoria === 'string' && input.categoria.trim() !== '';
  const montoRef = input.monto_original ?? input.monto_actual;
  const tieneMonto = typeof montoRef === 'number' && Number.isFinite(montoRef);
  if (!tieneCategoria && !tieneMonto) return [];

  const catBuscada = tieneCategoria ? normalizarNombre(input.categoria) : null;

  let candidatos = transactions.filter(t => {
    if (catBuscada && normalizarNombre(t.category) !== catBuscada) return false;
    if (tieneMonto && t.amount !== montoRef) return false;
    if (input.tipo && t.type !== input.tipo) return false;
    return true;
  });

  // 3. Categoría + monto identifican una transacción concreta; si además hay
  //    varias idénticas, la más reciente es la que el usuario acaba de crear.
  if (candidatos.length > 1 && catBuscada && tieneMonto) {
    const ordenadas = [...candidatos].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    candidatos = [ordenadas[0]];
  }

  return candidatos;
}

/**
 * Propaga un cambio de nombre de categoría a sus transacciones (BUG-10).
 * Se apoya en `categoryId`, por eso el histórico sobrevive al renombrado.
 */
export function renombrarCategoriaEnTransacciones(
  transactions: Transaction[],
  categoryId: string,
  nombreAnterior: string,
  nombreNuevo: string,
): Transaction[] | null {
  if (nombreAnterior === nombreNuevo) return null;

  let huboCambios = false;
  const objetivoLegado = normalizarNombre(nombreAnterior);

  const actualizadas = transactions.map(tx => {
    // Por id (camino normal) o, para transacciones aún sin migrar, por el
    // nombre anterior normalizado.
    const coincide =
      tx.categoryId === categoryId ||
      (!tx.categoryId && normalizarNombre(tx.category) === objetivoLegado);

    if (!coincide) return tx;
    huboCambios = true;
    return { ...tx, categoryId, category: nombreNuevo };
  });

  return huboCambios ? actualizadas : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPUESTA DE GASTO POR VOZ
//
// Vive en este módulo porque comparte la normalización de nombres y, sobre
// todo, porque aquí no hay dependencias de React Native: es lógica pura que
// puede verificarse con pruebas.
//
// Antes, lo que extraía el Worker caía directo en el formulario de alta rápida:
// si la categoría no existía, `QuickAddSheet` seleccionaba en silencio la
// PRIMERA de la lista, así que un "pago membresía Netflix" podía terminar
// archivado en Alimentación sin que el usuario lo notara.
//
// Ahora Finn resuelve lo que puede y propone UNA acción concreta.
// `accionPrimaria` es lo que determina el botón grande de la tarjeta.
//
// Principio: proponer, nunca crear categorías a espaldas del usuario.
// ═══════════════════════════════════════════════════════════════════════════

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type CategoriaPropuesta =
  /** La categoría ya existe: se guarda directo en ella. */
  | { estado: 'existente'; categoria: Category }
  /** No existe pero está en el catálogo: se propone crearla. */
  | { estado: 'nueva'; nombre: string; icono: string; budgetSugerido: number }
  /** No se pudo resolver: el usuario debe elegirla a mano. */
  | { estado: 'sin_resolver'; nombreDicho: string };

/**
 * Qué botón primario muestra la tarjeta:
 * - `guardar`          → un toque y queda registrado
 * - `crear_y_guardar`  → crea la categoría propuesta y registra, en un toque
 * - `completar`        → falta un dato, se abre el formulario
 */
export type AccionPrimaria = 'guardar' | 'crear_y_guardar' | 'completar';

export interface PropuestaGasto {
  monto: number;
  /** true si el monto se tomó de un gasto anterior parecido, no de la voz. */
  montoInferido: boolean;
  /** Descripción del gasto anterior del que se tomó el monto, si aplica. */
  referenciaInferida?: string;
  descripcion: string;
  tipo: 'income' | 'expense';
  categoria: CategoriaPropuesta;
  /** Subcategoría existente, si la voz mencionó una que encaja. */
  subcategoriaId?: string;
  accionPrimaria: AccionPrimaria;
}

/** Lo que devuelve el endpoint /voice del Worker. */
export interface EntradaVoz {
  monto: number;
  categoria: string;
  subcategoria?: string;
  descripcion: string;
  tipo: 'income' | 'expense';
}

// ── Inferencia del monto desde el historial ──────────────────────────────────

/**
 * Palabras demasiado genéricas para identificar un gasto recurrente. Sin este
 * filtro, "pago del mes" encontraría cualquier transacción.
 */
const PALABRAS_GENERICAS = new Set([
  'pago', 'pagos', 'pague', 'mes', 'mensual', 'mensualidad', 'membresia',
  'suscripcion', 'compra', 'compre', 'gasto', 'este', 'esta', 'para', 'del',
  'con', 'por', 'una', 'unos', 'unas', 'los', 'las', 'que', 'mil', 'plata',
]);

function tokensDistintivos(texto: string): string[] {
  return normalizarNombre(texto)
    .split(/\s+/)
    .filter(t => t.length >= 4 && !PALABRAS_GENERICAS.has(t));
}

/**
 * Busca el gasto anterior más reciente que comparta una palabra distintiva
 * (p. ej. "netflix") para reutilizar su monto.
 *
 * Es la vía más rápida en el uso real: las suscripciones se repiten, así que el
 * monto ya está en el historial y no hace falta dictarlo.
 */
export function inferirMontoDeHistorial(
  descripcion: string,
  tipo: 'income' | 'expense',
  transactions: Transaction[],
): { monto: number; referencia: string } | null {
  const tokens = tokensDistintivos(descripcion);
  if (tokens.length === 0) return null;

  const candidatas = transactions
    .filter(t => t.type === tipo && t.amount > 0)
    .filter(t => {
      const texto = normalizarNombre(`${t.description ?? ''} ${t.category}`);
      return tokens.some(tok => texto.includes(tok));
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const ultima = candidatas[0];
  if (!ultima) return null;

  return {
    monto: ultima.amount,
    referencia: ultima.description?.trim() || ultima.category,
  };
}

// ── Resolución de la categoría ───────────────────────────────────────────────

/**
 * Forma mínima que necesita una entrada de catálogo. Se inyecta en vez de
 * importarla para que este núcleo no dependa de un catálogo concreto (y pueda
 * verificarse con pruebas).
 */
export interface ItemCatalogoPropuesta {
  nombre: string;
  icono: string;
  tipo: 'gasto' | 'ingreso';
  pctSugerido: number;
}

/** `pctSugerido` viene como "% × 100" (2500 = 25%). */
const ESCALA_PCT = 10_000;
/** Los presupuestos sugeridos se redondean a decenas de miles de pesos. */
const STEP_COP = 10_000;

export function calcularPresupuestoSugerido(pctSugerido: number, salario: number): number {
  if (salario <= 0 || pctSugerido <= 0) return 0;
  return Math.round((salario * pctSugerido) / ESCALA_PCT / STEP_COP) * STEP_COP;
}

function buscarEnCatalogo(
  nombre: string,
  catalogo: ItemCatalogoPropuesta[],
): ItemCatalogoPropuesta | undefined {
  const objetivo = normalizarNombre(nombre);
  return catalogo.find(c => normalizarNombre(c.nombre) === objetivo);
}

function resolverCategoria(
  nombreDicho: string,
  tipo: 'income' | 'expense',
  categories: Category[],
  salario: number,
  catalogo: ItemCatalogoPropuesta[],
): CategoriaPropuesta {
  const objetivo = normalizarNombre(nombreDicho);
  if (!objetivo) return { estado: 'sin_resolver', nombreDicho };

  // 1. ¿Ya existe? Solo categorías raíz: las subcategorías no llevan presupuesto.
  const existente = categories.find(
    c => !c.parentCategoryId && normalizarNombre(c.name) === objetivo,
  );
  if (existente) return { estado: 'existente', categoria: existente };

  // 2. ¿Está en el catálogo? Entonces se puede proponer con icono y presupuesto.
  const delCatalogo = buscarEnCatalogo(nombreDicho, catalogo);
  const tipoEsperado = tipo === 'income' ? 'ingreso' : 'gasto';
  if (delCatalogo && delCatalogo.tipo === tipoEsperado) {
    return {
      estado: 'nueva',
      nombre: delCatalogo.nombre,
      icono: delCatalogo.icono,
      budgetSugerido: calcularPresupuestoSugerido(delCatalogo.pctSugerido, salario),
    };
  }

  // 3. Un nombre que no conocemos: que lo elija el usuario, no lo inventamos.
  return { estado: 'sin_resolver', nombreDicho };
}

function resolverSubcategoria(
  nombre: string | undefined,
  categoriaPadre: Category | undefined,
  categories: Category[],
): string | undefined {
  if (!nombre || !categoriaPadre) return undefined;
  const objetivo = normalizarNombre(nombre);
  const sub = categories.find(
    c => c.parentCategoryId === categoriaPadre.id && normalizarNombre(c.name) === objetivo,
  );
  return sub?.id;
}

// ── Construcción de la propuesta ─────────────────────────────────────────────

export interface ContextoPropuesta {
  categories: Category[];
  transactions: Transaction[];
  /** Salario mensual del perfil, para calcular el presupuesto sugerido. */
  salario: number;
  /** Catálogo de categorías conocidas (se inyecta: ver ItemCatalogoPropuesta). */
  catalogo: ItemCatalogoPropuesta[];
}

export function construirPropuesta(
  entrada: EntradaVoz,
  ctx: ContextoPropuesta,
): PropuestaGasto {
  const descripcion = entrada.descripcion?.trim() || entrada.categoria;
  const categoria = resolverCategoria(
    entrada.categoria, entrada.tipo, ctx.categories, ctx.salario, ctx.catalogo,
  );

  // Si la voz no trajo monto, se busca en el historial antes de rendirse.
  let monto = Number.isFinite(entrada.monto) && entrada.monto > 0 ? Math.round(entrada.monto) : 0;
  let montoInferido = false;
  let referenciaInferida: string | undefined;

  if (monto <= 0) {
    const inferido = inferirMontoDeHistorial(descripcion, entrada.tipo, ctx.transactions);
    if (inferido) {
      monto = inferido.monto;
      montoInferido = true;
      referenciaInferida = inferido.referencia;
    }
  }

  const subcategoriaId = resolverSubcategoria(
    entrada.subcategoria,
    categoria.estado === 'existente' ? categoria.categoria : undefined,
    ctx.categories,
  );

  // El botón primario sale de lo que quedó resuelto, no de lógica en la UI.
  let accionPrimaria: AccionPrimaria;
  if (monto <= 0 || categoria.estado === 'sin_resolver') {
    accionPrimaria = 'completar';
  } else if (categoria.estado === 'nueva') {
    accionPrimaria = 'crear_y_guardar';
  } else {
    accionPrimaria = 'guardar';
  }

  return {
    monto,
    montoInferido,
    ...(referenciaInferida ? { referenciaInferida } : {}),
    descripcion,
    tipo: entrada.tipo,
    categoria,
    ...(subcategoriaId ? { subcategoriaId } : {}),
    accionPrimaria,
  };
}

/** Texto del botón primario, derivado de la propuesta. */
export function etiquetaAccion(p: PropuestaGasto, formatearCOP: (n: number) => string): string {
  switch (p.accionPrimaria) {
    case 'guardar':
      return p.montoInferido ? `Guardar ${formatearCOP(p.monto)}` : 'Guardar';
    case 'crear_y_guardar':
      return p.categoria.estado === 'nueva'
        ? `Crear ${p.categoria.nombre} y guardar`
        : 'Crear y guardar';
    case 'completar':
      return 'Completar';
  }
}
