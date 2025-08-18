import React from 'react';
import type { PropagationSpot, BandCondition } from '../types';

interface StatisticsPanelProps {
  spots: PropagationSpot[];
  bandConditions: BandCondition[];
}

export default function StatisticsPanel({ spots, bandConditions }: StatisticsPanelProps) {
  if (spots.length === 0) {
    return (
      <div className="statistics-empty">
        <div className="empty-icon">📈</div>
        <span>No data for statistics</span>
        <small>Statistics will appear when propagation data is available</small>
      </div>
    );
  }

  // Calculate statistics
  const stats = {
    totalSpots: spots.length,
    uniqueTransmitters: new Set(spots.map(s => s.transmitter.callsign)).size,
    uniqueReceivers: new Set(spots.map(s => s.receiver.callsign)).size,
    timeRange: {
      start: spots.length > 0 ? new Date(Math.min(...spots.map(s => s.timestamp.getTime()))) : new Date(),
      end: spots.length > 0 ? new Date(Math.max(...spots.map(s => s.timestamp.getTime()))) : new Date(),
    },
    bandDistribution: {} as Record<string, number>,
    modeDistribution: {} as Record<string, number>,
    averageSnr: 0,
    snrRange: { min: 0, max: 0 },
  };

  // Calculate distributions
  spots.forEach(spot => {
    stats.bandDistribution[spot.band] = (stats.bandDistribution[spot.band] || 0) + 1;
    stats.modeDistribution[spot.mode] = (stats.modeDistribution[spot.mode] || 0) + 1;
  });

  // Calculate SNR statistics
  const snrValues = spots.filter(s => s.snr !== undefined).map(s => s.snr!);
  if (snrValues.length > 0) {
    stats.averageSnr = snrValues.reduce((sum, snr) => sum + snr, 0) / snrValues.length;
    stats.snrRange.min = Math.min(...snrValues);
    stats.snrRange.max = Math.max(...snrValues);
  }

  const formatDuration = (start: Date, end: Date) => {
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  const getTopEntries = (distribution: Record<string, number>, limit: number = 5) => {
    return Object.entries(distribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit);
  };

  return (
    <div className="statistics-panel">
      {/* Overview Stats */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-value">{stats.totalSpots.toLocaleString()}</div>
          <div className="stat-label">Total Spots</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.uniqueTransmitters}</div>
          <div className="stat-label">Transmitters</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.uniqueReceivers}</div>
          <div className="stat-label">Receivers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatDuration(stats.timeRange.start, stats.timeRange.end)}</div>
          <div className="stat-label">Time Span</div>
        </div>
      </div>

      {/* Signal Quality */}
      {snrValues.length > 0 && (
        <div className="stats-section">
          <h3>Signal Quality</h3>
          <div className="signal-stats">
            <div className="signal-stat">
              <span className="signal-label">Average SNR:</span>
              <span className="signal-value">{stats.averageSnr.toFixed(1)} dB</span>
            </div>
            <div className="signal-stat">
              <span className="signal-label">SNR Range:</span>
              <span className="signal-value">
                {stats.snrRange.min.toFixed(1)} to {stats.snrRange.max.toFixed(1)} dB
              </span>
            </div>
            <div className="signal-stat">
              <span className="signal-label">Samples:</span>
              <span className="signal-value">{snrValues.length} spots</span>
            </div>
          </div>
        </div>
      )}

      {/* Band Distribution */}
      <div className="stats-section">
        <h3>Band Activity</h3>
        <div className="distribution-chart">
          {getTopEntries(stats.bandDistribution).map(([band, count]) => {
            const percentage = (count / stats.totalSpots) * 100;
            return (
              <div key={band} className="distribution-item">
                <div className="distribution-header">
                  <span className="distribution-label">{band}</span>
                  <span className="distribution-count">{count} ({percentage.toFixed(1)}%)</span>
                </div>
                <div className="distribution-bar">
                  <div 
                    className="distribution-fill"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mode Distribution */}
      <div className="stats-section">
        <h3>Mode Activity</h3>
        <div className="distribution-chart">
          {getTopEntries(stats.modeDistribution).map(([mode, count]) => {
            const percentage = (count / stats.totalSpots) * 100;
            return (
              <div key={mode} className="distribution-item">
                <div className="distribution-header">
                  <span className="distribution-label">{mode}</span>
                  <span className="distribution-count">{count} ({percentage.toFixed(1)}%)</span>
                </div>
                <div className="distribution-bar">
                  <div 
                    className="distribution-fill"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Band Conditions Summary */}
      <div className="stats-section">
        <h3>Band Conditions Summary</h3>
        <div className="conditions-summary">
          {bandConditions.map(condition => (
            <div key={condition.band} className="condition-summary-item">
              <span className="condition-band">{condition.band}</span>
              <span className={`condition-status ${condition.condition.toLowerCase()}`}>
                {condition.condition}
              </span>
              <span className="condition-confidence">{condition.confidence}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Time Range Info */}
      <div className="stats-section">
        <h3>Data Range</h3>
        <div className="time-range-info">
          <div className="time-item">
            <span className="time-label">From:</span>
            <span className="time-value">{stats.timeRange.start.toLocaleString()}</span>
          </div>
          <div className="time-item">
            <span className="time-label">To:</span>
            <span className="time-value">{stats.timeRange.end.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
