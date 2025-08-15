import type { AppState, Profile } from '../types';
import { STORAGE_KEYS } from '../types';

// Utility functions for localStorage management

export class StorageManager {
  private static instance: StorageManager;

  private constructor() {}

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  // Generic storage methods
  private setItem<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;

    try {
      const serialized = JSON.stringify(value, this.dateReplacer);
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.error(`Failed to save to localStorage (${key}):`, error);
    }
  }

  private getItem<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;

    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return JSON.parse(item, this.dateReviver);
    } catch (error) {
      console.error(`Failed to load from localStorage (${key}):`, error);
      return defaultValue;
    }
  }

  private removeItem(key: string): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove from localStorage (${key}):`, error);
    }
  }

  // Date serialization helpers
  private dateReplacer(key: string, value: any): any {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  private dateReviver(key: string, value: any): any {
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  }

  // Profile management
  public saveProfiles(profiles: Profile[]): void {
    this.setItem(STORAGE_KEYS.PROFILES, profiles);
  }

  public loadProfiles(): Profile[] {
    return this.getItem<Profile[]>(STORAGE_KEYS.PROFILES, []);
  }

  public saveProfile(profile: Profile): void {
    const profiles = this.loadProfiles();
    const existingIndex = profiles.findIndex(p => p.id === profile.id);
    
    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }
    
    this.saveProfiles(profiles);
  }

  public deleteProfile(profileId: string): void {
    const profiles = this.loadProfiles();
    const filteredProfiles = profiles.filter(p => p.id !== profileId);
    this.saveProfiles(filteredProfiles);
  }

  public getProfile(profileId: string): Profile | null {
    const profiles = this.loadProfiles();
    return profiles.find(p => p.id === profileId) || null;
  }

  // App state management
  public saveAppState(appState: Partial<AppState>): void {
    const currentState = this.loadAppState();
    const newState = { ...currentState, ...appState };
    this.setItem(STORAGE_KEYS.APP_STATE, newState);
  }

  public loadAppState(): Partial<AppState> {
    return this.getItem<Partial<AppState>>(STORAGE_KEYS.APP_STATE, {});
  }

  // Utility methods
  public clearAllData(): void {
    this.removeItem(STORAGE_KEYS.PROFILES);
    this.removeItem(STORAGE_KEYS.APP_STATE);
  }

  public exportData(): string {
    const profiles = this.loadProfiles();
    const appState = this.loadAppState();
    
    return JSON.stringify({
      profiles,
      appState,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    }, null, 2);
  }

  public importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData, this.dateReviver);
      
      if (data.profiles && Array.isArray(data.profiles)) {
        this.saveProfiles(data.profiles);
      }
      
      if (data.appState && typeof data.appState === 'object') {
        this.saveAppState(data.appState);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  // Storage size estimation
  public getStorageSize(): { used: number; available: number } {
    if (typeof window === 'undefined') {
      return { used: 0, available: 5 * 1024 * 1024 };
    }

    let used = 0;

    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }
    } catch (error) {
      console.error('Failed to calculate storage size:', error);
    }

    // Rough estimate of available space (5MB is typical localStorage limit)
    const available = 5 * 1024 * 1024 - used;

    return { used, available };
  }
}

// Export singleton instance
export const storage = StorageManager.getInstance();
