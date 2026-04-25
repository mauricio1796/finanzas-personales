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
}

// ── Executor ──────────────────────────────────────────────────────────────────

export function ejecutarHerramienta(toolCall: FinnToolCall, ctx: AgentContext): FinnToolResult {
  const { tool, input } = toolCall;
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

  switch (tool) {
    case 'registrar_transaccion': {
      const tx: Transaction = {
        id:          Date.now().toString(),
        amount:      input.monto,
        type:        input.tipo as 'income' | 'expense',
        category:    input.categoria,
        date:        new Date().toISOString(),
        description: input.descripcion,
      };
      ctx.addTransaction(tx);
      const label = input.tipo === 'income' ? 'ingreso' : 'gasto';
      return { exito: true, descripcion: `Registré un ${label} de ${fmt(input.monto)} en ${input.categoria}` };
    }

    case 'eliminar_transaccion': {
      const tx = ctx.transactions.find(t => t.id === input.id);
      if (!tx) return { exito: false, descripcion: `No encontré la transacción con ID ${input.id}` };
      ctx.deleteTransaction(input.id);
      return { exito: true, descripcion: `Eliminé el ${tx.type === 'income' ? 'ingreso' : 'gasto'} de ${fmt(tx.amount)} en ${tx.category}` };
    }

    case 'actualizar_transaccion': {
      const tx = ctx.transactions.find(t => t.id === input.id);
      if (!tx) return { exito: false, descripcion: `No encontré esa transacción` };
      const update: Partial<Transaction> = {};
      if (input.monto     !== undefined) update.amount      = input.monto;
      if (input.categoria !== undefined) update.category    = input.categoria;
      if (input.descripcion !== undefined) update.description = input.descripcion;
      ctx.updateTransaction(input.id, update);
      return { exito: true, descripcion: `Actualicé la transacción de ${tx.category}` };
    }

    case 'actualizar_presupuesto': {
      const cat = ctx.categories.find(c => c.id === input.categoria_id);
      if (!cat) return { exito: false, descripcion: `No encontré esa categoría` };
      ctx.updateCategory(input.categoria_id, { budget: input.nuevo_presupuesto });
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
