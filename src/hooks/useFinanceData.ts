import { useState, useCallback } from 'react';
import { Transaction } from '@/src/core/financeEngine';

export function useFinanceData() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const addTransaction = useCallback(
    (amount: number, category: string, type: 'income' | 'expense', date: Date = new Date()) => {
      const newTransaction: Transaction = {
        id: Date.now().toString(),
        amount,
        category,
        type,
        date: date.toISOString(),
      };
      setTransactions(prev => [newTransaction, ...prev]);
    },
    []
  );

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  const getTransactionsByType = useCallback(
    (type: 'income' | 'expense') => {
      return transactions.filter(t => t.type === type);
    },
    [transactions]
  );

  const getTransactionsByDateRange = useCallback(
    (startDate: Date, endDate: Date) => {
      return transactions.filter(
        t => new Date(t.date) >= startDate && new Date(t.date) <= endDate
      );
    },
    [transactions]
  );

  return {
    transactions,
    addTransaction,
    deleteTransaction,
    getTransactionsByType,
    getTransactionsByDateRange,
  };
}