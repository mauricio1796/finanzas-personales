import { useFinance } from '../FinanceContext';
import { calculateTotalIncome, calculateTotalExpenses, calculateBalance } from '../../core/engine/calculations';

export function useFinanceData() {
  const { transactions } = useFinance();

  const totalIncome = calculateTotalIncome(transactions);
  const totalExpenses = calculateTotalExpenses(transactions);
  const balance = calculateBalance(transactions);

  return {
    totalIncome,
    totalExpenses,
    balance,
    transactions,
  };
}
