// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  monthlySalary?: number;
  createdAt?: string;
}

// Category Types
export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  budget?: number;
  isSelected?: boolean;
  presupuesto?: number;
  gastado?: number;
  diaPago?: number;
  pagado?: boolean;
  tipo?: string;
  fechaCreacion?: string;
}

// Transaction Types
export interface Transaction {
  id: string;
  amount: number;
  category: string;
  date: string;
  type: 'income' | 'expense';
  description?: string;
}

// Auth Types
export type AuthState = 'login' | 'register' | 'authenticated';

// Screen Names
export type ScreenName = 
  | 'dashboard' 
  | 'ingresos' 
  | 'gastos' 
  | 'categorias' 
  | 'estadisticas' 
  | 'botia' 
  | 'usuario';

// ========== NUEVOS TIPOS PARA ONBOARDING Y FEATURES AVANZADAS ==========

// Perfil Financiero
export interface FinancialProfile {
  id: string;
  userId: string;
  employmentType: 'employed' | 'student' | 'freelance' | 'business' | 'other';
  incomeType: 'fixed' | 'variable' | 'mixed';
  monthlySalary: number;
  hasDebts: boolean;
  debtAmount?: number;
  mainFinancialConcern: string;
  currencyPreference: string;
  createdAt: string;
  updatedAt: string;
}

// Objetivo Financiero
export interface FinancialGoal {
  id: string;
  userId: string;
  type: 'savings' | 'debt_elimination' | 'expense_control' | 'investment' | 'organization';
  title: string;
  description?: string;
  targetAmount?: number;
  currentAmount: number;
  deadline?: string;
  priority: 'low' | 'medium' | 'high';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Presupuesto
export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  monthlyLimit: number;
  spent: number;
  month: string; // YYYY-MM
  percentage: number;
  createdAt: string;
  updatedAt: string;
}

// Logro/Medal
export interface Achievement {
  id: string;
  userId: string;
  type: 'streak' | 'budget_control' | 'savings_goal' | 'no_debt' | 'first_transaction' | 'custom';
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  unclocked: boolean;
}

// Nivel del Usuario
export interface UserLevel {
  id: string;
  userId: string;
  level: number; // 1-5
  experience: number;
  title: 'Principiante' | 'Aprendiz' | 'Gestor' | 'Experto' | 'Inversionista';
  createdAt: string;
  updatedAt: string;
}

// Análisis y Recomendaciones IA
export interface AIAnalysis {
  id: string;
  userId: string;
  type: 'spending_pattern' | 'savings_projection' | 'risk_alert' | 'optimization' | 'insight';
  title: string;
  message: string;
  recommendation?: string;
  urgency: 'low' | 'medium' | 'high';
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

// Reto Financiero
export interface Challenge {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  targetCategory?: string;
  targetAmount?: number;
  duration: number; // en días
  startDate: string;
  endDate: string;
  completed: boolean;
  progress: number;
  reward?: string;
  createdAt: string;
}

// Estado de Onboarding
export interface OnboardingState {
  completed: boolean;
  step: number; // 0-4 (Welcome, Profile, Goal, Budget, Confirmation)
  profileCompleted: boolean;
  goalSelected: boolean;
  budgetCreated: boolean;
  createdAt: string;
  updatedAt: string;
}
