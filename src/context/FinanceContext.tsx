import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

interface FinanceContextType {
  categories: Category[];
  setCategories: (categories: Category[]) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

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

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);

  return (
    <FinanceContext.Provider value={{ categories, setCategories }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
