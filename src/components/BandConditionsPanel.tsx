import React, { useMemo } from 'react';
import type { PropagationSpot } from '../types';

interface BandConditionsPanelProps {
  spots: PropagationSpot[];
}

const BandConditionsPanel = React.memo(function BandConditionsPanel({ spots }: BandConditionsPanelProps) {
  // Analyze real propagation data to determine band conditions
  const bandAnalysis = useMemo(() => {
    if (spots.length === 0) return [];

    const bands = ['160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '4m', '2m'];
    const analysis = bands.map(band => {
      const bandSpots = spots.filter(spot => spot.band === band);
      
      if (bandSpots.length === 0) {
        return null; // Skip bands with no data
      }

      // Calculate statistics
      const snrValues = bandSpots.map(spot => spot.snr);
      const distances = bandSpots.map(spot => spot.distance);
      const modes = [...new Set(bandSpots.map(spot => spot.mode))];
      
      const avgSNR = snrValues.reduce((sum, snr) => sum + snr, 0) / snrValues.length;
      const bestSNR = Math.max(...snrValues);
      const worstSNR = Math.min(...snrValues);
      const avgDistance = distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
      const maxDistance = Math.max(...distances);

      // Find best DX contact
      const bestDX = bandSpots.reduce((best, spot) => 
        spot.distance > best.distance ? spot : best
      );

      // Determine condition based on SNR distribution
      let condition: 'excellent' | 'good' | 'fair' | 'poor';
      if (avgSNR >= 0) condition = 'excellent';
      else if (avgSNR >= -10) condition = 'good';
      else if (avgSNR >= -20) condition = 'fair';
      else condition = 'poor';

      // Determine activity level
      let activity: 'high' | 'medium' | 'low';
      if (bandSpots.length >= 20) activity = 'high';
      else if (bandSpots.length >= 5) activity = 'medium';
      else activity = 'low';

      // Calculate confidence based on sample size
      const confidence = Math.min(100, (bandSpots.length / 10) * 100);

      return {
        band,
        condition,
        spots: bandSpots.length,
        avgSNR: Math.round(avgSNR * 10) / 10,
        bestSNR,
        worstSNR,
        avgDistance: Math.round(avgDistance),
        maxDistance: Math.round(maxDistance),
        modes,
        activity,
        confidence: Math.round(confidence),
        bestDX: {
          callsign: bestDX.receiver.callsign,
          distance: bestDX.distance,
          snr: bestDX.snr
        }
      };
    });

    return analysis.filter(band => band !== null); // Only return bands with data
  }, [spots]);

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return '#10b981'; // Green
      case 'good': return '#3b82f6'; // Blue
      case 'fair': return '#f59e0b'; // Yellow
      case 'poor': return '#ef4444'; // Red
      default: return '#6b7280'; // Gray
    }
  };

  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case 'excellent': return '🟢';
      case 'good': return '🔵';
      case 'fair': return '🟡';
      case 'poor': return '🔴';
      default: return '⚪';
    }
  };

  const getActivityIcon = (activity: string) => {
    switch (activity) {
      case 'high': return '📡';
      case 'medium': return '📊';
      case 'low': return '📉';
      default: return '⚪';
    }
  };

  const getBandFrequency = (band: string) => {
    const frequencies: { [key: string]: string } = {
      '160m': '1.8 MHz',
      '80m': '3.5 MHz',
      '60m': '5.3 MHz',
      '40m': '7.0 MHz',
      '30m': '10.1 MHz',
      '20m': '14.0 MHz',
      '17m': '18.1 MHz',
      '15m': '21.0 MHz',
      '12m': '24.9 MHz',
      '10m': '28.0 MHz',
      '6m': '50.0 MHz',
      '4m': '70.0 MHz',
      '2m': '144 MHz'
    };
    return frequencies[band] || '';
  };

  if (spots.length === 0) {
    return (
      <div className="band-conditions-empty">
        <div className="empty-icon">📊</div>
        <h3>No Propagation Data</h3>
        <p>Band conditions analysis requires propagation spots.</p>
        <small>Start transmitting or wait for data to load...</small>
      </div>
    );
  }

  if (bandAnalysis.length === 0) {
    return (
      <div className="band-conditions-empty">
        <div className="empty-icon">📊</div>
        <h3>No Band Activity</h3>
        <p>No spots found on any amateur bands.</p>
        <small>Try adjusting your filters or time range...</small>
      </div>
    );
  }

  return (
    <div className="band-conditions">
      <div className="conditions-header">
        <h3>Band Conditions</h3>
        <div className="conditions-count">{bandAnalysis.length} active bands</div>
      </div>

      <div className="band-list">
        {bandAnalysis.map((band) => (
          <div key={band.band} className="band-row">
            {/* Band & Status Column */}
            <div className="band-info">
              <div className="band-name">{band.band}</div>
              <div className="band-frequency">
                {getBandFrequency(band.band)}
              </div>
            </div>

            {/* Condition Column */}
            <div className="band-condition">
              <div
                className="condition-status"
                style={{ color: getConditionColor(band.condition) }}
              >
                {getConditionIcon(band.condition)} {band.condition.toUpperCase()}
              </div>
              <div className="condition-bar">
                <div
                  className="condition-fill"
                  style={{
                    width: `${band.confidence}%`,
                    backgroundColor: getConditionColor(band.condition)
                  }}
                />
              </div>
            </div>

            {/* Activity Column */}
            <div className="band-activity">
              <div className="activity-count">
                <span className="spots-count">{band.spots}</span>
                <span className="spots-label">spots</span>
              </div>
              <div className="activity-level">
                {getActivityIcon(band.activity)} {band.activity}
              </div>
            </div>

            {/* Signal Column */}
            <div className="band-signal">
              <div className="snr-stats">
                <div className="avg-snr">
                  <span className="snr-value" style={{ color: getConditionColor(band.condition) }}>
                    {band.avgSNR > 0 ? '+' : ''}{band.avgSNR}
                  </span>
                  <span className="snr-unit">dB avg</span>
                </div>
                <div className="best-snr">
                  <span className="snr-range">
                    {band.worstSNR} to {band.bestSNR > 0 ? '+' : ''}{band.bestSNR} dB
                  </span>
                </div>
              </div>
            </div>

            {/* DX Column */}
            <div className="band-dx">
              <div className="best-dx">
                <div className="dx-callsign">{band.bestDX.callsign}</div>
                <div className="dx-details">
                  <span className="dx-distance">{Math.round(band.bestDX.distance)} km</span>
                  <span className="dx-snr">({band.bestDX.snr > 0 ? '+' : ''}{band.bestDX.snr} dB)</span>
                </div>
              </div>
            </div>

            {/* Modes Column */}
            <div className="band-modes">
              <div className="modes-list">
                {band.modes.slice(0, 3).map(mode => (
                  <span key={mode} className="mode-tag">{mode}</span>
                ))}
                {band.modes.length > 3 && (
                  <span className="mode-more">+{band.modes.length - 3}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="conditions-summary">
        <div className="summary-stats">
          <div className="summary-stat">
            <span className="stat-value">{bandAnalysis.length}</span>
            <span className="stat-label">Active Bands</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">
              {bandAnalysis.find(b => b.condition === 'excellent')?.band ||
               bandAnalysis.find(b => b.condition === 'good')?.band ||
               bandAnalysis[0]?.band || 'None'}
            </span>
            <span className="stat-label">Best Band</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">
              {bandAnalysis.reduce((sum, b) => sum + b.spots, 0)}
            </span>
            <span className="stat-label">Total Spots</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">
              {Math.max(...bandAnalysis.map(b => b.bestSNR)) > 0 ? '+' : ''}{Math.max(...bandAnalysis.map(b => b.bestSNR))} dB
            </span>
            <span className="stat-label">Best SNR</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default BandConditionsPanel;
