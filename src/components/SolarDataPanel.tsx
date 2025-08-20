import React from 'react';
import type { SolarData } from '../types';

interface SolarDataPanelProps {
  solarData: SolarData | null;
}

export default function SolarDataPanel({ solarData }: SolarDataPanelProps) {
  if (!solarData) {
    return (
      <div className="solar-data">
        <div className="solar-data-empty">
          <div className="empty-icon">☀️</div>
          <span>No solar data available</span>
          <small>Waiting for space weather data...</small>
        </div>
      </div>
    );
  }

  const getStormColor = (kIndex: number) => {
    if (kIndex >= 9) return '#dc2626'; // Red - Extreme
    if (kIndex >= 7) return '#ea580c'; // Orange-red - Severe
    if (kIndex >= 6) return '#f59e0b'; // Orange - Strong
    if (kIndex >= 5) return '#eab308'; // Yellow - Moderate
    if (kIndex >= 4) return '#84cc16'; // Yellow-green - Minor
    return '#10b981'; // Green - Quiet
  };

  const getStormLevel = (kIndex: number) => {
    if (kIndex >= 9) return 'EXTREME';
    if (kIndex >= 7) return 'SEVERE';
    if (kIndex >= 6) return 'STRONG';
    if (kIndex >= 5) return 'MODERATE';
    if (kIndex >= 4) return 'MINOR';
    return 'QUIET';
  };

  const getIndexColor = (value: number, type: 'k' | 'a' | 'sfi') => {
    switch (type) {
      case 'k':
        if (value >= 7) return '#dc2626'; // Red
        if (value >= 5) return '#f59e0b'; // Orange
        if (value >= 3) return '#eab308'; // Yellow
        return '#10b981'; // Green
      case 'a':
        if (value >= 50) return '#dc2626'; // Red
        if (value >= 30) return '#f59e0b'; // Orange
        if (value >= 15) return '#eab308'; // Yellow
        return '#10b981'; // Green
      case 'sfi':
        if (value >= 200) return '#10b981'; // Green (high is good)
        if (value >= 150) return '#eab308'; // Yellow
        if (value >= 100) return '#f59e0b'; // Orange
        return '#dc2626'; // Red (low is bad)
      default:
        return '#6b7280';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString();
  };

  return (
    <div className="solar-data">
      <div className="solar-header">
        <h3>Solar & Geomagnetic</h3>
        <div className="solar-status">
          <div className="solar-timestamp">{formatTimestamp(solarData.timestamp)}</div>
          {solarData.kIndex >= 4 && (
            <div
              className="storm-alert"
              style={{ backgroundColor: getStormColor(solarData.kIndex) }}
            >
              <span className="storm-icon">⚠️</span>
              <span className="storm-text">{getStormLevel(solarData.kIndex)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="solar-content">
        <div className="solar-indices">
        <div className="index-grid">
          <div className="index-item">
            <div className="index-header">
              <span className="index-name">Solar Flux</span>
              <span className="index-unit">SFU</span>
            </div>
            <div
              className="index-value"
              style={{ color: getIndexColor(solarData.solarFluxIndex || 0, 'sfi') }}
            >
              {(solarData.solarFluxIndex || 0).toFixed(1)}
            </div>
            <div className="index-description">
              10.7cm radio flux
            </div>
          </div>

          <div className="index-item">
            <div className="index-header">
              <span className="index-name">K-Index</span>
              <span className="index-unit">0-9</span>
            </div>
            <div
              className="index-value"
              style={{ color: getIndexColor(solarData.kIndex || 0, 'k') }}
            >
              {solarData.kIndex || 0}
            </div>
            <div className="index-description">
              Geomagnetic activity
            </div>
          </div>

          <div className="index-item">
            <div className="index-header">
              <span className="index-name">A-Index</span>
              <span className="index-unit">nT</span>
            </div>
            <div
              className="index-value"
              style={{ color: getIndexColor(solarData.aIndex || 0, 'a') }}
            >
              {solarData.aIndex || 0}
            </div>
            <div className="index-description">
              Daily geomagnetic activity
            </div>
          </div>

          <div className="index-item">
            <div className="index-header">
              <span className="index-name">Solar Wind</span>
              <span className="index-unit">km/s</span>
            </div>
            <div className="index-value">
              {(solarData as any).solarWindSpeed || 'N/A'}
            </div>
            <div className="index-description">
              Solar wind speed
            </div>
          </div>
        </div>


      </div>

      <div className="solar-impact">
        <h4>Propagation Impact</h4>
        <div className="impact-grid">
          <div className="impact-item">
            <span className="impact-label">HF Conditions:</span>
            <span className={`impact-value ${solarData.kIndex <= 3 ? 'good' : solarData.kIndex <= 5 ? 'fair' : 'poor'}`}>
              {solarData.kIndex <= 3 ? 'Good' : solarData.kIndex <= 5 ? 'Fair' : 'Poor'}
            </span>
          </div>
          <div className="impact-item">
            <span className="impact-label">VHF/UHF:</span>
            <span className={`impact-value ${solarData.kIndex <= 4 ? 'good' : solarData.kIndex <= 6 ? 'fair' : 'poor'}`}>
              {solarData.kIndex <= 4 ? 'Normal' : solarData.kIndex <= 6 ? 'Enhanced' : 'Disturbed'}
            </span>
          </div>
          <div className="impact-item">
            <span className="impact-label">Aurora Activity:</span>
            <span className={`impact-value ${solarData.kIndex >= 5 ? 'high' : solarData.kIndex >= 3 ? 'moderate' : 'low'}`}>
              {solarData.kIndex >= 5 ? 'High' : solarData.kIndex >= 3 ? 'Moderate' : 'Low'}
            </span>
          </div>
        </div>
      </div>

      <div className="solar-summary">
        <div className="summary-text">
          {solarData.geomagneticStorm === 'NONE' ? (
            <span className="summary-good">
              ✅ Stable geomagnetic conditions. Normal HF propagation expected.
            </span>
          ) : (
            <span className="summary-warning">
              ⚠️ Geomagnetic disturbance in progress. HF propagation may be affected.
            </span>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
