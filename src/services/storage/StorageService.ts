import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StorageData {
  transactions: any[];
  categories: any[];
  user: any;
  settings: Record<string, any>;
}

class StorageService {
  // AsyncStorage keys
  private readonly KEYS = {
    TRANSACTIONS: '@financy_transactions',
    CATEGORIES: '@financy_categories',
    USER: '@financy_user',
    SETTINGS: '@financy_settings',
    ONBOARDED: '@financy_onboarded',
  };

  async saveData(key: string, data: any): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving data with key ${key}:`, error);
      throw error;
    }
  }

  async getData<T>(key: string): Promise<T | null> {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error getting data with key ${key}:`, error);
      return null;
    }
  }

  async removeData(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing data with key ${key}:`, error);
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

  // Helper methods for specific data
  async saveTransactions(transactions: any[]): Promise<void> {
    return this.saveData(this.KEYS.TRANSACTIONS, transactions);
  }

  async getTransactions(): Promise<any[] | null> {
    return this.getData(this.KEYS.TRANSACTIONS);
  }

  async saveUser(user: any): Promise<void> {
    return this.saveData(this.KEYS.USER, user);
  }

  async getUser(): Promise<any | null> {
    return this.getData(this.KEYS.USER);
  }

  async setOnboarded(value: boolean): Promise<void> {
    return this.saveData(this.KEYS.ONBOARDED, value);
  }

  async getOnboarded(): Promise<boolean> {
    const value = await this.getData<boolean>(this.KEYS.ONBOARDED);
    return value === true;
  }
}

export const storageService = new StorageService();
