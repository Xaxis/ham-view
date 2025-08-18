// PropView API Services - Data Source Integration

import type { 
  PropagationSpot, 
  SolarData, 
  PSKReporterResponse, 
  NOAASpaceWeatherResponse,
  Band,
  Mode 
} from '../types';

// API Configuration
const API_CONFIG = {
  PSK_REPORTER: {
    BASE_URL: 'https://retrieve.pskreporter.info/query',
    RATE_LIMIT: 60000, // 1 minute between requests
  },
  NOAA_SPACE_WEATHER: {
    BASE_URL: 'https://services.swpc.noaa.gov/json',
    RATE_LIMIT: 300000, // 5 minutes between requests
  },
  WSPR_NET: {
    BASE_URL: 'http://wsprnet.org/drupal/wsprnet/spots',
    RATE_LIMIT: 120000, // 2 minutes between requests
  },
};

// Rate limiting helper
class RateLimiter {
  private lastRequest: { [key: string]: number } = {};

  canMakeRequest(service: string, rateLimit: number): boolean {
    const now = Date.now();
    const lastTime = this.lastRequest[service] || 0;
    return (now - lastTime) >= rateLimit;
  }

  recordRequest(service: string): void {
    this.lastRequest[service] = Date.now();
  }
}

const rateLimiter = new RateLimiter();

// Utility functions
function bandFromFrequency(frequency: number): Band {
  const freqMHz = frequency / 1000000;
  
  if (freqMHz >= 1.8 && freqMHz <= 2.0) return '160m';
  if (freqMHz >= 3.5 && freqMHz <= 4.0) return '80m';
  if (freqMHz >= 5.3 && freqMHz <= 5.4) return '60m';
  if (freqMHz >= 7.0 && freqMHz <= 7.3) return '40m';
  if (freqMHz >= 10.1 && freqMHz <= 10.15) return '30m';
  if (freqMHz >= 14.0 && freqMHz <= 14.35) return '20m';
  if (freqMHz >= 18.068 && freqMHz <= 18.168) return '17m';
  if (freqMHz >= 21.0 && freqMHz <= 21.45) return '15m';
  if (freqMHz >= 24.89 && freqMHz <= 24.99) return '12m';
  if (freqMHz >= 28.0 && freqMHz <= 29.7) return '10m';
  if (freqMHz >= 50.0 && freqMHz <= 54.0) return '6m';
  if (freqMHz >= 70.0 && freqMHz <= 71.0) return '4m';
  if (freqMHz >= 144.0 && freqMHz <= 148.0) return '2m';
  
  return '20m'; // Default fallback
}

function normalizeMode(mode: string): Mode {
  const modeUpper = mode.toUpperCase();
  
  if (modeUpper.includes('FT8')) return 'FT8';
  if (modeUpper.includes('FT4')) return 'FT4';
  if (modeUpper.includes('PSK31')) return 'PSK31';
  if (modeUpper.includes('PSK63')) return 'PSK63';
  if (modeUpper.includes('RTTY')) return 'RTTY';
  if (modeUpper.includes('CW')) return 'CW';
  if (modeUpper.includes('SSB')) return 'SSB';
  if (modeUpper.includes('FM')) return 'FM';
  if (modeUpper.includes('WSPR')) return 'WSPR';
  if (modeUpper.includes('JT65')) return 'JT65';
  if (modeUpper.includes('JT9')) return 'JT9';
  if (modeUpper.includes('MSK144')) return 'MSK144';
  
  return 'FT8'; // Default fallback
}

function parseGridSquare(locator: string): { latitude: number; longitude: number } {
  if (!locator || locator.length < 4) {
    return { latitude: 0, longitude: 0 };
  }

  // Basic Maidenhead locator parsing (simplified)
  const A = locator.charCodeAt(0) - 65; // A=0, B=1, etc.
  const B = locator.charCodeAt(1) - 65;
  const C = parseInt(locator.charAt(2));
  const D = parseInt(locator.charAt(3));

  const longitude = (A * 20) + (C * 2) - 180 + 1; // Approximate center
  const latitude = (B * 10) + D - 90 + 0.5; // Approximate center

  return { latitude, longitude };
}

// PSK Reporter API Service
export class PSKReporterService {
  private static instance: PSKReporterService;

  static getInstance(): PSKReporterService {
    if (!PSKReporterService.instance) {
      PSKReporterService.instance = new PSKReporterService();
    }
    return PSKReporterService.instance;
  }

