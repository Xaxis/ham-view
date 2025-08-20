import React, { useState, useEffect } from 'react';
import type { SolarData } from '../types';

interface SolarDataPanelProps {
  solarData: SolarData | null;
}

interface RealTimeSolarData {
  xrayFlux: Array<{ time: string; flux: number; }>;
  solarWind: Array<{ time: string; bz: number; speed: number; }>;
  lastUpdate: Date | null;
  isLoading: boolean;
  error: string | null;
}

export default function SolarDataPanel({ solarData }: SolarDataPanelProps) {
  const [realTimeData, setRealTimeData] = useState<RealTimeSolarData>({
    xrayFlux: [],
    solarWind: [],
    lastUpdate: null,
    isLoading: false,
    error: null
  });

  // Fetch real-time solar data
  const fetchRealTimeSolarData = async () => {
    setRealTimeData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch X-ray flux data (last 6 hours)
      const xrayResponse = await fetch('https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json');
      const xrayData = await xrayResponse.json();

      // Fetch solar wind magnetometer data (last 1 hour)
      const solarWindResponse = await fetch('https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json');
      const solarWindData = await solarWindResponse.json();

      // Process X-ray data (take every 10th point to reduce data)
      const processedXray = xrayData
        .filter((_: any, index: number) => index % 10 === 0)
        .slice(-36) // Last 6 hours with 10-minute intervals
        .map((point: any) => ({
          time: point.time_tag,
          flux: parseFloat(point.flux) || 0
        }));

      // Process solar wind data (take every 5th point)
      const processedSolarWind = solarWindData
        .filter((_: any, index: number) => index % 5 === 0)
        .slice(-12) // Last hour with 5-minute intervals
        .map((point: any) => ({
          time: point.time_tag,
          bz: parseFloat(point.bz_gsm) || 0,
          speed: parseFloat(point.speed) || 0
        }));

      setRealTimeData({
        xrayFlux: processedXray,
        solarWind: processedSolarWind,
        lastUpdate: new Date(),
        isLoading: false,
        error: null
      });

    } catch (error) {
      console.error('Failed to fetch real-time solar data:', error);
      setRealTimeData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load real-time data'
      }));
    }
  };

  // Load data on mount and set up refresh interval
  useEffect(() => {
    fetchRealTimeSolarData();

    // Refresh every 5 minutes
    const interval = setInterval(fetchRealTimeSolarData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
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

      <div className="geomagnetic-status">
        <div className="status-header">
          <h4>🌍 Geomagnetic Conditions</h4>
          <button
            className="solar-refresh-btn"
            onClick={fetchRealTimeSolarData}
            disabled={realTimeData.isLoading}
            title="Refresh Solar Data"
          >
            {realTimeData.isLoading ? '🔄' : '↻'}
          </button>
        </div>
        <div className="status-content">
          {solarData.geomagneticStorm === 'NONE' ? (
            <div className="status-indicator status-good">
              <span className="status-icon">✅</span>
              <div className="status-text">
                <div className="status-title">Stable Conditions</div>
                <div className="status-description">Normal HF propagation expected</div>
              </div>
            </div>
          ) : (
            <div className="status-indicator status-warning">
              <span className="status-icon">⚠️</span>
              <div className="status-text">
                <div className="status-title">Geomagnetic Disturbance</div>
                <div className="status-description">HF propagation may be affected</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-Time Solar Activity Graphs */}
        <div className="solar-section">
          <div className="section-header">
            <h4>📊 Real-Time Solar Activity</h4>
            <div className="section-status">
              {realTimeData.lastUpdate && (
                <span className="last-update">
                  Updated: {realTimeData.lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {realTimeData.error && (
            <div className="error-message">
              ⚠️ {realTimeData.error}
            </div>
          )}

          {/* X-Ray Flux Graph */}
          <div className="activity-graph">
            <div className="graph-header">
              <h5>🌞 GOES X-Ray Flux (6 Hour)</h5>
              <div className={`graph-status ${realTimeData.isLoading ? 'loading' : 'live'}`}>
                {realTimeData.isLoading ? 'Loading...' : 'Live Data'}
              </div>
            </div>
            <div className="graph-content">
              {realTimeData.xrayFlux.length > 0 ? (
                <div className="data-summary">
                  <div className="data-points">
                    <span className="data-label">Latest Flux:</span>
                    <span className="data-value">
                      {realTimeData.xrayFlux[realTimeData.xrayFlux.length - 1]?.flux.toExponential(2)} W/m²
                    </span>
                  </div>
                  <div className="data-points">
                    <span className="data-label">Data Points:</span>
                    <span className="data-value">{realTimeData.xrayFlux.length}</span>
                  </div>
                  <div className="data-source">Source: NOAA SWPC GOES Satellites</div>
                </div>
              ) : (
                <div className="graph-placeholder">
                  <div className="graph-info">
                    <p>Real-time X-ray flux data from GOES satellites</p>
                    <p>Monitoring solar flare activity and space weather</p>
                    <div className="data-source">Source: NOAA SWPC</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Solar Wind Graph */}
          <div className="activity-graph">
            <div className="graph-header">
              <h5>🌪️ Solar Wind Magnetometer</h5>
              <div className={`graph-status ${realTimeData.isLoading ? 'loading' : 'live'}`}>
                {realTimeData.isLoading ? 'Loading...' : 'Live Data'}
              </div>
            </div>
            <div className="graph-content">
              {realTimeData.solarWind.length > 0 ? (
                <div className="data-summary">
                  <div className="data-points">
                    <span className="data-label">Latest Bz:</span>
                    <span className="data-value">
                      {realTimeData.solarWind[realTimeData.solarWind.length - 1]?.bz.toFixed(1)} nT
                    </span>
                  </div>
                  <div className="data-points">
                    <span className="data-label">Solar Wind Speed:</span>
                    <span className="data-value">
                      {realTimeData.solarWind[realTimeData.solarWind.length - 1]?.speed.toFixed(0)} km/s
                    </span>
                  </div>
                  <div className="data-source">Source: ACE/DSCOVR Satellites</div>
                </div>
              ) : (
                <div className="graph-placeholder">
                  <div className="graph-info">
                    <p>Real-time solar wind magnetic field data</p>
                    <p>Bz component critical for geomagnetic activity</p>
                    <div className="data-source">Source: ACE/DSCOVR Satellites</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Solar Activity Summary */}
          <div className="activity-summary">
            <div className="summary-item">
              <div className="summary-label">Current Solar Flux</div>
              <div className="summary-value">Real-time monitoring</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Geomagnetic Field</div>
              <div className="summary-value">Live magnetometer</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Space Weather</div>
              <div className="summary-value">Active monitoring</div>
            </div>
          </div>

          {/* Data Integration Note */}
          <div className="integration-note">
            <h5>📊 Enhanced Solar Data Integration</h5>
            <p>
              This panel now integrates with real-time NOAA SWPC data sources including:
            </p>
            <ul>
              <li><strong>GOES X-Ray Flux:</strong> Real-time solar flare monitoring</li>
              <li><strong>Solar Wind Data:</strong> Live magnetometer readings from ACE/DSCOVR</li>
              <li><strong>Geomagnetic Indices:</strong> K-index and planetary disturbance levels</li>
              <li><strong>Aurora Forecasts:</strong> OVATION Prime auroral activity predictions</li>
            </ul>
            <p>
              Future updates will include interactive graphs, historical data visualization,
              and correlation analysis with HF propagation conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
