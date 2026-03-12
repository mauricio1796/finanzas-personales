import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StorageData {
  transactions: any[];
  categories: any[];
  user: any;
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

  async saveTransactions(transactions: any[]): Promise<void> { return this.saveData(this.KEYS.TRANSACTIONS, transactions); }
  async getTransactions(): Promise<any[] | null> { return this.getData(this.KEYS.TRANSACTIONS); }
  async saveUser(user: any): Promise<void> { return this.saveData(this.KEYS.USER, user); }
  async getUser(): Promise<any | null> { return this.getData(this.KEYS.USER); }
  async setOnboarded(value: boolean): Promise<void> { return this.saveData(this.KEYS.ONBOARDED, value); }
  async getOnboarded(): Promise<boolean> { const v = await this.getData<boolean>(this.KEYS.ONBOARDED); return v === true; }
  async saveProfile(profile: any): Promise<void> { return this.saveData(this.KEYS.PROFILE, profile); }
  async getProfile(): Promise<any | null> { return this.getData(this.KEYS.PROFILE); }
  async saveGoal(goal: any): Promise<void> { return this.saveData(this.KEYS.GOAL, goal); }
  async getGoal(): Promise<any | null> { return this.getData(this.KEYS.GOAL); }
  async saveUserLevel(level: any): Promise<void> { return this.saveData(this.KEYS.USER_LEVEL, level); }
  async getUserLevel(): Promise<any | null> { return this.getData(this.KEYS.USER_LEVEL); }
  async saveCategories(categories: any[]): Promise<void> { return this.saveData(this.KEYS.CATEGORIES, categories); }
  async getCategories(): Promise<any[] | null> { return this.getData(this.KEYS.CATEGORIES); }
  async savePaidTxIds(ids: string[]): Promise<void> { return this.saveData(this.KEYS.PAID_TX_IDS, ids); }
  async getPaidTxIds(): Promise<string[] | null> { return this.getData(this.KEYS.PAID_TX_IDS); }
  async saveLeccionesCompletadas(ids: string[]): Promise<void> { return this.saveData(this.KEYS.LECCIONES_COMPLETADAS, ids); }
  async getLeccionesCompletadas(): Promise<string[] | null> { return this.getData(this.KEYS.LECCIONES_COMPLETADAS); }
  async saveRetoActivo(reto: any): Promise<void> { return this.saveData(this.KEYS.RETO_ACTIVO, reto); }
  async getRetoActivo(): Promise<any | null> { return this.getData(this.KEYS.RETO_ACTIVO); }
  async saveRetosCompletados(ids: string[]): Promise<void> { return this.saveData(this.KEYS.RETOS_COMPLETADOS, ids); }
  async getRetosCompletados(): Promise<string[] | null> { return this.getData(this.KEYS.RETOS_COMPLETADOS); }
  async savePremium(state: any): Promise<void> { return this.saveData(this.KEYS.PREMIUM, state); }
  async getPremium(): Promise<any | null> { return this.getData(this.KEYS.PREMIUM); }
  async setTourDone(value: boolean): Promise<void> { return this.saveData(this.KEYS.TOUR_DONE, value); }
  async getTourDone(): Promise<boolean> { const v = await this.getData<boolean>(this.KEYS.TOUR_DONE); return v === true; }
}

export const storageService = new StorageService();
