// PropView Web Worker Manager
// Handles communication with Web Workers for data processing

import type { PropagationSpot, BandCondition, MapMarker, PropagationPath } from '../types';

interface WorkerMessage {
  type: string;
  id: string;
  data?: any;
  result?: any;
  error?: string;
}

interface PendingRequest {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export class WorkerManager {
  private static instance: WorkerManager;
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestIdCounter = 0;
  private isInitialized = false;

  private constructor() {
    this.initializeWorker();
  }

  static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  private initializeWorker(): void {
    try {
      // Create worker from public directory
      this.worker = new Worker('/workers/dataProcessor.js');
      
      this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        this.handleWorkerMessage(e.data);
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        this.rejectAllPending(new Error('Worker error occurred'));
      };

      this.isInitialized = true;
      console.log('Data processing worker initialized');
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      this.isInitialized = false;
    }
  }

  private handleWorkerMessage(message: WorkerMessage): void {
    const { type, id, result, error } = message;
    const pendingRequest = this.pendingRequests.get(id);

    if (!pendingRequest) {
      console.warn('Received message for unknown request ID:', id);
      return;
    }

    this.pendingRequests.delete(id);

    if (type === 'SUCCESS') {
      pendingRequest.resolve(result);
    } else if (type === 'ERROR') {
      pendingRequest.reject(new Error(error || 'Unknown worker error'));
    }
  }