  async fetchSpots(options: {
    timeRange?: number; // minutes
    bands?: Band[];
    modes?: Mode[];
  } = {}): Promise<PropagationSpot[]> {
    const { timeRange = 60, bands = [], modes = [] } = options;

    if (!rateLimiter.canMakeRequest('PSK_REPORTER', API_CONFIG.PSK_REPORTER.RATE_LIMIT)) {
      throw new Error('Rate limit exceeded for PSK Reporter API');
    }

    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (timeRange * 60);

      const params = new URLSearchParams({
        flowStartSeconds: startTime.toString(),
        flowEndSeconds: endTime.toString(),
        format: 'json',
        frange: '0-30000000', // 0-30 MHz
        rrange: '0-30000000',
      });

      const response = await fetch(`${API_CONFIG.PSK_REPORTER.BASE_URL}?${params}`);
      
      if (!response.ok) {
        throw new Error(`PSK Reporter API error: ${response.status}`);
      }

      const data = await response.json();
      rateLimiter.recordRequest('PSK_REPORTER');

      return this.transformPSKReporterData(data, bands, modes);
    } catch (error) {
      console.error('Error fetching PSK Reporter data:', error);
      throw error;
    }
  }

  private transformPSKReporterData(
    data: PSKReporterResponse[], 
    bandFilter: Band[], 
    modeFilter: Mode[]
  ): PropagationSpot[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((spot, index) => {
        try {
          const frequency = spot.frequency;
          const band = bandFromFrequency(frequency);
          const mode = normalizeMode(spot.mode);

          // Apply filters
          if (bandFilter.length > 0 && !bandFilter.includes(band)) {
            return null;
          }
          if (modeFilter.length > 0 && !modeFilter.includes(mode)) {
            return null;
          }

          const txLocation = parseGridSquare(spot.senderLocator);
          const rxLocation = parseGridSquare(spot.receiverLocator);

          const propagationSpot: PropagationSpot = {
            id: `psk-${spot.flowStartSeconds}-${index}`,
            timestamp: new Date(spot.flowStartSeconds * 1000),
            frequency,
            band,
            mode,
            transmitter: {
              callsign: spot.senderCallsign,
              location: {
                ...txLocation,
                gridSquare: spot.senderLocator,
              },
            },
            receiver: {
              callsign: spot.receiverCallsign,
              location: {
                ...rxLocation,
                gridSquare: spot.receiverLocator,
              },
            },
            snr: spot.snr,
            source: 'PSK_REPORTER',
          };

          return propagationSpot;
        } catch (error) {
          console.warn('Error transforming PSK Reporter spot:', error);
          return null;
        }
      })
      .filter((spot): spot is PropagationSpot => spot !== null);
  }
}

// NOAA Space Weather Service
export class NOAASpaceWeatherService {
  private static instance: NOAASpaceWeatherService;

  static getInstance(): NOAASpaceWeatherService {
    if (!NOAASpaceWeatherService.instance) {
      NOAASpaceWeatherService.instance = new NOAASpaceWeatherService();
    }
    return NOAASpaceWeatherService.instance;
  }

  async fetchSolarData(): Promise<SolarData | null> {
    if (!rateLimiter.canMakeRequest('NOAA_SPACE_WEATHER', API_CONFIG.NOAA_SPACE_WEATHER.RATE_LIMIT)) {
      throw new Error('Rate limit exceeded for NOAA Space Weather API');
    }

    try {
      // Fetch multiple endpoints for comprehensive data
      const [solarFluxResponse, geomagResponse] = await Promise.all([
        fetch(`${API_CONFIG.NOAA_SPACE_WEATHER.BASE_URL}/solar-cycle/solar-cycle-25-f107-daily.json`),
        fetch(`${API_CONFIG.NOAA_SPACE_WEATHER.BASE_URL}/planetary_k_index_1m.json`),
      ]);

      if (!solarFluxResponse.ok || !geomagResponse.ok) {
        throw new Error('NOAA Space Weather API error');
      }

      const [solarFluxData, geomagData] = await Promise.all([
        solarFluxResponse.json(),
        geomagResponse.json(),
      ]);

      rateLimiter.recordRequest('NOAA_SPACE_WEATHER');

      return this.transformNOAAData(solarFluxData, geomagData);
    } catch (error) {
      console.error('Error fetching NOAA Space Weather data:', error);
      throw error;
    }
  }

  private transformNOAAData(solarFluxData: any[], geomagData: any[]): SolarData | null {
    try {
      // Get the most recent data
      const latestSolarFlux = solarFluxData[solarFluxData.length - 1];
      const latestGeomag = geomagData[geomagData.length - 1];

      if (!latestSolarFlux || !latestGeomag) {
        return null;
      }

      const solarData: SolarData = {
        timestamp: new Date(),
        solarFluxIndex: latestSolarFlux.f107 || 100,
        aIndex: latestGeomag.a_index || 0,
        kIndex: latestGeomag.k_index || 0,
        sunspotNumber: latestSolarFlux.ssn || 0,
        geomagneticStorm: this.classifyGeomagneticStorm(latestGeomag.k_index || 0),
      };

      return solarData;
    } catch (error) {
      console.warn('Error transforming NOAA data:', error);
      return null;
    }
  }

  private classifyGeomagneticStorm(kIndex: number): SolarData['geomagneticStorm'] {
    if (kIndex >= 9) return 'EXTREME';
    if (kIndex >= 8) return 'SEVERE';
    if (kIndex >= 6) return 'STRONG';
    if (kIndex >= 5) return 'MODERATE';
    if (kIndex >= 4) return 'MINOR';
    return 'NONE';
  }
}

// Main API service that coordinates all data sources
export class PropagationDataService {
  private pskReporter: PSKReporterService;
  private noaaSpaceWeather: NOAASpaceWeatherService;

  constructor() {
    this.pskReporter = PSKReporterService.getInstance();
    this.noaaSpaceWeather = NOAASpaceWeatherService.getInstance();
  }

  async fetchAllData(options: {
    timeRange?: number;
    bands?: Band[];
    modes?: Mode[];
  } = {}): Promise<{
    spots: PropagationSpot[];
    solarData: SolarData | null;
  }> {
    try {
      const [spots, solarData] = await Promise.allSettled([
        this.pskReporter.fetchSpots(options),
        this.noaaSpaceWeather.fetchSolarData(),
      ]);

      return {
        spots: spots.status === 'fulfilled' ? spots.value : [],
        solarData: solarData.status === 'fulfilled' ? solarData.value : null,
      };
    } catch (error) {
      console.error('Error fetching propagation data:', error);
      throw error;
    }
  }

  async fetchSpots(options: {
    timeRange?: number;
    bands?: Band[];
    modes?: Mode[];
  } = {}): Promise<PropagationSpot[]> {
    return this.pskReporter.fetchSpots(options);
  }

  async fetchSolarData(): Promise<SolarData | null> {
    return this.noaaSpaceWeather.fetchSolarData();
  }
}
