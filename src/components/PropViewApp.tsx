import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { AppState, FilterSettings, UserPreferences, Location, PanelConfig } from '../types';
import { pskReporterJSONP } from '../services/pskReporterJSONP';
import PropagationMap from './PropagationMap';
import BandConditionsPanel from './BandConditionsPanel';
import RecentSpotsPanel from './RecentSpotsPanel';
import SolarDataPanel from './SolarDataPanel';
import StatisticsPanel from './StatisticsPanel';
import SettingsModal from './SettingsModal';
import AdvancedFilterSidebar from './AdvancedFilterSidebar';
import MapLayersModal, { type MapLayer } from './MapLayersModal';
import SyncStatusIndicator from './SyncStatusIndicator';
import {
  loadUserPreferences,
  saveUserPreferences,
  loadFilterSettings,
  saveFilterSettings,
  loadQTHLocation,
  saveQTHLocation,
  loadMapLayers,
  saveMapLayers,
  type QTHLocation
} from '../services/localStorage';

// Default panels configuration for tabbed layout
const defaultPanels: PanelConfig[] = [
  { id: 'band-conditions', type: 'band-conditions', title: 'Band Conditions', enabled: true, order: 1, icon: '📊' },
  { id: 'recent-spots', type: 'recent-spots', title: 'Recent Spots', enabled: true, order: 2, icon: '📻' },
  { id: 'solar-data', type: 'solar-data', title: 'Solar & Geomagnetic', enabled: true, order: 3, icon: '☀️' },
  { id: 'statistics', type: 'statistics', title: 'Statistics', enabled: true, order: 4, icon: '📈' },
  { id: 'alerts', type: 'alerts', title: 'Alerts', enabled: false, order: 5, icon: '🔔' },
];

// Default map layers configuration
const defaultMapLayers: MapLayer[] = [
  // Data Layers
  { id: 'spots', name: 'Propagation Spots', description: 'PSK Reporter & WSPR spots', icon: '📻', enabled: true, category: 'data', opacity: 100 },
  { id: 'paths', name: 'Propagation Paths', description: 'Signal paths between stations', icon: '📡', enabled: true, category: 'data', opacity: 80 },
  { id: 'beacons', name: 'Beacon Network', description: 'RBN beacon reports', icon: '🔔', enabled: false, category: 'data', opacity: 70 },

  // Overlay Layers
  { id: 'daynight', name: 'Day/Night Terminator', description: 'Real-time grayline overlay', icon: '🌅', enabled: true, category: 'overlay', opacity: 60 },
  { id: 'aurora', name: 'Auroral Oval', description: 'Geomagnetic storm zones', icon: '🌌', enabled: false, category: 'overlay', opacity: 50 },
  { id: 'voacap', name: 'VOACAP Predictions', description: 'Coverage footprint overlays', icon: '📊', enabled: false, category: 'overlay', opacity: 40 },

  // Reference Layers
  { id: 'grid', name: 'Maidenhead Grid', description: 'Grid square overlay', icon: '🗂️', enabled: false, category: 'reference', opacity: 30 },
  { id: 'qth', name: 'My QTH', description: 'Your station location', icon: '🏠', enabled: false, category: 'reference', opacity: 100 },
  { id: 'targets', name: 'DX Targets', description: 'Custom markers for DX', icon: '🎯', enabled: false, category: 'reference', opacity: 100 },
];

// Default user preferences
const defaultPreferences: UserPreferences = {
  defaultLocation: {
    latitude: 39.8283,
    longitude: -98.5795,
    name: 'United States',
    gridSquare: 'EM29',
  },
  favoriteLocations: [],
  displaySettings: {
    theme: 'dark',
    mapStyle: 'street',
    units: 'metric',
    timeZone: 'UTC',
    layout: 'vertical',
    mapSplitRatio: 70, // Default 70% for map, 30% for tabs
  },
  panels: defaultPanels,
  alerts: {
    enabled: false,
    conditions: [],
  },
  dataRefreshInterval: 300, // 5 minutes
};

