// PropView Data Manager - Coordinates data fetching, caching, and updates

import { PropagationDataService } from './api';
import { DataProcessor } from './dataProcessor';
import { workerManager } from './workerManager';
import { demoDataGenerator } from './demoData';
import type {
  PropagationSpot,
  SolarData,
  BandCondition,
  FilterSettings,
  AppState
} from '../types';

// Event system for data updates
type DataUpdateListener = (data: {
  spots: PropagationSpot[];
  solarData: SolarData | null;
  bandConditions: BandCondition[];
  lastUpdate: Date;
}) => void;

type ErrorListener = (error: string) => void;

// Data cache with expiration
interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
}

class DataCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
    
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        timestamp: entry.timestamp,
        expiresAt: entry.expiresAt,
        expired: new Date() > entry.expiresAt,
      })),
    };
  }
}

export class DataManager {
  private static instance: DataManager;
  private dataService: PropagationDataService;
  private cache: DataCache;
  private updateListeners: DataUpdateListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private updateInterval: number | null = null;
  private isUpdating = false;
  private demoMode = true; // Start in demo mode due to CORS limitations

  // Current data state
  private currentData: {
    spots: PropagationSpot[];
    solarData: SolarData | null;
    bandConditions: BandCondition[];
    lastUpdate: Date | null;
  } = {
    spots: [],
    solarData: null,
    bandConditions: [],
    lastUpdate: null,
  };

  private constructor() {
    this.dataService = new PropagationDataService();
    this.cache = new DataCache();
  }

