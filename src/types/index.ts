// Core PropView Types and Interfaces

// Storage keys for localStorage
export const STORAGE_KEYS = {
  PROFILES: 'propview_profiles',
  APP_STATE: 'propview_app_state',
} as const;

// Default tile configuration
export const DEFAULT_TILE_SIZE = {
  width: 400,
  height: 300,
} as const;

export const DEFAULT_TILE_POSITION = {
  x: 100,
  y: 100,
} as const;

// Geographic coordinates
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Location with optional grid square
export interface Location extends Coordinates {
  name?: string;
  gridSquare?: string;
  country?: string;
  continent?: string;
}

// Ham radio bands
export type Band = '160m' | '80m' | '60m' | '40m' | '30m' | '20m' | '17m' | '15m' | '12m' | '10m' | '6m' | '4m' | '2m';

// Operating modes
export type Mode = 'FT8' | 'FT4' | 'PSK31' | 'PSK63' | 'RTTY' | 'CW' | 'SSB' | 'FM' | 'WSPR' | 'JT65' | 'JT9' | 'MSK144';

// Propagation spot from various sources
export interface PropagationSpot {
  id: string;
  timestamp: Date;
  frequency: number; // in Hz
  band: Band;
  mode: Mode;
  transmitter: {
    callsign: string;
    location: Location;
    power?: number; // in watts
  };
  receiver: {
    callsign: string;
    location: Location;
  };
  signalReport?: string; // e.g., "-15" for FT8, "599" for CW
  snr?: number; // Signal-to-noise ratio in dB
  distance?: number; // in kilometers
  bearing?: number; // in degrees
  source: 'PSK_REPORTER' | 'WSPR_NET' | 'RBN' | 'DX_CLUSTER';
}

// Solar and geomagnetic indices
export interface SolarData {
  timestamp: Date;
  solarFluxIndex: number; // 10.7cm solar flux
  aIndex: number; // A-index (geomagnetic activity)
  kIndex: number; // K-index (geomagnetic activity)
  sunspotNumber: number;
  xrayFlux?: {
    short: number; // 0.1-0.8nm
    long: number; // 0.05-0.4nm
  };
  geomagneticStorm?: 'NONE' | 'MINOR' | 'MODERATE' | 'STRONG' | 'SEVERE' | 'EXTREME';
}

// Propagation prediction data
export interface PropagationPrediction {
  timestamp: Date;
  fromLocation: Location;
  toLocation: Location;
  predictions: {
    band: Band;
    muf: number; // Maximum Usable Frequency in MHz
    luf: number; // Lowest Usable Frequency in MHz
    fot: number; // Frequency of Optimum Traffic in MHz
    reliability: number; // 0-100%
    signalStrength: number; // dB above noise
    multipath?: boolean;
    mode?: 'F2' | 'E' | 'Es' | 'EME' | 'MS'; // Propagation mode
  }[];
  source: 'VOACAP' | 'WSPR_ANALYSIS' | 'PREDICTION_MODEL';
}

// Band condition summary
export interface BandCondition {
  band: Band;
  condition: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  confidence: number; // 0-100%
  spotCount: number;
  averageSnr?: number;
  bestDx?: {
    distance: number;
    callsign: string;
    location: Location;
  };
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

// Advanced filter settings for data display
export interface FilterSettings {
  // Basic filters
  bands: Band[];
  modes: Mode[];
  sources: PropagationSpot['source'][];

  // Time filters
  timeRange: {
    start: Date;
    end: Date;
    preset: 'last-hour' | 'last-6h' | 'last-24h' | 'custom';
  };

  // Callsign filters
  callsign: {
    search: string;
    transmitterOnly: boolean;
    receiverOnly: boolean;
    exactMatch: boolean;
  };

  // Geographic filters
  geographic: {
    fromLocation?: Location;
    minDistance?: number; // km
    maxDistance?: number; // km
    bearing?: {
      min: number; // degrees
      max: number; // degrees
    };
    gridSquares: string[]; // Maidenhead grid squares
    countries: string[]; // Country codes
    continents: string[]; // Continent codes
  };

