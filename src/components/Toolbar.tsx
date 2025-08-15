import React from 'react';
import { useApp } from '../context/AppContext';
import { ThemeToggle } from './ThemeToggle';

interface ToolbarProps {
  onAutoGrid?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onAutoGrid }) => {
  const { state, currentProfile, switchProfile, dispatch } = useApp();

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const profileId = e.target.value;
    if (profileId) {
      switchProfile(profileId);
    }
  };

  const handleAddView = () => {
    if (!currentProfile) {
      // If no profile, prompt to create one first
      dispatch({ type: 'TOGGLE_PROFILE_MODAL', isOpen: true });
      return;
    }
    dispatch({ type: 'TOGGLE_ADD_TILE_MODAL', isOpen: true });
  };

  const handleManageProfiles = () => {
    dispatch({ type: 'TOGGLE_PROFILE_MODAL', isOpen: true });
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="app-title">
          <img src="/logo.png" alt="Ham View Logo" className="app-logo" />
          <h1>Ham View</h1>
        </div>
      </div>

      <div className="toolbar-center">
        <div className="profile-selector">
          <label htmlFor="profile-select">Profile:</label>
          <select
            id="profile-select"
            value={currentProfile?.id || ''}
            onChange={handleProfileChange}
            className="profile-select"
          >
            <option value="">Select Profile</option>
            {state.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="toolbar-right">
        <button
          className="toolbar-btn auto-grid-btn"
          onClick={onAutoGrid}
          disabled={!currentProfile || currentProfile.tiles.length === 0}
          title="Auto-arrange tiles in grid (Ctrl+G)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
          </svg>
          <span>Grid</span>
        </button>

        <button
          className="toolbar-btn add-view-btn"
          onClick={handleAddView}
          disabled={!currentProfile}
          title={!currentProfile ? 'Create a profile first' : 'Add new view'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Add View</span>
        </button>

        <button
          className="toolbar-btn manage-profiles-btn"
          onClick={handleManageProfiles}
          title="Manage profiles"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span>Profiles</span>
        </button>

        <ThemeToggle />
      </div>
    </div>
  );
};