  static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  // Event listeners
  onDataUpdate(listener: DataUpdateListener): () => void {
    this.updateListeners.push(listener);
    return () => {
      const index = this.updateListeners.indexOf(listener);
      if (index > -1) {
        this.updateListeners.splice(index, 1);
      }
    };
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.push(listener);
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  private notifyDataUpdate(): void {
    const data = {
      spots: [...this.currentData.spots],
      solarData: this.currentData.solarData,
      bandConditions: [...this.currentData.bandConditions],
      lastUpdate: this.currentData.lastUpdate || new Date(),
    };

    this.updateListeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in data update listener:', error);
      }
    });
  }

  private notifyError(error: string): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }

  // Demo mode methods
  setDemoMode(enabled: boolean): void {
    this.demoMode = enabled;
    console.log(`Demo mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  // Data fetching methods
  async fetchData(filters: FilterSettings): Promise<void> {
    if (this.isUpdating) {
      console.log('Data update already in progress, skipping...');
      return;
    }

    this.isUpdating = true;

    try {
      // Use demo data if in demo mode or if real APIs fail
      if (this.demoMode) {
        await this.fetchDemoData(filters);
        return;
      }
      // Check cache first
      const cacheKey = this.generateCacheKey(filters);
      const cachedData = this.cache.get<{
        spots: PropagationSpot[];
        solarData: SolarData | null;
      }>(cacheKey);

      if (cachedData) {
        console.log('Using cached data');
        this.currentData.spots = cachedData.spots;
        this.currentData.solarData = cachedData.solarData;
        this.currentData.bandConditions = DataProcessor.analyzeBandConditions(cachedData.spots);
        this.currentData.lastUpdate = new Date();
        this.notifyDataUpdate();
        return;
      }

      // Fetch fresh data
      console.log('Fetching fresh propagation data...');
      const data = await this.dataService.fetchAllData({
        timeRange: Math.floor((filters.timeRange.end.getTime() - filters.timeRange.start.getTime()) / (1000 * 60)),
        bands: filters.bands,
        modes: filters.modes,
      });

      // Apply additional filters
      let filteredSpots = data.spots;

      // Geographic filtering
      if (filters.geographic.fromLocation || filters.geographic.minDistance || filters.geographic.maxDistance) {
        filteredSpots = DataProcessor.filterSpotsByLocation(
          filteredSpots,
          filters.geographic.fromLocation,
          filters.geographic.minDistance,
          filters.geographic.maxDistance
        );
      }

      // Signal quality filtering
      if (filters.signal.minSnr !== undefined || filters.signal.maxSnr !== undefined) {
        filteredSpots = filteredSpots.filter(spot => {
          if (spot.snr === undefined) return true;
          if (filters.signal.minSnr !== undefined && spot.snr < filters.signal.minSnr) return false;
          if (filters.signal.maxSnr !== undefined && spot.snr > filters.signal.maxSnr) return false;
          return true;
        });
      }

      // Process data using Web Worker for better performance
      const bandConditions = await workerManager.analyzeBandConditions(filteredSpots);

      // Update current data
      this.currentData.spots = filteredSpots;
      this.currentData.solarData = data.solarData;
      this.currentData.bandConditions = bandConditions;
      this.currentData.lastUpdate = new Date();

      // Cache the data
      this.cache.set(cacheKey, {
        spots: data.spots, // Cache unfiltered data
        solarData: data.solarData,
      }, 5); // 5 minute cache

      this.notifyDataUpdate();
      console.log(`Data updated: ${filteredSpots.length} spots, ${this.currentData.bandConditions.length} bands`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error fetching real data, falling back to demo mode:', errorMessage);

      // Fallback to demo data if real APIs fail
      try {
        await this.fetchDemoData(filters);
        this.setDemoMode(true);
      } catch (demoError) {
        this.notifyError(`Failed to fetch data: ${errorMessage}`);
      }
    } finally {
      this.isUpdating = false;
    }
  }

  // Fetch demo data
  private async fetchDemoData(filters: FilterSettings): Promise<void> {
    console.log('Fetching demo propagation data...');

    // Generate demo spots
    const timeRangeMinutes = Math.floor((filters.timeRange.end.getTime() - filters.timeRange.start.getTime()) / (1000 * 60));
    const spotCount = Math.min(200, Math.max(50, timeRangeMinutes * 2)); // Scale with time range

    let demoSpots = demoDataGenerator.generateSpots(spotCount, timeRangeMinutes);

    // Apply advanced filters
    demoSpots = this.applyAdvancedFilters(demoSpots, filters);

    // Generate demo solar data
    const demoSolarData = demoDataGenerator.generateSolarData();

    // Process data using Web Worker
    const bandConditions = await workerManager.analyzeBandConditions(demoSpots);

    // Update current data
    this.currentData.spots = demoSpots;
    this.currentData.solarData = demoSolarData;
    this.currentData.bandConditions = bandConditions;
    this.currentData.lastUpdate = new Date();

    this.notifyDataUpdate();
    console.log(`Demo data updated: ${demoSpots.length} spots, ${bandConditions.length} bands`);
  }

  // Auto-refresh functionality
  startAutoRefresh(intervalMinutes: number, filters: FilterSettings): void {
    this.stopAutoRefresh();
    
    console.log(`Starting auto-refresh every ${intervalMinutes} minutes`);
    this.updateInterval = window.setInterval(() => {
      this.fetchData(filters);
    }, intervalMinutes * 60 * 1000);

    // Initial fetch
    this.fetchData(filters);
  }

  stopAutoRefresh(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('Auto-refresh stopped');
    }
  }

  // Manual refresh
  async refreshData(filters: FilterSettings): Promise<void> {
    // Clear cache to force fresh data
    this.cache.clear();
    await this.fetchData(filters);
  }

  // Get current data
  getCurrentData() {
    return {
      spots: [...this.currentData.spots],
      solarData: this.currentData.solarData,
      bandConditions: [...this.currentData.bandConditions],
      lastUpdate: this.currentData.lastUpdate,
    };
  }

  // Get data statistics
  getStatistics() {
    const stats = DataProcessor.calculateStatistics(this.currentData.spots);
    return {
      ...stats,
      cacheStats: this.cache.getStats(),
      isUpdating: this.isUpdating,
      autoRefreshActive: this.updateInterval !== null,
    };
  }

  // Generate map data (cached for performance)
  private mapDataCache: {
    markers: any[];
    paths: any[];
    lastUpdate: Date | null;
  } = {
    markers: [],
    paths: [],
    lastUpdate: null,
  };

  async getMapData() {
    // Use cached data if it's recent (within 30 seconds)
    if (this.mapDataCache.lastUpdate &&
        this.currentData.lastUpdate &&
        (this.currentData.lastUpdate.getTime() - this.mapDataCache.lastUpdate.getTime()) < 30000) {
      return {
        markers: this.mapDataCache.markers,
        paths: this.mapDataCache.paths,
      };
    }

    try {
      // Generate fresh map data using Web Worker
      const [markers, paths] = await Promise.all([
        workerManager.generateMapMarkers(this.currentData.spots),
        workerManager.generatePropagationPaths(this.currentData.spots),
      ]);

      // Update cache
      this.mapDataCache = {
        markers,
        paths,
        lastUpdate: new Date(),
      };

      return { markers, paths };
    } catch (error) {
      console.warn('Failed to generate map data with worker, using fallback:', error);
      // Fallback to synchronous processing
      return {
        markers: DataProcessor.generateMapMarkers(this.currentData.spots),
        paths: DataProcessor.generatePropagationPaths(this.currentData.spots),
      };
    }
  }

  // Synchronous version for immediate access (returns cached data)
  getMapDataSync() {
    return {
      markers: this.mapDataCache.markers,
      paths: this.mapDataCache.paths,
    };
  }

  // Utility methods
  private generateCacheKey(filters: FilterSettings): string {
    const key = {
      bands: filters.bands.sort(),
      modes: filters.modes.sort(),
      timeRange: {
        start: Math.floor(filters.timeRange.start.getTime() / (1000 * 60 * 5)), // 5-minute buckets
        end: Math.floor(filters.timeRange.end.getTime() / (1000 * 60 * 5)),
      },
      sources: filters.sources.sort(),
    };
    return JSON.stringify(key);
  }

  // Apply comprehensive filters to spots
  private applyAdvancedFilters(spots: PropagationSpot[], filters: FilterSettings): PropagationSpot[] {
    let filteredSpots = [...spots];

    // Band filters
    if (filters.bands.length > 0) {
      filteredSpots = filteredSpots.filter(spot => filters.bands.includes(spot.band));
    }

    // Mode filters
    if (filters.modes.length > 0) {
      filteredSpots = filteredSpots.filter(spot => filters.modes.includes(spot.mode));
    }

    // Callsign filters
    if (filters.callsign.search) {
      const searchTerm = filters.callsign.search.toLowerCase();
      filteredSpots = filteredSpots.filter(spot => {
        const txMatch = spot.transmitter.callsign.toLowerCase().includes(searchTerm);
        const rxMatch = spot.receiver.callsign.toLowerCase().includes(searchTerm);

        if (filters.callsign.transmitterOnly) return txMatch;
        if (filters.callsign.receiverOnly) return rxMatch;
        return txMatch || rxMatch;
      });
    }

    // Signal quality filters
    if (filters.signal.minSnr !== undefined || filters.signal.maxSnr !== undefined) {
      filteredSpots = filteredSpots.filter(spot => {
        if (spot.snr === undefined) return filters.signal.qualityThreshold === 'any';
        if (filters.signal.minSnr !== undefined && spot.snr < filters.signal.minSnr) return false;
        if (filters.signal.maxSnr !== undefined && spot.snr > filters.signal.maxSnr) return false;
        return true;
      });
    }

    // Quality threshold filter
    if (filters.signal.qualityThreshold !== 'any') {
      filteredSpots = filteredSpots.filter(spot => {
        if (spot.snr === undefined) return false;
        switch (filters.signal.qualityThreshold) {
          case 'excellent': return spot.snr >= 0;
          case 'good': return spot.snr >= -10;
          case 'fair': return spot.snr >= -20;
          default: return true;
        }
      });
    }

    // Geographic filters
    if (filters.geographic.minDistance || filters.geographic.maxDistance) {
      filteredSpots = filteredSpots.filter(spot => {
        const distance = this.calculateDistance(
          spot.transmitter.location.latitude,
          spot.transmitter.location.longitude,
          spot.receiver.location.latitude,
          spot.receiver.location.longitude
        );

        if (filters.geographic.minDistance && distance < filters.geographic.minDistance) return false;
        if (filters.geographic.maxDistance && distance > filters.geographic.maxDistance) return false;
        return true;
      });
    }

    // Advanced filters
    if (filters.advanced.uniqueOnly) {
      const uniquePaths = new Set<string>();
      filteredSpots = filteredSpots.filter(spot => {
        const pathKey = `${spot.transmitter.callsign}-${spot.receiver.callsign}`;
        if (uniquePaths.has(pathKey)) return false;
        uniquePaths.add(pathKey);
        return true;
      });
    }

    return filteredSpots;
  }

  // Calculate distance between two points (Haversine formula)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Cleanup
  destroy(): void {
    this.stopAutoRefresh();
    this.updateListeners.length = 0;
    this.errorListeners.length = 0;
    this.cache.clear();
  }
}

// Export singleton instance
export const dataManager = DataManager.getInstance();
