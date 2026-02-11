/**
 * Compatibilidad hacia atrás: re-exporta desde la nueva ubicación
 * NOTA: Este archivo es temporal para facilitar la migración
 * Actualiza los imports a src/state/ cuando sea posible
 */

export { useFinance, FinanceProvider } from '../../state/FinanceContext';
export type { Transaction, User, Category } from '../../types';
