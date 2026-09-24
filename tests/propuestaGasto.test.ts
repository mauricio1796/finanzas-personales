/**
 * Regresión de la propuesta de gasto por voz.
 *
 * Protege la garantía central: un gasto NUNCA se archiva en una categoría que
 * el usuario no eligió. Antes, si la categoría no existía, el formulario
 * seleccionaba en silencio la primera de la lista.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirPropuesta as construirPropuestaCore,
  inferirMontoDeHistorial,
  etiquetaAccion,
  calcularPresupuestoSugerido,
  type EntradaVoz,
  type ItemCatalogoPropuesta,
} from '../src/utils/categoryResolver.ts';
import type { Category, Transaction } from '../src/types/index.ts';

/**
 * Subconjunto del catálogo real (mismos valores que src/constants/
 * catalogoCategorias.ts) para poder ejercitar el núcleo sin arrastrar las
 * dependencias de la app.
 */
const CATALOGO: ItemCatalogoPropuesta[] = [
  { nombre: 'Entretenimiento', icono: 'tv',            tipo: 'gasto',   pctSugerido: 500 },
  { nombre: 'Alimentación',    icono: 'shopping-cart', tipo: 'gasto',   pctSugerido: 2500 },
  { nombre: 'Freelance',       icono: 'code',          tipo: 'ingreso', pctSugerido: 0 },
];

const construirPropuesta = (
  entrada: EntradaVoz,
  ctx: { categories: Category[]; transactions: Transaction[]; salario: number },
) => construirPropuestaCore(entrada, { ...ctx, catalogo: CATALOGO });

const cat = (id: string, name: string, extra: Partial<Category> = {}): Category =>
  ({ id, name, isSelected: true, tipo: 'gasto', ...extra }) as Category;

const tx = (
  id: string, amount: number, category: string, dia: number,
  description?: string, type: 'income' | 'expense' = 'expense',
): Transaction => ({
  id, amount, category, type,
  date: new Date(2026, 8, dia).toISOString(),
  ...(description ? { description } : {}),
});

const voz = (over: Partial<EntradaVoz> = {}): EntradaVoz => ({
  monto: 44_000,
  categoria: 'Entretenimiento',
  descripcion: 'Membresía Netflix',
  tipo: 'expense',
  ...over,
});

const SALARIO = 2_000_000;
const ctx = (categories: Category[], transactions: Transaction[] = []) =>
  ({ categories, transactions, salario: SALARIO });

describe('categoría que YA existe', () => {
  const cats = [cat('c1', 'Entretenimiento'), cat('c2', 'Alimentación')];

  test('se guarda en ella con un solo toque', () => {
    const p = construirPropuesta(voz(), ctx(cats));
    assert.equal(p.accionPrimaria, 'guardar');
    assert.equal(p.categoria.estado, 'existente');
    if (p.categoria.estado === 'existente') assert.equal(p.categoria.categoria.id, 'c1');
    assert.equal(p.monto, 44_000);
  });

  test('tolera tildes y mayúsculas al reconocerla', () => {
    const p = construirPropuesta(voz({ categoria: 'entretenimiento' }), ctx(cats));
    assert.equal(p.categoria.estado, 'existente');
  });

  test('enlaza la subcategoría cuando encaja', () => {
    const conSub = [...cats, cat('s1', 'Streaming', { parentCategoryId: 'c1' })];
    const p = construirPropuesta(voz({ subcategoria: 'Streaming' }), ctx(conSub));
    assert.equal(p.subcategoriaId, 's1');
  });

  test('ignora una subcategoría que no pertenece a esa categoría', () => {
    const conSub = [...cats, cat('s9', 'Mercado', { parentCategoryId: 'c2' })];
    const p = construirPropuesta(voz({ subcategoria: 'Mercado' }), ctx(conSub));
    assert.equal(p.subcategoriaId, undefined);
  });
});

describe('categoría que NO existe pero está en el catálogo', () => {
  const cats = [cat('c2', 'Alimentación')]; // sin Entretenimiento

  test('propone crearla en vez de archivar en otra (el bug original)', () => {
    const p = construirPropuesta(voz(), ctx(cats));
    assert.equal(p.accionPrimaria, 'crear_y_guardar');
    assert.equal(p.categoria.estado, 'nueva');
    if (p.categoria.estado === 'nueva') {
      assert.equal(p.categoria.nombre, 'Entretenimiento');
      assert.equal(p.categoria.icono, 'tv');
    }
  });

  test('NUNCA cae en la primera categoría de la lista', () => {
    const p = construirPropuesta(voz(), ctx(cats));
    assert.notEqual(p.categoria.estado, 'existente');
  });

  test('sugiere presupuesto desde el salario (5% de 2.000.000 = 100.000)', () => {
    const p = construirPropuesta(voz(), ctx(cats));
    if (p.categoria.estado === 'nueva') {
      assert.equal(p.categoria.budgetSugerido, 100_000);
      assert.equal(p.categoria.budgetSugerido, calcularPresupuestoSugerido(500, SALARIO));
    }
  });

  test('sin salario, el presupuesto sugerido es 0 y no rompe', () => {
    const p = construirPropuesta(voz(), { categories: cats, transactions: [], salario: 0 });
    if (p.categoria.estado === 'nueva') assert.equal(p.categoria.budgetSugerido, 0);
    assert.equal(p.accionPrimaria, 'crear_y_guardar');
  });

  test('no propone una categoría de ingreso para un gasto', () => {
    const p = construirPropuesta(voz({ categoria: 'Freelance', tipo: 'expense' }), ctx(cats));
    assert.equal(p.categoria.estado, 'sin_resolver');
  });
});

