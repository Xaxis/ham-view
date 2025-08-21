import React, { useState, useEffect } from 'react';
import type { UserPreferences, PanelConfig } from '../types';
import { loadQTHLocation, saveQTHLocation, type QTHLocation, maidenheadToLatLng } from '../services/localStorage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onSave: (preferences: UserPreferences) => void;
  qthLocation?: QTHLocation;
  onQTHSave?: (location: QTHLocation) => void;
}

const defaultPanels: PanelConfig[] = [
  { id: 'map', type: 'map', title: 'Propagation Map', enabled: true, order: 1, size: 'full-width' },
  { id: 'band-conditions', type: 'band-conditions', title: 'Band Conditions', enabled: true, order: 2, size: 'large' },
  { id: 'recent-spots', type: 'recent-spots', title: 'Recent Spots', enabled: true, order: 3, size: 'large' },
  { id: 'solar-data', type: 'solar-data', title: 'Solar & Geomagnetic', enabled: true, order: 4, size: 'medium' },
  { id: 'statistics', type: 'statistics', title: 'Statistics', enabled: false, order: 5, size: 'medium' },
  { id: 'alerts', type: 'alerts', title: 'Alerts & Notifications', enabled: false, order: 6, size: 'small' },
];

export default function SettingsModal({ isOpen, onClose, preferences, onSave, qthLocation, onQTHSave }: SettingsModalProps) {
  const [localPreferences, setLocalPreferences] = useState<UserPreferences>(preferences);
  const [activeTab, setActiveTab] = useState<'station' | 'display' | 'panels' | 'data' | 'alerts'>('station');

  // Station settings state
  const [stationData, setStationData] = useState({
    callsign: qthLocation?.callsign || '',
    gridSquare: qthLocation?.maidenhead || '',
  });

  // Update station data when qthLocation prop changes
  useEffect(() => {
    setStationData({
      callsign: qthLocation?.callsign || '',
      gridSquare: qthLocation?.maidenhead || '',
    });
  }, [qthLocation]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Save station info if it's been entered
    if (stationData.callsign.trim() && stationData.gridSquare.trim()) {
      try {
        const coords = maidenheadToLatLng(stationData.gridSquare.toUpperCase());
        const qthLocation: QTHLocation = {
          callsign: stationData.callsign.toUpperCase(),
          latitude: coords.latitude,
          longitude: coords.longitude,
          maidenhead: stationData.gridSquare.toUpperCase(),
          isSet: true,
        };
        saveQTHLocation(qthLocation);
        if (onQTHSave) {
          onQTHSave(qthLocation);
        }
      } catch (error) {
        alert('Invalid grid square format. Please use format like FN20kr');
        return;
      }
    }

    // Save preferences
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
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-content">
          <div className="settings-tabs">
            <button
              className={`tab-btn ${activeTab === 'station' ? 'active' : ''}`}
              onClick={() => setActiveTab('station')}
            >
              Station
            </button>
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
            {activeTab === 'station' && (
              <div className="settings-section">
                <h3>Station Information</h3>
                <p className="section-description">
                  Save your station's callsign and grid square to enable real propagation data from PSK Reporter.
                </p>

                <div className="setting-group">
                  <label>Your Callsign *</label>
                  <input
                    type="text"
                    placeholder="e.g., KL5YT, W1AW, JA1XYZ"
                    value={stationData.callsign}
                    onChange={(e) => setStationData(prev => ({
                      ...prev,
                      callsign: e.target.value.toUpperCase()
                    }))}
                    className="callsign-input"
                    style={{
                      fontFamily: 'SF Mono, Monaco, Inconsolata, Roboto Mono, monospace',
                      fontSize: '16px',
                      fontWeight: '600'
                    }}
                  />
                  <small>Your amateur radio callsign (required for PSK Reporter data)</small>
                </div>

                <div className="setting-group">
                  <label>Grid Square (Maidenhead Locator) *</label>
                  <input
                    type="text"
                    placeholder="e.g., FN20kr, JO65cv, QF22lb"
                    value={stationData.gridSquare}
                    onChange={(e) => setStationData(prev => ({
                      ...prev,
                      gridSquare: e.target.value.toUpperCase()
                    }))}
                    className="grid-input"
                    style={{
                      fontFamily: 'SF Mono, Monaco, Inconsolata, Roboto Mono, monospace',
                      fontSize: '16px',
                      fontWeight: '600'
                    }}
                  />
                  <small>Your 6-character Maidenhead grid square (e.g., FN20kr)</small>
                </div>



                {qthLocation?.isSet && (
                  <div className="current-station-info">
                    <h4>Current Station</h4>
                    <div className="station-details">
                      <div className="detail-row">
                        <span className="label">Callsign:</span>
                        <span className="value">{qthLocation.callsign}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Grid Square:</span>
                        <span className="value">{qthLocation.maidenhead}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Coordinates:</span>
                        <span className="value">
                          {qthLocation.latitude.toFixed(4)}°, {qthLocation.longitude.toFixed(4)}°
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

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
