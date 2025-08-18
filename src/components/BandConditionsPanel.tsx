import React from 'react';
import type { BandCondition } from '../types';

interface BandConditionsPanelProps {
  conditions: BandCondition[];
}

export default function BandConditionsPanel({ conditions }: BandConditionsPanelProps) {
  const getConditionColor = (condition: BandCondition['condition']) => {
    switch (condition) {
      case 'EXCELLENT': return '#10b981'; // Green
      case 'GOOD': return '#3b82f6'; // Blue
      case 'FAIR': return '#f59e0b'; // Yellow
      case 'POOR': return '#ef4444'; // Red
      default: return '#6b7280'; // Gray
    }
  };

  const getConditionIcon = (condition: BandCondition['condition']) => {
    switch (condition) {
      case 'EXCELLENT': return '🟢';
      case 'GOOD': return '🔵';
      case 'FAIR': return '🟡';
      case 'POOR': return '🔴';
      default: return '⚪';
    }
  };

  const getTrendIcon = (trend: BandCondition['trend']) => {
    switch (trend) {
      case 'IMPROVING': return '📈';
      case 'DECLINING': return '📉';
      case 'STABLE': return '➡️';
      default: return '➡️';
    }
  };

  if (conditions.length === 0) {
    return (
      <div className="band-conditions-empty">
        <div className="empty-icon">📊</div>
        <span>No band data available</span>
        <small>Waiting for propagation data...</small>
      </div>
    );
  }

  return (
    <div className="band-conditions">
      <div className="conditions-grid">
        {conditions.map((condition) => (
          <div key={condition.band} className="condition-item">
            <div className="condition-header">
              <span className="band-name">{condition.band}</span>
              <span className="condition-icon">
                {getConditionIcon(condition.condition)}
              </span>
            </div>
            
            <div className="condition-details">
              <div className="condition-status">
                <span 
                  className="status-text"
                  style={{ color: getConditionColor(condition.condition) }}
                >
                  {condition.condition}
                </span>
                <span className="trend-icon" title={`Trend: ${condition.trend}`}>
                  {getTrendIcon(condition.trend)}
                </span>
              </div>
              
              <div className="condition-stats">
                <div className="stat">
                  <span className="stat-label">Spots</span>
                  <span className="stat-value">{condition.spotCount}</span>
                </div>
                
                {condition.averageSnr !== undefined && (
                  <div className="stat">
                    <span className="stat-label">Avg SNR</span>
                    <span className="stat-value">{condition.averageSnr.toFixed(1)} dB</span>
                  </div>
                )}
                
                <div className="stat">
                  <span className="stat-label">Confidence</span>
                  <span className="stat-value">{condition.confidence}%</span>
                </div>
              </div>
              
              {condition.bestDx && (
                <div className="best-dx">
                  <span className="dx-label">Best DX:</span>
                  <span className="dx-callsign">{condition.bestDx.callsign}</span>
                  <span className="dx-distance">{Math.round(condition.bestDx.distance)} km</span>
                </div>
              )}
            </div>
            
            {/* Confidence bar */}
            <div className="confidence-bar">
              <div 
                className="confidence-fill"
                style={{ 
                  width: `${condition.confidence}%`,
                  backgroundColor: getConditionColor(condition.condition)
                }}
              />
            </div>
          </div>
        ))}
      </div>
      
      {/* Summary */}
      <div className="conditions-summary">
        <div className="summary-item">
          <span className="summary-label">Active Bands</span>
          <span className="summary-value">{conditions.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Spots</span>
          <span className="summary-value">
            {conditions.reduce((sum, c) => sum + c.spotCount, 0)}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Best Conditions</span>
          <span className="summary-value">
            {conditions.filter(c => c.condition === 'EXCELLENT' || c.condition === 'GOOD').length}
          </span>
        </div>
      </div>
    </div>
  );
}