describe('categoría desconocida', () => {
  test('no se inventa: pide que el usuario la elija', () => {
    const p = construirPropuesta(
      voz({ categoria: 'Criptomonedas Exóticas' }), ctx([cat('c2', 'Alimentación')]),
    );
    assert.equal(p.categoria.estado, 'sin_resolver');
    assert.equal(p.accionPrimaria, 'completar');
  });
});

describe('monto ausente: se infiere del historial', () => {
  const cats = [cat('c1', 'Entretenimiento')];
  const historial = [
    tx('t1', 44_000, 'Entretenimiento', 1, 'Membresía Netflix'),
    tx('t2', 12_000, 'Alimentación',    5, 'Almuerzo'),
  ];

  test('"pago membresía Netflix" reutiliza el monto de la última vez', () => {
    const p = construirPropuesta(
      voz({ monto: 0, descripcion: 'pago membresía Netflix' }), ctx(cats, historial),
    );
    assert.equal(p.monto, 44_000);
    assert.equal(p.montoInferido, true);
    assert.equal(p.accionPrimaria, 'guardar');
  });

  test('toma el más reciente si hay varios', () => {
    const conDos = [...historial, tx('t3', 47_000, 'Entretenimiento', 20, 'Netflix')];
    const r = inferirMontoDeHistorial('Netflix', 'expense', conDos);
    assert.equal(r?.monto, 47_000);
  });

  test('no infiere desde palabras genéricas', () => {
    // "pago del mes" no debe engancharse con cualquier transacción.
    assert.equal(inferirMontoDeHistorial('pago del mes', 'expense', historial), null);
  });

  test('no mezcla ingresos con gastos', () => {
    const conIngreso = [tx('t9', 900_000, 'Freelance', 3, 'Proyecto Netflix', 'income')];
    assert.equal(inferirMontoDeHistorial('Netflix', 'expense', conIngreso), null);
  });

  test('sin historial que coincida, pide completar', () => {
    const p = construirPropuesta(voz({ monto: 0, descripcion: 'Spotify' }), ctx(cats, historial));
    assert.equal(p.monto, 0);
    assert.equal(p.montoInferido, false);
    assert.equal(p.accionPrimaria, 'completar');
  });
});

describe('casos límite', () => {
  test('monto negativo se trata como ausente', () => {
    const p = construirPropuesta(voz({ monto: -5000 }), ctx([cat('c1', 'Entretenimiento')]));
    assert.equal(p.accionPrimaria, 'completar');
  });

  test('sin categorías ni historial no lanza', () => {
    const p = construirPropuesta(voz(), { categories: [], transactions: [], salario: 0 });
    assert.equal(p.accionPrimaria, 'crear_y_guardar');
  });

  test('categoría vacía queda sin resolver', () => {
    const p = construirPropuesta(voz({ categoria: '' }), ctx([cat('c1', 'Entretenimiento')]));
    assert.equal(p.categoria.estado, 'sin_resolver');
  });
});

describe('etiqueta del botón primario', () => {
  const fmt = (n: number) => '$' + n.toLocaleString('es-CO').replace(/,/g, '.');

  test('refleja la acción resuelta', () => {
    const existe = construirPropuesta(voz(), ctx([cat('c1', 'Entretenimiento')]));
    assert.equal(etiquetaAccion(existe, fmt), 'Guardar');

    const nueva = construirPropuesta(voz(), ctx([cat('c2', 'Alimentación')]));
    assert.equal(etiquetaAccion(nueva, fmt), 'Crear Entretenimiento y guardar');
  });

  test('muestra el monto cuando fue inferido, para que se pueda revisar', () => {
    const p = construirPropuesta(
      voz({ monto: 0, descripcion: 'Netflix' }),
      ctx([cat('c1', 'Entretenimiento')], [tx('t1', 44_000, 'Entretenimiento', 1, 'Netflix')]),
    );
    assert.equal(etiquetaAccion(p, fmt), 'Guardar $44.000');
  });
});
