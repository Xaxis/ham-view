import React from 'react';

export interface MapLayer {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  category: 'data' | 'overlay' | 'reference';
  opacity?: number;
}

interface MapLayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  layers: MapLayer[];
  onLayerToggle: (layerId: string) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
  mapStyle: string;
  onMapStyleChange: (style: string) => void;
}

const mapStyles = [
  { value: 'street', label: 'Street Map', preview: '🗺️' },
  { value: 'satellite', label: 'Satellite', preview: '🛰️' },
  { value: 'terrain', label: 'Terrain', preview: '🏔️' },
  { value: 'dark', label: 'Dark Mode', preview: '🌙' },
];

export default function MapLayersModal({
  isOpen,
  onClose,
  layers,
  onLayerToggle,
  onOpacityChange,
  mapStyle,
  onMapStyleChange,
}: MapLayersModalProps) {
  if (!isOpen) return null;

  const groupedLayers = {
    data: layers.filter(layer => layer.category === 'data'),
    overlay: layers.filter(layer => layer.category === 'overlay'),
    reference: layers.filter(layer => layer.category === 'reference'),
  };

  const LayerGroup = ({ 
    title, 
    layers, 
    icon 
  }: { 
    title: string; 
    layers: MapLayer[]; 
    icon: string; 
  }) => (
    <div className="layer-group">
      <h4 className="layer-group-title">
        <span className="layer-group-icon">{icon}</span>
        {title}
      </h4>
      <div className="layer-list">
        {layers.map(layer => (
          <div key={layer.id} className="layer-item">
            <div className="layer-header">
              <label className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layer.enabled}
                  onChange={() => onLayerToggle(layer.id)}
                />
                <span className="layer-icon">{layer.icon}</span>
                <div className="layer-info">
                  <span className="layer-name">{layer.name}</span>
                  <span className="layer-description">{layer.description}</span>
                </div>
              </label>
            </div>
            
            {layer.enabled && layer.opacity !== undefined && (
              <div className="layer-opacity">
                <label className="opacity-label">Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={layer.opacity}
                  onChange={(e) => onOpacityChange(layer.id, parseInt(e.target.value))}
                  className="opacity-slider"
                />
                <span className="opacity-value">{layer.opacity}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="map-layers-modal-overlay" onClick={onClose}>
      <div className="map-layers-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Map Layers & Style</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-content">
          {/* Map Style Selection */}
          <div className="map-style-section">
            <h4 className="section-title">
              <span className="section-icon">🎨</span>
              Base Map Style
            </h4>
            <div className="map-style-grid">
              {mapStyles.map(style => (
                <button
                  key={style.value}
                  className={`map-style-btn ${mapStyle === style.value ? 'active' : ''}`}
                  onClick={() => onMapStyleChange(style.value)}
                >
                  <span className="style-preview">{style.preview}</span>
                  <span className="style-label">{style.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Data Layers */}
          <LayerGroup
            title="Data Layers"
            layers={groupedLayers.data}
            icon="📊"
          />

          {/* Overlay Layers */}
          <LayerGroup
            title="Map Overlays"
            layers={groupedLayers.overlay}
            icon="🌍"
          />

          {/* Reference Layers */}
          <LayerGroup
            title="Reference"
            layers={groupedLayers.reference}
            icon="📍"
          />

          {/* Layer Info */}
          <div className="layer-info-section">
            <div className="info-item">
              <span className="info-icon">💡</span>
              <span className="info-text">
                Toggle layers on/off and adjust opacity to customize your view
              </span>
            </div>
            <div className="info-item">
              <span className="info-icon">🔄</span>
              <span className="info-text">
                Changes apply instantly to the map
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="reset-btn" onClick={() => {
            // Reset all layers to default
            layers.forEach(layer => {
              if (layer.id === 'spots' || layer.id === 'paths') {
                onLayerToggle(layer.id);
              }
            });
          }}>
            Reset to Default
          </button>
          <button className="done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
