/**
 * Envoltorio de la propuesta de gasto por voz para la app.
 *
 * El núcleo (decidir monto, categoría y acción primaria) vive en
 * `categoryResolver.ts`, que no tiene dependencias y por eso está cubierto por
 * pruebas. Aquí solo se le inyecta el catálogo real de la app, para que el
 * núcleo no dependa de un catálogo concreto.
 */

import { CATALOGO_CATEGORIAS, catalogoItemToCategory } from '../constants/catalogoCategorias';
import type { Category, Transaction } from '../types';
import {
  construirPropuesta as construirPropuestaCore,
  type EntradaVoz,
  type ItemCatalogoPropuesta,
  type PropuestaGasto,
} from './categoryResolver';

export type {
  EntradaVoz,
  PropuestaGasto,
  CategoriaPropuesta,
  AccionPrimaria,
} from './categoryResolver';
export { etiquetaAccion } from './categoryResolver';

/** El catálogo real, reducido a lo que necesita el núcleo. */
const CATALOGO_PARA_PROPUESTA: ItemCatalogoPropuesta[] = CATALOGO_CATEGORIAS.map(c => ({
  nombre: c.nombre,
  icono: c.icono,
  tipo: c.tipo,
  pctSugerido: c.pctSugerido,
}));

export function construirPropuesta(
  entrada: EntradaVoz,
  ctx: { categories: Category[]; transactions: Transaction[]; salario: number },
): PropuestaGasto {
  return construirPropuestaCore(entrada, { ...ctx, catalogo: CATALOGO_PARA_PROPUESTA });
}

/**
 * Crea el objeto Category para una propuesta de categoría nueva, con el icono y
 * el presupuesto sugerido ya resueltos.
 */
export function categoriaDesdePropuesta(
  nombre: string,
  budgetSugerido: number,
): Category | null {
  const item = CATALOGO_CATEGORIAS.find(c => c.nombre === nombre);
  if (!item) return null;
  return catalogoItemToCategory(item, budgetSugerido);
}
