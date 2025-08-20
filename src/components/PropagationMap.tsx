import React, { useEffect, useRef, useState } from 'react';
import type { MapMarker, PropagationPath, PropagationSpot } from '../types';
import type { MapLayer } from './MapLayersModal';

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
  mapStyle?: 'street' | 'satellite' | 'terrain';
  layers?: MapLayer[];
  kIndex?: number; // For aurora calculations
  mapZoom?: number; // For grid density
}

export default function PropagationMap({
  markers,
  paths,
  spots,
  onSpotSelect,
  selectedSpot,
  mapStyle = 'street',
  layers = [],
  kIndex = 3,
  mapZoom = 1
}: PropagationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const pathsLayerRef = useRef<any>(null);
  const layerGroupsRef = useRef<{
    daynight?: any;
    aurora?: any;
    grid?: any;
    qth?: any;
    targets?: any;
    voacap?: any;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(true);

  // Reset empty state when spots arrive
  useEffect(() => {
    if (spots.length > 0) {
      setShowEmptyState(true);
    }
  }, [spots]);

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
      // Create map instance
      const map = window.L.map(mapRef.current, {
        center: [20, 0], // Center on equator
        zoom: 2,
        zoomControl: true,
        attributionControl: true,
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
          default: // street
            return window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            });
        }
      };

      getTileLayer().addTo(map);

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
          addAuroralOval(L, layerGroup, layer.opacity || 50, kIndex);
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
      }
    });

    // Update layers on zoom/pan change
    const handleViewChange = () => {
      // Update grid layer for zoom/pan changes to ensure tessellation
      const gridLayer = layerGroupsRef.current.grid;
      if (gridLayer && map.hasLayer(gridLayer)) {
        const gridLayerConfig = layers.find(l => l.id === 'grid');
        if (gridLayerConfig?.enabled) {
          gridLayer.clearLayers();
          addMaidenheadGrid(window.L, gridLayer, gridLayerConfig.opacity || 30, map.getZoom());
        }
      }

      // Update day/night terminator for pan changes
      const dayNightLayer = layerGroupsRef.current.daynight;
      if (dayNightLayer && map.hasLayer(dayNightLayer)) {
        const dayNightLayerConfig = layers.find(l => l.id === 'daynight');
        if (dayNightLayerConfig?.enabled) {
          dayNightLayer.clearLayers();
          addDayNightTerminator(window.L, dayNightLayer, dayNightLayerConfig.opacity || 60, map);
        }
      }

      // Update day/night terminator for world repetitions
      const daynightLayer = layerGroupsRef.current.daynight;
      if (daynightLayer && map.hasLayer(daynightLayer)) {
        const daynightLayerConfig = layers.find(l => l.id === 'daynight');
        if (daynightLayerConfig?.enabled) {
          daynightLayer.clearLayers();
          addDayNightTerminator(L, daynightLayer, daynightLayerConfig.opacity || 60, map);
        }
      }
    };

    // Add event listeners for view changes
    map.on('zoomend', handleViewChange);
    map.on('moveend', handleViewChange);
    map.on('viewreset', handleViewChange);

    // Update day/night terminator every minute since it moves continuously
    const updateTerminator = () => {
      const daynightLayer = layerGroupsRef.current.daynight;
      if (daynightLayer && map.hasLayer(daynightLayer)) {
        const daynightLayerConfig = layers.find(l => l.id === 'daynight');
        if (daynightLayerConfig?.enabled) {
          daynightLayer.clearLayers();
          addDayNightTerminator(L, daynightLayer, daynightLayerConfig.opacity || 60, map);
        }
      }
    };

    const terminatorInterval = setInterval(updateTerminator, 60000); // Update every minute

    return () => {
      map.off('zoomend', handleViewChange);
      map.off('moveend', handleViewChange);
      clearInterval(terminatorInterval);
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

        // Create marker icon for receivers (PSK Reporter style with clustering)
        const getMarkerIcon = (type: MapMarker['type'], spotCount: number, callsign: string) => {
          // Determine if this is a multi-station cluster
          const isMultiStation = callsign.includes('+');
          const stationCount = isMultiStation ? parseInt(callsign.split('+')[1]) + 1 : 1;

          // PSK Reporter style: "Large markers are monitors"
          // Size based on activity level and station count
          const activitySize = Math.min(24, Math.max(12, spotCount * 0.8));
          const clusterSize = isMultiStation ? Math.min(32, Math.max(16, stationCount * 2)) : activitySize;
          const finalSize = Math.max(activitySize, clusterSize);

          // PSK Reporter style: All markers are receivers showing where signals were heard
          const color = '#10b981'; // Green for receivers
          const borderColor = '#ffffff';
          const textColor = '#ffffff';

          // Label shows activity or station count
          let label;
          let fontSize = '10px';

          if (isMultiStation) {
            // Show number of stations at this location
            label = stationCount.toString();
            fontSize = stationCount > 99 ? '8px' : '10px';
          } else if (spotCount > 1) {
            // Show spot count for active single stations
            label = spotCount.toString();
            fontSize = spotCount > 99 ? '8px' : '10px';
          } else {
            // Single spot, single station
            label = 'RX';
            fontSize = '9px';
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

          // Add popup
          if (marker.popup) {
            leafletMarker.bindPopup(`
              <div style="font-family: Inter, sans-serif;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${marker.popup.title}</h3>
                <p style="margin: 0; font-size: 12px; color: #666;">${marker.popup.content}</p>
                <div style="margin-top: 8px; font-size: 11px; color: #888;">
                  Type: ${marker.type} | Spots: ${marker.spotCount}
                </div>
              </div>
            `);
          }

          // Add click handler
          leafletMarker.on('click', () => {
            // Find a spot associated with this marker
            const associatedSpot = spots.find(spot =>
              spot.transmitter.callsign === marker.callsign ||
              spot.receiver.callsign === marker.callsign
            );
            if (associatedSpot && onSpotSelect) {
              onSpotSelect(associatedSpot);
            }
          });

          markersLayerRef.current.addLayer(leafletMarker);
        });
      } catch (err) {
        console.warn('Error creating marker:', err);
      }
    });
  }, [markers, spots, onSpotSelect]);

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
    <div className="propagation-map" style={{ height: '100%', width: '100%' }}>
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



