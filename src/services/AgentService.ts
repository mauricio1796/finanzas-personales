import { type Transaction, type Category, type FinancialGoal } from '../types';

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
      // Buscar por ID, o por categoría+monto (la más reciente) si no hay ID
      let tx = ctx.transactions.find(t => t.id === input.id);
      if (!tx && input.categoria) {
        const cat = input.categoria.toLowerCase();
        tx = [...ctx.transactions]
          .filter(t => t.category.toLowerCase() === cat || t.category.toLowerCase().includes(cat))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      }
      if (!tx) return { exito: false, descripcion: `No encontré la transacción` };
      ctx.deleteTransaction(tx.id);
      return { exito: true, descripcion: `Eliminé el ${tx.type === 'income' ? 'ingreso' : 'gasto'} de ${fmt(tx.amount)} en ${tx.category}` };
    }

    case 'actualizar_transaccion': {
      // Buscar por ID; si no, por la transacción más reciente de esa categoría/tipo
      let tx = input.id ? ctx.transactions.find(t => t.id === input.id) : undefined;
      if (!tx) {
        // Fallback: buscar la más reciente que coincida con categoría, tipo o monto original
        const sorted = [...ctx.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (input.categoria) {
          const cat = input.categoria.toLowerCase();
          tx = sorted.find(t =>
            t.category.toLowerCase() === cat ||
            t.category.toLowerCase().includes(cat),
          );
        }
        if (!tx && input.monto_original !== undefined) {
          tx = sorted.find(t => t.amount === input.monto_original);
        }
        if (!tx && input.tipo) {
          tx = sorted.find(t => t.type === input.tipo);
        }
        if (!tx) tx = sorted[0]; // última transacción como último recurso
      }
      if (!tx) return { exito: false, descripcion: `No encontré la transacción a actualizar` };

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
