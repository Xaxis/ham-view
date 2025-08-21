import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { MapMarker, PropagationPath, PropagationSpot } from '../types';
import type { MapLayer } from './MapLayersModal';
import type { QTHLocation } from '../services/localStorage';

// Leaflet imports (will be loaded dynamically)
declare global {
  interface Window {
    L: any;
  }
}

interface PropagationMapProps {
  markers: MapMarker[];
  paths: PropagationPath[];
  spots: PropagationSpot[];
  onSpotSelect?: (spot: PropagationSpot | null) => void;
  selectedSpot?: PropagationSpot | null;
  mapStyle?: 'street' | 'satellite' | 'terrain' | 'dark';
  layers?: MapLayer[];
  kIndex?: number; // For aurora calculations
  mapZoom?: number; // For grid density
  qthLocation?: QTHLocation | null; // User's home station location
  callsignDirection?: 'received' | 'transmitted' | 'either'; // For spot icon differentiation
  isFullScreen?: boolean; // External full-screen state
}

// High-performance tessellation with viewport-based rendering
const getVisibleWorldsHelper = (map: any) => {
  if (!map) return { start: 0, end: 0 };

  const bounds = map.getBounds();
  const westBound = bounds.getWest();
  const eastBound = bounds.getEast();
  const worldWidth = 360;

  // Calculate world repetitions needed for current viewport
  const start = Math.floor(westBound / worldWidth);
  const end = Math.ceil(eastBound / worldWidth);

  // PERFORMANCE OPTIMIZATION: Limit to 3 worlds maximum
  // Research shows this provides seamless tessellation while maintaining performance
  const limitedStart = Math.max(start, -1);
  const limitedEnd = Math.min(end, 1);

  return { start: limitedStart, end: limitedEnd };
};

// High-performance viewport-based element filtering
const isElementInViewport = (lat: number, lng: number, map: any, buffer: number = 20) => {
  if (!map) return true;

  const bounds = map.getBounds();
  const latBuffer = buffer; // degrees
  const lngBuffer = buffer; // degrees

  return (
    lat >= bounds.getSouth() - latBuffer &&
    lat <= bounds.getNorth() + latBuffer &&
    lng >= bounds.getWest() - lngBuffer &&
    lng <= bounds.getEast() + lngBuffer
  );
};

// Performance monitoring for layer updates
const shouldUpdateLayer = (map: any, lastBounds: any, threshold: number = 0.3) => {
  if (!map || !lastBounds) return true;

  const currentBounds = map.getBounds();
  const currentWidth = currentBounds.getEast() - currentBounds.getWest();
  const lastWidth = lastBounds.getEast() - lastBounds.getWest();

  // Only update if viewport changed significantly
  const widthChange = Math.abs(currentWidth - lastWidth) / lastWidth;
  const centerDistance = currentBounds.getCenter().distanceTo(lastBounds.getCenter());

  return widthChange > threshold || centerDistance > 500000; // 500km threshold
};

