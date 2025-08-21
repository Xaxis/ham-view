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
      <div className="panel-header">
        <h3>Solar & Geomagnetic</h3>
        <div className="panel-controls">
          <div className="panel-timestamp">{formatTimestamp(solarData.timestamp)}</div>
          {solarData.kIndex >= 4 && (
            <div
              className="storm-alert"
              style={{ backgroundColor: getStormColor(solarData.kIndex) }}
            >
              <span className="storm-icon">⚠️</span>
              <span className="storm-text">{getStormLevel(solarData.kIndex)}</span>
            </div>
          )}
          <button
            className="solar-refresh-btn"
            onClick={() => {
              fetchRealTimeSolarData();
            }}
            disabled={realTimeData.isLoading}
            title="Refresh All Solar Data"
          >
            {realTimeData.isLoading ? '🔄' : '↻'}
          </button>
        </div>
      </div>

      {realTimeData.error && (
        <div className="error-message">
          ⚠️ {realTimeData.error}
        </div>
      )}

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

      <div className="solar-activity-grid">
        <div className="index-item">
          <div className="index-header">
            <span className="index-name">☀️ X-Ray Flux</span>
            <span className="index-unit">W/m²</span>
          </div>
          <div className="index-value">
            {realTimeData.xrayFlux.length > 0 ?
              realTimeData.xrayFlux[realTimeData.xrayFlux.length - 1]?.flux.toExponential(1) :
              'N/A'}
          </div>
          <div className="index-description">
            {realTimeData.xrayFlux.length > 1 ?
              (realTimeData.xrayFlux[realTimeData.xrayFlux.length - 1]?.flux >
               realTimeData.xrayFlux[realTimeData.xrayFlux.length - 2]?.flux ? 'Rising trend' : 'Falling trend')
              : 'GOES satellite data'}
          </div>
        </div>

        <div className="index-item">
          <div className="index-header">
            <span className="index-name">🌌 Planetary K-Index</span>
            <span className="index-unit">0-9</span>
          </div>
          <div className="index-value" style={{
            color: solarData.kIndex >= 5 ? '#ef4444' :
                   solarData.kIndex >= 3 ? '#f59e0b' : '#10b981'
          }}>
            {solarData.kIndex || 0}
          </div>
          <div className="index-description">
            {solarData.kIndex >= 5 ? 'Storm conditions' :
             solarData.kIndex >= 3 ? 'Unsettled field' :
             'Quiet geomagnetic field'}
          </div>
        </div>
      </div>

    </div>
  );
}
