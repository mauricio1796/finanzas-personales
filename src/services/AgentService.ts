import type { Transaction, Category, FinancialGoal } from '../types';
import { resolverTransaccionesCandidatas } from '../utils/categoryResolver';

export { resolverTransaccionesCandidatas };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FinnToolCall {
  tool:             string;
  input:            Record<string, any>;
  toolUseId:        string;
  assistantMessage: any[];
}

export interface FinnToolResult {
  exito:       boolean;
  descripcion: string;
}

export interface AgentContext {
  transactions:      Transaction[];
  categories:        Category[];
  goal:              FinancialGoal | null;
  addTransaction:    (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  updateTransaction: (id: string, update: Partial<Transaction>) => void;
  updateCategory:    (id: string, update: any) => void;
  addCategory:       (cat: Category) => void;
  setGoal:           (goal: FinancialGoal) => void;
  deleteCategory:    (id: string) => void;
}

// ── Executor ──────────────────────────────────────────────────────────────────

export function ejecutarHerramienta(toolCall: FinnToolCall, ctx: AgentContext): FinnToolResult {
  const { tool, input } = toolCall;
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

  switch (tool) {
    case 'registrar_transaccion': {
      // Resolve subcategory: accept name or id
      let subcategoryId: string | undefined;
      if (input.subcategoria) {
        const sub = ctx.categories.find(
          c => c.id === input.subcategoria || c.name.toLowerCase() === String(input.subcategoria).toLowerCase(),
        );
        subcategoryId = sub?.id ?? input.subcategoria;
      }
      const tx: Transaction = {
        id:          Date.now().toString(),
        amount:      input.monto,
        type:        input.tipo as 'income' | 'expense',
        category:    input.categoria,
        date:        new Date().toISOString(),
        description: input.descripcion,
        ...(subcategoryId ? { subcategory: subcategoryId } : {}),
      };
      ctx.addTransaction(tx);
      const label = input.tipo === 'income' ? 'ingreso' : 'gasto';
      const subLabel = subcategoryId
        ? ` (${ctx.categories.find(c => c.id === subcategoryId)?.name ?? subcategoryId})`
        : '';
      return { exito: true, descripcion: `Registré un ${label} de ${fmt(input.monto)} en ${input.categoria}${subLabel}` };
    }

    case 'eliminar_transaccion': {
      // BUG-03: mismo criterio inequívoco que actualizar_transaccion. Borrar es
      // aún más grave que editar, así que tampoco aquí se adivina.
      const candidatos = resolverTransaccionesCandidatas(input, ctx.transactions);
      if (candidatos.length === 0) {
        return { exito: false, descripcion: 'No encontré esa transacción. Dime el monto y la categoría exactos.' };
      }
      if (candidatos.length > 1) {
        const opciones = candidatos.slice(0, 3)
          .map(t => `${fmt(t.amount)} en ${t.category} (${new Date(t.date).toLocaleDateString('es-CO')})`)
          .join('; ');
        return { exito: false, descripcion: `Hay varias que coinciden: ${opciones}. ¿Cuál elimino?` };
      }
      const tx = candidatos[0];
      ctx.deleteTransaction(tx.id);
      return { exito: true, descripcion: `Eliminé el ${tx.type === 'income' ? 'ingreso' : 'gasto'} de ${fmt(tx.amount)} en ${tx.category}` };
    }

    case 'actualizar_transaccion': {
      /**
       * BUG-03 — Resolución INEQUÍVOCA de la transacción.
       *
       * Antes, si el modelo no lograba resolver el id, esta función recorría una
       * cascada de heurísticas y terminaba en `sorted[0]`: modificaba la última
       * transacción del usuario, sin relación con lo pedido y sin confirmación,
       * informando "Corregí el gasto..." como si hubiera acertado.
       *
       * Ahora solo se acepta una coincidencia única. Ante cualquier ambigüedad
       * se devuelve un error pidiendo precisión: la autoridad sobre los datos
       * financieros es de la app, no de lo que el modelo haya inferido.
       */
      const candidatos = resolverTransaccionesCandidatas(input, ctx.transactions);

      if (candidatos.length === 0) {
        return {
          exito: false,
          descripcion: 'No encontré esa transacción. ¿Puedes decirme el monto y la categoría exactos?',
        };
      }
      if (candidatos.length > 1) {
        const opciones = candidatos.slice(0, 3)
          .map(t => `${fmt(t.amount)} en ${t.category} (${new Date(t.date).toLocaleDateString('es-CO')})`)
          .join('; ');
        return {
          exito: false,
          descripcion: `Encontré varias que coinciden: ${opciones}. ¿Cuál de ellas quieres corregir?`,
        };
      }

      const tx = candidatos[0];

      const update: Partial<Transaction> = {};
      if (input.monto       !== undefined) update.amount      = Number(input.monto);
      if (input.categoria   !== undefined) update.category    = input.categoria;
      if (input.descripcion !== undefined) update.description = input.descripcion;

      ctx.updateTransaction(tx.id, update);

      const montoAntes = fmt(tx.amount);
      const montoDesp  = input.monto !== undefined ? fmt(Number(input.monto)) : montoAntes;
      return {
        exito: true,
        descripcion: `Corregí el gasto de ${montoAntes} → ${montoDesp} en ${tx.category}. El saldo se actualizó automáticamente.`,
      };
    }

    case 'actualizar_presupuesto': {
      // Buscar categoría por ID o por nombre
      const cat = ctx.categories.find(c =>
        c.id === input.categoria_id ||
        c.name.toLowerCase() === String(input.categoria_id ?? '').toLowerCase() ||
        c.name.toLowerCase() === String(input.nombre_categoria ?? '').toLowerCase(),
      );
      if (!cat) return { exito: false, descripcion: `No encontré esa categoría` };
      ctx.updateCategory(cat.id, { budget: input.nuevo_presupuesto });
      return { exito: true, descripcion: `Actualicé el presupuesto de ${cat.name} a ${fmt(input.nuevo_presupuesto)}` };
    }

    case 'crear_categoria': {
      const nueva: Category = {
        id:         Date.now().toString(),
        name:       input.nombre,
        budget:     input.presupuesto ?? 0,
        icon:       input.icono ?? 'tag',
        tipo:       'gasto',
        isSelected: true,
      };
      ctx.addCategory(nueva);
      return { exito: true, descripcion: `Creé la categoría "${input.nombre}"` };
    }

    case 'crear_subcategoria': {
      // Find parent category
      const padre = ctx.categories.find(
        c => c.id === input.categoria_padre_id
          || c.name.toLowerCase() === String(input.categoria_padre).toLowerCase(),
      );
      if (!padre) {
        return { exito: false, descripcion: `No encontré la categoría padre "${input.categoria_padre ?? input.categoria_padre_id}"` };
      }
      const nueva: Category = {
        id:               Date.now().toString(),
        name:             input.nombre,
        budget:           input.presupuesto ?? 0,
        icon:             input.icono ?? 'tag',
        tipo:             padre.tipo ?? 'gasto',
        isSelected:       true,
        parentCategoryId: padre.id,
        fechaCreacion:    new Date().toISOString(),
      };
      ctx.addCategory(nueva);
      return { exito: true, descripcion: `Creé la subcategoría "${input.nombre}" dentro de "${padre.name}"` };
    }

    case 'eliminar_subcategoria': {
      const sub = ctx.categories.find(
        c => c.id === input.id
          || (c.name.toLowerCase() === String(input.nombre ?? '').toLowerCase() && c.parentCategoryId),
      );
      if (!sub) return { exito: false, descripcion: `No encontré la subcategoría` };
      ctx.deleteCategory(sub.id);
      return { exito: true, descripcion: `Eliminé la subcategoría "${sub.name}"` };
    }

    case 'listar_subcategorias': {
      const padre = ctx.categories.find(
        c => c.id === input.categoria_padre_id
          || c.name.toLowerCase() === String(input.categoria_padre ?? '').toLowerCase(),
      );
      if (!padre) return { exito: false, descripcion: `No encontré la categoría padre` };
      const subs = ctx.categories.filter(c => c.parentCategoryId === padre.id);
      if (subs.length === 0) return { exito: true, descripcion: `"${padre.name}" no tiene subcategorías aún` };
      const lista = subs.map(s => `• ${s.name}`).join('\n');
      return { exito: true, descripcion: `Subcategorías de "${padre.name}":\n${lista}` };
    }

    case 'actualizar_meta': {
      const base = ctx.goal;
      ctx.setGoal({
        ...(base ?? {}),
        name:          input.nombre,
        targetAmount:  input.monto_objetivo,
        currentAmount: base?.currentAmount ?? 0,
        deadline:      input.fecha_limite  ?? base?.deadline,
      } as unknown as FinancialGoal);
      return { exito: true, descripcion: `Actualicé tu meta a "${input.nombre}" por ${fmt(input.monto_objetivo)}` };
    }

    default:
      return { exito: false, descripcion: `Herramienta desconocida: ${tool}` };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function previewEliminar(id: string, transactions: Transaction[]): string {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return `transacción con ID ${id}`;
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
  const fecha = new Date(tx.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return `${tx.type === 'income' ? 'ingreso' : 'gasto'} de ${fmt(tx.amount)} en ${tx.category} del ${fecha}`;
}

/**
 * Texto de confirmación para las acciones sensibles de Finn (BUG-03).
 * Describe exactamente QUÉ transacción se va a tocar, para que el usuario pueda
 * detectar una resolución equivocada antes de que se aplique.
 */
export function previewAccion(
  tool: string,
  input: Record<string, any>,
  transactions: Transaction[],
): string {
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
  const candidatos = resolverTransaccionesCandidatas(input, transactions);
  const tx = candidatos.length === 1 ? candidatos[0] : undefined;

  switch (tool) {
    case 'eliminar_transaccion':
      return tx
        ? `¿Eliminar ${previewEliminar(tx.id, transactions)}?`
        : '¿Eliminar esa transacción? No pude identificarla con certeza.';

    case 'actualizar_transaccion': {
      if (!tx) return '¿Modificar esa transacción? No pude identificarla con certeza.';
      const antes = fmt(tx.amount);
      const despues = input.monto !== undefined ? fmt(Number(input.monto)) : antes;
      const cambioCat = input.categoria && input.categoria !== tx.category
        ? ` y moverlo a ${input.categoria}`
        : '';
      return antes === despues && !cambioCat
        ? `¿Actualizar el ${tx.type === 'income' ? 'ingreso' : 'gasto'} de ${antes} en ${tx.category}?`
        : `¿Cambiar el ${tx.type === 'income' ? 'ingreso' : 'gasto'} de ${tx.category}: ${antes} → ${despues}${cambioCat}?`;
    }

    case 'eliminar_subcategoria':
      return `¿Eliminar la subcategoría "${input.nombre ?? input.id}"?`;

    default:
      return '¿Confirmas esta acción?';
  }
}
