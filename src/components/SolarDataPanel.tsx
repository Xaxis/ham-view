import React from 'react';
import type { SolarData } from '../types';

interface SolarDataPanelProps {
  solarData: SolarData | null;
}

export default function SolarDataPanel({ solarData }: SolarDataPanelProps) {
  if (!solarData) {
    return (
      <div className="solar-data-empty">
        <div className="empty-icon">☀️</div>
        <span>No solar data available</span>
        <small>Waiting for space weather data...</small>
      </div>
    );
  }

  const getStormColor = (storm: SolarData['geomagneticStorm']) => {
    switch (storm) {
      case 'EXTREME': return '#dc2626'; // Red
      case 'SEVERE': return '#ea580c'; // Orange-red
      case 'STRONG': return '#f59e0b'; // Orange
      case 'MODERATE': return '#eab308'; // Yellow
      case 'MINOR': return '#84cc16'; // Yellow-green
      case 'NONE': return '#10b981'; // Green
      default: return '#6b7280'; // Gray
    }
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
        <div className="last-update">
          <span className="update-label">Last Update:</span>
          <span className="update-time">{formatTimestamp(solarData.timestamp)}</span>
        </div>
        
        {solarData.geomagneticStorm !== 'NONE' && (
          <div 
            className="storm-alert"
            style={{ backgroundColor: getStormColor(solarData.geomagneticStorm) }}
          >
            <span className="storm-icon">⚠️</span>
            <span className="storm-text">{solarData.geomagneticStorm} STORM</span>
          </div>
        )}
      </div>

      <div className="solar-indices">
        <div className="index-grid">
          <div className="index-item">
            <div className="index-header">
              <span className="index-name">Solar Flux</span>
              <span className="index-unit">SFU</span>
            </div>
            <div 
              className="index-value"
              style={{ color: getIndexColor(solarData.solarFluxIndex, 'sfi') }}
            >
              {solarData.solarFluxIndex.toFixed(1)}
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
              style={{ color: getIndexColor(solarData.kIndex, 'k') }}
            >
              {solarData.kIndex}
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
              style={{ color: getIndexColor(solarData.aIndex, 'a') }}
            >
              {solarData.aIndex}
            </div>
            <div className="index-description">
              Daily geomagnetic activity
            </div>
          </div>

          <div className="index-item">
            <div className="index-header">
              <span className="index-name">Sunspots</span>
              <span className="index-unit">SSN</span>
            </div>
            <div className="index-value">
              {solarData.sunspotNumber}
            </div>
            <div className="index-description">
              Sunspot number
            </div>
          </div>
        </div>

        {solarData.xrayFlux && (
          <div className="xray-section">
            <h4>X-Ray Flux</h4>
            <div className="xray-grid">
              <div className="xray-item">
                <span className="xray-label">Short (0.1-0.8nm):</span>
                <span className="xray-value">{solarData.xrayFlux.short.toExponential(2)}</span>
              </div>
              <div className="xray-item">
                <span className="xray-label">Long (0.05-0.4nm):</span>
                <span className="xray-value">{solarData.xrayFlux.long.toExponential(2)}</span>
              </div>
            </div>
          </div>
        )}
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
  );
}
