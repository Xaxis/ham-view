import React from 'react';
import type { PropagationSpot, BandCondition } from '../types';

interface StatisticsPanelProps {
  spots: PropagationSpot[];
  bandConditions: BandCondition[];
}

export default function StatisticsPanel({ spots, bandConditions }: StatisticsPanelProps) {
  if (spots.length === 0) {
    return (
      <div className="statistics">
        <div className="statistics-empty">
          <div className="empty-icon">📈</div>
          <span>No propagation data available</span>
          <small>Statistics will appear when spots are received</small>
        </div>
      </div>
    );
  }

  // Calculate comprehensive statistics
  const snrValues = spots.filter(s => s.snr !== undefined).map(s => s.snr!);
  const distances = spots.map(s => s.distance);
  const uniqueCallsigns = new Set([...spots.map(s => s.transmitter.callsign), ...spots.map(s => s.receiver.callsign)]);

  // Band analysis
  const bandStats = spots.reduce((acc, spot) => {
    if (!acc[spot.band]) {
      acc[spot.band] = { count: 0, snrSum: 0, snrCount: 0, maxDistance: 0, modes: new Set() };
    }
    acc[spot.band].count++;
    acc[spot.band].modes.add(spot.mode);
    acc[spot.band].maxDistance = Math.max(acc[spot.band].maxDistance, spot.distance);
    if (spot.snr !== undefined) {
      acc[spot.band].snrSum += spot.snr;
      acc[spot.band].snrCount++;
    }
    return acc;
  }, {} as Record<string, any>);

  // Mode analysis
  const modeStats = spots.reduce((acc, spot) => {
    if (!acc[spot.mode]) {
      acc[spot.mode] = { count: 0, bands: new Set(), avgSnr: 0, snrSum: 0, snrCount: 0 };
    }
    acc[spot.mode].count++;
    acc[spot.mode].bands.add(spot.band);
    if (spot.snr !== undefined) {
      acc[spot.mode].snrSum += spot.snr;
      acc[spot.mode].snrCount++;
    }
    return acc;
  }, {} as Record<string, any>);

  // Calculate averages
  Object.values(modeStats).forEach((mode: any) => {
    mode.avgSnr = mode.snrCount > 0 ? mode.snrSum / mode.snrCount : 0;
  });

  // Distance analysis
  const distanceRanges = {
    'Local (0-500km)': distances.filter(d => d <= 500).length,
    'Regional (500-1500km)': distances.filter(d => d > 500 && d <= 1500).length,
    'Continental (1500-5000km)': distances.filter(d => d > 1500 && d <= 5000).length,
    'DX (5000km+)': distances.filter(d => d > 5000).length,
  };

  // Signal quality distribution
  const snrRanges = {
    'Excellent (+10dB+)': snrValues.filter(s => s >= 10).length,
    'Good (0 to +10dB)': snrValues.filter(s => s >= 0 && s < 10).length,
    'Fair (-10 to 0dB)': snrValues.filter(s => s >= -10 && s < 0).length,
    'Poor (-20 to -10dB)': snrValues.filter(s => s >= -20 && s < -10).length,
    'Very Poor (<-20dB)': snrValues.filter(s => s < -20).length,
  };

  // Time analysis
  const timeRange = {
    start: new Date(Math.min(...spots.map(s => s.timestamp.getTime()))),
    end: new Date(Math.max(...spots.map(s => s.timestamp.getTime()))),
  };

  const hourlyActivity = spots.reduce((acc, spot) => {
    const hour = spot.timestamp.getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const formatDuration = (start: Date, end: Date) => {
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  const getPercentage = (value: number, total: number) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  };

  const getPeakHour = () => {
    const maxActivity = Math.max(...Object.values(hourlyActivity));
    const peakHour = Object.entries(hourlyActivity).find(([, count]) => count === maxActivity)?.[0];
    return peakHour ? `${peakHour}:00 UTC` : 'N/A';
  };

  return (
    <div className="statistics">
      <div className="statistics-header">
        <h3>Propagation Statistics</h3>
        <div className="stats-count">{spots.length.toLocaleString()} spots analyzed</div>
      </div>

      <div className="statistics-content">
        {/* Key Metrics */}
        <div className="stats-overview">
          <div className="stat-metric">
            <div className="metric-value">{spots.length.toLocaleString()}</div>
            <div className="metric-label">Total Spots</div>
          </div>
          <div className="stat-metric">
            <div className="metric-value">{uniqueCallsigns.size}</div>
            <div className="metric-label">Unique Stations</div>
          </div>
          <div className="stat-metric">
            <div className="metric-value">{Object.keys(bandStats).length}</div>
            <div className="metric-label">Active Bands</div>
          </div>
          <div className="stat-metric">
            <div className="metric-value">{formatDuration(timeRange.start, timeRange.end)}</div>
            <div className="metric-label">Time Span</div>
          </div>
        </div>

        {/* Signal Quality Distribution */}
        {snrValues.length > 0 && (
          <div className="stats-section">
            <h4>Signal Quality Distribution</h4>
            <div className="quality-grid">
              {Object.entries(snrRanges).map(([range, count]) => (
                <div key={range} className="quality-item">
                  <div className="quality-header">
                    <span className="quality-range">{range}</span>
                    <span className="quality-count">{count} ({getPercentage(count, snrValues.length)}%)</span>
                  </div>
                  <div className="quality-bar">
                    <div
                      className="quality-fill"
                      style={{
                        width: `${getPercentage(count, snrValues.length)}%`,
                        backgroundColor: getQualityColor(range)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="signal-summary">
              <div className="signal-stat">
                <span className="stat-label">Average SNR:</span>
                <span className="stat-value">{(snrValues.reduce((a, b) => a + b, 0) / snrValues.length).toFixed(1)} dB</span>
              </div>
              <div className="signal-stat">
                <span className="stat-label">Best Signal:</span>
                <span className="stat-value">{Math.max(...snrValues).toFixed(1)} dB</span>
              </div>
              <div className="signal-stat">
                <span className="stat-label">Weakest Signal:</span>
                <span className="stat-value">{Math.min(...snrValues).toFixed(1)} dB</span>
              </div>
            </div>
          </div>
        )}

        {/* Distance Analysis */}
        <div className="stats-section">
          <h4>Distance Analysis</h4>
          <div className="distance-grid">
            {Object.entries(distanceRanges).map(([range, count]) => (
              <div key={range} className="distance-item">
                <div className="distance-header">
                  <span className="distance-range">{range}</span>
                  <span className="distance-count">{count} ({getPercentage(count, spots.length)}%)</span>
                </div>
                <div className="distance-bar">
                  <div
                    className="distance-fill"
                    style={{ width: `${getPercentage(count, spots.length)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="distance-summary">
            <div className="distance-stat">
              <span className="stat-label">Average Distance:</span>
              <span className="stat-value">{Math.round(distances.reduce((a, b) => a + b, 0) / distances.length).toLocaleString()} km</span>
            </div>
            <div className="distance-stat">
              <span className="stat-label">Maximum DX:</span>
              <span className="stat-value">{Math.round(Math.max(...distances)).toLocaleString()} km</span>
            </div>
          </div>
        </div>

        {/* Band Performance */}
        <div className="stats-section">
          <h4>Band Performance</h4>
          <div className="band-performance">
            {Object.entries(bandStats)
              .sort(([,a], [,b]) => b.count - a.count)
              .slice(0, 6)
              .map(([band, stats]) => (
                <div key={band} className="band-perf-item">
                  <div className="band-perf-header">
                    <span className="band-name">{band}</span>
                    <span className="band-spots">{stats.count} spots</span>
                  </div>
                  <div className="band-perf-details">
                    <div className="perf-detail">
                      <span className="detail-label">Avg SNR:</span>
                      <span className="detail-value">
                        {stats.snrCount > 0 ? (stats.snrSum / stats.snrCount).toFixed(1) : 'N/A'} dB
                      </span>
                    </div>
                    <div className="perf-detail">
                      <span className="detail-label">Max DX:</span>
                      <span className="detail-value">{Math.round(stats.maxDistance).toLocaleString()} km</span>
                    </div>
                    <div className="perf-detail">
                      <span className="detail-label">Modes:</span>
                      <span className="detail-value">{Array.from(stats.modes).join(', ')}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="stats-section">
          <h4>Activity Timeline</h4>
          <div className="timeline-summary">
            <div className="timeline-stat">
              <span className="stat-label">Data Period:</span>
              <span className="stat-value">{timeRange.start.toLocaleDateString()} - {timeRange.end.toLocaleDateString()}</span>
            </div>
            <div className="timeline-stat">
              <span className="stat-label">Peak Hour:</span>
              <span className="stat-value">{getPeakHour()}</span>
            </div>
            <div className="timeline-stat">
              <span className="stat-label">Spots/Hour:</span>
              <span className="stat-value">{(spots.length / Math.max(1, (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60))).toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function getQualityColor(range: string): string {
    if (range.includes('Excellent')) return '#10b981';
    if (range.includes('Good')) return '#3b82f6';
    if (range.includes('Fair')) return '#f59e0b';
    if (range.includes('Poor') && !range.includes('Very')) return '#ef4444';
    return '#6b7280';
  }
}