// Function to get default filter settings - Dynamic time range for new users
const getDefaultFilters = (): FilterSettings => ({
  bands: ['20m', '40m', '15m', '10m'], // Most active HF bands showing propagation differences
  modes: ['FT8', 'FT4', 'PSK31', 'CW', 'RTTY'], // Popular digital modes + CW for comprehensive view
  sources: ['PSK_REPORTER'],
  timeRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours - calculated fresh each time
    end: new Date(),
    preset: 'last-24h',
  },
  callsign: {
    search: '', // No callsign filter - show global activity for new users
    direction: 'either', // Show all propagation directions for maximum activity
    exactMatch: false,
  },
  geographic: {
    gridSquares: [], // No geographic filtering - show global activity
    countries: [], // No country filtering - worldwide coverage
    continents: [], // No continent filtering - all regions
  },
  signal: {
    qualityThreshold: 'any', // Show all signal strengths for maximum activity
  },
  advanced: {
    minSpotCount: 1, // Show all spots, even single occurrences
    uniqueOnly: false, // Show all spots, not just unique callsigns
    bidirectionalOnly: false, // Show all propagation directions
  },
});

// Load saved data immediately to avoid default state issues
const loadInitialData = () => {
  const savedFilters = loadFilterSettings();
  const savedPreferences = loadUserPreferences();
  const defaultFilters = getDefaultFilters(); // Get fresh default filters with current time

  // Ensure filters always have some bands and modes selected
  let filters = savedFilters || defaultFilters;
  if (filters.bands.length === 0) {
    filters = { ...filters, bands: defaultFilters.bands };
  }
  if (filters.modes.length === 0) {
    filters = { ...filters, modes: defaultFilters.modes };
  }

  return {
    filters,
    preferences: savedPreferences || defaultPreferences,
  };
};

const initialData = loadInitialData();

// Initial application state
const initialState: AppState = {
  isLoading: false,
  lastUpdate: null,
  error: null,
  spots: [],
  solarData: null,
  bandConditions: [],
  filters: initialData.filters,
  preferences: initialData.preferences,
  selectedSpot: null,
  syncStatus: {
    lastSync: null,
    nextSync: null,
    isAutoRefresh: true,
    intervalMinutes: 5,
    isSyncing: false,
  },
};

