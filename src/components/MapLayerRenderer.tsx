import React from 'react';
import type { MapLayer } from './MapLayersModal';
import DayNightTerminator from './mapLayers/DayNightTerminator';
import MaidenheadGrid from './mapLayers/MaidenheadGrid';
import AuroralOval from './mapLayers/AuroralOval';

interface MapLayerRendererProps {
  layers: MapLayer[];
  mapZoom?: number;
  kIndex?: number; // For aurora calculations
}

export default function MapLayerRenderer({ layers, mapZoom = 1, kIndex = 3 }: MapLayerRendererProps) {
  // Get layer by ID
  const getLayer = (id: string) => layers.find(layer => layer.id === id);

  // Render individual layers based on their type
  const renderLayer = (layer: MapLayer) => {
    if (!layer.enabled) return null;

    switch (layer.id) {
      case 'daynight':
        return (
          <DayNightTerminator
            key={layer.id}
            opacity={layer.opacity || 60}
            enabled={layer.enabled}
          />
        );

      case 'grid':
        return (
          <MaidenheadGrid
            key={layer.id}
            opacity={layer.opacity || 30}
            enabled={layer.enabled}
            zoom={mapZoom}
          />
        );

      case 'aurora':
        return (
          <AuroralOval
            key={layer.id}
            opacity={layer.opacity || 50}
            enabled={layer.enabled}
            kIndex={kIndex}
          />
        );

      case 'qth':
        return (
          <QTHMarker
            key={layer.id}
            opacity={layer.opacity || 100}
            enabled={layer.enabled}
          />
        );

      case 'targets':
        return (
          <DXTargets
            key={layer.id}
            opacity={layer.opacity || 100}
            enabled={layer.enabled}
          />
        );

      case 'voacap':
        return (
          <VOACAPOverlay
            key={layer.id}
            opacity={layer.opacity || 40}
            enabled={layer.enabled}
          />
        );

      default:
        return null;
    }
  };

  // Sort layers by z-index (overlay layers should be on top)
  const sortedLayers = [...layers].sort((a, b) => {
    const zIndexMap: Record<string, number> = {
      'voacap': 1,     // Bottom - prediction overlays
      'grid': 2,       // Grid squares
      'aurora': 3,     // Aurora oval
      'daynight': 4,   // Day/night terminator
      'qth': 5,        // QTH marker
      'targets': 6,    // DX targets
    };
    
    return (zIndexMap[a.id] || 0) - (zIndexMap[b.id] || 0);
  });

  return (
    <div className="map-layer-renderer">
      {sortedLayers.map(renderLayer)}
    </div>
  );
}

// QTH Marker component (placeholder)
function QTHMarker({ opacity, enabled }: { opacity: number; enabled: boolean }) {
  if (!enabled) return null;

  return (
    <div 
      className="qth-marker"
      style={{ 
        opacity: opacity / 100,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 15,
        pointerEvents: 'none',
      }}
    >
      <div className="qth-icon">
        🏠
      </div>
      <div className="qth-label">
        My QTH
      </div>
    </div>
  );
}

// DX Targets component (placeholder)
function DXTargets({ opacity, enabled }: { opacity: number; enabled: boolean }) {
  if (!enabled) return null;

  // Sample DX targets
  const targets = [
    { name: 'JA1XYZ', lat: 35.6762, lng: 139.6503, priority: 'high' },
    { name: 'VK2ABC', lat: -33.8688, lng: 151.2093, priority: 'medium' },
    { name: 'ZL1DEF', lat: -36.8485, lng: 174.7633, priority: 'low' },
  ];

  return (
    <div 
      className="dx-targets"
      style={{ 
        opacity: opacity / 100,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 16,
        pointerEvents: 'none',
      }}
    >
      {targets.map((target, index) => {
        // Convert lat/lng to percentage position (simplified)
        const x = ((target.lng + 180) / 360) * 100;
        const y = ((90 - target.lat) / 180) * 100;
        
        return (
          <div
            key={index}
            className={`dx-target priority-${target.priority}`}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="target-icon">🎯</div>
            <div className="target-label">{target.name}</div>
          </div>
        );
      })}
    </div>
  );
}

// VOACAP Overlay component (placeholder)
function VOACAPOverlay({ opacity, enabled }: { opacity: number; enabled: boolean }) {
  if (!enabled) return null;

  return (
    <div 
      className="voacap-overlay"
      style={{ 
        opacity: opacity / 100,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="propagationGradient" cx="50%" cy="50%" r="40%">
            <stop offset="0%" stopColor="rgba(0, 255, 0, 0.3)" />
            <stop offset="50%" stopColor="rgba(255, 255, 0, 0.2)" />
            <stop offset="100%" stopColor="rgba(255, 0, 0, 0.1)" />
          </radialGradient>
        </defs>
        
        {/* Sample propagation prediction circle */}
        <circle
          cx="50"
          cy="50"
          r="30"
          fill="url(#propagationGradient)"
          stroke="rgba(0, 255, 0, 0.5)"
          strokeWidth="0.2"
          strokeDasharray="2,1"
        />
      </svg>
      
      <div className="voacap-info">
        <span className="voacap-label">
          📊 VOACAP Predictions
        </span>
      </div>
    </div>
  );
}
