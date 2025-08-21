import type { UserPreferences, FilterSettings, AppState } from '../types';

const STORAGE_KEYS = {
  USER_PREFERENCES: 'propview_user_preferences',
  FILTER_SETTINGS: 'propview_filter_settings',
  QTH_LOCATION: 'propview_qth_location',
  MAP_LAYERS: 'propview_map_layers',
} as const;

// User Preferences
export const saveUserPreferences = (preferences: UserPreferences): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save user preferences:', error);
  }
};

export const loadUserPreferences = (): UserPreferences | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load user preferences:', error);
    return null;
  }
};

// Filter Settings
export const saveFilterSettings = (filters: FilterSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.FILTER_SETTINGS, JSON.stringify(filters));
  } catch (error) {
    console.warn('Failed to save filter settings:', error);
  }
};

export const loadFilterSettings = (): FilterSettings | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FILTER_SETTINGS);
    if (!stored) return null;

    const parsed = JSON.parse(stored);

    // Convert date strings back to Date objects
    if (parsed.timeRange) {
      if (parsed.timeRange.start) {
        parsed.timeRange.start = new Date(parsed.timeRange.start);
      }
      if (parsed.timeRange.end) {
        parsed.timeRange.end = new Date(parsed.timeRange.end);
      }
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to load filter settings:', error);
    return null;
  }
};

// QTH Location
export interface QTHLocation {
  callsign?: string;
  latitude: number;
  longitude: number;
  maidenhead: string;
  name?: string;
  isSet: boolean;
}

export const saveQTHLocation = (location: QTHLocation): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.QTH_LOCATION, JSON.stringify(location));
  } catch (error) {
    console.warn('Failed to save QTH location:', error);
  }
};

export const loadQTHLocation = (): QTHLocation | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.QTH_LOCATION);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load QTH location:', error);
    return null;
  }
};

// Map Layers
export const saveMapLayers = (layers: any[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.MAP_LAYERS, JSON.stringify(layers));
  } catch (error) {
    console.warn('Failed to save map layers:', error);
  }
};

export const loadMapLayers = (): any[] | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.MAP_LAYERS);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load map layers:', error);
    return null;
  }
};

// Browser Geolocation API
export const requestUserLocation = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  });
};

// Convert lat/lng to Maidenhead grid square
export const latLngToMaidenhead = (lat: number, lng: number): string => {
  // Adjust longitude to 0-360 range
  const adjustedLng = lng + 180;
  const adjustedLat = lat + 90;

  // Field (first 2 characters)
  const fieldLng = Math.floor(adjustedLng / 20);
  const fieldLat = Math.floor(adjustedLat / 10);
  const field = String.fromCharCode(65 + fieldLng) + String.fromCharCode(65 + fieldLat);

  // Square (next 2 digits)
  const squareLng = Math.floor((adjustedLng % 20) / 2);
  const squareLat = Math.floor((adjustedLat % 10) / 1);
  const square = squareLng.toString() + squareLat.toString();

  // Subsquare (next 2 characters)
  const subsquareLng = Math.floor(((adjustedLng % 20) % 2) * 12);
  const subsquareLat = Math.floor(((adjustedLat % 10) % 1) * 24);
  const subsquare = String.fromCharCode(97 + subsquareLng) + String.fromCharCode(97 + subsquareLat);

  return field + square + subsquare;
};

// Convert Maidenhead grid square to lat/lng
export const maidenheadToLatLng = (maidenhead: string): { latitude: number; longitude: number } => {
  if (!maidenhead || maidenhead.length < 4) {
    throw new Error('Invalid Maidenhead grid square format');
  }

  const grid = maidenhead.toUpperCase();

  // Field (first 2 characters)
  const fieldLng = (grid.charCodeAt(0) - 65) * 20 - 180;
  const fieldLat = (grid.charCodeAt(1) - 65) * 10 - 90;

  // Square (next 2 characters)
  const squareLng = parseInt(grid.charAt(2)) * 2;
  const squareLat = parseInt(grid.charAt(3)) * 1;

  // Subsquare (optional, next 2 characters)
  let subsquareLng = 0;
  let subsquareLat = 0;

  if (grid.length >= 6) {
    subsquareLng = (grid.charCodeAt(4) - 65) * (2/24);
    subsquareLat = (grid.charCodeAt(5) - 65) * (1/24);
  }

  // Calculate center of grid square
  const longitude = fieldLng + squareLng + subsquareLng + (grid.length >= 6 ? 1/24 : 1);
  const latitude = fieldLat + squareLat + subsquareLat + (grid.length >= 6 ? 1/48 : 0.5);

  return { latitude, longitude };
};

// QTH Setup Helper
export const setupQTHFromBrowser = async (): Promise<QTHLocation> => {
  try {
    const position = await requestUserLocation();
    const { latitude, longitude } = position.coords;
    
    const maidenhead = latLngToMaidenhead(latitude, longitude);
    
    const qthLocation: QTHLocation = {
      latitude,
      longitude,
      maidenhead,
      name: `${maidenhead} (Auto-detected)`,
      isSet: true,
    };
    
    saveQTHLocation(qthLocation);
    return qthLocation;
  } catch (error) {
    throw new Error(`Failed to get location: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Clear all stored data
export const clearAllStoredData = (): void => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.warn('Failed to clear stored data:', error);
  }
};

// Check if this is first time user
export const isFirstTimeUser = (): boolean => {
  return !localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES) && 
         !localStorage.getItem(STORAGE_KEYS.QTH_LOCATION);
};