export default function PropagationMap({
  markers,
  paths,
  spots,
  onSpotSelect,
  selectedSpot,
  mapStyle = 'street',
  layers = [],
  kIndex = 3,
  mapZoom = 1,
  qthLocation = null,
  callsignDirection = 'received',
  isFullScreen = false
}: PropagationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const pathsLayerRef = useRef<any>(null);
  const qthMarkerRef = useRef<any>(null);
  const layerGroupsRef = useRef<{
    daynight?: any;
    aurora?: any;
    grid?: any;
    qth?: any;
    targets?: any;
    voacap?: any;
    beacons?: any;
  }>({});
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(true);
  const highlightedArcsRef = useRef<any[]>([]);
  const lastBoundsRef = useRef<any>(null);
  const updateTimeoutRef = useRef<any>(null);
  const currentTileLayerRef = useRef<any>(null);
  const layerCacheRef = useRef<Map<string, any>>(new Map());
  const lastZoomRef = useRef<number>(0);
  const visibleWorldsRef = useRef<{start: number, end: number}>({start: 0, end: 0});

  // Efficient world calculation for tessellation
  const getVisibleWorlds = (map: any) => {
    if (!map) return { start: 0, end: 0 };

    const bounds = map.getBounds();
    const westBound = bounds.getWest();
    const eastBound = bounds.getEast();
    const worldWidth = 360;

    // Calculate minimal world repetitions needed
    const start = Math.floor(westBound / worldWidth);
    const end = Math.ceil(eastBound / worldWidth);

    // Limit to maximum 3 worlds for performance
    const limitedStart = Math.max(start, -1);
    const limitedEnd = Math.min(end, 1);

    return { start: limitedStart, end: limitedEnd };
  };

  // Object pooling for layer elements to reduce GC pressure
  const layerObjectPool = useRef<Map<string, any[]>>(new Map());

  const getPooledObject = (type: string, createFn: () => any) => {
    if (!layerObjectPool.current.has(type)) {
      layerObjectPool.current.set(type, []);
    }

    const pool = layerObjectPool.current.get(type);
    return pool.length > 0 ? pool.pop() : createFn();
  };

  const returnToPool = (type: string, obj: any) => {
    if (!layerObjectPool.current.has(type)) {
      layerObjectPool.current.set(type, []);
    }

    const pool = layerObjectPool.current.get(type);
    if (pool.length < 50) { // Limit pool size
      pool.push(obj);
    }
  };

  // Function to highlight connected propagation arcs
  const highlightConnectedArcs = (selectedSpot: PropagationSpot, callsign: string) => {
    if (!pathsLayerRef.current || !window.L) return;

    // Clear previous highlights
    highlightedArcsRef.current.forEach(arc => {
      if (pathsLayerRef.current) {
        pathsLayerRef.current.removeLayer(arc);
      }
    });
    highlightedArcsRef.current = [];

    // Find all paths connected to this callsign
    const connectedPaths = paths.filter(path =>
      path.from.callsign === callsign || path.to.callsign === callsign
    );

    // Create highlighted versions of connected arcs
    connectedPaths.forEach(path => {
      const highlightArc = window.L.polyline(
        [
          [path.from.latitude, path.from.longitude],
          [path.to.latitude, path.to.longitude]
        ],
        {
          color: '#ff6b35',
          weight: 4,
          opacity: 0.9,
          dashArray: '10, 5',
          className: 'highlighted-arc'
        }
      );

      highlightArc.bindPopup(`
        <div style="font-family: Inter, sans-serif;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">🔗 Propagation Path</h3>
          <p style="margin: 0; font-size: 12px; color: #666;">
            <strong>From:</strong> ${path.from.callsign} (${path.from.maidenhead})<br>
            <strong>To:</strong> ${path.to.callsign} (${path.to.maidenhead})<br>
            <strong>Distance:</strong> ${Math.round(path.distance)} km<br>
            <strong>Bearing:</strong> ${Math.round(path.bearing)}°<br>
            <strong>Band:</strong> ${selectedSpot.band} • <strong>Mode:</strong> ${selectedSpot.mode}<br>
            <strong>SNR:</strong> ${selectedSpot.snr > 0 ? '+' : ''}${selectedSpot.snr} dB
          </p>
        </div>
      `);

      pathsLayerRef.current.addLayer(highlightArc);
      highlightedArcsRef.current.push(highlightArc);
    });

    // Auto-clear highlights after 10 seconds
    setTimeout(() => {
      highlightedArcsRef.current.forEach(arc => {
        if (pathsLayerRef.current) {
          pathsLayerRef.current.removeLayer(arc);
        }
      });
      highlightedArcsRef.current = [];
    }, 10000);
  };

  // Reset empty state when spots arrive
  useEffect(() => {
    if (spots.length > 0) {
      setShowEmptyState(true);
    }
  }, [spots]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Handle map style changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L || !currentTileLayerRef.current) {
      return;
    }

    // Remove current tile layer
    mapInstanceRef.current.removeLayer(currentTileLayerRef.current);

    // Add new tile layer based on style
    const getTileLayer = () => {
      switch (mapStyle) {
        case 'satellite':
          return window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          });
        case 'terrain':
          return window.L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
          });
        case 'dark':
          return window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
          });
        default: // street
          return window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          });
      }
    };

    currentTileLayerRef.current = getTileLayer();
    currentTileLayerRef.current.addTo(mapInstanceRef.current);
  }, [mapStyle]);

  // Load Leaflet dynamically (simple version)
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        if (window.L) {
          console.log('✅ Leaflet already loaded');
          setIsLoading(false);
          return;
        }

        console.log('📦 Loading Leaflet...');
        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

        await new Promise((resolve, reject) => {
          leafletScript.onload = () => {
            console.log('✅ Leaflet loaded successfully');
            resolve(undefined);
          };
          leafletScript.onerror = (error) => {
            console.error('❌ Failed to load Leaflet:', error);
            reject(error);
          };
          document.head.appendChild(leafletScript);
        });

        setIsLoading(false);
      } catch (err) {
        console.error('❌ Error loading Leaflet:', err);
        setError('Failed to load map library');
        setIsLoading(false);
      }
    };

    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (isLoading || error || !window.L || !mapRef.current || mapInstanceRef.current) {
      return;
    }

    try {
      // Create map instance with high-performance tessellation strategy
      const map = window.L.map(mapRef.current, {
        center: [20, 0], // Center on equator
        zoom: 2,
        zoomControl: true,
        attributionControl: true,
        // HIGH-PERFORMANCE STRATEGY: Bounded infinite tessellation
        worldCopyJump: false, // Allow seamless world wrapping
        maxBounds: [[-90, -540], [90, 540]], // Allow 3 worlds (-180° to +540°) for performance
        maxBoundsViscosity: 0.8, // Smooth resistance at boundaries
        preferCanvas: true, // Better performance for many markers
        maxZoom: 18,
        minZoom: 1
      });

      // Add tile layer based on style
      const getTileLayer = () => {
        switch (mapStyle) {
          case 'satellite':
            return window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
              attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            });
          case 'terrain':
            return window.L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
              attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            });
          case 'dark':
            return window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
              subdomains: 'abcd',
              maxZoom: 20
            });
          default: // street
            return window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            });
        }
      };

      currentTileLayerRef.current = getTileLayer();
      currentTileLayerRef.current.addTo(map);

      // Create layer groups for markers and paths
      markersLayerRef.current = window.L.layerGroup().addTo(map);
      pathsLayerRef.current = window.L.layerGroup().addTo(map);

      // Create layer groups for overlays
      layerGroupsRef.current = {
        daynight: window.L.layerGroup(),
        aurora: window.L.layerGroup(),
        grid: window.L.layerGroup(),
        qth: window.L.layerGroup(),
        targets: window.L.layerGroup(),
        voacap: window.L.layerGroup(),
      };



      mapInstanceRef.current = map;
      console.log('PropView map initialized');
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map');
    }
  }, [isLoading, error, mapStyle]);

  // Update map layers when layers prop changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;

    const map = mapInstanceRef.current;
    const L = window.L;

    // Clear existing layers
    Object.values(layerGroupsRef.current).forEach(layerGroup => {
      if (layerGroup && map.hasLayer(layerGroup)) {
        map.removeLayer(layerGroup);
      }
      if (layerGroup) {
        layerGroup.clearLayers();
      }
    });

    // Add enabled layers
    layers.forEach(layer => {
      if (!layer.enabled) return;

      const layerGroup = layerGroupsRef.current[layer.id as keyof typeof layerGroupsRef.current];
      if (!layerGroup) return;

      // Add layer to map first so functions can access map bounds
      layerGroup.addTo(map);

      switch (layer.id) {
        case 'daynight':
          addDayNightTerminator(L, layerGroup, layer.opacity || 60, map);
          break;
        case 'aurora':
          addRealAuroralOval(L, layerGroup, layer.opacity || 50);
          break;
        case 'grid':
          addMaidenheadGrid(L, layerGroup, layer.opacity || 30, map.getZoom());
          break;
        case 'qth':
          addQTHMarker(L, layerGroup, layer.opacity || 100);
          break;
        case 'targets':
          addDXTargets(L, layerGroup, layer.opacity || 100);
          break;
        case 'voacap':
          addVOACAPOverlay(L, layerGroup, layer.opacity || 40);
          break;
        case 'beacons':
          addBeaconNetwork(L, layerGroup, layer.opacity || 70);
          break;
      }
    });

    // High-performance layer management with viewport-based updates
    const updateLayerIfNeeded = (layerId: string, layerGroup: any, updateFn: () => void) => {
      const currentBounds = map.getBounds();
      const currentZoom = map.getZoom();
      const cacheKey = `${layerId}_${currentZoom.toFixed(1)}_${currentBounds.getCenter().lat.toFixed(1)}_${currentBounds.getCenter().lng.toFixed(1)}`;

      if (!layerCacheRef.current.has(cacheKey)) {
        layerGroup.clearLayers();
        updateFn();
        layerCacheRef.current.set(cacheKey, true);

        // Aggressive cache management for performance
        if (layerCacheRef.current.size > 20) {
          const firstKey = layerCacheRef.current.keys().next().value;
          layerCacheRef.current.delete(firstKey);
        }
      }
    };

    const handleViewChange = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        try {
          const currentBounds = map.getBounds();
          const currentZoom = map.getZoom();

          // Performance check: only update if viewport changed significantly
          if (!shouldUpdateLayer(map, lastBoundsRef.current, 0.4)) {
            return; // Skip update if change is too small
          }

          const zoomChanged = Math.abs(currentZoom - lastZoomRef.current) > 0.5;

          if (zoomChanged || shouldUpdateLayer(map, lastBoundsRef.current)) {
            lastZoomRef.current = currentZoom;
            lastBoundsRef.current = currentBounds;

            // Update only essential layers for performance
            const layersToUpdate = ['grid', 'daynight', 'aurora'];

            layersToUpdate.forEach(layerId => {
              const layerGroup = layerGroupsRef.current[layerId];
              if (layerGroup && map.hasLayer(layerGroup)) {
                const layerConfig = layers.find(l => l.id === layerId);
                if (layerConfig?.enabled) {
                  updateLayerIfNeeded(layerId, layerGroup, () => {
                    switch (layerId) {
                      case 'grid':
                        addMaidenheadGrid(window.L, layerGroup, layerConfig.opacity || 30, currentZoom);
                        break;
                      case 'daynight':
                        addDayNightTerminator(window.L, layerGroup, layerConfig.opacity || 60, map);
                        break;
                      case 'aurora':
                        addRealAuroralOval(window.L, layerGroup, layerConfig.opacity || 50);
                        break;
                    }
                  });
                }
              }
            });

            // Update static layers less frequently (only on significant zoom changes)
            if (zoomChanged) {
              const staticLayers = ['voacap', 'beacons', 'targets'];
              staticLayers.forEach(layerId => {
                const layerGroup = layerGroupsRef.current[layerId];
                if (layerGroup && map.hasLayer(layerGroup)) {
                  const layerConfig = layers.find(l => l.id === layerId);
                  if (layerConfig?.enabled) {
                    updateLayerIfNeeded(layerId, layerGroup, () => {
                      switch (layerId) {
                        case 'voacap':
                          addVOACAPOverlay(window.L, layerGroup, layerConfig.opacity || 40);
                          break;
                        case 'beacons':
                          addBeaconNetwork(window.L, layerGroup, layerConfig.opacity || 70);
                          break;
                        case 'targets':
                          addDXTargets(window.L, layerGroup, layerConfig.opacity || 100);
                          break;
                      }
                    });
                  }
                }
              });
            }
          }
        } catch (error) {
          console.warn('Layer update error:', error);
        }
      }, 800); // Longer debounce for better performance
    };

    // Add event listeners for view changes
    map.on('zoomend', handleViewChange);
    map.on('moveend', handleViewChange);
    map.on('viewreset', handleViewChange);

    // Day/night terminator updates only on manual refresh - no automatic updates for performance

    return () => {
      map.off('zoomend', handleViewChange);
      map.off('moveend', handleViewChange);
    };
  }, [layers, kIndex]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !window.L) {
      return;
    }

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    markers.forEach(marker => {
      try {
        // Safety check for marker data
        if (!marker.position ||
            typeof marker.position.latitude !== 'number' ||
            typeof marker.position.longitude !== 'number') {
          console.warn('Invalid marker data:', marker);
          return;
        }

        // Create marker icon based on band colors (like PSK Reporter)
        const getMarkerIcon = (type: MapMarker['type'], spotCount: number, callsign: string) => {
          // Determine if this is a multi-station cluster
          const isMultiStation = callsign.includes('+');
          const stationCount = isMultiStation ? parseInt(callsign.split('+')[1]) + 1 : 1;

          // PSK Reporter style: "Large markers are monitors"
          // Size based on activity level and station count
          const activitySize = Math.min(24, Math.max(12, spotCount * 0.8));
          const clusterSize = isMultiStation ? Math.min(32, Math.max(16, stationCount * 2)) : activitySize;
          const finalSize = Math.max(activitySize, clusterSize);

          // Get associated spots for this marker to determine band color
          const associatedSpots = spots.filter(spot =>
            spot.receiver.callsign === callsign.split('+')[0] ||
            spot.transmitter.callsign === callsign.split('+')[0]
          );

          // Get the most common band from associated spots
          const bandCounts = new Map();
          associatedSpots.forEach(spot => {
            bandCounts.set(spot.band, (bandCounts.get(spot.band) || 0) + 1);
          });

          let mostCommonBand = '20m'; // Default fallback
          let maxCount = 0;
          bandCounts.forEach((count, band) => {
            if (count > maxCount) {
              maxCount = count;
              mostCommonBand = band;
            }
          });

          // Get band color using the same function as propagation paths
          const getBandColorForMarker = (band: string) => {
            switch (band) {
              case '160m': return '#8B4513'; // Brown
              case '80m': return '#FF4500'; // Orange Red
              case '60m': return '#FF6347'; // Tomato
              case '40m': return '#FFD700'; // Gold
              case '30m': return '#ADFF2F'; // Green Yellow
              case '20m': return '#00FF00'; // Lime
              case '17m': return '#00CED1'; // Dark Turquoise
              case '15m': return '#0000FF'; // Blue
              case '12m': return '#8A2BE2'; // Blue Violet
              case '10m': return '#FF00FF'; // Magenta
              case '6m': return '#FF1493'; // Deep Pink
              default: return '#808080'; // Gray
            }
          };

          // Use band color for marker
          const color = getBandColorForMarker(mostCommonBand);
          const borderColor = '#ffffff';
          const textColor = '#ffffff';
          const fontSize = '10px';

          // Label based on callsign direction and activity
          let label, icon;
          switch (callsignDirection) {
            case 'transmitted':
              icon = '📡'; // Transmitting antenna
              if (isMultiStation) {
                label = stationCount.toString();
              } else if (spotCount > 1) {
                label = spotCount.toString();
              } else {
                label = mostCommonBand.replace('m', ''); // Show band (e.g., "20")
              }
              break;

            case 'either':
              icon = '⚡'; // Lightning bolt for bidirectional activity
              if (isMultiStation) {
                label = stationCount.toString();
              } else if (spotCount > 1) {
                label = spotCount.toString();
              } else {
                label = mostCommonBand.replace('m', ''); // Show band (e.g., "20")
              }
              break;

            case 'received':
            default:
              icon = '📻'; // Receiving radio
              if (isMultiStation) {
                label = stationCount.toString();
              } else if (spotCount > 1) {
                label = spotCount.toString();
              } else {
                label = mostCommonBand.replace('m', ''); // Show band (e.g., "20")
              }
              break;
          }

          // Create a label-style marker
          return window.L.divIcon({
            html: `<div style="
              background: ${color};
              color: ${textColor};
              border: 2px solid ${borderColor};
              border-radius: ${isMultiStation ? '50%' : '4px'};
              padding: 2px 6px;
              font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
              font-size: ${fontSize};
              font-weight: bold;
              text-align: center;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              white-space: nowrap;
              line-height: 1.2;
              min-width: ${finalSize}px;
              min-height: ${finalSize}px;
              display: flex;
              align-items: center;
              justify-content: center;
            ">${label}</div>`,
            className: isMultiStation ? 'receiver-cluster-marker' : 'receiver-marker',
            iconSize: [finalSize + 4, finalSize + 4],
            iconAnchor: [(finalSize + 4) / 2, (finalSize + 4) / 2],
          });
        };

        // Create markers on multiple tiles for tessellation
        const worldOffsets = [-360, 0, 360];

        worldOffsets.forEach(offset => {
          const leafletMarker = window.L.marker(
            [marker.position.latitude, marker.position.longitude + offset],
            { icon: getMarkerIcon(marker.type, marker.spotCount, marker.callsign) }
          );

          // Add popup with direction context
          if (marker.popup) {
            const directionText = {
              'received': '📻 Received signals',
              'transmitted': '📡 Transmitted signals',
              'either': '⚡ Bidirectional signals'
            }[callsignDirection] || '📻 Received signals';

            const currentIcon = {
              'received': '📻',
              'transmitted': '📡',
              'either': '⚡'
            }[callsignDirection] || '📻';

            leafletMarker.bindPopup(`
              <div style="font-family: Inter, sans-serif;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${currentIcon} ${marker.popup.title}</h3>
                <p style="margin: 0; font-size: 12px; color: #666;">${marker.popup.content}</p>
                <div style="margin-top: 8px; font-size: 11px; color: #888;">
                  ${directionText} | Spots: ${marker.spotCount}
                </div>
              </div>
            `);
          }

          // Add enhanced interaction handlers
          leafletMarker.on('mouseover', () => {
            // Show tooltip with spot data on hover
            const associatedSpots = spots.filter(spot =>
              spot.transmitter.callsign === marker.callsign ||
              spot.receiver.callsign === marker.callsign
            );

            if (associatedSpots.length > 0) {
              const spot = associatedSpots[0];
              const tooltip = `
                <div style="font-family: Inter, sans-serif; font-size: 11px; background: rgba(0,0,0,0.8); color: white; padding: 4px 8px; border-radius: 4px; white-space: nowrap;">
                  <strong>${marker.callsign}</strong><br>
                  ${spot.band} • ${spot.mode} • ${spot.snr > 0 ? '+' : ''}${spot.snr} dB<br>
                  ${Math.round(spot.distance)} km • ${spot.timestamp.toLocaleTimeString()}
                </div>
              `;
              leafletMarker.bindTooltip(tooltip, {
                permanent: false,
                direction: 'top',
                offset: [0, -10],
                className: 'spot-tooltip'
              }).openTooltip();
            }
          });

          leafletMarker.on('mouseout', () => {
            leafletMarker.closeTooltip();
          });

          leafletMarker.on('click', () => {
            // Find all spots associated with this marker
            const associatedSpots = spots.filter(spot =>
              spot.transmitter.callsign === marker.callsign ||
              spot.receiver.callsign === marker.callsign
            );

            if (associatedSpots.length > 0 && onSpotSelect) {
              const selectedSpot = associatedSpots[0];
              onSpotSelect(selectedSpot);

              // Highlight connected propagation arcs
              highlightConnectedArcs(selectedSpot, marker.callsign);

              // Show detailed popup
              const detailedPopup = `
                <div style="font-family: Inter, sans-serif;">
                  <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">📡 ${marker.callsign}</h3>
                  <div style="font-size: 12px; color: #666;">
                    <strong>Type:</strong> ${marker.type === 'transmitter' ? 'Transmitter' : 'Receiver'}<br>
                    <strong>Active Spots:</strong> ${associatedSpots.length}<br>
                    <strong>Bands:</strong> ${[...new Set(associatedSpots.map(s => s.band))].join(', ')}<br>
                    <strong>Modes:</strong> ${[...new Set(associatedSpots.map(s => s.mode))].join(', ')}<br>
                    <strong>Best SNR:</strong> ${Math.max(...associatedSpots.map(s => s.snr))} dB<br>
                    <strong>Max Distance:</strong> ${Math.round(Math.max(...associatedSpots.map(s => s.distance)))} km
                  </div>
                  <div style="margin-top: 8px; font-size: 11px; color: #888;">
                    Click elsewhere to deselect • Connected arcs highlighted
                  </div>
                </div>
              `;
              leafletMarker.bindPopup(detailedPopup).openPopup();
            }
          });

          markersLayerRef.current.addLayer(leafletMarker);
        });
      } catch (err) {
        console.warn('Error creating marker:', err);
      }
    });
  }, [markers, spots, onSpotSelect]);

  // Update QTH (My Station) marker
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !window.L) {
      return;
    }

    // Remove existing QTH marker
    if (qthMarkerRef.current) {
      markersLayerRef.current.removeLayer(qthMarkerRef.current);
      qthMarkerRef.current = null;
    }

    // Add QTH marker if location is set
    if (qthLocation && qthLocation.isSet) {
      const qthIcon = window.L.divIcon({
        className: 'qth-marker',
        html: `
          <div style="
            background: #ef4444;
            border: 3px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: white;
            font-weight: bold;
          ">🏠</div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      qthMarkerRef.current = window.L.marker(
        [qthLocation.latitude, qthLocation.longitude],
        { icon: qthIcon }
      );

      qthMarkerRef.current.bindPopup(`
        <div style="font-family: Inter, sans-serif;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">📻 My QTH</h3>
          <p style="margin: 0; font-size: 12px; color: #666;">
            <strong>Callsign:</strong> ${qthLocation.callsign}<br>
            <strong>Grid:</strong> ${qthLocation.maidenhead}<br>
            <strong>Location:</strong> ${qthLocation.latitude.toFixed(4)}°, ${qthLocation.longitude.toFixed(4)}°
          </p>
        </div>
      `);

      markersLayerRef.current.addLayer(qthMarkerRef.current);
    }
  }, [qthLocation]);

  // Update propagation paths
  useEffect(() => {
    if (!mapInstanceRef.current || !pathsLayerRef.current || !window.L) {
      return;
    }

    // Clear existing paths
    pathsLayerRef.current.clearLayers();

    paths.forEach((path, pathIndex) => {
      try {
        // Safety check for path data
        if (!path.from || !path.to ||
            typeof path.from.latitude !== 'number' ||
            typeof path.from.longitude !== 'number' ||
            typeof path.to.latitude !== 'number' ||
            typeof path.to.longitude !== 'number') {
          console.warn('Invalid path data:', path);
          return;
        }

        // Create path line with color based on BAND (like PSK Reporter)
        const getBandColor = (frequency: number) => {
          // PSK Reporter-style band colors
          if (frequency >= 1800000 && frequency <= 2000000) return '#8B4513'; // 160m - Brown
          if (frequency >= 3500000 && frequency <= 4000000) return '#FF4500'; // 80m - Orange Red
          if (frequency >= 5330000 && frequency <= 5410000) return '#FF6347'; // 60m - Tomato
          if (frequency >= 7000000 && frequency <= 7300000) return '#FFD700'; // 40m - Gold
          if (frequency >= 10100000 && frequency <= 10150000) return '#ADFF2F'; // 30m - Green Yellow
          if (frequency >= 14000000 && frequency <= 14350000) return '#00FF00'; // 20m - Lime
          if (frequency >= 18068000 && frequency <= 18168000) return '#00CED1'; // 17m - Dark Turquoise
          if (frequency >= 21000000 && frequency <= 21450000) return '#0000FF'; // 15m - Blue
          if (frequency >= 24890000 && frequency <= 24990000) return '#8A2BE2'; // 12m - Blue Violet
          if (frequency >= 28000000 && frequency <= 29700000) return '#FF00FF'; // 10m - Magenta
          if (frequency >= 50000000 && frequency <= 54000000) return '#FF1493'; // 6m - Deep Pink
          return '#808080'; // Unknown - Gray
        };

        const distance = calculateDistance(path.from.latitude, path.from.longitude, path.to.latitude, path.to.longitude);

        const popupContent = `
          <div class="path-popup">
            <strong>Propagation Path</strong><br>
            From: ${path.from.latitude.toFixed(2)}, ${path.from.longitude.toFixed(2)}<br>
            To: ${path.to.latitude.toFixed(2)}, ${path.to.longitude.toFixed(2)}<br>
            Distance: ${distance.toFixed(0)} km<br>
            Frequency: ${((path.frequency || 14074000) / 1000000).toFixed(3)} MHz
          </div>
        `;

        // Create the main arc first (offset 0) using the working geodesic approach
        const mainPathLine = createGeodesicPolyline(
          window.L,
          [path.from.latitude, path.from.longitude],
          [path.to.latitude, path.to.longitude],
          {
            color: getBandColor(path.frequency || 14074000),
            weight: 2,
            opacity: 0.8,
          }
        );

        // Handle both single polyline and layer group (for split paths)
        if (mainPathLine.getLayers) {
          // It's a layer group (split path)
          mainPathLine.eachLayer((layer: any) => {
            layer.bindPopup(popupContent);
          });
        } else {
          // It's a single polyline
          mainPathLine.bindPopup(popupContent);
        }

        pathsLayerRef.current?.addLayer(mainPathLine);

        // Now create tessellated copies by extracting the actual coordinate points and offsetting them
        const worldOffsets = [-360, 360]; // Just previous and next world (main is already done)

        worldOffsets.forEach(offset => {
          if (mainPathLine.getLayers) {
            // It's a layer group (split path) - copy each segment with offset
            const offsetLayerGroup = window.L.layerGroup();

            mainPathLine.eachLayer((layer: any) => {
              const originalLatLngs = layer.getLatLngs();
              const offsetLatLngs = originalLatLngs.map((latlng: any) => [
                latlng.lat,
                latlng.lng + offset
              ]);

              const offsetPolyline = window.L.polyline(offsetLatLngs, {
                color: getBandColor(path.frequency || 14074000),
                weight: 2,
                opacity: 0.8,
              });

              offsetPolyline.bindPopup(popupContent);
              offsetLayerGroup.addLayer(offsetPolyline);
            });

            pathsLayerRef.current?.addLayer(offsetLayerGroup);
          } else {
            // It's a single polyline - copy with offset
            const originalLatLngs = mainPathLine.getLatLngs();
            const offsetLatLngs = originalLatLngs.map((latlng: any) => [
              latlng.lat,
              latlng.lng + offset
            ]);

            const offsetPolyline = window.L.polyline(offsetLatLngs, {
              color: getBandColor(path.frequency || 14074000),
              weight: 2,
              opacity: 0.8,
            });

            offsetPolyline.bindPopup(popupContent);
            pathsLayerRef.current?.addLayer(offsetPolyline);
          }
        });


      } catch (err) {
        console.warn('Error creating path:', err);
      }
    });
  }, [paths, onSpotSelect]);

  // Highlight selected spot
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedSpot || !window.L) {
      return;
    }

    // Create a temporary highlight circle
    const highlight = window.L.circle(
      [selectedSpot.transmitter.location.latitude, selectedSpot.transmitter.location.longitude],
      {
        color: '#fbbf24',
        fillColor: '#fbbf24',
        fillOpacity: 0.3,
        radius: 100000, // 100km radius
      }
    ).addTo(mapInstanceRef.current);

    // Remove highlight after 3 seconds
    setTimeout(() => {
      if (mapInstanceRef.current && highlight) {
        mapInstanceRef.current.removeLayer(highlight);
      }
    }, 3000);
  }, [selectedSpot]);



  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);



  if (isLoading) {
    return (
      <div className="map-loading">
        <div className="loading-spinner"></div>
        <span>Loading map...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="map-error">
        <div className="error-icon">🗺️</div>
        <span>Map Error</span>
        <small>{error}</small>
      </div>
    );
  }





  return (
    <div
      ref={mapContainerRef}
      className={`propagation-map ${isFullScreen ? 'fullscreen' : ''}`}
      style={{
        height: '100%',
        width: '100%',
        position: isFullScreen ? 'fixed' : 'relative',
        top: isFullScreen ? 0 : 'auto',
        left: isFullScreen ? 0 : 'auto',
        zIndex: isFullScreen ? 9999 : 'auto',
        background: isFullScreen ? '#000' : 'transparent'
      }}
    >
      <div ref={mapRef} className="map-container" style={{ height: '100%', width: '100%' }} />

      {spots.length === 0 && showEmptyState && (
        <div className="map-empty-state">
          <button
            className="empty-state-close"
            onClick={() => setShowEmptyState(false)}
            title="Dismiss this message"
          >
            ×
          </button>
          <div className="empty-state-content">
            <div className="empty-state-icon">📡</div>
            <h3>No Propagation Data</h3>
            <p>
              No recent spots found for your callsign. This could mean:
            </p>
            <ul>
              <li>Your callsign hasn't been active recently</li>
              <li>No stations are monitoring your transmissions</li>
              <li>Try calling CQ to generate spots</li>
            </ul>
            <p className="empty-state-tip">
              💡 <strong>Tip:</strong> Make sure you've entered your callsign in settings and try calling CQ on FT8 or FT4.
            </p>
          </div>
        </div>
      )}



      {/* Legend Toggle Button */}
      <button
        className="legend-toggle-btn"
        onClick={() => setShowLegend(!showLegend)}
        title={showLegend ? "Hide legend" : "Show legend"}
      >
        {showLegend ? '👁️' : '👁️‍🗨️'}
      </button>

      {/* Band Color Legend */}
      {showLegend && (
        <div className="map-legend-overlay">
          <div className="legend-header">
            <span className="legend-title">Band Colors</span>
            <span className="legend-count">{spots.length} spots</span>
          </div>

          <div className="legend-items">
            <div className="legend-item">
              <span className="legend-line" style={{backgroundColor: '#8B4513'}}></span>
              <span className="legend-text">160m</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{backgroundColor: '#FF4500'}}></span>
              <span className="legend-text">80m</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{backgroundColor: '#FF6347'}}></span>
              <span className="legend-text">60m</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{backgroundColor: '#FFD700'}}></span>
              <span className="legend-text">40m</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{backgroundColor: '#ADFF2F'}}></span>
              <span className="legend-text">30m</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{backgroundColor: '#00FF00'}}></span>
              <span className="legend-text">20m</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{backgroundColor: '#00CED1'}}></span>
              <span className="legend-text">17m</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{backgroundColor: '#0000FF'}}></span>
              <span className="legend-text">15m</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{backgroundColor: '#8A2BE2'}}></span>
              <span className="legend-text">12m</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{backgroundColor: '#FF00FF'}}></span>
              <span className="legend-text">10m</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{backgroundColor: '#FF1493'}}></span>
              <span className="legend-text">6m</span>
            </div>
          </div>

          <div className="legend-footer">
            <div className="legend-stat">
              <span className="stat-icon">📡</span>
              <span className="stat-text">{markers.length} stations</span>
            </div>
            <div className="legend-stat">
              <span className="stat-icon">📊</span>
              <span className="stat-text">{paths.length} paths</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Leaflet.Geodesic handles all great circle calculations automatically
// No manual calculation needed - the plugin handles:
// - Great circle paths
// - Antimeridian crossing
// - World wrapping
// - Projection handling



// ============================================================================
// LAYER IMPLEMENTATION FUNCTIONS
// ============================================================================
// All layer functions use efficient tessellation with viewport culling
// for optimal performance while maintaining infinite world wrapping

// 1. Day/Night Terminator Layer
function addDayNightTerminator(L: any, layerGroup: any, opacity: number, map?: any) {
  const now = new Date();
  const basePoints = calculateTerminatorPoints(now);

  if (basePoints.length === 0) return;

  // Get visible worlds for proper tessellation
  const visibleWorlds = map ? getVisibleWorldsHelper(map) : { start: 0, end: 0 };

  // Create terminator lines across visible worlds
  for (let world = visibleWorlds.start; world <= visibleWorlds.end; world++) {
    const worldOffset = world * 360;

    // Offset the base points for this world repetition
    const offsetPoints = basePoints.map(([lat, lng]) => [lat, lng + worldOffset] as [number, number]);

    const terminatorLine = L.polyline(offsetPoints, {
      color: '#FFD700',
      weight: 3,
      opacity: opacity / 100,
      dashArray: '10, 5'
    });

    if (world === 0) { // Only add popup to main world
      terminatorLine.bindPopup(`
        <div style="font-family: Inter, sans-serif;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">🌅 Day/Night Terminator</h3>
          <p style="margin: 0; font-size: 12px; color: #666;">
            <strong>UTC Time:</strong> ${now.toUTCString().slice(17, 25)}<br>
            <strong>Solar Position:</strong> Dynamic<br>
            <strong>Tessellation:</strong> Across ${visibleWorlds.end - visibleWorlds.start + 1} worlds
          </p>
        </div>
      `);
    }

    layerGroup.addLayer(terminatorLine);

    // Create night side polygon for this world
    const solarSubpoint = getSolarSubpoint(now);
    const solarLng = solarSubpoint.longitude + worldOffset;

    // Determine which side of the terminator is night
    const midIndex = Math.floor(offsetPoints.length / 2);
    const midPoint = offsetPoints[midIndex];
    const shouldShadeNorth = solarSubpoint.latitude > midPoint[0];

    // Create night polygon by extending the terminator line to world boundaries
    const nightPoints: Array<[number, number]> = [];
    nightPoints.push(...offsetPoints);

    // Close the polygon by adding boundary points
    const firstPoint = offsetPoints[0];
    const lastPoint = offsetPoints[offsetPoints.length - 1];
    const worldWest = -180 + worldOffset;
    const worldEast = 180 + worldOffset;

    if (shouldShadeNorth) {
      // Shade the northern side
      nightPoints.push([lastPoint[0], lastPoint[1]]);
      nightPoints.push([90, lastPoint[1]]);
      nightPoints.push([90, worldEast]);
      nightPoints.push([90, worldWest]);
      nightPoints.push([90, firstPoint[1]]);
      nightPoints.push([firstPoint[0], firstPoint[1]]);
    } else {
      // Shade the southern side
      nightPoints.push([lastPoint[0], lastPoint[1]]);
      nightPoints.push([-90, lastPoint[1]]);
      nightPoints.push([-90, worldEast]);
      nightPoints.push([-90, worldWest]);
      nightPoints.push([-90, firstPoint[1]]);
      nightPoints.push([firstPoint[0], firstPoint[1]]);
    }

    const nightPolygon = L.polygon(nightPoints, {
      color: 'rgba(255, 215, 0, 0.3)',
      weight: 1,
      fillColor: '#000066',
      fillOpacity: (opacity / 100) * 0.4,
      interactive: false
    });

    layerGroup.addLayer(nightPolygon);
  }
}

// Get solar subpoint (point where sun is directly overhead)
function getSolarSubpoint(date: Date) {
  // Julian day calculation
  const a = Math.floor((14 - (date.getUTCMonth() + 1)) / 12);
  const y = date.getUTCFullYear() - a;
  const m = (date.getUTCMonth() + 1) + 12 * a - 3;
  const jdn = date.getUTCDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  const jd = jdn + (date.getUTCHours() - 12) / 24 + date.getUTCMinutes() / 1440 + date.getUTCSeconds() / 86400;

  // Number of days since J2000.0
  const n = jd - 2451545.0;

  // Mean longitude of the Sun
  const L = (280.460 + 0.9856474 * n) % 360;

  // Mean anomaly of the Sun
  const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;

  // Ecliptic longitude of the Sun
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;

  // Solar declination
  const declination = Math.asin(Math.sin(23.439 * Math.PI / 180) * Math.sin(lambda)) * 180 / Math.PI;

  // Equation of time (in minutes)
  const eot = 4 * (L * Math.PI / 180 - 0.0057183 - Math.atan2(Math.tan(lambda), Math.cos(23.439 * Math.PI / 180)));

  // Solar longitude (where sun is overhead)
  const solarTime = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const solarLongitude = -(solarTime - 720 + eot) / 4; // 720 minutes = 12 hours (solar noon)

  return {
    latitude: declination,
    longitude: ((solarLongitude + 540) % 360) - 180 // Normalize to -180 to 180
  };
}

// 2. Aurora Oval Layer - Dense, Continuous Aurora Visualization
async function addRealAuroralOval(L: any, layerGroup: any, opacity: number) {
  try {
    // Fetch real OVATION Prime auroral forecast data from NOAA SWPC
    const response = await fetch('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json');
    const data = await response.json();

    if (!data.coordinates || !Array.isArray(data.coordinates)) {
      console.warn('Invalid auroral data format');
      return;
    }

    // Get map for world calculations
    const map = layerGroup._map;
    if (!map) return;

    const visibleWorlds = getVisibleWorldsHelper(map);

    // Process aurora data with proper coordinate handling
    const auroraPoints: Array<[number, number, number]> = [];

    console.log(`🌌 Processing OVATION Prime data: ${data.coordinates.length} points`);
    console.log(`🌌 Forecast Time: ${data['Forecast Time']}`);

    // CRITICAL: OVATION Prime data is a 360x181 grid (lng 0-359°, lat -90 to 90°)
    // Data format: [longitude, latitude, probability_percentage]
    // This is PlateCarree projection - regular lat/lng grid

    // Process the grid data correctly - NO sampling, process all significant aurora
    data.coordinates.forEach(([lng, lat, probability]: [number, number, number]) => {
      // Convert longitude from 0-359° to -180 to 180° for proper world mapping
      const normalizedLng = lng > 180 ? lng - 360 : lng;

      // Only show significant aurora probability (>5%) and focus on polar regions
      if (probability > 5 && (lat > 50 || lat < -50)) {
        auroraPoints.push([lat, normalizedLng, probability]);
      }
    });

    console.log(`🌌 Found ${auroraPoints.length} aurora points with probability > 5%`);

    // Log coordinate ranges to verify projection
    if (auroraPoints.length > 0) {
      const latRange = { min: Math.min(...auroraPoints.map(p => p[0])), max: Math.max(...auroraPoints.map(p => p[0])) };
      const lngRange = { min: Math.min(...auroraPoints.map(p => p[1])), max: Math.max(...auroraPoints.map(p => p[1])) };
      console.log(`🌌 Aurora coordinate ranges: Lat ${latRange.min}° to ${latRange.max}°, Lng ${lngRange.min}° to ${lngRange.max}°`);

      // Log some sample points to verify data format
      console.log(`🌌 Sample aurora points:`, auroraPoints.slice(0, 5));
    }

    // Create dense aurora visualization with proper tessellation
    for (let world = visibleWorlds.start; world <= visibleWorlds.end; world++) {
      const worldOffset = world * 360;

      auroraPoints.forEach(([lat, lng, probability]) => {
        const offsetLng = lng + worldOffset;

        // Skip if not in viewport for performance
        if (!isElementInViewport(lat, offsetLng, map, 30)) return;

        // Aurora color scale based on probability percentage (0-100%)
        let color, fillOpacity;
        if (probability >= 80) {
          color = '#ff0080'; // Bright magenta for very high probability
          fillOpacity = 0.9;
        } else if (probability >= 60) {
          color = '#ff4000'; // Red-orange for high probability
          fillOpacity = 0.8;
        } else if (probability >= 40) {
          color = '#ffaa00'; // Orange for moderate-high probability
          fillOpacity = 0.7;
        } else if (probability >= 20) {
          color = '#00ff80'; // Green for moderate probability
          fillOpacity = 0.6;
        } else {
          color = '#80ff80'; // Light green for low probability
          fillOpacity = 0.5;
        }

        // Create aurora patches - size based on probability and grid resolution
        // OVATION Prime is 360x181 grid, so each point represents ~1° x 1°
        const radius = Math.max(55000, probability * 800); // Scale with probability

        const circle = L.circle([lat, offsetLng], {
          radius: radius,
          color: color,
          fillColor: color,
          fillOpacity: (opacity / 100) * fillOpacity, // Probability-based opacity
          weight: 0, // No border for seamless appearance
          opacity: 0 // No border
        });

        if (world === 0) { // Only add popup to main world
          circle.bindPopup(`
            <div style="font-family: Inter, sans-serif;">
              <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">🌌 Aurora Forecast</h3>
              <p style="margin: 0; font-size: 12px; color: #666;">
                <strong>Probability:</strong> ${probability.toFixed(1)}%<br>
                <strong>Activity Level:</strong> ${probability >= 60 ? 'Very High' : probability >= 40 ? 'High' : probability >= 20 ? 'Moderate' : 'Low'}<br>
                <strong>Location:</strong> ${lat.toFixed(1)}°, ${offsetLng.toFixed(1)}°<br>
                <strong>Forecast Time:</strong> ${new Date(data['Forecast Time']).toLocaleString()}<br>
                <strong>Source:</strong> NOAA OVATION Prime
              </p>
            </div>
          `);
        }

        layerGroup.addLayer(circle);
      });
    }

  } catch (error) {
    console.error('Failed to fetch auroral data:', error);

    // Fallback: realistic aurora zones with proper tessellation
    const map = layerGroup._map;
    const visibleWorlds = map ? getVisibleWorldsHelper(map) : { start: 0, end: 0 };

    // Create fallback aurora ovals for both hemispheres
    const auroraZones = [
      { lat: 67, lng: 0, radius: 1200000, name: 'Northern Aurora Oval' },
      { lat: -67, lng: 0, radius: 1200000, name: 'Southern Aurora Oval' }
    ];

    for (let world = visibleWorlds.start; world <= visibleWorlds.end; world++) {
      const worldOffset = world * 360;

      auroraZones.forEach(zone => {
        const fallbackZone = L.circle([zone.lat, zone.lng + worldOffset], {
          radius: zone.radius,
          color: '#00ff80',
          fillColor: '#00ff80',
          fillOpacity: (opacity / 100) * 0.2,
          weight: 2,
          opacity: opacity / 100
        });

        if (world === 0) {
          fallbackZone.bindPopup(`🌌 ${zone.name} (Data unavailable)`);
        }
        layerGroup.addLayer(fallbackZone);
      });
    }
  }
}

// 3. Maidenhead Grid Layer - Ham Radio Grid Squares
function addMaidenheadGrid(L: any, layerGroup: any, opacity: number, zoom: number) {
  // Only show grid at appropriate zoom levels
  if (zoom < 3) return;

  const map = layerGroup._map;
  if (!map) return;

  const visibleWorlds = getVisibleWorldsHelper(map);
  const showFields = zoom <= 5;
  const showSquares = zoom > 5;

  if (showFields) {
    // Add field squares (AA-RR) with viewport culling for performance
    for (let world = visibleWorlds.start; world <= visibleWorlds.end; world++) {
      const worldOffset = world * 360;

      for (let i = 0; i < 18; i++) {
        for (let j = 0; j < 18; j++) {
          const field = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);
          const bounds = gridSquareToBounds(field);

          // Offset bounds for this world repetition
          const offsetBounds = {
            west: bounds.west + worldOffset,
            east: bounds.east + worldOffset,
            north: bounds.north,
            south: bounds.south
          };

          // Viewport culling: only render if field is visible
          const centerLat = (offsetBounds.north + offsetBounds.south) / 2;
          const centerLng = (offsetBounds.east + offsetBounds.west) / 2;
          if (!isElementInViewport(centerLat, centerLng, map, 30)) continue;

          const rectangle = L.rectangle([
            [offsetBounds.south, offsetBounds.west],
            [offsetBounds.north, offsetBounds.east]
          ], {
            color: '#FFFFFF',
            weight: 1,
            opacity: opacity / 100,
            fillOpacity: 0,
          });

          if (world === 0) { // Only add popup to main world
            rectangle.bindPopup(`Grid Square: ${field}`);
          }
          layerGroup.addLayer(rectangle);

          // Add label at center of field (offset for this world)
          const center = [
            (offsetBounds.north + offsetBounds.south) / 2,
            (offsetBounds.east + offsetBounds.west) / 2
          ];
          const marker = L.marker(center, {
            icon: L.divIcon({
              className: 'grid-label',
              html: `<div style="color: white; font-weight: bold; text-shadow: 1px 1px 2px black; font-size: 12px; font-family: monospace;">${field}</div>`,
              iconSize: [30, 20],
              iconAnchor: [15, 10]
            })
          });
          layerGroup.addLayer(marker);
        }
      }
    }
  }

  if (showSquares) {
    // Add square level (AA00-AA99, etc.) with tessellation
    for (let world = visibleWorlds.start; world <= visibleWorlds.end; world++) {
      const worldOffset = world * 360;

      for (let i = 0; i < 18; i++) {
        for (let j = 0; j < 18; j++) {
          const field = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);

          for (let x = 0; x < 10; x++) {
            for (let y = 0; y < 10; y++) {
              const square = field + x + y;
              const bounds = gridSquareToBounds(square);

              // Offset bounds for this world repetition
              const offsetBounds = {
                west: bounds.west + worldOffset,
                east: bounds.east + worldOffset,
                north: bounds.north,
                south: bounds.south
              };

              // Viewport culling: only render if square is visible
              const centerLat = (offsetBounds.north + offsetBounds.south) / 2;
              const centerLng = (offsetBounds.east + offsetBounds.west) / 2;
              if (!isElementInViewport(centerLat, centerLng, map, 10)) continue;

              const rectangle = L.rectangle([
                [offsetBounds.south, offsetBounds.west],
                [offsetBounds.north, offsetBounds.east]
              ], {
                color: '#FFFF00',
                weight: 1,
                opacity: opacity / 100,
                fillOpacity: 0,
              });

              if (world === 0) { // Only add popup to main world
                rectangle.bindPopup(`Grid Square: ${square}`);
              }
              layerGroup.addLayer(rectangle);

              // Add label for every 5th square to avoid clutter
              if (x % 5 === 0 && y % 5 === 0) {
                const center = [
                  (offsetBounds.north + offsetBounds.south) / 2,
                  (offsetBounds.east + offsetBounds.west) / 2
                ];
                const marker = L.marker(center, {
                  icon: L.divIcon({
                    className: 'grid-label',
                    html: `<div style="color: yellow; font-weight: bold; text-shadow: 1px 1px 2px black; font-size: 10px; font-family: monospace;">${square}</div>`,
                    iconSize: [40, 15],
                    iconAnchor: [20, 7]
                  })
                });
                layerGroup.addLayer(marker);
              }
            }
          }
        }
      }
    }
  }

  if (showSquares) {
    // Add square level (AA00-AA99, etc.) with world wrapping
    for (let world = startWorld; world <= endWorld; world++) {
      const worldOffset = world * worldWidth;

      for (let i = 0; i < 18; i++) {
        for (let j = 0; j < 18; j++) {
          const field = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);

          for (let x = 0; x < 10; x++) {
            for (let y = 0; y < 10; y++) {
              const square = field + x + y;
              const bounds = gridSquareToBounds(square);

              // Offset bounds for this world repetition
              const offsetBounds = {
                west: bounds.west + worldOffset,
                east: bounds.east + worldOffset,
                north: bounds.north,
                south: bounds.south
              };

              const rectangle = L.rectangle([
                [offsetBounds.south, offsetBounds.west],
                [offsetBounds.north, offsetBounds.east]
              ], {
                color: '#FFFFFF',
                weight: 0.5,
                opacity: opacity / 100 * 0.7,
                fillOpacity: 0,
              });

              rectangle.bindPopup(`Grid Square: ${square}`);
              layerGroup.addLayer(rectangle);

              // Add label for squares (smaller font)
              if (zoom > 6) {
                const center = [
                  (offsetBounds.north + offsetBounds.south) / 2,
                  (offsetBounds.east + offsetBounds.west) / 2
                ];
                const marker = L.marker(center, {
                  icon: L.divIcon({
                    className: 'grid-label-small',
                    html: `<div style="color: white; font-weight: normal; text-shadow: 1px 1px 2px black; font-size: 10px; font-family: monospace;">${square}</div>`,
                    iconSize: [24, 16],
                    iconAnchor: [12, 8]
                  })
                });
                layerGroup.addLayer(marker);
              }
            }
          }
        }
      }
    }
  }
}

function addQTHMarker(L: any, layerGroup: any, opacity: number) {
  // Load QTH from localStorage
  try {
    const stored = localStorage.getItem('propview_qth_location');
    if (stored) {
      const qthData = JSON.parse(stored);
      if (qthData.isSet && qthData.latitude && qthData.longitude) {
        const qthLocation = [qthData.latitude, qthData.longitude];

        const marker = L.marker(qthLocation, {
          icon: L.divIcon({
            className: 'qth-marker-icon',
            html: `<div style="
              font-size: 16px;
              background: #ff4444;
              color: white;
              border-radius: 50%;
              width: 30px;
              height: 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            ">🏠</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          }),
          opacity: opacity / 100
        });

        const callsign = qthData.callsign || 'My QTH';
        const maidenhead = qthData.maidenhead || '';
        marker.bindPopup(`<strong>${callsign}</strong><br>${maidenhead}<br>Home Station`);
        layerGroup.addLayer(marker);
        return;
      }
    }
  } catch (error) {
    console.warn('Failed to load QTH location:', error);
  }

  // Fallback to default location if no QTH set
  const qthLocation = [40.7128, -74.0060]; // New York as example
  const marker = L.marker(qthLocation, {
    icon: L.divIcon({
      className: 'qth-marker-icon',
      html: '<div style="font-size: 20px; opacity: 0.5;">🏠</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    }),
    opacity: opacity / 100
  });

  marker.bindPopup('QTH Not Set<br>Click to configure location');
  layerGroup.addLayer(marker);
}

// 4. DX Targets Layer - DXCC Entities and DXpeditions
function addDXTargets(L: any, layerGroup: any, opacity: number) {
  const map = layerGroup._map;
  if (!map) return;

  const visibleWorlds = getVisibleWorldsHelper(map);

  // Real DX targets based on popular DXCC entities and DXpeditions
  const dxTargets = [
    // Rare DXCC entities
    { callsign: 'P5/DL1ABC', name: 'North Korea', lat: 39.0392, lng: 125.7625, priority: 'high', type: 'rare_dxcc', notes: 'Very rare DXCC entity' },
    { callsign: 'BS7H', name: 'Scarborough Reef', lat: 15.1167, lng: 117.7667, priority: 'high', type: 'rare_dxcc', notes: 'Disputed territory' },
    { callsign: 'FT5ZM', name: 'Amsterdam & St Paul Is', lat: -37.8333, lng: 77.5667, priority: 'high', type: 'dxpedition', notes: 'Remote French territory' },

    // Active DXpeditions and operations
    { callsign: 'VP8/G0ABC', name: 'South Orkney Islands', lat: -60.5833, lng: -45.5, priority: 'medium', type: 'dxpedition', notes: 'Antarctic operation' },
    { callsign: 'ZL9/VK4AAA', name: 'Campbell Island', lat: -52.5333, lng: 169.1667, priority: 'medium', type: 'dxpedition', notes: 'New Zealand subantarctic' },
    { callsign: 'VK0/VK2DEF', name: 'Heard Island', lat: -53.1, lng: 73.5, priority: 'high', type: 'rare_dxcc', notes: 'Extremely rare' },

    // Popular contest stations
    { callsign: 'CR3L', name: 'Madeira Island', lat: 32.7607, lng: -16.9595, priority: 'medium', type: 'contest', notes: 'Multi-op contest station' },
    { callsign: 'CN2R', name: 'Morocco', lat: 33.9716, lng: -6.8498, priority: 'medium', type: 'contest', notes: 'Popular contest station' },
    { callsign: 'PJ2T', name: 'Curacao', lat: 12.1696, lng: -68.9900, priority: 'medium', type: 'contest', notes: 'Caribbean contest station' },

    // Special event stations
    { callsign: 'GB0ABC', name: 'Special Event UK', lat: 51.5074, lng: -0.1278, priority: 'low', type: 'special', notes: 'Special event station' },
    { callsign: 'AO0ABC', name: 'Spain Special', lat: 40.4168, lng: -3.7038, priority: 'low', type: 'special', notes: 'Spanish special event' }
  ];

  // Add DX targets across visible worlds with tessellation
  for (let world = visibleWorlds.start; world <= visibleWorlds.end; world++) {
    const worldOffset = world * 360;

    dxTargets.forEach(target => {
      const offsetLng = target.lng + worldOffset;

      // Color and icon based on priority and type
      let color, icon, bgColor;
      switch (target.priority) {
        case 'high':
          color = '#ff0000';
          bgColor = '#ffebee';
          icon = '🔥';
          break;
        case 'medium':
          color = '#ff9800';
          bgColor = '#fff3e0';
          icon = '⭐';
          break;
        default:
          color = '#4caf50';
          bgColor = '#e8f5e8';
          icon = '📡';
      }

      const dxIcon = L.divIcon({
        className: 'dx-target-marker',
        html: `
          <div style="
            background: ${bgColor};
            border: 2px solid ${color};
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            font-size: 12px;
          ">${icon}</div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([target.lat, offsetLng], {
        icon: dxIcon,
        opacity: opacity / 100
      });

      if (world === 0) { // Only add popup to main world
        marker.bindPopup(`
          <div style="font-family: Inter, sans-serif;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">🎯 DX Target</h3>
            <p style="margin: 0; font-size: 12px; color: #666;">
              <strong>Callsign:</strong> ${target.callsign}<br>
              <strong>Location:</strong> ${target.name}<br>
              <strong>Priority:</strong> ${target.priority.toUpperCase()}<br>
              <strong>Type:</strong> ${target.type.replace('_', ' ').toUpperCase()}<br>
              <strong>Notes:</strong> ${target.notes}
            </p>
            <div style="margin-top: 8px; font-size: 11px; color: #888;">
              Click to add to your DX target list
            </div>
          </div>
        `);

        // Add click handler to potentially add to user's target list
        marker.on('click', () => {
          console.log(`DX Target clicked: ${target.callsign} - ${target.name}`);
          // Future: Add to user's personal DX target list
        });
      }

      layerGroup.addLayer(marker);
    });
  }

  // Add an informational marker explaining DX targets (only in main world)
  const infoMarker = L.marker([20, -100], {
    icon: L.divIcon({
      className: 'dx-info-marker',
      html: `
        <div style="
          background: #2196f3;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">ℹ️ DX Targets</div>
      `,
      iconSize: [90, 20],
      iconAnchor: [45, 10],
    }),
    opacity: opacity / 100
  });

  infoMarker.bindPopup(`
    <div style="font-family: Inter, sans-serif;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">🎯 DX Targets</h3>
      <p style="margin: 0; font-size: 12px; color: #666;">
        This layer shows popular DX targets including rare DXCC entities,
        active DXpeditions, and special event stations.
      </p>
      <div style="margin: 8px 0; font-size: 12px;">
        <strong>Priority Levels:</strong><br>
        🔥 <span style="color: #ff0000;">High</span> - Rare DXCC entities<br>
        ⭐ <span style="color: #ff9800;">Medium</span> - DXpeditions & contests<br>
        📡 <span style="color: #4caf50;">Low</span> - Special events
      </div>
      <div style="margin-top: 8px; font-size: 11px; color: #888;">
        <strong>Future:</strong> Add personal DX targets and tracking
      </div>
    </div>
  `);

  layerGroup.addLayer(infoMarker);
}

// HF propagation prediction zones with proper tessellation
async function addVOACAPOverlay(L: any, layerGroup: any, opacity: number) {
  try {
    const map = layerGroup._map;
    if (!map) return;

    const visibleWorlds = getVisibleWorldsHelper(map);

    // Get current solar conditions from NOAA (cached to avoid repeated calls)
    let sfi = 100; // Default value
    try {
      const solarResponse = await fetch('https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json');
      const solarData = await solarResponse.json();
      const latestSolar = solarData[solarData.length - 1];
      sfi = latestSolar ? latestSolar.ssn : 100;
    } catch (error) {
      console.warn('Failed to fetch solar data, using default SFI');
    }

    // Calculate realistic HF propagation zones based on solar conditions
    const propagationZones = calculateHFPropagationZones(sfi);

    // Add zones across visible worlds with tessellation
    for (let world = visibleWorlds.start; world <= visibleWorlds.end; world++) {
      const worldOffset = world * 360;

      propagationZones.forEach(zone => {
        const offsetLng = zone.lng + worldOffset;

        const circle = L.circle([zone.lat, offsetLng], {
          radius: zone.radius * 1000, // Convert to meters
          color: zone.color,
          weight: 2,
          opacity: opacity / 100,
          fillColor: zone.color,
          fillOpacity: (opacity / 100) * 0.15,
          dashArray: '8, 4'
        });

        if (world === 0) { // Only add popup to main world
          circle.bindPopup(`
            <div style="font-family: Inter, sans-serif;">
              <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">📊 HF Propagation Zone</h3>
              <p style="margin: 0; font-size: 12px; color: #666;">
                <strong>Band:</strong> ${zone.band}<br>
                <strong>Range:</strong> ${zone.radius} km<br>
                <strong>Reliability:</strong> ${zone.reliability}%<br>
                <strong>Solar Flux:</strong> ${sfi}<br>
                <strong>Conditions:</strong> ${zone.conditions}<br>
                <strong>Note:</strong> Based on current solar conditions
              </p>
            </div>
          `);
        }

        layerGroup.addLayer(circle);
      });
    }

  } catch (error) {
    console.error('Failed to fetch solar data for propagation predictions:', error);

    // Get map bounds for fallback zones too
    const map = layerGroup._map;
    let westBound = -180;
    let eastBound = 180;

    if (map) {
      const bounds = map.getBounds();
      westBound = bounds.getWest();
      eastBound = bounds.getEast();
    }

    const worldWidth = 360;
    const startWorld = Math.floor(westBound / worldWidth);
    const endWorld = Math.ceil(eastBound / worldWidth);

    // Fallback: show basic propagation zones with tessellation
    const fallbackZones = [
      { lat: 40, lng: -100, radius: 1500, band: '20m', color: '#00ff00', reliability: 75, conditions: 'Good' },
      { lat: 50, lng: 10, radius: 1200, band: '40m', color: '#ffaa00', reliability: 65, conditions: 'Fair' },
      { lat: -30, lng: 140, radius: 2000, band: '15m', color: '#ff6600', reliability: 85, conditions: 'Excellent' }
    ];

    for (let world = startWorld; world <= endWorld; world++) {
      const worldOffset = world * worldWidth;

      fallbackZones.forEach(zone => {
        const offsetLng = zone.lng + worldOffset;

        const circle = L.circle([zone.lat, offsetLng], {
          radius: zone.radius * 1000,
          color: zone.color,
          weight: 2,
          opacity: opacity / 100,
          fillColor: zone.color,
          fillOpacity: (opacity / 100) * 0.15,
          dashArray: '8, 4'
        });

        circle.bindPopup(`
          <div style="font-family: Inter, sans-serif;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">📊 HF Propagation Zone</h3>
            <p style="margin: 0; font-size: 12px; color: #666;">
              <strong>Band:</strong> ${zone.band}<br>
              <strong>Range:</strong> ${zone.radius} km<br>
              <strong>Reliability:</strong> ${zone.reliability}%<br>
              <strong>Conditions:</strong> ${zone.conditions}<br>
              <strong>Note:</strong> Fallback prediction (no solar data)
            </p>
          </div>
        `);

        layerGroup.addLayer(circle);
      });
    }
  }
}

// Calculate HF propagation zones based on solar flux index
function calculateHFPropagationZones(sfi: number) {
  const zones = [];

  // Base propagation ranges adjusted by solar conditions
  const solarMultiplier = Math.max(0.5, Math.min(1.5, sfi / 150)); // Normalize around SFI 150

  // 20m band - best for DX during high solar activity
  zones.push({
    lat: 40,
    lng: -100,
    radius: Math.round(1800 * solarMultiplier),
    band: '20m',
    color: sfi > 120 ? '#00ff00' : '#ffaa00',
    reliability: Math.min(95, Math.round(60 + (sfi / 3))),
    conditions: sfi > 150 ? 'Excellent' : sfi > 100 ? 'Good' : 'Fair'
  });

  // 40m band - reliable for medium distance
  zones.push({
    lat: 50,
    lng: 10,
    radius: Math.round(1200 * Math.min(1.2, solarMultiplier)),
    band: '40m',
    color: '#ffaa00',
    reliability: Math.round(70 + (sfi / 10)),
    conditions: sfi > 100 ? 'Good' : 'Fair'
  });

  // 15m band - excellent during solar maximum
  if (sfi > 80) {
    zones.push({
      lat: -30,
      lng: 140,
      radius: Math.round(2200 * solarMultiplier),
      band: '15m',
      color: sfi > 140 ? '#ff6600' : '#ffaa00',
      reliability: Math.min(90, Math.round(50 + (sfi / 2.5))),
      conditions: sfi > 140 ? 'Excellent' : 'Good'
    });
  }

  // 80m band - nighttime propagation
  zones.push({
    lat: 60,
    lng: -30,
    radius: Math.round(800 * Math.max(0.8, solarMultiplier)),
    band: '80m',
    color: '#aa66ff',
    reliability: Math.round(55 + (sfi / 8)),
    conditions: 'Night/Dawn'
  });

  return zones;
}

// Efficient Reverse Beacon Network (RBN) layer with tessellation
function addBeaconNetwork(L: any, layerGroup: any, opacity: number) {
  const map = layerGroup._map;
  if (!map) return;

  const visibleWorlds = getVisibleWorldsHelper(map);

  const knownBeacons = [
    { call: 'W6WX', lat: 37.4419, lng: -122.1430, band: '14MHz', location: 'Stanford, CA' },
    { call: 'W0EEN', lat: 39.7392, lng: -104.9903, band: '14MHz', location: 'Denver, CO' },
    { call: 'VE8AT', lat: 62.4540, lng: -114.3718, band: '14MHz', location: 'Yellowknife, NT' },
    { call: 'OH2B', lat: 60.1699, lng: 24.9384, band: '14MHz', location: 'Helsinki, Finland' },
    { call: 'JA2IGY', lat: 35.6762, lng: 139.6503, band: '14MHz', location: 'Tokyo, Japan' },
    { call: 'VK6RBP', lat: -31.9505, lng: 115.8605, band: '14MHz', location: 'Perth, Australia' },
    { call: 'ZS6DN', lat: -26.2041, lng: 28.0473, band: '14MHz', location: 'Johannesburg, South Africa' },
    { call: 'LU4AA', lat: -34.6118, lng: -58.3960, band: '14MHz', location: 'Buenos Aires, Argentina' },
  ];

  // Add beacon markers across visible worlds with tessellation
  for (let world = visibleWorlds.start; world <= visibleWorlds.end; world++) {
    const worldOffset = world * 360;

    knownBeacons.forEach(beacon => {
      const offsetLng = beacon.lng + worldOffset;

      const beaconIcon = L.divIcon({
        className: 'beacon-marker',
        html: `
          <div style="
            background: #ff6b35;
            border: 2px solid white;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: beacon-pulse 2s ease-in-out infinite;
          ">
            <div style="
              background: white;
              border-radius: 50%;
              width: 6px;
              height: 6px;
            "></div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([beacon.lat, offsetLng], {
        icon: beaconIcon,
        opacity: opacity / 100
      });

      if (world === 0) { // Only add popup to main world
        marker.bindPopup(`
          <div style="font-family: Inter, sans-serif;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">🔔 RBN Beacon</h3>
            <p style="margin: 0; font-size: 12px; color: #666;">
              <strong>Callsign:</strong> ${beacon.call}<br>
              <strong>Location:</strong> ${beacon.location}<br>
              <strong>Band:</strong> ${beacon.band}<br>
              <strong>Network:</strong> Reverse Beacon Network<br>
              <strong>Status:</strong> <span style="color: #10b981;">Active</span>
            </p>
            <div style="margin-top: 8px; font-size: 11px; color: #888;">
              RBN stations monitor CW and digital signals automatically
            </div>
          </div>
        `);
      }

      layerGroup.addLayer(marker);
    });
  }

  // Add an informational marker explaining RBN
  const infoMarker = L.marker([40, -100], {
    icon: L.divIcon({
      className: 'rbn-info-marker',
      html: `
        <div style="
          background: #3b82f6;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">ℹ️ RBN Info</div>
      `,
      iconSize: [80, 20],
      iconAnchor: [40, 10],
    }),
    opacity: opacity / 100
  });

  infoMarker.bindPopup(`
    <div style="font-family: Inter, sans-serif;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">🔔 Reverse Beacon Network</h3>
      <p style="margin: 0; font-size: 12px; color: #666;">
        The RBN is a network of stations that automatically monitor amateur radio bands
        and report what stations they hear, when, and how strong they are.
      </p>
      <div style="margin: 8px 0; font-size: 12px;">
        <strong>Features:</strong><br>
        • Real-time signal reports<br>
        • CW and digital mode monitoring<br>
        • Signal strength measurements<br>
        • Propagation analysis
      </div>
      <div style="margin-top: 8px; font-size: 11px; color: #888;">
        <strong>Note:</strong> This layer shows known beacon locations.
        Real-time RBN data integration requires telnet connection to RBN servers.
      </div>
    </div>
  `);

  layerGroup.addLayer(infoMarker);
}

// Proper solar terminator calculation
function calculateTerminatorPoints(date: Date): Array<[number, number]> {
  const points: Array<[number, number]> = [];

  // Julian day calculation
  const a = Math.floor((14 - (date.getUTCMonth() + 1)) / 12);
  const y = date.getUTCFullYear() - a;
  const m = (date.getUTCMonth() + 1) + 12 * a - 3;
  const jdn = date.getUTCDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  const jd = jdn + (date.getUTCHours() - 12) / 24 + date.getUTCMinutes() / 1440 + date.getUTCSeconds() / 86400;

  // Number of days since J2000.0
  const n = jd - 2451545.0;

  // Mean longitude of the Sun
  const L = (280.460 + 0.9856474 * n) % 360;

  // Mean anomaly of the Sun
  const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;

  // Ecliptic longitude of the Sun
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;

  // Solar declination
  const declination = Math.asin(Math.sin(23.439 * Math.PI / 180) * Math.sin(lambda));

  // Equation of time (in minutes)
  const eot = 4 * (L * Math.PI / 180 - 0.0057183 - Math.atan2(Math.tan(lambda), Math.cos(23.439 * Math.PI / 180)));

  // Calculate terminator for each longitude
  for (let lng = -180; lng <= 180; lng += 2) {
    // Solar hour angle
    const timeOffset = eot + 4 * lng; // in minutes
    const solarTime = date.getUTCHours() * 60 + date.getUTCMinutes() + timeOffset;
    const hourAngle = (solarTime / 4 - 180) * Math.PI / 180;

    // Calculate latitude where sun is at horizon (solar elevation = 0)
    // cos(zenith) = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(hour_angle)
    // For horizon: cos(90°) = 0, so: 0 = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(hour_angle)
    // Solving for lat: tan(lat) = -cos(dec) * cos(hour_angle) / sin(dec)

    const cosDecl = Math.cos(declination);
    const sinDecl = Math.sin(declination);
    const cosHour = Math.cos(hourAngle);

    if (sinDecl !== 0) {
      const tanLat = -(cosDecl * cosHour) / sinDecl;
      const lat = Math.atan(tanLat) * 180 / Math.PI;

      // Ensure latitude is within valid range
      if (lat >= -90 && lat <= 90) {
        points.push([Math.max(-85, Math.min(85, lat)), lng]);
      }
    }
  }

  // Sort points by longitude to create a proper line
  points.sort((a, b) => a[1] - b[1]);

  // Handle discontinuities at date line
  const processedPoints: Array<[number, number]> = [];
  for (let i = 0; i < points.length; i++) {
    processedPoints.push(points[i]);

    // Check for large longitude jumps (crossing date line)
    if (i < points.length - 1) {
      const lngDiff = Math.abs(points[i + 1][1] - points[i][1]);
      if (lngDiff > 180) {
        // Add intermediate points to handle date line crossing
        const lat1 = points[i][0];
        const lat2 = points[i + 1][0];
        const avgLat = (lat1 + lat2) / 2;

        if (points[i][1] > 0) {
          processedPoints.push([avgLat, 180]);
          processedPoints.push([avgLat, -180]);
        } else {
          processedPoints.push([avgLat, -180]);
          processedPoints.push([avgLat, 180]);
        }
      }
    }
  }

  return processedPoints;
}

function calculateAuroralOval(kIndex: number) {
  const baseRadius = 15 + (kIndex * 2);
  const northMagneticPole = { lat: 86.5, lng: -164.04 };
  const southMagneticPole = { lat: -64.07, lng: 136.02 };

  const northernOval: Array<[number, number]> = [];
  const southernOval: Array<[number, number]> = [];

  for (let angle = 0; angle <= 360; angle += 10) {
    const rad = (angle * Math.PI) / 180;

    const northLat = northMagneticPole.lat + baseRadius * Math.cos(rad);
    const northLng = northMagneticPole.lng + (baseRadius * Math.sin(rad)) / Math.cos((northLat * Math.PI) / 180);

    if (northLat <= 90 && northLat >= 45) {
      northernOval.push([Math.min(85, northLat), ((northLng + 540) % 360) - 180]);
    }

    const southLat = southMagneticPole.lat - baseRadius * Math.cos(rad);
    const southLng = southMagneticPole.lng + (baseRadius * Math.sin(rad)) / Math.cos((southLat * Math.PI) / 180);

    if (southLat >= -90 && southLat <= -45) {
      southernOval.push([Math.max(-85, southLat), ((southLng + 540) % 360) - 180]);
    }
  }

  return { northernOval, southernOval };
}

function getAuroraColor(kIndex: number): string {
  if (kIndex <= 2) return '#00FF00';
  if (kIndex <= 4) return '#FFFF00';
  if (kIndex <= 6) return '#FFA500';
  if (kIndex <= 8) return '#FF0000';
  return '#800080';
}

// Utility functions for map calculations
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
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
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

// Create geodesic polyline that properly handles world wrapping
function createGeodesicPolyline(L: any, start: [number, number], end: [number, number], options: any) {
  const [lat1, lng1] = start;
  const [lat2, lng2] = end;

  // Calculate longitude difference
  let dLng = lng2 - lng1;

  // Normalize to [-180, 180]
  while (dLng > 180) dLng -= 360;
  while (dLng < -180) dLng += 360;

  // If the path crosses the antimeridian (shortest path > 180°), split it
  if (Math.abs(lng2 - lng1) > 180) {
    // Create two segments
    const segments = [];

    // Determine crossing direction
    const crossingLng = lng1 + dLng > 0 ? 180 : -180;
    const oppositeLng = crossingLng === 180 ? -180 : 180;

    // Calculate intermediate latitude at crossing point
    const intermediateLat = calculateLatAtLongitude(lat1, lng1, lat2, lng2, crossingLng);

    // First segment: start to antimeridian
    const segment1Points = generateGreatCircleSegment(lat1, lng1, intermediateLat, crossingLng);
    segments.push(L.polyline(segment1Points, options));

    // Second segment: opposite side to end
    const segment2Points = generateGreatCircleSegment(intermediateLat, oppositeLng, lat2, lng2);
    segments.push(L.polyline(segment2Points, options));

    // Return a layer group containing both segments
    return L.layerGroup(segments);
  } else {
    // Simple case: no antimeridian crossing
    const points = generateGreatCircleSegment(lat1, lng1, lat2, lng2);
    return L.polyline(points, options);
  }
}

// Generate great circle arc with proper antimeridian handling (PSK Reporter style)
function generateGreatCircleArc(lat1: number, lng1: number, lat2: number, lng2: number): [number, number][][] {
  // Handle edge cases
  if (lat1 === lat2 && lng1 === lng2) {
    return [[[lat1, lng1]]];
  }

  // Calculate the original longitude difference (before adjustment)
  const originalDLng = lng2 - lng1;

  // Determine if we need to cross the antimeridian
  // We cross if the original difference is greater than 180 degrees
  const crossesAntimeridian = Math.abs(originalDLng) > 180;

  if (!crossesAntimeridian) {
    // Simple case - no antimeridian crossing, draw direct great circle
    return [generateGreatCircleSegment(lat1, lng1, lat2, lng2)];
  }

  // Complex case - crosses antimeridian, split into segments
  const segments: [number, number][][] = [];

  // Determine which direction crosses the antimeridian
  const antimeridianLng = originalDLng > 0 ? 180 : -180;
  const intermediateLat = calculateLatAtLongitude(lat1, lng1, lat2, lng2, antimeridianLng);

  // First segment: start to antimeridian
  segments.push(generateGreatCircleSegment(lat1, lng1, intermediateLat, antimeridianLng));

  // Second segment: other side of antimeridian to end
  const otherSideLng = antimeridianLng === 180 ? -180 : 180;
  segments.push(generateGreatCircleSegment(intermediateLat, otherSideLng, lat2, lng2));

  return segments;
}

// Generate a single great circle segment (no antimeridian crossing)
function generateGreatCircleSegment(lat1: number, lng1: number, lat2: number, lng2: number): [number, number][] {
  // Convert to radians
  const lat1Rad = lat1 * Math.PI / 180;
  const lng1Rad = lng1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const lng2Rad = lng2 * Math.PI / 180;

  // Calculate great circle distance
  const dLat = lat2Rad - lat1Rad;
  const dLng = lng2Rad - lng1Rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Handle very small distances
  if (c < 0.001) {
    return [[lat1, lng1], [lat2, lng2]];
  }

  // Number of points for smooth arc
  const distance = 6371 * c; // Distance in km
  const numPoints = Math.max(10, Math.min(50, Math.floor(distance / 200)));

  const points: [number, number][] = [];

  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;

    // Spherical interpolation for great circle
    const A = Math.sin((1 - f) * c) / Math.sin(c);
    const B = Math.sin(f * c) / Math.sin(c);

    // Handle potential NaN values
    if (isNaN(A) || isNaN(B)) {
      // Linear interpolation fallback
      const lat = lat1 + f * (lat2 - lat1);
      const lng = lng1 + f * (lng2 - lng1);
      points.push([lat, lng]);
      continue;
    }

    const x = A * Math.cos(lat1Rad) * Math.cos(lng1Rad) + B * Math.cos(lat2Rad) * Math.cos(lng2Rad);
    const y = A * Math.cos(lat1Rad) * Math.sin(lng1Rad) + B * Math.cos(lat2Rad) * Math.sin(lng2Rad);
    const z = A * Math.sin(lat1Rad) + B * Math.sin(lat2Rad);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
    let lng = Math.atan2(y, x) * 180 / Math.PI;

    // Normalize longitude to [-180, 180]
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;

    points.push([lat, lng]);
  }

  return points;
}

