import React from 'react';
import type { PropagationSpot } from '../types';

interface RecentSpotsPanelProps {
  spots: PropagationSpot[];
  onSpotSelect?: (spot: PropagationSpot) => void;
  selectedSpot?: PropagationSpot | null;
}

export default function RecentSpotsPanel({ spots, onSpotSelect, selectedSpot }: RecentSpotsPanelProps) {
  // Show only the most recent 20 spots
  const recentSpots = spots.slice(0, 20);

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

  const getSignalQuality = (snr?: number): { label: string; color: string } => {
    if (snr === undefined) return { label: 'Unknown', color: '#6b7280' };
    
    if (snr >= 0) return { label: 'Excellent', color: '#10b981' };
    if (snr >= -10) return { label: 'Good', color: '#3b82f6' };
    if (snr >= -20) return { label: 'Fair', color: '#f59e0b' };
    return { label: 'Poor', color: '#ef4444' };
  };

  if (recentSpots.length === 0) {
    return (
      <div className="recent-spots-empty">
        <div className="empty-icon">📻</div>
        <span>No recent spots</span>
        <small>Waiting for propagation data...</small>
      </div>
    );
  }

  return (
    <div className="recent-spots">
      <div className="spots-header">
        <span className="spots-count">{spots.length} total spots</span>
        <span className="spots-subtitle">Showing {recentSpots.length} most recent</span>
      </div>
      
      <div className="spots-list">
        {recentSpots.map((spot) => {
          const signalQuality = getSignalQuality(spot.snr);
          const isSelected = selectedSpot?.id === spot.id;
          
          return (
            <div
              key={spot.id}
              className={`spot-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSpotSelect?.(spot)}
            >
              <div className="spot-header">
                <div className="spot-callsigns">
                  <span className="transmitter">{spot.transmitter.callsign}</span>
                  <span className="arrow">→</span>
                  <span className="receiver">{spot.receiver.callsign}</span>
                </div>
                <span className="spot-time">{formatTime(spot.timestamp)}</span>
              </div>
              
              <div className="spot-details">
                <div className="frequency-band">
                  <span className="frequency">{formatFrequency(spot.frequency)}</span>
                  <span className="band">{spot.band}</span>
                  <span className="mode">{spot.mode}</span>
                </div>
                
                {spot.snr !== undefined && (
                  <div className="signal-info">
                    <span 
                      className="snr-value"
                      style={{ color: signalQuality.color }}
                    >
                      {spot.snr > 0 ? '+' : ''}{spot.snr} dB
                    </span>
                    <span 
                      className="signal-quality"
                      style={{ color: signalQuality.color }}
                    >
                      {signalQuality.label}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="spot-locations">
                <div className="location tx-location">
                  <span className="location-label">TX:</span>
                  <span className="grid-square">{spot.transmitter.location.gridSquare}</span>
                  {spot.transmitter.location.name && (
                    <span className="location-name">{spot.transmitter.location.name}</span>
                  )}
                </div>
                <div className="location rx-location">
                  <span className="location-label">RX:</span>
                  <span className="grid-square">{spot.receiver.location.gridSquare}</span>
                  {spot.receiver.location.name && (
                    <span className="location-name">{spot.receiver.location.name}</span>
                  )}
                </div>
              </div>
              
              <div className="spot-source">
                <span className="source-label">Source:</span>
                <span className="source-value">{spot.source.replace('_', ' ')}</span>
              </div>
            </div>
          );
        })}
      </div>
      
      {spots.length > recentSpots.length && (
        <div className="spots-footer">
          <span className="more-spots">
            +{spots.length - recentSpots.length} more spots available
          </span>
        </div>
      )}
    </div>
  );
}
