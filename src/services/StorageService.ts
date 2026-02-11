export interface StorageData {
  transactions: any[];
  categories: any[];
  user: any;
  settings: Record<string, any>;
}

class StorageService {
  private storage: Map<string, any> = new Map();

  async saveData(key: string, data: any): Promise<void> {
    try {
      this.storage.set(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving data:', error);
      throw error;
    }
  }

  async getData<T>(key: string): Promise<T | null> {
    try {
      const data = this.storage.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting data:', error);
      return null;
    }
  }

  async removeData(key: string): Promise<void> {
    try {
      this.storage.delete(key);
    } catch (error) {
      console.error('Error removing data:', error);
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    try {
      this.storage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }
}

export const storageService = new StorageService();