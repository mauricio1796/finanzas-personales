import { createContext, useContext, useState } from 'react';

export type Category = {
  id: string;
  name: string;
};

type FinanceContextType = {
  categories: Category[];
  setCategories: (c: Category[]) => void;
};

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);

  return (
    <FinanceContext.Provider value={{ categories, setCategories }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('FinanceContext error');
  return context;
}
