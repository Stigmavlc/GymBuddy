/**
 * Safe session storage utilities for GymBuddy
 * Handles browser compatibility and storage errors gracefully
 */

export class SafeSessionStorage {
  private static isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  static getItem<T>(key: string): T | null {
    if (!this.isStorageAvailable()) {
      console.warn('[SessionStorage] Session storage not available, using memory fallback');
      return null;
    }

    try {
      const item = sessionStorage.getItem(key);
      if (!item) return null;
      
      return JSON.parse(item);
    } catch (error) {
      console.warn(`[SessionStorage] Failed to get item ${key}:`, error);
      return null;
    }
  }

  static setItem<T>(key: string, value: T): boolean {
    if (!this.isStorageAvailable()) {
      console.warn('[SessionStorage] Session storage not available, skipping cache');
      return false;
    }

    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`[SessionStorage] Failed to set item ${key}:`, error);
      return false;
    }
  }

  static removeItem(key: string): void {
    if (!this.isStorageAvailable()) {
      return;
    }

    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn(`[SessionStorage] Failed to remove item ${key}:`, error);
    }
  }

  static clear(): void {
    if (!this.isStorageAvailable()) {
      return;
    }

    try {
      sessionStorage.clear();
    } catch (error) {
      console.warn('[SessionStorage] Failed to clear storage:', error);
    }
  }
}