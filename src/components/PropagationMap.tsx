import React, { useEffect, useRef, useState } from 'react';
import type { MapMarker, PropagationPath, PropagationSpot } from '../types';

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
  layers?: {
    daynight?: boolean;
    spots?: boolean;
    paths?: boolean;
  };
}

export default function PropagationMap({
  markers,
  paths,
  spots,
  onSpotSelect,
  selectedSpot,
  mapStyle = 'street',
  layers = { daynight: true, spots: true, paths: true }
}: PropagationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const pathsLayerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load Leaflet dynamically
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        if (window.L) {
          setIsLoading(false);
          return;
        }

        // Load Leaflet script
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
          setIsLoading(false);
        };
        script.onerror = () => {
          setError('Failed to load map library');
          setIsLoading(false);
        };
        document.head.appendChild(script);
      } catch (err) {
        setError('Error loading map library');
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

      mapInstanceRef.current = map;

      console.log('PropView map initialized');
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map');
    }
  }, [isLoading, error, mapStyle]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !window.L) {
      return;
    }

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    markers.forEach(marker => {
      try {
        // Create marker icon based on type
        const getMarkerIcon = (type: MapMarker['type'], spotCount: number) => {
          const size = Math.min(30, Math.max(10, spotCount * 2)); // Scale with spot count
          let color = '#3b82f6'; // Default blue
          let symbol = '📡';

          switch (type) {
            case 'transmitter':
              color = '#ef4444'; // Red
              symbol = '📤';
              break;
            case 'receiver':
              color = '#10b981'; // Green
              symbol = '📥';
              break;
            case 'both':
              color = '#8b5cf6'; // Purple
              symbol = '📡';
              break;
          }

          return window.L.divIcon({
            html: `<div style="
              background: ${color};
              width: ${size}px;
              height: ${size}px;
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${Math.max(8, size * 0.6)}px;
            ">${symbol}</div>`,
            className: 'custom-marker',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
        };

        const leafletMarker = window.L.marker(
          [marker.position.latitude, marker.position.longitude],
          { icon: getMarkerIcon(marker.type, marker.spotCount) }
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

    paths.forEach(path => {
      try {
        // Create path line with color based on quality
        const getPathColor = (quality: PropagationPath['quality']) => {
          switch (quality) {
            case 'excellent': return '#10b981'; // Green
            case 'good': return '#3b82f6'; // Blue
            case 'fair': return '#f59e0b'; // Yellow
            case 'poor': return '#ef4444'; // Red
            default: return '#6b7280'; // Gray
          }
        };

        const pathLine = window.L.polyline(
          [
            [path.from.latitude, path.from.longitude],
            [path.to.latitude, path.to.longitude]
          ],
          {
            color: getPathColor(path.quality),
            weight: Math.max(1, Math.min(5, path.spots.length)), // Line weight based on spot count
            opacity: 0.7,
            dashArray: path.quality === 'poor' ? '5, 5' : undefined, // Dashed line for poor quality
          }
        );

        // Add popup with path information
        pathLine.bindPopup(`
          <div style="font-family: Inter, sans-serif;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Propagation Path</h3>
            <div style="font-size: 12px; line-height: 1.4;">
              <div><strong>Distance:</strong> ${Math.round(path.distance)} km</div>
              <div><strong>Bearing:</strong> ${Math.round(path.bearing)}°</div>
              <div><strong>Quality:</strong> ${path.quality}</div>
              <div><strong>Spots:</strong> ${path.spots.length}</div>
              <div style="margin-top: 8px;">
                <strong>Latest:</strong> ${path.spots[0]?.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        `);

        // Add click handler
        pathLine.on('click', () => {
          if (path.spots.length > 0 && onSpotSelect) {
            onSpotSelect(path.spots[0]); // Select the most recent spot
          }
        });

        pathsLayerRef.current.addLayer(pathLine);
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
    <div className="propagation-map">
      <div ref={mapRef} className="map-container" />
      
      {/* Map legend - positioned bottom right */}
      <div className="map-legend-overlay">
        <div className="legend-header">
          <span className="legend-title">Live Activity</span>
          <span className="legend-count">{spots.length} spots</span>
        </div>

        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-dot excellent"></span>
            <span className="legend-text">Excellent (0dB+)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot good"></span>
            <span className="legend-text">Good (-10dB+)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot fair"></span>
            <span className="legend-text">Fair (-20dB+)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot poor"></span>
            <span className="legend-text">Poor (below -20dB)</span>
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
    </div>
  );
}
