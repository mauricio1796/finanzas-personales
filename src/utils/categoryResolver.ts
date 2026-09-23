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