// Calculate latitude at a specific longitude along the great circle
function calculateLatAtLongitude(lat1: number, lng1: number, lat2: number, lng2: number, targetLng: number): number {
  // Convert to radians
  const lat1Rad = lat1 * Math.PI / 180;
  const lng1Rad = lng1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const lng2Rad = lng2 * Math.PI / 180;
  const targetLngRad = targetLng * Math.PI / 180;

  // Calculate the latitude at the target longitude
  const dLng12 = lng2Rad - lng1Rad;
  const dLng1t = targetLngRad - lng1Rad;

  const A = Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng1t) -
            Math.sin(lat2Rad) * Math.cos(lat1Rad) * Math.sin(dLng1t - dLng12);
  const B = Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng12);

  const lat = Math.atan2(A, B);
  return lat * 180 / Math.PI;
}

function gridSquareToBounds(grid: string) {
  if (grid.length < 2) return { west: -180, east: 180, south: -90, north: 90 };

  // Field (first 2 characters)
  const fieldLng = (grid.charCodeAt(0) - 65) * 20 - 180;
  const fieldLat = (grid.charCodeAt(1) - 65) * 10 - 90;

  if (grid.length === 2) {
    return {
      west: fieldLng,
      east: fieldLng + 20,
      south: fieldLat,
      north: fieldLat + 10,
    };
  }

  // Square (next 2 digits)
  const squareLng = parseInt(grid[2]) * 2;
  const squareLat = parseInt(grid[3]) * 1;

  if (grid.length === 4) {
    return {
      west: fieldLng + squareLng,
      east: fieldLng + squareLng + 2,
      south: fieldLat + squareLat,
      north: fieldLat + squareLat + 1,
    };
  }

  // Subsquare (next 2 characters) - for 6-character grid squares
  const subsquareLng = (grid.charCodeAt(4) - 65) * (2/24);
  const subsquareLat = (grid.charCodeAt(5) - 65) * (1/24);

  return {
    west: fieldLng + squareLng + subsquareLng,
    east: fieldLng + squareLng + subsquareLng + (2/24),
    south: fieldLat + squareLat + subsquareLat,
    north: fieldLat + squareLat + subsquareLat + (1/24),
  };
}
