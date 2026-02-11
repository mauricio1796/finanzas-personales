import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Category = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  budget?: number;
  isSelected?: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  monthlySalary?: number;
  createdAt?: string;
};

export type Transaction = {
  id: string;
  amount: number;
  category: string;
  date: string;
  type: 'income' | 'expense';
  description?: string;
};

type FinanceContextType = {
  // User
  user: User | null;
  setUser: (u: User | null) => void;
  updateUserSalary: (salary: number) => void;
  
  // Categories
  categories: Category[];
  setCategories: (c: Category[]) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  
  // Transactions
  transactions: Transaction[];
  addTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;
  
  // Onboarding
  isOnboarded: boolean;
  setIsOnboarded: (value: boolean) => void;
  
  // General
  refreshData: () => void;
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Comida', icon: '🍔', color: '#FF6B6B' },
  { id: '2', name: 'Transporte', icon: '🚗', color: '#4ECDC4' },
  { id: '3', name: 'Vivienda', icon: '🏠', color: '#BC6C25' },
  { id: '4', name: 'Servicios', icon: '💡', color: '#A8DADC' },
  { id: '5', name: 'Ocio', icon: '🎮', color: '#F1FAEE' },
  { id: '6', name: 'Salud', icon: '⚕️', color: '#96CEB4' },
  { id: '7', name: 'Educación', icon: '📚', color: '#FFEAA7' },
  { id: '8', name: 'Ropa', icon: '👕', color: '#DDA15E' },
  { id: '9', name: 'Mascotas', icon: '🐕', color: '#C9ADA7' },
  { id: '10', name: 'Seguros', icon: '🛡️', color: '#9A8C98' },
  { id: '11', name: 'Suscripciones', icon: '📺', color: '#F72585' },
  { id: '12', name: 'Gimnasio', icon: '💪', color: '#FFB703' },
  { id: '13', name: 'Restaurantes', icon: '🍽️', color: '#FB5607' },
  { id: '14', name: 'Cine', icon: '🎬', color: '#45B7D1' },
  { id: '15', name: 'Viajes', icon: '✈️', color: '#8ECAE6' },
  { id: '16', name: 'Regalos', icon: '🎁', color: '#FFB4A2' },
  { id: '17', name: 'Cuidado Personal', icon: '💇', color: '#E5989B' },
  { id: '18', name: 'Deuda/Créditos', icon: '💳', color: '#B0A8B8' },
  { id: '19', name: 'Ahorros', icon: '🏦', color: '#22C55E' },
  { id: '20', name: 'Otros', icon: '📦', color: '#94A3B8' },
];

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isOnboarded, setIsOnboarded] = useState(false);

  // Cargar onboarding state desde AsyncStorage al iniciar
  useEffect(() => {
    loadOnboardingState();
  }, []);

  const loadOnboardingState = async () => {
    try {
      const stored = await AsyncStorage.getItem('@financy_onboarded');
      if (stored === 'true') {
        setIsOnboarded(true);
      }
    } catch (error) {
      console.log('Error loading onboarding state:', error);
    }
  };

  const handleSetIsOnboarded = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('@financy_onboarded', value ? 'true' : 'false');
      setIsOnboarded(value);
    } catch (error) {
      console.log('Error saving onboarding state:', error);
    }
  };

  // Actualizar salario del usuario
  const updateUserSalary = (salary: number) => {
    if (user) {
      setUser({ ...user, monthlySalary: salary });
    }
  };

  // Actualizar una categoría
  const updateCategory = (id: string, updates: Partial<Category>) => {
    setCategories(categories.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };

  // Agregar transacción
  const addTransaction = (t: Transaction) => {
    setTransactions([...transactions, t]);
  };

  // Eliminar transacción
  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  // Refrescar datos
  const refreshData = () => {
    // Aquí puedes agregar lógica para cargar desde storage si es necesario
  };

  return (
    <FinanceContext.Provider
      value={{
        user,
        setUser,
        updateUserSalary,
        categories,
        setCategories,
        updateCategory,
        transactions,
        addTransaction,
        deleteTransaction,
        isOnboarded,
        setIsOnboarded: handleSetIsOnboarded,
        refreshData,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('FinanceContext error');
  return context;
}
