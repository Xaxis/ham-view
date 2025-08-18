// PropView Demo Data Generator
// Generates realistic propagation data for demonstration purposes

import type { PropagationSpot, SolarData, Band, Mode } from '../types';

// Ham radio callsign prefixes by region
const callsignPrefixes = {
  'North America': ['W', 'K', 'N', 'VE', 'VA', 'VY'],
  'Europe': ['G', 'DL', 'F', 'I', 'EA', 'OH', 'SM', 'LA', 'OZ'],
  'Asia': ['JA', 'HL', 'BV', 'VK', 'VU', 'BY', 'HS'],
  'South America': ['PY', 'LU', 'CE', 'YV', 'HK'],
  'Africa': ['ZS', 'A2', 'CN', 'SU', 'ET'],
  'Oceania': ['VK', 'ZL', 'YB', 'DU'],
};

// Major cities with coordinates for realistic locations
const majorCities = [
  { name: 'New York', lat: 40.7128, lon: -74.0060, region: 'North America' },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, region: 'North America' },
  { name: 'London', lat: 51.5074, lon: -0.1278, region: 'Europe' },
  { name: 'Berlin', lat: 52.5200, lon: 13.4050, region: 'Europe' },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, region: 'Asia' },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, region: 'Oceania' },
  { name: 'São Paulo', lat: -23.5505, lon: -46.6333, region: 'South America' },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357, region: 'Africa' },
  { name: 'Moscow', lat: 55.7558, lon: 37.6176, region: 'Europe' },
  { name: 'Beijing', lat: 39.9042, lon: 116.4074, region: 'Asia' },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, region: 'Asia' },
  { name: 'Mexico City', lat: 19.4326, lon: -99.1332, region: 'North America' },
  { name: 'Buenos Aires', lat: -34.6118, lon: -58.3960, region: 'South America' },
  { name: 'Cape Town', lat: -33.9249, lon: 18.4241, region: 'Africa' },
  { name: 'Stockholm', lat: 59.3293, lon: 18.0686, region: 'Europe' },
];

// Ham radio bands with typical frequencies
const bandFrequencies: Record<Band, { min: number; max: number; typical: number[] }> = {
  '160m': { min: 1800000, max: 2000000, typical: [1840000, 1910000] },
  '80m': { min: 3500000, max: 4000000, typical: [3573000, 3590000] },
  '60m': { min: 5330000, max: 5405000, typical: [5357000] },
  '40m': { min: 7000000, max: 7300000, typical: [7074000, 7076000] },
  '30m': { min: 10100000, max: 10150000, typical: [10136000] },
  '20m': { min: 14000000, max: 14350000, typical: [14074000, 14076000] },
  '17m': { min: 18068000, max: 18168000, typical: [18100000] },
  '15m': { min: 21000000, max: 21450000, typical: [21074000, 21076000] },
  '12m': { min: 24890000, max: 24990000, typical: [24915000] },
  '10m': { min: 28000000, max: 29700000, typical: [28074000, 28076000] },
  '6m': { min: 50000000, max: 54000000, typical: [50313000] },
  '4m': { min: 70000000, max: 71000000, typical: [70091000] },
  '2m': { min: 144000000, max: 148000000, typical: [144174000] },
};

// Mode probabilities (more realistic distribution)
const modeDistribution: { mode: Mode; weight: number }[] = [
  { mode: 'FT8', weight: 60 },
  { mode: 'FT4', weight: 15 },
  { mode: 'PSK31', weight: 8 },
  { mode: 'WSPR', weight: 5 },
  { mode: 'CW', weight: 4 },
  { mode: 'SSB', weight: 3 },
  { mode: 'RTTY', weight: 2 },
  { mode: 'JT65', weight: 2 },
  { mode: 'PSK63', weight: 1 },
];

// Band activity by time of day (UTC) - simplified propagation model
const bandActivity: Record<Band, { day: number; night: number }> = {
  '160m': { day: 0.1, night: 0.9 },
  '80m': { day: 0.3, night: 0.8 },
  '60m': { day: 0.4, night: 0.6 },
  '40m': { day: 0.6, night: 0.9 },
  '30m': { day: 0.7, night: 0.5 },
  '20m': { day: 0.9, night: 0.3 },
  '17m': { day: 0.8, night: 0.2 },
  '15m': { day: 0.7, night: 0.1 },
  '12m': { day: 0.5, night: 0.1 },
  '10m': { day: 0.4, night: 0.1 },
  '6m': { day: 0.3, night: 0.2 },
  '4m': { day: 0.2, night: 0.1 },
  '2m': { day: 0.6, night: 0.4 },
};

export class DemoDataGenerator {
  private static instance: DemoDataGenerator;
  private spotIdCounter = 0;

  static getInstance(): DemoDataGenerator {
    if (!DemoDataGenerator.instance) {
      DemoDataGenerator.instance = new DemoDataGenerator();
    }
    return DemoDataGenerator.instance;
  }

