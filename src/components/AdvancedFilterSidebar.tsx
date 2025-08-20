import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import type { FilterSettings, Band, Mode } from '../types';
import CallsignInput from './CallsignInput';

interface AdvancedFilterSidebarProps {
  filters: FilterSettings;
  onFiltersChange: (filters: Partial<FilterSettings>) => void;
  spotCount: number;
  bandCount: number;
}

const allBands: Band[] = ['160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '4m', '2m'];
const allModes: Mode[] = ['FT8', 'FT4', 'PSK31', 'PSK63', 'WSPR', 'JT65', 'CW', 'SSB', 'RTTY'];

const timePresets = [
  { value: 'last-hour', label: 'Last Hour', hours: 1 },
  { value: 'last-6h', label: 'Last 6 Hours', hours: 6 },
  { value: 'last-24h', label: 'Last 24 Hours', hours: 24 },
  { value: 'custom', label: 'Custom Range', hours: 0 },
];

const qualityThresholds = [
  { value: 'any', label: 'Any Signal', color: '#6b7280' },
  { value: 'fair', label: 'Fair (-20dB+)', color: '#f59e0b' },
  { value: 'good', label: 'Good (-10dB+)', color: '#3b82f6' },
  { value: 'excellent', label: 'Excellent (0dB+)', color: '#10b981' },
];

function AdvancedFilterSidebar({
  filters,
  onFiltersChange,
  spotCount,
  bandCount
}: AdvancedFilterSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['time', 'bands', 'modes'])
  );



  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Handle callsign search change
  const handleCallsignChange = useCallback((searchTerm: string) => {
    onFiltersChange({
      ...filters,
      callsign: { ...filters.callsign, search: searchTerm }
    });
  }, [filters, onFiltersChange]);

  const handleTimePresetChange = (preset: string) => {
    const now = new Date();
    let start = new Date();
    
    switch (preset) {
      case 'last-hour':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'last-6h':
        start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case 'last-24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      default:
        return; // Custom - don't change dates
    }

    onFiltersChange({
      ...filters,
      timeRange: {
        ...filters.timeRange,
        start,
        end: now,
        preset: preset as any,
      },
    });
  };

  const handleBandToggle = (band: Band) => {
    const newBands = filters.bands.includes(band)
      ? filters.bands.filter(b => b !== band)
      : [...filters.bands, band];
    onFiltersChange({ ...filters, bands: newBands });
  };

  const handleModeToggle = (mode: Mode) => {
    const newModes = filters.modes.includes(mode)
      ? filters.modes.filter(m => m !== mode)
      : [...filters.modes, mode];
    onFiltersChange({ ...filters, modes: newModes });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      bands: [],
      modes: [],
      callsign: {
        search: '',
        transmitterOnly: false,
        receiverOnly: false,
        exactMatch: false,
      },
      geographic: {
        gridSquares: [],
        countries: [],
        continents: [],
      },
      signal: {
        qualityThreshold: 'any',
      },
      advanced: {
        minSpotCount: 1,
        uniqueOnly: false,
        bidirectionalOnly: false,
      },
    });
  };

  const FilterSection = ({ 
    id, 
    title, 
    icon, 
    children 
  }: { 
    id: string; 
    title: string; 
    icon: string; 
    children: React.ReactNode; 
  }) => (
    <div className="filter-section">
      <button
        className="filter-section-header"
        onClick={() => toggleSection(id)}
      >
        <span className="section-icon">{icon}</span>
        <span className="section-title">{title}</span>
        <span className={`section-toggle ${expandedSections.has(id) ? 'expanded' : ''}`}>
          ▼
        </span>
      </button>
      {expandedSections.has(id) && (
        <div className="filter-section-content">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="advanced-filter-sidebar">
      <div className="sidebar-header">
        <h2>Filters & Controls</h2>
        <button className="clear-filters-btn" onClick={clearAllFilters}>
          Clear All
        </button>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-item">
          <span className="stat-label">Active Spots</span>
          <span className="stat-value">{spotCount.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Bands Active</span>
          <span className="stat-value">{bandCount}</span>
        </div>
      </div>

      {/* Callsign Search */}
      <FilterSection id="callsign" title="Callsign Search" icon="📻">
        <div className="callsign-search">
          <CallsignInput
            value={filters.callsign.search}
            onChange={handleCallsignChange}
          />

          {filters.callsign.search && (
            <div className="active-search">
              <span className="search-indicator">
                🔍 Searching for: <strong>{filters.callsign.search}</strong>
              </span>
            </div>
          )}

          <div className="callsign-options">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={filters.callsign.transmitterOnly}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  callsign: { ...filters.callsign, transmitterOnly: e.target.checked }
                })}
              />
              <span>Transmitter only</span>
            </label>
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={filters.callsign.receiverOnly}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  callsign: { ...filters.callsign, receiverOnly: e.target.checked }
                })}
              />
              <span>Receiver only</span>
            </label>
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={filters.callsign.exactMatch}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  callsign: { ...filters.callsign, exactMatch: e.target.checked }
                })}
              />
              <span>Exact match</span>
            </label>
          </div>

          <div className="callsign-help">
            <span className="help-text">
              💡 Press Enter or click 🔍 to search. Results update automatically after typing.
            </span>
          </div>
        </div>
      </FilterSection>

      {/* Time Range */}
      <FilterSection id="time" title="Time Range" icon="⏰">
        <div className="time-presets">
          {timePresets.map(preset => (
            <button
              key={preset.value}
              className={`time-preset-btn ${filters.timeRange.preset === preset.value ? 'active' : ''}`}
              onClick={() => handleTimePresetChange(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {filters.timeRange.preset === 'custom' && (
          <div className="custom-time-range">
            <input
              type="datetime-local"
              value={filters.timeRange.start.toISOString().slice(0, 16)}
              onChange={(e) => onFiltersChange({
                ...filters,
                timeRange: {
                  ...filters.timeRange,
                  start: new Date(e.target.value),
                }
              })}
            />
            <input
              type="datetime-local"
              value={filters.timeRange.end.toISOString().slice(0, 16)}
              onChange={(e) => onFiltersChange({
                ...filters,
                timeRange: {
                  ...filters.timeRange,
                  end: new Date(e.target.value),
                }
              })}
            />
          </div>
        )}
      </FilterSection>

      {/* Band Selection */}
      <FilterSection id="bands" title="Band Selection" icon="📊">
        <div className="band-grid">
          {allBands.map(band => (
            <button
              key={band}
              className={`band-btn ${filters.bands.includes(band) ? 'active' : ''}`}
              onClick={() => handleBandToggle(band)}
            >
              {band}
            </button>
          ))}
        </div>
        <div className="selection-controls">
          <button
            className="select-all-btn"
            onClick={() => onFiltersChange({ ...filters, bands: allBands })}
          >
            Select All
          </button>
          <button
            className="select-none-btn"
            onClick={() => onFiltersChange({ ...filters, bands: [] })}
          >
            Clear
          </button>
        </div>
      </FilterSection>

      {/* Mode Selection */}
      <FilterSection id="modes" title="Mode Selection" icon="📡">
        <div className="mode-grid">
          {allModes.map(mode => (
            <button
              key={mode}
              className={`mode-btn ${filters.modes.includes(mode) ? 'active' : ''}`}
              onClick={() => handleModeToggle(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="selection-controls">
          <button
            className="select-all-btn"
            onClick={() => onFiltersChange({ ...filters, modes: allModes })}
          >
            Select All
          </button>
          <button
            className="select-none-btn"
            onClick={() => onFiltersChange({ ...filters, modes: [] })}
          >
            Clear
          </button>
        </div>
      </FilterSection>

      {/* Signal Quality */}
      <FilterSection id="signal" title="Signal Quality" icon="📶">
        <div className="quality-thresholds">
          {qualityThresholds.map(threshold => (
            <button
              key={threshold.value}
              className={`quality-btn ${filters.signal.qualityThreshold === threshold.value ? 'active' : ''}`}
              onClick={() => onFiltersChange({
                ...filters,
                signal: { ...filters.signal, qualityThreshold: threshold.value as any }
              })}
              style={{ 
                borderColor: filters.signal.qualityThreshold === threshold.value ? threshold.color : undefined,
                color: filters.signal.qualityThreshold === threshold.value ? threshold.color : undefined
              }}
            >
              {threshold.label}
            </button>
          ))}
        </div>
        <div className="snr-range">
          <label>SNR Range (dB)</label>
          <div className="range-inputs">
            <input
              type="number"
              placeholder="Min"
              value={filters.signal.minSnr || ''}
              onChange={(e) => onFiltersChange({
                ...filters,
                signal: {
                  ...filters.signal,
                  minSnr: e.target.value ? parseFloat(e.target.value) : undefined
                }
              })}
            />
            <span>to</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.signal.maxSnr || ''}
              onChange={(e) => onFiltersChange({
                ...filters,
                signal: {
                  ...filters.signal,
                  maxSnr: e.target.value ? parseFloat(e.target.value) : undefined
                }
              })}
            />
          </div>
        </div>
      </FilterSection>

      {/* Advanced Options */}
      <FilterSection id="advanced" title="Advanced" icon="⚙️">
        <div className="advanced-options">
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={filters.advanced.uniqueOnly}
              onChange={(e) => onFiltersChange({
                ...filters,
                advanced: { ...filters.advanced, uniqueOnly: e.target.checked }
              })}
            />
            <span>Unique paths only</span>
          </label>
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={filters.advanced.bidirectionalOnly}
              onChange={(e) => onFiltersChange({
                ...filters,
                advanced: { ...filters.advanced, bidirectionalOnly: e.target.checked }
              })}
            />
            <span>Bidirectional contacts</span>
          </label>
          <div className="min-spots-control">
            <label>Minimum spots per station</label>
            <input
              type="number"
              min="1"
              value={filters.advanced.minSpotCount}
              onChange={(e) => onFiltersChange({
                ...filters,
                advanced: {
                  ...filters.advanced,
                  minSpotCount: parseInt(e.target.value) || 1
                }
              })}
            />
          </div>
        </div>
      </FilterSection>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(AdvancedFilterSidebar, (prevProps, nextProps) => {
  // Only re-render if filters, spotCount, or bandCount actually change
  return (
    JSON.stringify(prevProps.filters) === JSON.stringify(nextProps.filters) &&
    prevProps.spotCount === nextProps.spotCount &&
    prevProps.bandCount === nextProps.bandCount
  );
});