  // Signal quality filters
  signal: {
    minSnr?: number;
    maxSnr?: number;
    qualityThreshold: 'any' | 'fair' | 'good' | 'excellent';
  };

  // Advanced filters
  advanced: {
    minSpotCount: number; // Minimum spots for a station to appear
    uniqueOnly: boolean; // Show only unique paths
    bidirectionalOnly: boolean; // Show only bidirectional contacts
  };
}

// Panel configuration for tabbed layout
export interface PanelConfig {
  id: string;
  type: 'band-conditions' | 'recent-spots' | 'solar-data' | 'statistics' | 'alerts';
  title: string;
  enabled: boolean;
  order: number;
  icon?: string;
  settings?: Record<string, any>;
}

// Layout configuration for resizable panels
export interface LayoutConfig {
  mapHeight: number; // Percentage of viewport height for map
  bottomPanelsHeight: number; // Percentage for bottom panels
  panelSizes: Record<string, number>; // Panel width percentages
  collapsedPanels: string[]; // IDs of collapsed panels
}

// User preferences and settings
export interface UserPreferences {
  defaultLocation: Location;
  favoriteLocations: Location[];
  displaySettings: {
    theme: 'light' | 'dark' | 'auto';
    mapStyle: 'street' | 'satellite' | 'terrain';
    units: 'metric' | 'imperial';
    timeZone: string;
    layout: 'grid' | 'vertical' | 'compact';
    mapSplitRatio: number; // Percentage of viewport height for map (0-100)
  };
  panels: PanelConfig[];
  alerts: {
    enabled: boolean;
    conditions: AlertCondition[];
  };
  dataRefreshInterval: number; // in seconds
}

// Alert condition for notifications
export interface AlertCondition {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    bands?: Band[];
    modes?: Mode[];
    minDistance?: number;
    targetLocations?: Location[];
    minSnr?: number;
    bandCondition?: BandCondition['condition'];
  };
  actions: {
    notification: boolean;
    sound: boolean;
    email?: string;
  };
}

// Data sync status
export interface SyncStatus {
  lastSync: Date | null;
  nextSync: Date | null;
  isAutoRefresh: boolean;
  intervalMinutes: number;
  isSyncing: boolean;
}

// Application state
export interface AppState {
  isLoading: boolean;
  lastUpdate: Date | null;
  error: string | null;
  spots: PropagationSpot[];
  solarData: SolarData | null;
  bandConditions: BandCondition[];
  filters: FilterSettings;
  preferences: UserPreferences;
  selectedSpot: PropagationSpot | null;
  syncStatus: SyncStatus;
}

// API response types
export interface PSKReporterResponse {
  receiverCallsign: string;
  receiverLocator: string;
  senderCallsign: string;
  senderLocator: string;
  frequency: number;
  mode: string;
  snr: number;
  flowStartSeconds: number;
}

export interface NOAASpaceWeatherResponse {
  time_tag: string;
  f107: number;
  a_index: number;
  k_index: number;
  sunspot_number: number;
}

// Chart data types for visualization
export interface ChartDataPoint {
  x: number | Date;
  y: number;
  label?: string;
}

export interface ChartDataset {
  label: string;
  data: ChartDataPoint[];
  color: string;
  type?: 'line' | 'bar' | 'scatter';
}

// Map marker types
export interface MapMarker {
  id: string;
  position: Coordinates;
  type: 'transmitter' | 'receiver' | 'both';
  callsign: string;
  spotCount: number;
  lastActivity: Date;
  popup?: {
    title: string;
    content: string;
  };
}

// Propagation path for map visualization
export interface PropagationPath {
  id: string;
  from: Coordinates;
  to: Coordinates;
  spots: PropagationSpot[];
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  distance: number;
  bearing: number;
}