  // Generate realistic callsign
  private generateCallsign(region: string): string {
    const prefixes = callsignPrefixes[region] || ['W'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(Math.random() * 9999).toString().padStart(3, '0');
    return `${prefix}${suffix}`;
  }

  // Generate Maidenhead grid square
  private generateGridSquare(lat: number, lon: number): string {
    const lonField = String.fromCharCode(65 + Math.floor((lon + 180) / 20));
    const latField = String.fromCharCode(65 + Math.floor((lat + 90) / 10));
    const lonSquare = Math.floor(((lon + 180) % 20) / 2);
    const latSquare = Math.floor(((lat + 90) % 10) / 1);
    return `${lonField}${latField}${lonSquare}${latSquare}`;
  }

  // Select weighted random mode
  private selectRandomMode(): Mode {
    const totalWeight = modeDistribution.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of modeDistribution) {
      random -= item.weight;
      if (random <= 0) {
        return item.mode;
      }
    }
    return 'FT8'; // Fallback
  }

  // Select band based on time of day
  private selectRandomBand(): Band {
    const hour = new Date().getUTCHours();
    const isDayTime = hour >= 6 && hour <= 18;
    
    const bands = Object.keys(bandActivity) as Band[];
    const weights = bands.map(band => {
      const activity = bandActivity[band];
      return isDayTime ? activity.day : activity.night;
    });
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < bands.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return bands[i];
      }
    }
    return '20m'; // Fallback
  }

  // Generate realistic SNR based on distance and band
  private generateSNR(distance: number, band: Band): number {
    // Base SNR calculation (simplified propagation model)
    let baseSNR = -10; // Start with moderate signal
    
    // Distance factor (further = weaker)
    baseSNR -= Math.log10(distance / 1000) * 6;
    
    // Band factor (higher bands generally weaker at long distance)
    const bandFactors: Record<Band, number> = {
      '160m': 2, '80m': 1, '60m': 0, '40m': -1, '30m': -2,
      '20m': -3, '17m': -4, '15m': -5, '12m': -6, '10m': -7,
      '6m': -8, '4m': -9, '2m': -10
    };
    baseSNR += bandFactors[band] || 0;
    
    // Add random variation
    baseSNR += (Math.random() - 0.5) * 10;
    
    // Clamp to reasonable range
    return Math.max(-30, Math.min(20, Math.round(baseSNR)));
  }

  // Calculate distance between two points
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

  // Generate propagation spots
  generateSpots(count: number = 100, timeRangeMinutes: number = 60): PropagationSpot[] {
    const spots: PropagationSpot[] = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      // Select random transmitter and receiver locations
      const txCity = majorCities[Math.floor(Math.random() * majorCities.length)];
      let rxCity = majorCities[Math.floor(Math.random() * majorCities.length)];
      
      // Ensure different locations
      while (rxCity === txCity) {
        rxCity = majorCities[Math.floor(Math.random() * majorCities.length)];
      }
      
      // Add some random variation to coordinates
      const txLat = txCity.lat + (Math.random() - 0.5) * 2;
      const txLon = txCity.lon + (Math.random() - 0.5) * 2;
      const rxLat = rxCity.lat + (Math.random() - 0.5) * 2;
      const rxLon = rxCity.lon + (Math.random() - 0.5) * 2;
      
      const distance = this.calculateDistance(txLat, txLon, rxLat, rxLon);
      const band = this.selectRandomBand();
      const mode = this.selectRandomMode();
      const frequency = bandFrequencies[band].typical[
        Math.floor(Math.random() * bandFrequencies[band].typical.length)
      ];
      
      // Generate timestamp within the time range
      const timestamp = new Date(now.getTime() - Math.random() * timeRangeMinutes * 60 * 1000);
      
      const spot: PropagationSpot = {
        id: `demo-${++this.spotIdCounter}`,
        timestamp,
        frequency,
        band,
        mode,
        transmitter: {
          callsign: this.generateCallsign(txCity.region),
          location: {
            latitude: txLat,
            longitude: txLon,
            name: txCity.name,
            gridSquare: this.generateGridSquare(txLat, txLon),
          },
        },
        receiver: {
          callsign: this.generateCallsign(rxCity.region),
          location: {
            latitude: rxLat,
            longitude: rxLon,
            name: rxCity.name,
            gridSquare: this.generateGridSquare(rxLat, rxLon),
          },
        },
        snr: this.generateSNR(distance, band),
        source: 'PSK_REPORTER',
      };
      
      spots.push(spot);
    }
    
    // Sort by timestamp (newest first)
    return spots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Generate realistic solar data
  generateSolarData(): SolarData {
    const now = new Date();
    
    // Generate realistic but random solar indices
    const solarFluxIndex = 80 + Math.random() * 120; // 80-200 range
    const kIndex = Math.floor(Math.random() * 9); // 0-8 range
    const aIndex = Math.floor(Math.random() * 50); // 0-50 range
    const sunspotNumber = Math.floor(Math.random() * 200); // 0-200 range
    
    // Determine geomagnetic storm level
    let geomagneticStorm: SolarData['geomagneticStorm'] = 'NONE';
    if (kIndex >= 9) geomagneticStorm = 'EXTREME';
    else if (kIndex >= 8) geomagneticStorm = 'SEVERE';
    else if (kIndex >= 6) geomagneticStorm = 'STRONG';
    else if (kIndex >= 5) geomagneticStorm = 'MODERATE';
    else if (kIndex >= 4) geomagneticStorm = 'MINOR';
    
    return {
      timestamp: now,
      solarFluxIndex,
      aIndex,
      kIndex,
      sunspotNumber,
      xrayFlux: {
        short: Math.random() * 1e-6,
        long: Math.random() * 1e-5,
      },
      geomagneticStorm,
    };
  }
}

// Export singleton instance
export const demoDataGenerator = DemoDataGenerator.getInstance();