// Layer implementation functions
function addDayNightTerminator(L: any, layerGroup: any, opacity: number, map?: any) {
  const now = new Date();
  const basePoints = calculateTerminatorPoints(now);

  if (basePoints.length === 0) return;

  // Get map bounds to determine how many world repetitions are visible
  let westBound = -180;
  let eastBound = 180;

  if (map) {
    const bounds = map.getBounds();
    westBound = bounds.getWest();
    eastBound = bounds.getEast();
  }

  // Calculate how many 360-degree world repetitions we need
  const worldWidth = 360;
  const startWorld = Math.floor(westBound / worldWidth);
  const endWorld = Math.ceil(eastBound / worldWidth);

  // Create terminator lines and night polygons for each visible world
  for (let worldOffset = startWorld; worldOffset <= endWorld; worldOffset++) {
    const offsetLng = worldOffset * worldWidth;

    // Offset the base points for this world repetition
    const offsetPoints = basePoints.map(([lat, lng]) => [lat, lng + offsetLng] as [number, number]);

    // Create the terminator line for this world
    const terminatorLine = L.polyline(offsetPoints, {
      color: '#FFD700',
      weight: 3,
      opacity: opacity / 100,
      dashArray: '10, 5'
    });

    if (worldOffset === 0) {
      // Only add popup to the main world to avoid clutter
      terminatorLine.bindPopup(`Day/Night Terminator<br>Time: ${now.toUTCString().slice(17, 25)} UTC`);
    }

    layerGroup.addLayer(terminatorLine);

    // Create night side polygon for this world
    // The night side is the area where the sun is below the horizon

    const solarSubpoint = getSolarSubpoint(now);
    const solarLng = solarSubpoint.longitude + offsetLng;

    // Determine which side of the terminator is night
    // Test a point 90 degrees away from the solar longitude
    const testLng = solarLng + 180; // Opposite side of Earth from sun (should be night)

    // Find the closest terminator point to our test longitude
    let closestPoint = offsetPoints[0];
    let minDistance = Math.abs(offsetPoints[0][1] - testLng);

    for (const point of offsetPoints) {
      const distance = Math.abs(point[1] - testLng);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }

    // For a point on the terminator, determine if north or south of it is night
    // We'll use the middle point of the terminator for this calculation
    const midIndex = Math.floor(offsetPoints.length / 2);
    const midPoint = offsetPoints[midIndex];

    // Calculate which direction is away from the sun
    // If the sun is north of the terminator point, then south is night (and vice versa)
    const shouldShadeNorth = solarSubpoint.latitude > midPoint[0];

    // Create night polygon by extending the terminator line to world boundaries
    const nightPoints: Array<[number, number]> = [];

    // Add all terminator points
    nightPoints.push(...offsetPoints);

    // Close the polygon by adding boundary points
    const firstPoint = offsetPoints[0];
    const lastPoint = offsetPoints[offsetPoints.length - 1];
    const worldWest = -180 + offsetLng;
    const worldEast = 180 + offsetLng;

    if (shouldShadeNorth) {
      // Shade the northern side
      nightPoints.push([lastPoint[0], lastPoint[1]]); // End of terminator
      nightPoints.push([90, lastPoint[1]]); // Go north
      nightPoints.push([90, worldEast]); // Northeast corner
      nightPoints.push([90, worldWest]); // Northwest corner
      nightPoints.push([90, firstPoint[1]]); // Back to start longitude
      nightPoints.push([firstPoint[0], firstPoint[1]]); // Back to start of terminator
    } else {
      // Shade the southern side
      nightPoints.push([lastPoint[0], lastPoint[1]]); // End of terminator
      nightPoints.push([-90, lastPoint[1]]); // Go south
      nightPoints.push([-90, worldEast]); // Southeast corner
      nightPoints.push([-90, worldWest]); // Southwest corner
      nightPoints.push([-90, firstPoint[1]]); // Back to start longitude
      nightPoints.push([firstPoint[0], firstPoint[1]]); // Back to start of terminator
    }

    const nightPolygon = L.polygon(nightPoints, {
      color: 'rgba(255, 215, 0, 0.3)', // Slight golden border
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

function addAuroralOval(L: any, layerGroup: any, opacity: number, kIndex: number) {
  const { northernOval, southernOval } = calculateAuroralOval(kIndex);

  const color = getAuroraColor(kIndex);
  const options = {
    color: color,
    weight: 2,
    opacity: opacity / 100,
    fillColor: color,
    fillOpacity: (opacity / 100) * 0.3,
  };

  if (northernOval.length > 0) {
    const northPolygon = L.polygon(northernOval, options);
    northPolygon.bindPopup(`Northern Aurora Oval<br>K-index: ${kIndex}`);
    layerGroup.addLayer(northPolygon);
  }

  if (southernOval.length > 0) {
    const southPolygon = L.polygon(southernOval, options);
    southPolygon.bindPopup(`Southern Aurora Oval<br>K-index: ${kIndex}`);
    layerGroup.addLayer(southPolygon);
  }
}

function addMaidenheadGrid(L: any, layerGroup: any, opacity: number, zoom: number) {
  // Only show grid at appropriate zoom levels
  if (zoom < 3) return;

  const showFields = zoom <= 5;
  const showSquares = zoom > 5;

  // Get map bounds to determine visible area and world repetitions
  const map = layerGroup._map;
  let westBound = -180;
  let eastBound = 180;

  if (map) {
    const bounds = map.getBounds();
    westBound = bounds.getWest();
    eastBound = bounds.getEast();
  }

  // Calculate how many 360-degree world repetitions we need to cover
  const worldWidth = 360;
  const startWorld = Math.floor(westBound / worldWidth);
  const endWorld = Math.ceil(eastBound / worldWidth);

  if (showFields) {
    // Add field squares (AA-RR) with world wrapping
    for (let world = startWorld; world <= endWorld; world++) {
      const worldOffset = world * worldWidth;

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

          const rectangle = L.rectangle([
            [offsetBounds.south, offsetBounds.west],
            [offsetBounds.north, offsetBounds.east]
          ], {
            color: '#FFFFFF',
            weight: 1,
            opacity: opacity / 100,
            fillOpacity: 0,
          });

          rectangle.bindPopup(`Grid Square: ${field}`);
          layerGroup.addLayer(rectangle);

          // Add label
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

function addDXTargets(L: any, layerGroup: any, opacity: number) {
  const targets = [
    { name: 'JA1XYZ', lat: 35.6762, lng: 139.6503, priority: 'high' },
    { name: 'VK2ABC', lat: -33.8688, lng: 151.2093, priority: 'medium' },
    { name: 'ZL1DEF', lat: -36.8485, lng: 174.7633, priority: 'low' },
  ];

  targets.forEach(target => {
    const color = target.priority === 'high' ? '#FF0000' :
                  target.priority === 'medium' ? '#FFA500' : '#00FF00';

    const marker = L.marker([target.lat, target.lng], {
      icon: L.divIcon({
        className: 'dx-target-icon',
        html: `<div style="font-size: 18px; color: ${color};">🎯</div>`,
        iconSize: [25, 25],
        iconAnchor: [12, 12]
      }),
      opacity: opacity / 100
    });

    marker.bindPopup(`DX Target: ${target.name}<br>Priority: ${target.priority}`);
    layerGroup.addLayer(marker);
  });
}

function addVOACAPOverlay(L: any, layerGroup: any, opacity: number) {
  // Sample VOACAP prediction circle
  const center = [40, -100];
  const radius = 2000; // km

  const circle = L.circle(center, {
    radius: radius * 1000, // Convert to meters
    color: '#00FF00',
    weight: 2,
    opacity: opacity / 100,
    fillColor: '#00FF00',
    fillOpacity: (opacity / 100) * 0.2,
    dashArray: '10, 5'
  });

  circle.bindPopup('VOACAP Prediction<br>20m band coverage');
  layerGroup.addLayer(circle);
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
