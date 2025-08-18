import React, { useState } from 'react';
import type { UserPreferences, PanelConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onSave: (preferences: UserPreferences) => void;
}

const defaultPanels: PanelConfig[] = [
  { id: 'map', type: 'map', title: 'Propagation Map', enabled: true, order: 1, size: 'full-width' },
  { id: 'band-conditions', type: 'band-conditions', title: 'Band Conditions', enabled: true, order: 2, size: 'large' },
  { id: 'recent-spots', type: 'recent-spots', title: 'Recent Spots', enabled: true, order: 3, size: 'large' },
  { id: 'solar-data', type: 'solar-data', title: 'Solar & Geomagnetic', enabled: true, order: 4, size: 'medium' },
  { id: 'statistics', type: 'statistics', title: 'Statistics', enabled: false, order: 5, size: 'medium' },
  { id: 'alerts', type: 'alerts', title: 'Alerts & Notifications', enabled: false, order: 6, size: 'small' },
];

export default function SettingsModal({ isOpen, onClose, preferences, onSave }: SettingsModalProps) {
  const [localPreferences, setLocalPreferences] = useState<UserPreferences>(preferences);
  const [activeTab, setActiveTab] = useState<'display' | 'panels' | 'data' | 'alerts'>('display');

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localPreferences);
    onClose();
  };

  const handlePanelToggle = (panelId: string) => {
    setLocalPreferences(prev => ({
      ...prev,
      panels: prev.panels.map(panel =>
        panel.id === panelId ? { ...panel, enabled: !panel.enabled } : panel
      ),
    }));
  };

  const handlePanelReorder = (panelId: string, direction: 'up' | 'down') => {
    setLocalPreferences(prev => {
      const panels = [...prev.panels];
      const index = panels.findIndex(p => p.id === panelId);
      if (index === -1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= panels.length) return prev;

      // Swap panels
      [panels[index], panels[newIndex]] = [panels[newIndex], panels[index]];
      
      // Update order numbers
      panels.forEach((panel, idx) => {
        panel.order = idx + 1;
      });

      return { ...prev, panels };
    });
  };

  const handlePanelSizeChange = (panelId: string, size: PanelConfig['size']) => {
    setLocalPreferences(prev => ({
      ...prev,
      panels: prev.panels.map(panel =>
        panel.id === panelId ? { ...panel, size } : panel
      ),
    }));
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>PropView Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-content">
          <div className="settings-tabs">
            <button 
              className={`tab-btn ${activeTab === 'display' ? 'active' : ''}`}
              onClick={() => setActiveTab('display')}
            >
              Display
            </button>
            <button 
              className={`tab-btn ${activeTab === 'panels' ? 'active' : ''}`}
              onClick={() => setActiveTab('panels')}
            >
              Panels
            </button>
            <button 
              className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              Data
            </button>
            <button 
              className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setActiveTab('alerts')}
            >
              Alerts
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'display' && (
              <div className="settings-section">
                <h3>Display Settings</h3>
                
                <div className="setting-group">
                  <label>Theme</label>
                  <select 
                    value={localPreferences.displaySettings.theme}
                    onChange={e => setLocalPreferences(prev => ({
                      ...prev,
                      displaySettings: { ...prev.displaySettings, theme: e.target.value as any }
                    }))}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label>Map Style</label>
                  <select 
                    value={localPreferences.displaySettings.mapStyle}
                    onChange={e => setLocalPreferences(prev => ({
                      ...prev,
                      displaySettings: { ...prev.displaySettings, mapStyle: e.target.value as any }
                    }))}
                  >
                    <option value="street">Street</option>
                    <option value="satellite">Satellite</option>
                    <option value="terrain">Terrain</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label>Layout Style</label>
                  <select 
                    value={localPreferences.displaySettings.layout}
                    onChange={e => setLocalPreferences(prev => ({
                      ...prev,
                      displaySettings: { ...prev.displaySettings, layout: e.target.value as any }
                    }))}
                  >
                    <option value="vertical">Vertical Scroll</option>
                    <option value="grid">Grid Layout</option>
                    <option value="compact">Compact</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label>Units</label>
                  <select
                    value={localPreferences.displaySettings.units}
                    onChange={e => setLocalPreferences(prev => ({
                      ...prev,
                      displaySettings: { ...prev.displaySettings, units: e.target.value as any }
                    }))}
                  >
                    <option value="metric">Metric</option>
                    <option value="imperial">Imperial</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label>Map/Tabs Split Ratio</label>
                  <div className="split-ratio-control">
                    <input
                      type="range"
                      min="30"
                      max="80"
                      value={localPreferences.displaySettings.mapSplitRatio}
                      onChange={e => setLocalPreferences(prev => ({
                        ...prev,
                        displaySettings: { ...prev.displaySettings, mapSplitRatio: parseInt(e.target.value) }
                      }))}
                    />
                    <span className="split-ratio-value">
                      Map: {localPreferences.displaySettings.mapSplitRatio}% / Tabs: {100 - localPreferences.displaySettings.mapSplitRatio}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'panels' && (
              <div className="settings-section">
                <h3>Panel Configuration</h3>
                <p className="section-description">
                  Configure which panels are visible and their layout order.
                </p>
                
                <div className="panels-list">
                  {localPreferences.panels.map((panel, index) => (
                    <div key={panel.id} className="panel-config-item">
                      <div className="panel-info">
                        <div className="panel-header">
                          <label className="panel-toggle">
                            <input
                              type="checkbox"
                              checked={panel.enabled}
                              onChange={() => handlePanelToggle(panel.id)}
                            />
                            <span className="panel-title">{panel.title}</span>
                          </label>
                          <span className="panel-type">{panel.type}</span>
                        </div>
                        
                        {panel.enabled && (
                          <div className="panel-controls">
                            <div className="size-controls">
                              <label>Size:</label>
                              <select
                                value={panel.size}
                                onChange={e => handlePanelSizeChange(panel.id, e.target.value as any)}
                              >
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                                <option value="full-width">Full Width</option>
                              </select>
                            </div>
                            
                            <div className="order-controls">
                              <button
                                className="order-btn"
                                onClick={() => handlePanelReorder(panel.id, 'up')}
                                disabled={index === 0}
                              >
                                ↑
                              </button>
                              <button
                                className="order-btn"
                                onClick={() => handlePanelReorder(panel.id, 'down')}
                                disabled={index === localPreferences.panels.length - 1}
                              >
                                ↓
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="settings-section">
                <h3>Data Settings</h3>
                
                <div className="setting-group">
                  <label>Refresh Interval</label>
                  <select 
                    value={localPreferences.dataRefreshInterval}
                    onChange={e => setLocalPreferences(prev => ({
                      ...prev,
                      dataRefreshInterval: parseInt(e.target.value)
                    }))}
                  >
                    <option value="60">1 minute</option>
                    <option value="300">5 minutes</option>
                    <option value="600">10 minutes</option>
                    <option value="1800">30 minutes</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label>Default Location</label>
                  <div className="location-inputs">
                    <input
                      type="number"
                      placeholder="Latitude"
                      value={localPreferences.defaultLocation.latitude}
                      onChange={e => setLocalPreferences(prev => ({
                        ...prev,
                        defaultLocation: { ...prev.defaultLocation, latitude: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                    <input
                      type="number"
                      placeholder="Longitude"
                      value={localPreferences.defaultLocation.longitude}
                      onChange={e => setLocalPreferences(prev => ({
                        ...prev,
                        defaultLocation: { ...prev.defaultLocation, longitude: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="settings-section">
                <h3>Alerts & Notifications</h3>
                
                <div className="setting-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={localPreferences.alerts.enabled}
                      onChange={e => setLocalPreferences(prev => ({
                        ...prev,
                        alerts: { ...prev.alerts, enabled: e.target.checked }
                      }))}
                    />
                    <span>Enable Alerts</span>
                  </label>
                </div>

                <div className="alert-info">
                  <p>Alert configuration will be available in a future update.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
