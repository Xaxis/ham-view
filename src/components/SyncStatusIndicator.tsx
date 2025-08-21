import React, { useState, useEffect } from 'react';
import type { SyncStatus } from '../types';

interface SyncStatusIndicatorProps {
  syncStatus: SyncStatus;
  onManualSync?: () => void;
}

export default function SyncStatusIndicator({ syncStatus, onManualSync }: SyncStatusIndicatorProps) {
  const [countdown, setCountdown] = useState<number>(0);
  const [timeAgo, setTimeAgo] = useState<string>('');

  // Update countdown and time ago every second
  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      
      // Calculate countdown to next sync
      if (syncStatus.nextSync) {
        const secondsUntilSync = Math.max(0, Math.floor((syncStatus.nextSync.getTime() - now.getTime()) / 1000));
        setCountdown(secondsUntilSync);
      } else {
        setCountdown(0);
      }

      // Calculate time since last sync
      if (syncStatus.lastSync) {
        const secondsAgo = Math.floor((now.getTime() - syncStatus.lastSync.getTime()) / 1000);
        setTimeAgo(formatTimeAgo(secondsAgo));
      } else {
        setTimeAgo('Never');
      }
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, [syncStatus.lastSync, syncStatus.nextSync]);

  const formatTimeAgo = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const formatCountdown = (seconds: number): string => {
    if (seconds === 0) return 'Now';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getSyncStatusColor = (): string => {
    if (syncStatus.isSyncing) return 'var(--primary)';
    if (!syncStatus.isAutoRefresh) return 'var(--warning)';
    return 'var(--text-secondary)';
  };

  return (
    <div className="sync-status-indicator">
      <div className="sync-status-main">
        {syncStatus.isSyncing && (
          <span
            className="sync-icon"
            style={{ color: getSyncStatusColor() }}
          >
            🔄
          </span>
        )}

        <div className="sync-info">
          <div className="sync-last">
            <span className="sync-label">Last sync:</span>
            <span className="sync-value">{timeAgo}</span>
          </div>
          
          {syncStatus.isAutoRefresh && !syncStatus.isSyncing && (
            <div className="sync-next">
              <span className="sync-label">Next in:</span>
              <span className="sync-countdown">{formatCountdown(countdown)}</span>
            </div>
          )}
          
          {syncStatus.isSyncing && (
            <div className="sync-next">
              <span className="sync-label">Syncing...</span>
            </div>
          )}
          
          {!syncStatus.isAutoRefresh && (
            <div className="sync-next">
              <span className="sync-label">Auto-sync paused</span>
            </div>
          )}
        </div>
      </div>

      {onManualSync && (
        <button
          className="manual-sync-btn"
          onClick={onManualSync}
          disabled={syncStatus.isSyncing}
          title="Manual sync"
        >
          {syncStatus.isSyncing ? '🔄' : '↻'}
        </button>
      )}
    </div>
  );
}