export default function HamViewApp() {
  const [state, setState] = useState<AppState>(initialState);
  const [mapData, setMapData] = useState<{ markers: any[]; paths: any[] }>({ markers: [], paths: [] });
  const [showSettings, setShowSettings] = useState(false);
  const [showMapLayers, setShowMapLayers] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('band-conditions');
  const [isResizing, setIsResizing] = useState(false);
  const [mapSplitRatio, setMapSplitRatio] = useState(70);
  const [mapLayers, setMapLayers] = useState<MapLayer[]>(defaultMapLayers);
  const [qthLocation, setQTHLocation] = useState<QTHLocation | null>(null);

  // Data update handler
  const handleDataUpdate = useCallback(async (data: {
    spots?: any[];
    solarData?: any;
    bandConditions?: any[];
    lastUpdate?: Date;
  }) => {
    setState(prev => ({
      ...prev,
      spots: data.spots || [],
      solarData: data.solarData || null,
      bandConditions: data.bandConditions || [],
      lastUpdate: data.lastUpdate || new Date(),
      isLoading: false,
      error: null,
    }));

    // Update map data asynchronously
    try {
      // Simple map data - we'll generate this from spots
      setMapData({ markers: [], paths: [] });
    } catch (error) {
      console.warn('Failed to update map data:', error);
      setMapData({ markers: [], paths: [] });
    }
  }, []);

  // Error handler
  const handleError = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      error,
      isLoading: false,
    }));
  }, []);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedPreferences = localStorage.getItem('propview-preferences');
    if (savedPreferences) {
      try {
        const preferences = JSON.parse(savedPreferences);
        // Merge with defaults to ensure new properties are included
        const mergedPreferences = {
          ...defaultPreferences,
          ...preferences,
          panels: preferences.panels || defaultPanels,
          displaySettings: {
            ...defaultPreferences.displaySettings,
            ...preferences.displaySettings,
          },
        };
        setState(prev => ({
          ...prev,
          preferences: mergedPreferences,
        }));
      } catch (error) {
        console.warn('Failed to load saved preferences:', error);
      }
    }
  }, []);

  // Setup PSK Reporter JSONP listeners
  useEffect(() => {
    const unsubscribe = pskReporterJSONP.subscribe(handleDataUpdate);
    return unsubscribe;
  }, [handleDataUpdate]);

  // Initialize app - load saved data and check for first-time user
  useEffect(() => {
    // Load saved QTH location
    const savedQTH = loadQTHLocation();
    if (savedQTH) {
      setQTHLocation(savedQTH);
    }

    // Load saved map layers
    const savedLayers = loadMapLayers();
    if (savedLayers) {
      setMapLayers(savedLayers);
    }

    // If QTH is configured, set up callsign in PSK Reporter and filters
    if (savedQTH && savedQTH.isSet && savedQTH.callsign) {
      // Set callsign in PSK Reporter JSONP
      pskReporterJSONP.setUserCallsign(savedQTH.callsign);

      // Auto-set the callsign search filter for existing users (both TX and RX)
      setState(prev => ({
        ...prev,
        filters: {
          ...prev.filters,
          callsign: {
            ...prev.filters.callsign,
            search: savedQTH.callsign.toUpperCase(),
            transmitterOnly: false,  // Show spots where user is TX OR RX
            receiverOnly: false      // Show both directions
          }
        }
      }));
      console.log(`🔍 Auto-set callsign filter for existing user: ${savedQTH.callsign.toUpperCase()}`);
    } else {
      // For new users without QTH: initialize with fresh default filters and start sync
      const freshFilters = getDefaultFilters();
      pskReporterJSONP.initializeForNewUsers(freshFilters);
      console.log('🌍 Initializing global sync for new user with fresh default filters');

      // Update state with fresh filters for new users
      setState(prev => ({
        ...prev,
        filters: freshFilters
      }));

      // Immediately load data for new users
      setTimeout(() => {
        handleRefresh();
      }, 100); // Small delay to ensure service is initialized
    }

    // Load data for existing users
    if (savedQTH && savedQTH.isSet && savedQTH.callsign) {
      setTimeout(() => {
        handleRefresh();
      }, 100);
    }
  }, []);

  // Save preferences when they change
  useEffect(() => {
    saveUserPreferences(state.preferences);
  }, [state.preferences]);

  // Save filters when they change
  useEffect(() => {
    saveFilterSettings(state.filters);
  }, [state.filters]);

  // Update filters for next sync cycle when callsign search, direction, or time range changes
  useEffect(() => {
    console.log('🔧 Filter update triggered - callsign search, direction, or time range changed');
    // Only clear cached data and update filters for next sync - don't refresh immediately
    if (pskReporterJSONP) {
      pskReporterJSONP.updateFilters(state.filters);
    }
  }, [state.filters.callsign.search, state.filters.callsign.direction, state.filters.timeRange.start, state.filters.timeRange.end]);

  // Save map layers when they change
  useEffect(() => {
    saveMapLayers(mapLayers);
  }, [mapLayers]);

  // Start auto-refresh when preferences change - only if callsign is set
  useEffect(() => {
    console.log('🔄 Auto-refresh useEffect triggered');
    if (!qthLocation || !qthLocation.isSet || !qthLocation.callsign) {
      console.log('⏸️ Auto-refresh paused - waiting for user callsign');
      return;
    }

    console.log(`🔄 Auto-refresh enabled for callsign: ${qthLocation.callsign}`);

    // Trigger initial refresh
    handleRefresh();

    // Set up interval for auto-refresh
    const intervalMs = state.preferences.dataRefreshInterval * 1000;
    const interval = setInterval(() => {
      console.log('🔄 Auto-refresh triggered');
      handleRefresh();
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [state.preferences.dataRefreshInterval, qthLocation?.isSet, qthLocation?.callsign]);

  // Set active tab to first enabled panel when preferences change
  useEffect(() => {
    const enabledPanels = getEnabledPanels();
    if (enabledPanels.length > 0 && !enabledPanels.find(p => p.id === activeTab)) {
      setActiveTab(enabledPanels[0].id);
    }
  }, [state.preferences.panels, activeTab]);

  // Update split ratio from preferences
  useEffect(() => {
    setMapSplitRatio(state.preferences.displaySettings.mapSplitRatio);
  }, [state.preferences.displaySettings.mapSplitRatio]);



  // Apply theme to document
  useEffect(() => {
    const theme = state.preferences.displaySettings.theme;
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [state.preferences.displaySettings.theme]);

  const updateFilters = useCallback((newFilters: Partial<FilterSettings>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
    }));
  }, []);



  // Apply filters to spots for display (CLIENT-SIDE FILTERING LIKE PSK REPORTER)
  const filteredSpots = useMemo(() => {
    // CRITICAL FIX: Deduplicate spots by ID to prevent React key conflicts
    const uniqueSpots = state.spots.reduce((acc, spot) => {
      if (!acc.has(spot.id)) {
        acc.set(spot.id, spot);
      }
      return acc;
    }, new Map());

    let filtered = Array.from(uniqueSpots.values());

    // Apply band filter - If no bands selected, show NOTHING
    if (state.filters.bands.length === 0) {
      return [];
    } else {
      filtered = filtered.filter(spot => state.filters.bands.includes(spot.band));
    }

    // Apply mode filter - If no modes selected, show NOTHING
    if (state.filters.modes.length === 0) {
      return [];
    } else {
      filtered = filtered.filter(spot => state.filters.modes.includes(spot.mode));
    }

    // Apply callsign filter
    if (state.filters.callsign.search) {
      const searchTerm = state.filters.callsign.search.toUpperCase();

      filtered = filtered.filter(spot => {
        // Handle exact match vs partial match
        let txMatch, rxMatch;
        if (state.filters.callsign.exactMatch) {
          txMatch = spot.transmitter.callsign.toUpperCase() === searchTerm;
          rxMatch = spot.receiver.callsign.toUpperCase() === searchTerm;
        } else {
          txMatch = spot.transmitter.callsign.toUpperCase().includes(searchTerm);
          rxMatch = spot.receiver.callsign.toUpperCase().includes(searchTerm);
        }

        // Apply direction filter (mutually exclusive)
        switch (state.filters.callsign.direction) {
          case 'transmitted':
            return txMatch; // Show signals transmitted BY the callsign
          case 'received':
            return rxMatch; // Show signals received BY the callsign (default)
          case 'either':
            return txMatch || rxMatch; // Show both directions
          default:
            return rxMatch; // Fallback to received
        }
      });
    }

    // Apply time range filter - STRICT TIME FILTERING
    const now = new Date();
    let startTime = state.filters.timeRange.start;
    let endTime = state.filters.timeRange.end;

    // If using a preset, recalculate the time range dynamically
    if (state.filters.timeRange.preset !== 'custom') {
      switch (state.filters.timeRange.preset) {
        case 'last-hour':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          endTime = now;
          break;
        case 'last-6h':
          startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          endTime = now;
          break;
        case 'last-24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          endTime = now;
          break;
      }
    }

    // Apply time filtering - respect the actual filter settings
    filtered = filtered.filter(spot => {
      const spotTime = spot.timestamp;
      return spotTime >= startTime && spotTime <= endTime;
    });

    // Apply signal quality filters (CLIENT-SIDE ONLY - no API calls)
    if (state.filters.signal.minSnr !== undefined) {
      filtered = filtered.filter(spot => (spot.snr || -999) >= state.filters.signal.minSnr!);
    }

    if (state.filters.signal.maxSnr !== undefined) {
      filtered = filtered.filter(spot => (spot.snr || 999) <= state.filters.signal.maxSnr!);
    }

    // Apply signal quality threshold filter
    if (state.filters.signal.qualityThreshold !== 'any') {
      filtered = filtered.filter(spot => {
        const snr = spot.snr || -999;
        switch (state.filters.signal.qualityThreshold) {
          case 'excellent': return snr >= 10;
          case 'good': return snr >= 0;
          case 'fair': return snr >= -10;
          case 'poor': return snr >= -20;
          default: return true;
        }
      });
    }

    // Apply advanced filters
    if (state.filters.advanced.uniqueOnly) {
      // Remove duplicate paths (same transmitter-receiver pair)
      const uniquePaths = new Map();
      filtered = filtered.filter(spot => {
        const pathKey = `${spot.transmitter.callsign}-${spot.receiver.callsign}`;
        if (!uniquePaths.has(pathKey)) {
          uniquePaths.set(pathKey, spot);
          return true;
        }
        return false;
      });
    }

    if (state.filters.advanced.bidirectionalOnly) {
      // Only show spots where both directions exist (A->B and B->A)
      const pathMap = new Map();
      filtered.forEach(spot => {
        const forwardKey = `${spot.transmitter.callsign}-${spot.receiver.callsign}`;
        const reverseKey = `${spot.receiver.callsign}-${spot.transmitter.callsign}`;

        if (!pathMap.has(forwardKey)) pathMap.set(forwardKey, []);
        pathMap.get(forwardKey).push(spot);
      });

      filtered = filtered.filter(spot => {
        const forwardKey = `${spot.transmitter.callsign}-${spot.receiver.callsign}`;
        const reverseKey = `${spot.receiver.callsign}-${spot.transmitter.callsign}`;
        return pathMap.has(forwardKey) && pathMap.has(reverseKey);
      });
    }

    // Apply minimum spot count filter (per station)
    if (state.filters.advanced.minSpotCount > 1) {
      const stationCounts = new Map();
      filtered.forEach(spot => {
        const txKey = spot.transmitter.callsign;
        const rxKey = spot.receiver.callsign;
        stationCounts.set(txKey, (stationCounts.get(txKey) || 0) + 1);
        stationCounts.set(rxKey, (stationCounts.get(rxKey) || 0) + 1);
      });

      filtered = filtered.filter(spot => {
        const txCount = stationCounts.get(spot.transmitter.callsign) || 0;
        const rxCount = stationCounts.get(spot.receiver.callsign) || 0;
        return txCount >= state.filters.advanced.minSpotCount ||
               rxCount >= state.filters.advanced.minSpotCount;
      });
    }

    // Apply distance filters
    if (state.filters.geographic.minDistance || state.filters.geographic.maxDistance) {
      filtered = filtered.filter(spot => {
        const distance = spot.distance || 0;
        if (state.filters.geographic.minDistance && distance < state.filters.geographic.minDistance) {
          return false;
        }
        if (state.filters.geographic.maxDistance && distance > state.filters.geographic.maxDistance) {
          return false;
        }
        return true;
      });
    }

    return filtered;
  }, [state.spots, state.filters]);

  // Create intelligent propagation map data
  const filteredMapData = useMemo(() => {
    const markers: any[] = [];
    const paths: any[] = [];
    const homeStations = new Map(); // Track unique transmitter locations
    const receiverStations = new Map(); // Track unique receiver locations

    console.log(`🗺️ CREATING MAP DATA from ${filteredSpots.length} filtered spots`);

    // First pass: Identify unique home stations and receivers
    filteredSpots.forEach(spot => {
      // Track home stations (transmitters) - these are the "source" stations
      if (spot.transmitter.location.latitude && spot.transmitter.location.longitude) {
        const key = `${spot.transmitter.callsign}_${spot.transmitter.location.latitude}_${spot.transmitter.location.longitude}`;
        if (!homeStations.has(key)) {
          homeStations.set(key, {
            callsign: spot.transmitter.callsign,
            position: {
              latitude: spot.transmitter.location.latitude,
              longitude: spot.transmitter.location.longitude,
              maidenhead: spot.transmitter.location.maidenhead
            },
            spotCount: 0,
            bands: new Set(),
            modes: new Set(),
            latestSpot: spot.timestamp
          });
        }
        const station = homeStations.get(key);
        station.spotCount++;
        station.bands.add(spot.band);
        station.modes.add(spot.mode);
        if (spot.timestamp > station.latestSpot) {
          station.latestSpot = spot.timestamp;
        }
      }

      // Track receiver stations - these heard the home station
      if (spot.receiver.location.latitude && spot.receiver.location.longitude) {
        const key = `${spot.receiver.callsign}_${spot.receiver.location.latitude}_${spot.receiver.location.longitude}`;
        if (!receiverStations.has(key)) {
          receiverStations.set(key, {
            callsign: spot.receiver.callsign,
            position: {
              latitude: spot.receiver.location.latitude,
              longitude: spot.receiver.location.longitude,
              maidenhead: spot.receiver.location.maidenhead
            },
            spotCount: 0,
            bestSNR: -50,
            worstSNR: 50,
            bands: new Set(),
            modes: new Set()
          });
        }
        const station = receiverStations.get(key);
        station.spotCount++;
        station.bestSNR = Math.max(station.bestSNR, spot.snr);
        station.worstSNR = Math.min(station.worstSNR, spot.snr);
        station.bands.add(spot.band);
        station.modes.add(spot.mode);
      }
    });

    // Create home station markers (large, distinctive - these are the "source" stations)
    homeStations.forEach((station, key) => {
      markers.push({
        id: `home_${key}`,
        type: 'home',
        position: station.position,
        callsign: station.callsign,
        frequency: 0, // Not applicable for home stations
        mode: Array.from(station.modes).join(', '),
        spotCount: station.spotCount,
        bands: Array.from(station.bands),
        modes: Array.from(station.modes),
        latestActivity: station.latestSpot
      });
    });

    // Create receiver markers (smaller, color-coded by signal quality)
    receiverStations.forEach((station, key) => {
      const avgSNR = (station.bestSNR + station.worstSNR) / 2;
      let quality = 'poor';
      if (avgSNR >= 0) quality = 'excellent';
      else if (avgSNR >= -10) quality = 'good';
      else if (avgSNR >= -20) quality = 'fair';

      markers.push({
        id: `receiver_${key}`,
        type: 'receiver',
        position: station.position,
        callsign: station.callsign,
        frequency: 0, // Not applicable for receivers
        mode: Array.from(station.modes).join(', '),
        spotCount: station.spotCount,
        bestSNR: station.bestSNR,
        worstSNR: station.worstSNR,
        quality,
        bands: Array.from(station.bands),
        modes: Array.from(station.modes)
      });
    });

    // Create propagation paths (great circle arcs from home to receivers)
    filteredSpots.forEach(spot => {
      if (spot.transmitter.location.latitude && spot.transmitter.location.longitude &&
          spot.receiver.location.latitude && spot.receiver.location.longitude) {

        // Determine path quality based on SNR
        let quality = 'poor';
        if (spot.snr >= 0) quality = 'excellent';
        else if (spot.snr >= -10) quality = 'good';
        else if (spot.snr >= -20) quality = 'fair';

        const distance = calculateDistance(
          spot.transmitter.location.latitude,
          spot.transmitter.location.longitude,
          spot.receiver.location.latitude,
          spot.receiver.location.longitude
        );
        const bearing = calculateBearing(
          spot.transmitter.location.latitude,
          spot.transmitter.location.longitude,
          spot.receiver.location.latitude,
          spot.receiver.location.longitude
        );

        paths.push({
          id: `path-${spot.id}`,
          from: spot.transmitter.location,
          to: spot.receiver.location,
          frequency: spot.frequency,
          snr: spot.snr,
          mode: spot.mode,
          quality,
          distance,
          bearing,
          band: spot.band,
          timestamp: spot.timestamp
        });
      }
    });

    console.log(`🗺️ INTELLIGENT MAP DATA:`, {
      filteredSpotsCount: filteredSpots.length,
      homeStations: homeStations.size,
      receiverStations: receiverStations.size,
      totalMarkers: markers.length,
      propagationPaths: paths.length
    });
    return { markers, paths };
  }, [filteredSpots]);

  const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
    setState(prev => ({
      ...prev,
      preferences: { ...prev.preferences, ...newPreferences },
    }));
  };

  const setError = (error: string | null) => {
    setState(prev => ({ ...prev, error }));
  };

  const setLoading = (isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  };

  const handleRefresh = async () => {
    const now = new Date();

    // Update sync status to show syncing
    setState(prev => ({
      ...prev,
      isLoading: true,
      syncStatus: {
        ...prev.syncStatus,
        isSyncing: true,
      }
    }));

    try {
      await pskReporterJSONP.refreshData(state.filters);

      // Calculate next sync time
      const nextSync = new Date(now.getTime() + (state.syncStatus.intervalMinutes * 60 * 1000));

      // Update sync status with successful sync
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastUpdate: now,
        syncStatus: {
          ...prev.syncStatus,
          lastSync: now,
          nextSync: nextSync,
          isSyncing: false,
        }
      }));
    } catch (error) {
      console.error('Error refreshing data:', error);

      // Update sync status with error
      setState(prev => ({
        ...prev,
        isLoading: false,
        syncStatus: {
          ...prev.syncStatus,
          isSyncing: false,
        }
      }));
    }
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const dashboardElement = document.querySelector('.propview-dashboard') as HTMLElement;
    if (!dashboardElement) return;

    const rect = dashboardElement.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const newRatio = Math.max(30, Math.min(80, (y / rect.height) * 100));

    setMapSplitRatio(newRatio);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      // Save the new ratio to preferences
      updatePreferences({
        displaySettings: {
          ...state.preferences.displaySettings,
          mapSplitRatio: mapSplitRatio,
        },
      });
    }
  }, [isResizing, mapSplitRatio, state.preferences.displaySettings, updatePreferences]);

  // Add global mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Map layer handlers
  const handleLayerToggle = (layerId: string) => {
    setMapLayers(prev => prev.map(layer =>
      layer.id === layerId ? { ...layer, enabled: !layer.enabled } : layer
    ));
  };

  const handleOpacityChange = (layerId: string, opacity: number) => {
    setMapLayers(prev => prev.map(layer =>
      layer.id === layerId ? { ...layer, opacity } : layer
    ));
  };

  const handleMapStyleChange = (style: string) => {
    updatePreferences({
      displaySettings: {
        ...state.preferences.displaySettings,
        mapStyle: style as any,
      },
    });
  };

  // Get enabled panels for tabs
  const getEnabledPanels = () => {
    return state.preferences.panels
      .filter(panel => panel.enabled)
      .sort((a, b) => a.order - b.order);
  };

  // Render content for the active tab
  const renderActiveTabContent = () => {
    const activePanel = state.preferences.panels.find(panel => panel.id === activeTab);
    if (!activePanel || !activePanel.enabled) {
      return (
        <div className="no-panel-content">
          <span>No panel selected or panel disabled</span>
        </div>
      );
    }

    switch (activePanel.type) {
      case 'band-conditions':
        return <BandConditionsPanel spots={filteredSpots} />;
      case 'recent-spots':
        return (
          <RecentSpotsPanel
            spots={filteredSpots}
            onSpotSelect={(spot) => setState(prev => ({ ...prev, selectedSpot: spot }))}
            selectedSpot={state.selectedSpot}
          />
        );
      case 'solar-data':
        return <SolarDataPanel solarData={state.solarData} />;
      case 'statistics':
        return (
          <StatisticsPanel
            spots={filteredSpots}
            bandConditions={state.bandConditions}
          />
        );
      case 'alerts':
        return (
          <div className="alerts-placeholder">
            <div className="placeholder-content">
              <span className="placeholder-icon">🔔</span>
              <span>Alerts & Notifications</span>
              <small>Real-time propagation alerts coming soon...</small>
            </div>
          </div>
        );
      default:
        return (
          <div className="unknown-panel">
            <span>Unknown panel type: {activePanel.type}</span>
          </div>
        );
    }
  };

  return (
    <div className="propview-app">
      {/* Header */}
      <header className="propview-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">
              <span className="title-icon">📡</span>
              HamView
            </h1>
            <span className="app-subtitle">Advanced Propagation Tracking</span>
          </div>
          
          <div className="header-center">
            <SyncStatusIndicator
              syncStatus={state.syncStatus}
              onManualSync={handleRefresh}
            />
          </div>

          <div className="header-right">
            <div className="status-indicators">
              {/* Demo mode indicator removed - using real proxy data */}

              {state.error && (
                <div className="status-indicator error">
                  <span>⚠️ {state.error}</span>
                </div>
              )}
            </div>
            
            <button
              className="settings-btn"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              ⚙️
            </button>

            <button
              className="theme-toggle"
              onClick={() => {
                const currentTheme = state.preferences.displaySettings.theme;
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                updatePreferences({
                  displaySettings: {
                    ...state.preferences.displaySettings,
                    theme: newTheme,
                  },
                });
              }}
              title="Toggle theme"
            >
              {state.preferences.displaySettings.theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Tabbed Layout */}
      <main className="propview-main">
        {/* Advanced Filter Sidebar */}
        <aside className="propview-sidebar">
          <AdvancedFilterSidebar
            filters={state.filters}
            onFiltersChange={updateFilters}
            spotCount={filteredSpots?.length || 0}
            bandCount={state.bandConditions?.length || 0}
          />
        </aside>

        {/* Dashboard with Map + Tabbed Panels */}
        <div className="propview-dashboard">
          {/* Map Section - Resizable */}
          <div
            className="map-section"
            style={{ height: `${mapSplitRatio}vh` }}
          >
            <div className="map-header">
              <h2>Propagation Map</h2>
              <div className="map-controls">
                <button
                  className="control-btn"
                  title="Map Layers"
                  onClick={() => setShowMapLayers(true)}
                >
                  🗺️
                </button>
              </div>
            </div>
            <div className="map-container" style={{ height: '100%', width: '100%' }}>
              <PropagationMap
                markers={filteredMapData.markers}
                paths={filteredMapData.paths}
                spots={filteredSpots}
                onSpotSelect={(spot) => setState(prev => ({ ...prev, selectedSpot: spot }))}
                selectedSpot={state.selectedSpot}
                mapStyle={state.preferences.displaySettings.mapStyle}
                layers={mapLayers}
                kIndex={state.solarData?.kIndex || 3}
                mapZoom={1} // TODO: Get actual map zoom level
                qthLocation={qthLocation}
                callsignDirection={state.filters.callsign.direction}
              />
            </div>
          </div>

          {/* Resize Handle */}
          <div
            className={`resize-handle ${isResizing ? 'resizing' : ''}`}
            onMouseDown={handleResizeStart}
          >
            <div className="resize-indicator">
              <div className="resize-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>

          {/* Tabbed Panels Section - Resizable */}
          <div
            className="tabbed-panels"
            style={{ height: `${100 - mapSplitRatio}vh` }}
          >
            <div className="tab-bar">
              {getEnabledPanels().map(panel => (
                <button
                  key={panel.id}
                  className={`tab-button ${activeTab === panel.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(panel.id)}
                >
                  <span className="tab-icon">{panel.icon}</span>
                  <span className="tab-title">{panel.title}</span>
                </button>
              ))}
            </div>

            <div className="tab-content">
              {renderActiveTabContent()}
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        preferences={state.preferences}
        onSave={updatePreferences}
        qthLocation={qthLocation}
        onQTHSave={(location) => {
          setQTHLocation(location);
          saveQTHLocation(location);

          // Set user callsign in PSK Reporter JSONP
          if (location.callsign) {
            pskReporterJSONP.setUserCallsign(location.callsign);

            // Auto-set the callsign search filter
            setState(prev => ({
              ...prev,
              filters: {
                ...prev.filters,
                callsign: {
                  ...prev.filters.callsign,
                  search: location.callsign.toUpperCase(),
                  transmitterOnly: false,
                  receiverOnly: false
                }
              }
            }));
            console.log(`🔍 Updated callsign filter: ${location.callsign.toUpperCase()}`);
          }
        }}
      />

      {/* Map Layers Modal */}
      <MapLayersModal
        isOpen={showMapLayers}
        onClose={() => setShowMapLayers(false)}
        layers={mapLayers}
        onLayerToggle={handleLayerToggle}
        onOpacityChange={handleOpacityChange}
        mapStyle={state.preferences.displaySettings.mapStyle}
        onMapStyleChange={handleMapStyleChange}
      />


    </div>
  );
}

// Helper functions for map data calculation
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
}