  private sendMessage<T>(type: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized || !this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = `req_${++this.requestIdCounter}`;
      const timestamp = Date.now();

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timestamp });

      // Send message to worker
      this.worker.postMessage({ type, id, data });

      // Set timeout for request (30 seconds)
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Worker request timeout'));
        }
      }, 30000);
    });
  }

  private rejectAllPending(error: Error): void {
    this.pendingRequests.forEach(request => {
      request.reject(error);
    });
    this.pendingRequests.clear();
  }

  // Public API methods

  async analyzeBandConditions(spots: PropagationSpot[]): Promise<BandCondition[]> {
    if (!this.isInitialized) {
      // Fallback to synchronous processing if worker not available
      return this.fallbackAnalyzeBandConditions(spots);
    }

    try {
      return await this.sendMessage<BandCondition[]>('ANALYZE_BAND_CONDITIONS', { spots });
    } catch (error) {
      console.warn('Worker analysis failed, falling back to sync processing:', error);
      return this.fallbackAnalyzeBandConditions(spots);
    }
  }

  async generateMapMarkers(spots: PropagationSpot[]): Promise<MapMarker[]> {
    if (!this.isInitialized) {
      return this.fallbackGenerateMapMarkers(spots);
    }

    try {
      return await this.sendMessage<MapMarker[]>('GENERATE_MAP_MARKERS', { spots });
    } catch (error) {
      console.warn('Worker marker generation failed, falling back to sync processing:', error);
      return this.fallbackGenerateMapMarkers(spots);
    }
  }

  async generatePropagationPaths(spots: PropagationSpot[]): Promise<PropagationPath[]> {
    if (!this.isInitialized) {
      return this.fallbackGeneratePropagationPaths(spots);
    }

    try {
      return await this.sendMessage<PropagationPath[]>('GENERATE_PROPAGATION_PATHS', { spots });
    } catch (error) {
      console.warn('Worker path generation failed, falling back to sync processing:', error);
      return this.fallbackGeneratePropagationPaths(spots);
    }
  }

  async calculateStatistics(spots: PropagationSpot[]): Promise<any> {
    if (!this.isInitialized) {
      return this.fallbackCalculateStatistics(spots);
    }

    try {
      return await this.sendMessage<any>('CALCULATE_STATISTICS', { spots });
    } catch (error) {
      console.warn('Worker statistics calculation failed, falling back to sync processing:', error);
      return this.fallbackCalculateStatistics(spots);
    }
  }

  async processAll(spots: PropagationSpot[]): Promise<{
    bandConditions: BandCondition[];
    mapMarkers: MapMarker[];
    propagationPaths: PropagationPath[];
    statistics: any;
  }> {
    if (!this.isInitialized) {
      return {
        bandConditions: this.fallbackAnalyzeBandConditions(spots),
        mapMarkers: this.fallbackGenerateMapMarkers(spots),
        propagationPaths: this.fallbackGeneratePropagationPaths(spots),
        statistics: this.fallbackCalculateStatistics(spots),
      };
    }

    try {
      return await this.sendMessage('PROCESS_ALL', { spots });
    } catch (error) {
      console.warn('Worker batch processing failed, falling back to sync processing:', error);
      return {
        bandConditions: this.fallbackAnalyzeBandConditions(spots),
        mapMarkers: this.fallbackGenerateMapMarkers(spots),
        propagationPaths: this.fallbackGeneratePropagationPaths(spots),
        statistics: this.fallbackCalculateStatistics(spots),
      };
    }
  }

  // Fallback methods (simplified versions for when worker is not available)
  private fallbackAnalyzeBandConditions(spots: PropagationSpot[]): BandCondition[] {
    // Simplified fallback implementation
    const bandCounts = new Map<string, number>();
    spots.forEach(spot => {
      bandCounts.set(spot.band, (bandCounts.get(spot.band) || 0) + 1);
    });

    const conditions: BandCondition[] = [];
    bandCounts.forEach((count, band) => {
      conditions.push({
        band: band as any,
        condition: count > 10 ? 'GOOD' : count > 5 ? 'FAIR' : 'POOR',
        confidence: Math.min(100, count * 5),
        spotCount: count,
        trend: 'STABLE',
      });
    });

    return conditions;
  }

  private fallbackGenerateMapMarkers(spots: PropagationSpot[]): MapMarker[] {
    // PSK Reporter methodology: Show RECEIVER locations as primary spots
    // Group by precise coordinates (subsquare level) to handle clustering
    const receiverData = new Map<string, {
      position: { latitude: number; longitude: number };
      callsigns: Set<string>;
      spots: PropagationSpot[];
      lastActivity: Date;
      bestSNR: number;
      worstSNR: number;
      bands: Set<string>;
      modes: Set<string>;
      locators: Set<string>;
    }>();

    spots.forEach((spot) => {
      // Only process receiver locations with valid coordinates (not 0,0)
      if (spot.receiver.location.latitude !== 0 || spot.receiver.location.longitude !== 0) {
        // Use higher precision for clustering (6 decimal places for subsquare accuracy)
        const rxKey = `${spot.receiver.location.latitude.toFixed(6)}_${spot.receiver.location.longitude.toFixed(6)}`;

        if (!receiverData.has(rxKey)) {
          receiverData.set(rxKey, {
            position: spot.receiver.location,
            callsigns: new Set([spot.receiver.callsign]),
            spots: [spot],
            lastActivity: new Date(spot.timestamp),
            bestSNR: spot.snr || -999,
            worstSNR: spot.snr || -999,
            bands: new Set([spot.band]),
            modes: new Set([spot.mode]),
            locators: new Set([spot.receiver.location.maidenhead || ''])
          });
        } else {
          const data = receiverData.get(rxKey)!;
          data.callsigns.add(spot.receiver.callsign);
          data.spots.push(spot);
          if (new Date(spot.timestamp) > data.lastActivity) {
            data.lastActivity = new Date(spot.timestamp);
          }
          if (spot.snr && spot.snr > data.bestSNR) {
            data.bestSNR = spot.snr;
          }
          if (spot.snr && spot.snr < data.worstSNR) {
            data.worstSNR = spot.snr;
          }
          data.bands.add(spot.band);
          data.modes.add(spot.mode);
          data.locators.add(spot.receiver.location.maidenhead || '');
        }
      }
    });

    // Convert to markers - PSK Reporter style with clustering
    const markers: MapMarker[] = [];
    let index = 0;

    receiverData.forEach((data, key) => {
      const callsignArray = Array.from(data.callsigns);
      const primaryCallsign = callsignArray[0];
      const isMultiStation = callsignArray.length > 1;

      markers.push({
        id: `receiver-${index++}`,
        position: data.position,
        type: 'receiver', // All spots are receivers in PSK Reporter methodology
        callsign: isMultiStation ? `${primaryCallsign} +${callsignArray.length - 1}` : primaryCallsign,
        spotCount: data.spots.length,
        lastActivity: data.lastActivity,
        popup: {
          title: isMultiStation ? `Multiple Stations (${callsignArray.length})` : `${primaryCallsign} (Monitor)`,
          content: `${callsignArray.join(', ')} | ${data.spots.length} spots | Best: ${data.bestSNR}dB | Loc: ${Array.from(data.locators).join(', ')}`
        }
      });
    });

    return markers;
  }

  private fallbackGeneratePropagationPaths(spots: PropagationSpot[]): PropagationPath[] {
    // Simplified fallback implementation
    return spots.slice(0, 50).map((spot, index) => ({
      id: `path-${index}`,
      from: spot.transmitter.location,
      to: spot.receiver.location,
      spots: [spot],
      quality: 'fair' as const,
      distance: 1000, // Simplified
      bearing: 0, // Simplified
    }));
  }

  private fallbackCalculateStatistics(spots: PropagationSpot[]): any {
    // Simplified fallback implementation
    return {
      totalSpots: spots.length,
      uniqueTransmitters: new Set(spots.map(s => s.transmitter.callsign)).size,
      uniqueReceivers: new Set(spots.map(s => s.receiver.callsign)).size,
      bandDistribution: {},
      modeDistribution: {},
      averageSnr: 0,
      maxDistance: 0,
      timeRange: {
        start: new Date(),
        end: new Date(),
      },
    };
  }

  // Utility methods
  getWorkerStatus(): {
    isInitialized: boolean;
    pendingRequests: number;
    workerAvailable: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      pendingRequests: this.pendingRequests.size,
      workerAvailable: !!this.worker,
    };
  }

  // Cleanup
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.rejectAllPending(new Error('Worker manager destroyed'));
    this.isInitialized = false;
  }
}

// Export singleton instance
export const workerManager = WorkerManager.getInstance();
