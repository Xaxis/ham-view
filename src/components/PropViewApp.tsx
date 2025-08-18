import React, { useState, useEffect, useCallback } from 'react';
import type { AppState, FilterSettings, UserPreferences, Location, PanelConfig } from '../types';
import { dataManager } from '../services/dataManager';
import PropagationMap from './PropagationMap';
import BandConditionsPanel from './BandConditionsPanel';
import RecentSpotsPanel from './RecentSpotsPanel';
import SolarDataPanel from './SolarDataPanel';
import StatisticsPanel from './StatisticsPanel';
import SettingsModal from './SettingsModal';
import AdvancedFilterSidebar from './AdvancedFilterSidebar';
import MapLayersModal, { type MapLayer } from './MapLayersModal';

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
  { id: 'qth', name: 'My QTH', description: 'Your station location', icon: '🏠', enabled: true, category: 'reference', opacity: 100 },
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

// Default filter settings
const defaultFilters: FilterSettings = {
  bands: ['20m', '40m', '80m', '15m', '10m'],
  modes: ['FT8', 'FT4', 'PSK31'],
  sources: ['PSK_REPORTER', 'WSPR_NET'],
  timeRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date(),
    preset: 'last-24h',
  },
  callsign: {
    search: '',
    transmitterOnly: false,
    receiverOnly: false,
    exactMatch: false,
  },
  geographic: {
    gridSquares: [],
    countries: [],
    continents: [],
  },
  signal: {
    qualityThreshold: 'any',
  },
  advanced: {
    minSpotCount: 1,
    uniqueOnly: false,
    bidirectionalOnly: false,
  },
};

// Initial application state
const initialState: AppState = {
  isLoading: false,
  lastUpdate: null,
  error: null,
  spots: [],
  solarData: null,
  bandConditions: [],
  filters: defaultFilters,
  preferences: defaultPreferences,
  selectedSpot: null,
};

export default function PropViewApp() {
  const [state, setState] = useState<AppState>(initialState);
  const [mapData, setMapData] = useState<{ markers: any[]; paths: any[] }>({ markers: [], paths: [] });
  const [showSettings, setShowSettings] = useState(false);
  const [showMapLayers, setShowMapLayers] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('band-conditions');
  const [isResizing, setIsResizing] = useState(false);
  const [mapSplitRatio, setMapSplitRatio] = useState(70);
  const [mapLayers, setMapLayers] = useState<MapLayer[]>(defaultMapLayers);

  // Data update handler
  const handleDataUpdate = useCallback(async (data: {
    spots: any[];
    solarData: any;
    bandConditions: any[];
    lastUpdate: Date;
  }) => {
    setState(prev => ({
      ...prev,
      spots: data.spots,
      solarData: data.solarData,
      bandConditions: data.bandConditions,
      lastUpdate: data.lastUpdate,
      isLoading: false,
      error: null,
    }));

    // Update map data asynchronously
    try {
      const newMapData = await dataManager.getMapData();
      setMapData(newMapData);
    } catch (error) {
      console.warn('Failed to update map data:', error);
      // Use synchronous fallback
      setMapData(dataManager.getMapDataSync());
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

  // Setup data manager listeners
  useEffect(() => {
    const unsubscribeData = dataManager.onDataUpdate(handleDataUpdate);
    const unsubscribeError = dataManager.onError(handleError);

    return () => {
      unsubscribeData();
      unsubscribeError();
    };
  }, [handleDataUpdate, handleError]);

  // Start auto-refresh when preferences change
  useEffect(() => {
    const intervalMinutes = state.preferences.dataRefreshInterval / 60; // Convert seconds to minutes
    dataManager.startAutoRefresh(intervalMinutes, state.filters);

    return () => {
      dataManager.stopAutoRefresh();
    };
  }, [state.preferences.dataRefreshInterval, state.filters]);

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

  // Save preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem('propview-preferences', JSON.stringify(state.preferences));
  }, [state.preferences]);

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

  const updateFilters = (newFilters: Partial<FilterSettings>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
    }));
  };

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
    setLoading(true);
    try {
      await dataManager.refreshData(state.filters);
    } catch (error) {
      console.error('Error refreshing data:', error);
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
        return <BandConditionsPanel conditions={state.bandConditions} />;
      case 'recent-spots':
        return (
          <RecentSpotsPanel
            spots={state.spots}
            onSpotSelect={(spot) => setState(prev => ({ ...prev, selectedSpot: spot }))}
            selectedSpot={state.selectedSpot}
          />
        );
      case 'solar-data':
        return <SolarDataPanel solarData={state.solarData} />;
      case 'statistics':
        return (
          <StatisticsPanel
            spots={state.spots}
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
              PropView
            </h1>
            <span className="app-subtitle">Advanced Propagation Tracking</span>
          </div>
          
          <div className="header-right">
            <div className="status-indicators">
              {dataManager.isDemoMode() && (
                <div className="status-indicator demo-mode">
                  <span>🎭 Demo Mode</span>
                </div>
              )}

              {state.isLoading && (
                <div className="status-indicator loading">
                  <div className="loading-spinner"></div>
                  <span>Loading...</span>
                </div>
              )}

              {state.lastUpdate && (
                <div className="status-indicator last-update">
                  <span>Last update: {state.lastUpdate.toLocaleTimeString()}</span>
                </div>
              )}

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
            spotCount={state.spots.length}
            bandCount={state.bandConditions.length}
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
                  title="Refresh Data"
                  onClick={handleRefresh}
                  disabled={state.isLoading}
                >
                  🔄
                </button>
                <button
                  className="control-btn"
                  title="Map Layers"
                  onClick={() => setShowMapLayers(true)}
                >
                  🗺️
                </button>
              </div>
            </div>
            <div className="map-container">
              <PropagationMap
                markers={mapData.markers}
                paths={mapData.paths}
                spots={state.spots}
                onSpotSelect={(spot) => setState(prev => ({ ...prev, selectedSpot: spot }))}
                selectedSpot={state.selectedSpot}
                mapStyle={state.preferences.displaySettings.mapStyle}
                layers={{
                  daynight: mapLayers.find(l => l.id === 'daynight')?.enabled || false,
                  spots: mapLayers.find(l => l.id === 'spots')?.enabled || true,
                  paths: mapLayers.find(l => l.id === 'paths')?.enabled || true,
                }}
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
