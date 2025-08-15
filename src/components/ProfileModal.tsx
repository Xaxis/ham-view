import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { ProfileConfig } from '../types';

export const ProfileModal: React.FC = () => {
  const { state, currentProfile, createProfile, switchProfile, dispatch } = useApp();
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');

  const handleClose = () => {
    dispatch({ type: 'TOGGLE_PROFILE_MODAL', isOpen: false });
    setIsCreating(false);
    setNewProfileName('');
    setNewProfileDescription('');
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newProfileName.trim()) return;

    const config: ProfileConfig = {
      name: newProfileName.trim(),
      description: newProfileDescription.trim() || undefined,
    };

    createProfile(config);
    handleClose();
  };

  const handleDeleteProfile = (profileId: string) => {
    if (confirm('Are you sure you want to delete this profile? This action cannot be undone.')) {
      dispatch({ type: 'DELETE_PROFILE', profileId });
    }
  };

  const formatDate = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) {
        return 'Unknown';
      }
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(dateObj);
    } catch (error) {
      return 'Unknown';
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-content">
            <img src="/logo.png" alt="Ham View" className="modal-logo" />
            <h2>Manage Profiles</h2>
          </div>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <div className="modal-content">
          {!isCreating ? (
            <>
              <div className="profile-list">
                <div className="profile-list-header">
                  <h3>Your Profiles</h3>
                  <button
                    className="btn btn-primary"
                    onClick={() => setIsCreating(true)}
                  >
                    + Create New Profile
                  </button>
                </div>

                {state.profiles.length === 0 ? (
                  <div className="empty-profiles">
                    <p>No profiles created yet. Create your first profile to get started!</p>
                  </div>
                ) : (
                  <div className="profiles-grid">
                    {state.profiles.map((profile) => {
                      // Safety check for profile data
                      if (!profile || !profile.id) {
                        return null;
                      }

                      return (
                        <div
                          key={profile.id}
                          className={`profile-card ${currentProfile?.id === profile.id ? 'active' : ''}`}
                        >
                          <div className="profile-card-header">
                            <h4>{profile.name || 'Unnamed Profile'}</h4>
                            <div className="profile-card-actions">
                              {currentProfile?.id !== profile.id && (
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => switchProfile(profile.id)}
                                >
                                  Switch
                                </button>
                              )}
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteProfile(profile.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {profile.description && (
                            <p className="profile-description">{profile.description}</p>
                          )}

                          <div className="profile-stats">
                            <span className="stat">
                              <strong>{profile.tiles?.length || 0}</strong> views
                            </span>
                            <span className="stat">
                              Created: {formatDate(profile.createdAt)}
                            </span>
                            {profile.updatedAt && profile.createdAt &&
                             new Date(profile.updatedAt).getTime() !== new Date(profile.createdAt).getTime() && (
                              <span className="stat">
                                Updated: {formatDate(profile.updatedAt)}
                              </span>
                            )}
                          </div>

                          {currentProfile?.id === profile.id && (
                            <div className="current-profile-badge">Current</div>
                          )}
                        </div>
                      );
                    }).filter(Boolean)}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="create-profile-form">
              <h3>Create New Profile</h3>
              <form onSubmit={handleCreateProfile}>
                <div className="form-group">
                  <label htmlFor="profile-name">Profile Name:</label>
                  <input
                    type="text"
                    id="profile-name"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="e.g., Contest Setup, DX Hunting, etc."
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="profile-description">Description (optional):</label>
                  <textarea
                    id="profile-description"
                    value={newProfileDescription}
                    onChange={(e) => setNewProfileDescription(e.target.value)}
                    placeholder="Brief description of this profile's purpose"
                    rows={3}
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsCreating(false)}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!newProfileName.trim()}
                  >
                    Create Profile
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
