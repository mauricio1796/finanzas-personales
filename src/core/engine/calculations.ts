import { Transaction } from '../../types';

export function calculateTotalIncome(transactions: Transaction[]): number {
  return transactions
    .filter(t => t.type === 'income')
    .reduce((total, t) => total + t.amount, 0);
}

export function calculateTotalExpenses(transactions: Transaction[]): number {
  return transactions
    .filter(t => t.type === 'expense')
    .reduce((total, t) => total + t.amount, 0);
}

export function calculateBalance(transactions: Transaction[]): number {
  const income = calculateTotalIncome(transactions);
  const expenses = calculateTotalExpenses(transactions);
  return income - expenses;
}

export function expensesByCategory(
  transactions: Transaction[],
  idToName?: Record<string, string>,
): Record<string, number> {
  const result: Record<string, number> = {};

  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const key = idToName ? (idToName[t.category] ?? t.category) : t.category;
      result[key] = (result[key] || 0) + t.amount;
    });

  return result;
}

export function categoryPercentages(
  transactions: Transaction[]
): Record<string, number> {
  const expenses = expensesByCategory(transactions);
  const totalExpenses = calculateTotalExpenses(transactions);

  if (totalExpenses === 0) return {};

  const percentages: Record<string, number> = {};

  for (const category in expenses) {
    percentages[category] = (expenses[category] / totalExpenses) * 100;
  }

  return percentages;
}

export function calculateSavings(
  transactions: Transaction[],
  savingPercentage: number
): number {
  const income = calculateTotalIncome(transactions);
  return income * (savingPercentage / 100);
}

export function checkBudget(spent: number, budget: number) {
  return {
    exceeded: spent > budget,
    remaining: budget - spent,
  };
}
