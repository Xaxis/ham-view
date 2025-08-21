import React, { useState, useMemo } from 'react';
import type { PropagationSpot } from '../types';

interface RecentSpotsPanelProps {
  spots: PropagationSpot[];
  onSpotSelect?: (spot: PropagationSpot) => void;
  selectedSpot?: PropagationSpot | null;
}

const RecentSpotsPanel = React.memo(function RecentSpotsPanel({ spots, onSpotSelect, selectedSpot }: RecentSpotsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter and sort spots based on search term
  const filteredAndSortedSpots = useMemo(() => {
    let filtered = spots;

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = spots.filter(spot =>
        spot.transmitter.callsign.toLowerCase().includes(search) ||
        spot.receiver.callsign.toLowerCase().includes(search) ||
        spot.band.toLowerCase().includes(search) ||
        spot.mode.toLowerCase().includes(search) ||
        spot.transmitter.location.country?.toLowerCase().includes(search) ||
        spot.receiver.location.country?.toLowerCase().includes(search)
      );
    }

    // Sort by timestamp (newest first) and limit to 100 spots
    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 100);
  }, [spots, searchTerm]);

  const formatFrequency = (frequency: number): string => {
    if (frequency >= 1000000) {
      return `${(frequency / 1000000).toFixed(3)} MHz`;
    } else if (frequency >= 1000) {
      return `${(frequency / 1000).toFixed(1)} kHz`;
    }
    return `${frequency} Hz`;
  };

  const formatTime = (timestamp: Date): string => {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const formatDistance = (distance: number): string => {
    if (distance < 1000) {
      return `${Math.round(distance)} km`;
    }
    return `${(distance / 1000).toFixed(1)}k km`;
  };

  const getSignalQuality = (snr?: number): { label: string; color: string; icon: string } => {
    if (snr === undefined) return { label: 'Unknown', color: '#6b7280', icon: '⚪' };
    
    if (snr >= 0) return { label: 'Excellent', color: '#10b981', icon: '🟢' };
    if (snr >= -10) return { label: 'Good', color: '#3b82f6', icon: '🔵' };
    if (snr >= -20) return { label: 'Fair', color: '#f59e0b', icon: '🟡' };
    return { label: 'Poor', color: '#ef4444', icon: '🔴' };
  };

  const getDirectionInfo = (spot: PropagationSpot) => {
    // Determine if this is TX or RX based on the filtered callsign
    // For now, assume transmitter is the "home" station
    return {
      direction: 'TX→RX',
      from: spot.transmitter.callsign,
      to: spot.receiver.callsign,
      fromGrid: spot.transmitter.location.maidenhead,
      toGrid: spot.receiver.location.maidenhead
    };
  };

  if (filteredAndSortedSpots.length === 0) {
    return (
      <div className="recent-spots-empty">
        <div className="empty-icon">📻</div>
        <h3>{searchTerm ? 'No Matching Spots' : 'No Recent Spots'}</h3>
        <p>{searchTerm ? `No spots found matching "${searchTerm}"` : 'No propagation spots found.'}</p>
        <small>{searchTerm ? 'Try a different search term...' : 'Check your filters or wait for new data...'}</small>
      </div>
    );
  }

  return (
    <div className="recent-spots">
      <div className="spots-header">
        <h3>Recent Spots</h3>
        <div className="spots-count">
          {filteredAndSortedSpots.length} of {spots.length}
          {searchTerm && <span className="search-indicator"> (filtered)</span>}
        </div>
      </div>

      {/* Search Bar */}
      <div className="spots-search">
        <div className="search-input-container">
          <input
            type="text"
            placeholder="Search callsigns, bands, modes, countries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <div className="search-icon">🔍</div>
          {searchTerm && (
            <button
              className="clear-search"
              onClick={() => setSearchTerm('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="spots-list">
        {filteredAndSortedSpots.map((spot) => {
          const signalQuality = getSignalQuality(spot.snr);
          const direction = getDirectionInfo(spot);
          const isSelected = selectedSpot?.id === spot.id;

          return (
            <div
              key={spot.id}
              className={`spot-row ${isSelected ? 'selected' : ''}`}
              onClick={() => onSpotSelect?.(spot)}
            >
              {/* Time Column */}
              <div className="spot-time">
                {formatTime(spot.timestamp)}
              </div>

              {/* Callsigns Column */}
              <div className="spot-callsigns">
                <div className="callsign-pair">
                  <span className="tx-call">{direction.from}</span>
                  <span className="arrow">→</span>
                  <span className="rx-call">{direction.to}</span>
                </div>
                <div className="grid-pair">
                  <span className="tx-grid">{direction.fromGrid}</span>
                  <span className="rx-grid">{direction.toGrid}</span>
                </div>
              </div>

              {/* Frequency & Mode Column */}
              <div className="spot-freq">
                <div className="frequency">{formatFrequency(spot.frequency)}</div>
                <div className="mode-band">
                  <span className="mode">{spot.mode}</span>
                  <span className="band">{spot.band}</span>
                </div>
              </div>

              {/* Signal Column */}
              <div className="spot-signal">
                <div className="snr-value" style={{ color: signalQuality.color }}>
                  {spot.snr !== undefined ? `${spot.snr > 0 ? '+' : ''}${spot.snr}` : 'N/A'}
                  <span className="snr-unit">dB</span>
                </div>
                <div className="signal-bar">
                  <div
                    className="signal-fill"
                    style={{
                      width: `${Math.max(0, Math.min(100, (spot.snr || -30) + 30))}%`,
                      backgroundColor: signalQuality.color
                    }}
                  />
                </div>
              </div>

              {/* Distance Column */}
              <div className="spot-distance">
                <div className="distance-value">{formatDistance(spot.distance)}</div>
                <div className="bearing">{Math.round(spot.bearing)}°</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default RecentSpotsPanel;
