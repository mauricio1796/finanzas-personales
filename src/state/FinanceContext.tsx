import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  Category, 
  Transaction,
  FinancialProfile,
  FinancialGoal,
  Budget,
  Achievement,
  UserLevel,
  OnboardingState,
} from '../types';
import { storageService } from '../services/storage/StorageService';
import { DEFAULT_CATEGORIES } from '../models/Category';

interface FinanceContextType {
  // User & Profile
  user: User | null;
  setUser: (u: User | null) => void;
  updateUserSalary: (salary: number) => void;
  
  // Financial Profile (NEW)
  profile: FinancialProfile | null;
  setProfile: (p: FinancialProfile) => void;

  // Categories
  categories: Category[];
  setCategories: (c: Category[]) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;

  // Transactions
  transactions: Transaction[];
  addTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;

  // Financial Goals (NEW)
  goal: FinancialGoal | null;
  setGoal: (g: FinancialGoal) => void;
  updateGoal: (updates: Partial<FinancialGoal>) => void;

  // Budgets (NEW)
  budgets: Budget[];
  setBudgets: (b: Budget[]) => void;
  updateBudget: (categoryId: string, updates: Partial<Budget>) => void;

  // Achievements (NEW)
  achievements: Achievement[];
  addAchievement: (a: Achievement) => void;
  unlockAchievement: (type: string) => void;

  // User Level (NEW)
  userLevel: UserLevel | null;
  updateUserLevel: (level: UserLevel) => void;

  // Onboarding
  isOnboarded: boolean;
  setIsOnboarded: (value: boolean) => void;
  onboardingState: OnboardingState;
  updateOnboardingStep: (step: number) => void;

  // General
  refreshData: () => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

interface FinanceProviderProps {
  children: ReactNode;
}

export function FinanceProvider({ children }: FinanceProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isOnboarded, setIsOnboarded] = useState(false);
  
  // NEW: Financial Profile
  const [profile, setProfile] = useState<FinancialProfile | null>(null);
  
  // NEW: Financial Goal
  const [goal, setGoal] = useState<FinancialGoal | null>(null);
  
  // NEW: Budgets
  const [budgets, setBudgets] = useState<Budget[]>([]);
  
  // NEW: Achievements
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  
  // NEW: User Level (1-5)
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  
  // NEW: Onboarding State
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({
    step: 0,
    profileCompleted: false,
    goalSelected: false,
    budgetCreated: false,
  });

  // Load onboarding state on mount
  useEffect(() => {
    loadOnboardingState();
  }, []);

  const loadOnboardingState = async () => {
    try {
      const onboarded = await storageService.getOnboarded();
      setIsOnboarded(onboarded);
    } catch (error) {
      console.error('Error loading onboarding state:', error);
    }
  };

  const handleSetIsOnboarded = async (value: boolean) => {
    try {
      await storageService.setOnboarded(value);
      setIsOnboarded(value);
    } catch (error) {
      console.error('Error saving onboarding state:', error);
    }
  };

  // Update user salary
  const updateUserSalary = (salary: number) => {
    if (user) {
      const updatedUser = { ...user, monthlySalary: salary };
      setUser(updatedUser);
    }
  };

  // Update category
  const updateCategory = (id: string, updates: Partial<Category>) => {
    setCategories(categories.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };

  // Add transaction
  const addTransaction = (t: Transaction) => {
    setTransactions([...transactions, t]);
  };

  // Delete transaction
  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  // NEW: Update Goal
  const updateGoal = (updates: Partial<FinancialGoal>) => {
    if (goal) {
      setGoal({ ...goal, ...updates });
    }
  };

  // NEW: Update Budget
  const updateBudget = (categoryId: string, updates: Partial<Budget>) => {
    setBudgets(budgets.map(b => 
      b.categoryId === categoryId ? { ...b, ...updates } : b
    ));
  };

  // NEW: Add Achievement
  const addAchievement = (a: Achievement) => {
    if (!achievements.find(ach => ach.type === a.type)) {
      setAchievements([...achievements, a]);
    }
  };

  // NEW: Unlock Achievement
  const unlockAchievement = (type: string) => {
    setAchievements(achievements.map(a => 
      a.type === type ? { ...a, unclocked: true } : a
    ));
  };

  // NEW: Update User Level
  const updateUserLevel = (level: UserLevel) => {
    setUserLevel(level);
  };

  // NEW: Update Onboarding Step
  const updateOnboardingStep = (step: number) => {
    setOnboardingState(prev => ({
      ...prev,
      step,
      profileCompleted: step > 1,
      goalSelected: step > 2,
      budgetCreated: step > 3,
    }));
  };

  // Refresh data
  const refreshData = () => {
    // Load from storage if needed
  };

  const value: FinanceContextType = {
    user,
    setUser,
    updateUserSalary,
    profile,
    setProfile,
    categories,
    setCategories,
    updateCategory,
    transactions,
    addTransaction,
    deleteTransaction,
    goal,
    setGoal,
    updateGoal,
    budgets,
    setBudgets,
    updateBudget,
    achievements,
    addAchievement,
    unlockAchievement,
    userLevel,
    updateUserLevel,
    isOnboarded,
    setIsOnboarded: handleSetIsOnboarded,
    onboardingState,
    updateOnboardingStep,
    refreshData,
  };

  return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within FinanceProvider');
  }
  return context;
}
