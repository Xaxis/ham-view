import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Tile } from './Tile';
import { Toolbar } from './Toolbar';
import { AddTileModal } from './AddTileModal';
import { ProfileModal } from './ProfileModal';
import { Footer } from './Footer';

export const Dashboard: React.FC = () => {
  const { state, currentProfile, updateTile, removeTile, focusTile, dispatch } = useApp();
  const [activeTileId, setActiveTileId] = useState<string | null>(null);

  // Handle window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      dispatch({
        type: 'SET_CANVAS_SIZE',
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial size
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dispatch]);

  // Handle tile focus
  const handleTileFocus = (tileId: string) => {
    setActiveTileId(tileId);
    focusTile(tileId);
  };

  // Handle clicking on canvas (unfocus tiles)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setActiveTileId(null);
    }
  };

  // Auto-arrange tiles in a grid
  const handleAutoGrid = useCallback(() => {
    if (!currentProfile || currentProfile.tiles.length === 0) return;

    const tiles = currentProfile.tiles;
    const canvasWidth = state.canvasSize.width;
    const canvasHeight = state.canvasSize.height - 120; // Account for toolbar (80px) and footer (40px)

    // Calculate optimal grid dimensions
    const tileCount = tiles.length;
    const cols = Math.ceil(Math.sqrt(tileCount));
    const rows = Math.ceil(tileCount / cols);

    // Calculate tile dimensions with padding
    const padding = 16;
    const tileWidth = Math.floor((canvasWidth - padding * (cols + 1)) / cols);
    const tileHeight = Math.floor((canvasHeight - padding * (rows + 1)) / rows);

    // Ensure minimum tile size
    const minWidth = 300;
    const minHeight = 200;
    const finalWidth = Math.max(tileWidth, minWidth);
    const finalHeight = Math.max(tileHeight, minHeight);

    // Position tiles in grid
    tiles.forEach((tile, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = padding + col * (finalWidth + padding);
      const y = padding + row * (finalHeight + padding);

      updateTile(tile.id, {
        position: { x, y },
        size: { width: finalWidth, height: finalHeight },
        isMinimized: false,
        isMaximized: false,
        zIndex: index + 1
      });
    });
  }, [currentProfile, state.canvasSize, updateTile]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + G for auto-grid
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        handleAutoGrid();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAutoGrid]);

  return (
    <div className="dashboard">
      <Toolbar onAutoGrid={handleAutoGrid} />

      <div
        className="canvas"
        onClick={handleCanvasClick}
        style={{
          width: state.canvasSize.width,
          height: state.canvasSize.height - 120, // Account for toolbar (80px) and footer (40px)
        }}
      >
        {currentProfile?.tiles.map((tile) => (
          <Tile
            key={tile.id}
            tile={tile}
            onUpdate={updateTile}
            onClose={removeTile}
            onFocus={handleTileFocus}
            isActive={activeTileId === tile.id}
          />
        ))}

        {currentProfile?.tiles.length === 0 && (
          <div className="empty-canvas">
            <div className="empty-canvas-content">
              <img src="/ham-view/logo.png" alt="Ham View" className="empty-state-logo" />
              <p>Start by adding your first view</p>
              <button
                className="add-first-tile-btn"
                onClick={() => dispatch({ type: 'TOGGLE_ADD_TILE_MODAL', isOpen: true })}
              >
                Add View
              </button>
            </div>
          </div>
        )}

        {!currentProfile && (
          <div className="no-profile">
            <div className="no-profile-content">
              <img src="/ham-view/logo.png" alt="Ham View" className="empty-state-logo" />
              <p>Create or select a profile to get started</p>
              <button
                className="create-first-profile-btn"
                onClick={() => dispatch({ type: 'TOGGLE_PROFILE_MODAL', isOpen: true })}
              >
                Create Profile
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {state.isAddTileModalOpen && <AddTileModal />}
      {state.isProfileModalOpen && <ProfileModal />}

      <Footer />
    </div>
  );
};
