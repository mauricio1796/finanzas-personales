import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transaction, Category, User, FinancialProfile, FinancialGoal, UserLevel, Meta, Deuda, GastoRecurrente } from '../../types';
import type { PremiumState, RetoActivo } from '../../state/FinanceContext';

export interface StorageData {
  transactions: Transaction[];
  categories: Category[];
  user: User | null;
  settings: Record<string, any>;
}

class StorageService {
  private readonly KEYS = {
    TRANSACTIONS: '@financy_transactions',
    CATEGORIES: '@financy_categories',
    USER: '@financy_user',
    SETTINGS: '@financy_settings',
    ONBOARDED: '@financy_onboarded',
    PROFILE: '@financy_profile',
    GOAL: '@financy_goal',
    USER_LEVEL: '@financy_user_level',
    PAID_TX_IDS: '@financy_paid_tx_ids',
    LECCIONES_COMPLETADAS: '@financy_lecciones_completadas',
    RETO_ACTIVO: '@financy_reto_activo',
    RETOS_COMPLETADOS: '@financy_retos_completados',
    PREMIUM: '@financy_premium',
    TOUR_DONE: '@financy_tour_done',
    METAS: '@financy_metas',
    DEUDAS: '@financy_deudas',
    RECURRENTES: '@financy_recurrentes',
    PERMISSIONS_SHOWN: '@financy_permissions_shown',
  };

  async saveData(key: string, data: any): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving data with key ' + key + ':', error);
      throw error;
    }
  }

  async getData<T>(key: string): Promise<T | null> {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting data with key ' + key + ':', error);
      return null;
    }
  }

  async removeData(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing data with key ' + key + ':', error);
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  async saveTransactions(transactions: Transaction[]): Promise<void> { return this.saveData(this.KEYS.TRANSACTIONS, transactions); }
  async getTransactions(): Promise<Transaction[] | null> { return this.getData<Transaction[]>(this.KEYS.TRANSACTIONS); }
  async saveUser(user: User): Promise<void> { return this.saveData(this.KEYS.USER, user); }
  async getUser(): Promise<User | null> { return this.getData<User>(this.KEYS.USER); }
  async setOnboarded(value: boolean): Promise<void> { return this.saveData(this.KEYS.ONBOARDED, value); }
  async getOnboarded(): Promise<boolean> { const v = await this.getData<boolean>(this.KEYS.ONBOARDED); return v === true; }
  async saveProfile(profile: FinancialProfile): Promise<void> { return this.saveData(this.KEYS.PROFILE, profile); }
  async getProfile(): Promise<FinancialProfile | null> { return this.getData<FinancialProfile>(this.KEYS.PROFILE); }
  async saveGoal(goal: FinancialGoal): Promise<void> { return this.saveData(this.KEYS.GOAL, goal); }
  async getGoal(): Promise<FinancialGoal | null> { return this.getData<FinancialGoal>(this.KEYS.GOAL); }
  async saveUserLevel(level: UserLevel): Promise<void> { return this.saveData(this.KEYS.USER_LEVEL, level); }
  async getUserLevel(): Promise<UserLevel | null> { return this.getData<UserLevel>(this.KEYS.USER_LEVEL); }
  async saveCategories(categories: Category[]): Promise<void> { return this.saveData(this.KEYS.CATEGORIES, categories); }
  async getCategories(): Promise<Category[] | null> { return this.getData<Category[]>(this.KEYS.CATEGORIES); }
  async savePaidTxIds(ids: string[]): Promise<void> { return this.saveData(this.KEYS.PAID_TX_IDS, ids); }
  async getPaidTxIds(): Promise<string[] | null> { return this.getData<string[]>(this.KEYS.PAID_TX_IDS); }
  async saveLeccionesCompletadas(ids: string[]): Promise<void> { return this.saveData(this.KEYS.LECCIONES_COMPLETADAS, ids); }
  async getLeccionesCompletadas(): Promise<string[] | null> { return this.getData<string[]>(this.KEYS.LECCIONES_COMPLETADAS); }
  async saveRetoActivo(reto: RetoActivo | null): Promise<void> { return this.saveData(this.KEYS.RETO_ACTIVO, reto); }
  async getRetoActivo(): Promise<RetoActivo | null> { return this.getData<RetoActivo>(this.KEYS.RETO_ACTIVO); }
  async saveRetosCompletados(ids: string[]): Promise<void> { return this.saveData(this.KEYS.RETOS_COMPLETADOS, ids); }
  async getRetosCompletados(): Promise<string[] | null> { return this.getData<string[]>(this.KEYS.RETOS_COMPLETADOS); }
  async savePremium(state: PremiumState): Promise<void> { return this.saveData(this.KEYS.PREMIUM, state); }
  async getPremium(): Promise<PremiumState | null> { return this.getData<PremiumState>(this.KEYS.PREMIUM); }
  async setTourDone(value: boolean): Promise<void> { return this.saveData(this.KEYS.TOUR_DONE, value); }
  async getTourDone(): Promise<boolean> { const v = await this.getData<boolean>(this.KEYS.TOUR_DONE); return v === true; }
  async setPermissionsShown(value: boolean): Promise<void> { return this.saveData(this.KEYS.PERMISSIONS_SHOWN, value); }
  async getPermissionsShown(): Promise<boolean> { const v = await this.getData<boolean>(this.KEYS.PERMISSIONS_SHOWN); return v === true; }
  async saveMetas(metas: Meta[]): Promise<void> { return this.saveData(this.KEYS.METAS, metas); }
  async getMetas(): Promise<Meta[] | null> { return this.getData<Meta[]>(this.KEYS.METAS); }
  async saveDeudas(deudas: Deuda[]): Promise<void> { return this.saveData(this.KEYS.DEUDAS, deudas); }
  async getDeudas(): Promise<Deuda[] | null> { return this.getData<Deuda[]>(this.KEYS.DEUDAS); }
  async saveRecurrentes(recurrentes: GastoRecurrente[]): Promise<void> { return this.saveData(this.KEYS.RECURRENTES, recurrentes); }
  async getRecurrentes(): Promise<GastoRecurrente[] | null> { return this.getData<GastoRecurrente[]>(this.KEYS.RECURRENTES); }
}

export const storageService = new StorageService();
