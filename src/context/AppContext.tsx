import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, Profile, TileState, TileConfig, ProfileConfig } from '../types';
import { DEFAULT_TILE_SIZE, DEFAULT_TILE_POSITION } from '../types';
import { storage } from '../utils/storage';

// Action types
type AppAction =
  | { type: 'SET_CURRENT_PROFILE'; profileId: string | null }
  | { type: 'ADD_PROFILE'; profile: Profile }
  | { type: 'UPDATE_PROFILE'; profileId: string; updates: Partial<Profile> }
  | { type: 'DELETE_PROFILE'; profileId: string }
  | { type: 'ADD_TILE'; tileConfig: TileConfig }
  | { type: 'UPDATE_TILE'; tileId: string; updates: Partial<TileState> }
  | { type: 'REMOVE_TILE'; tileId: string }
  | { type: 'FOCUS_TILE'; tileId: string }
  | { type: 'SET_CANVAS_SIZE'; width: number; height: number }
  | { type: 'TOGGLE_PROFILE_MODAL'; isOpen?: boolean }
  | { type: 'TOGGLE_ADD_TILE_MODAL'; isOpen?: boolean }
  | { type: 'LOAD_STATE'; state: AppState };

// Initial state
const getInitialState = (): AppState => ({
  currentProfileId: null,
  profiles: [],
  nextZIndex: 1,
  canvasSize: {
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  },
  isProfileModalOpen: false,
  isAddTileModalOpen: false,
});

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CURRENT_PROFILE':
      return { ...state, currentProfileId: action.profileId };

    case 'ADD_PROFILE':
      return {
        ...state,
        profiles: [...state.profiles, action.profile],
        currentProfileId: action.profile.id,
      };

    case 'UPDATE_PROFILE': {
      const updatedProfiles = state.profiles.map(profile =>
        profile.id === action.profileId
          ? { ...profile, ...action.updates, updatedAt: new Date() }
          : profile
      );
      return { ...state, profiles: updatedProfiles };
    }

    case 'DELETE_PROFILE': {
      const filteredProfiles = state.profiles.filter(p => p.id !== action.profileId);
      const newCurrentProfileId = state.currentProfileId === action.profileId
        ? (filteredProfiles.length > 0 ? filteredProfiles[0].id : null)
        : state.currentProfileId;
      
      return {
        ...state,
        profiles: filteredProfiles,
        currentProfileId: newCurrentProfileId,
      };
    }

    case 'ADD_TILE': {
      if (!state.currentProfileId) return state;

      const newTile: TileState = {
        id: uuidv4(),
        url: action.tileConfig.url,
        title: action.tileConfig.title,
        position: action.tileConfig.position || { ...DEFAULT_TILE_POSITION },
        size: action.tileConfig.size || { ...DEFAULT_TILE_SIZE },
        isMinimized: false,
        isMaximized: false,
        zIndex: state.nextZIndex,
        isLoading: true,
        hasError: false,
      };

      const updatedProfiles = state.profiles.map(profile =>
        profile.id === state.currentProfileId
          ? { ...profile, tiles: [...profile.tiles, newTile], updatedAt: new Date() }
          : profile
      );

      return {
        ...state,
        profiles: updatedProfiles,
        nextZIndex: state.nextZIndex + 1,
      };
    }

    case 'UPDATE_TILE': {
      if (!state.currentProfileId) return state;

      const updatedProfiles = state.profiles.map(profile =>
        profile.id === state.currentProfileId
          ? {
              ...profile,
              tiles: profile.tiles.map(tile =>
                tile.id === action.tileId ? { ...tile, ...action.updates } : tile
              ),
              updatedAt: new Date(),
            }
          : profile
      );

      return { ...state, profiles: updatedProfiles };
    }

    case 'REMOVE_TILE': {
      if (!state.currentProfileId) return state;

      const updatedProfiles = state.profiles.map(profile =>
        profile.id === state.currentProfileId
          ? {
              ...profile,
              tiles: profile.tiles.filter(tile => tile.id !== action.tileId),
              updatedAt: new Date(),
            }
          : profile
      );

      return { ...state, profiles: updatedProfiles };
    }

    case 'FOCUS_TILE': {
      if (!state.currentProfileId) return state;

      const updatedProfiles = state.profiles.map(profile =>
        profile.id === state.currentProfileId
          ? {
              ...profile,
              tiles: profile.tiles.map(tile =>
                tile.id === action.tileId
                  ? { ...tile, zIndex: state.nextZIndex }
                  : tile
              ),
              updatedAt: new Date(),
            }
          : profile
      );

      return {
        ...state,
        profiles: updatedProfiles,
        nextZIndex: state.nextZIndex + 1,
      };
    }

    case 'SET_CANVAS_SIZE':
      return {
        ...state,
        canvasSize: { width: action.width, height: action.height },
      };

    case 'TOGGLE_PROFILE_MODAL':
      return {
        ...state,
        isProfileModalOpen: action.isOpen ?? !state.isProfileModalOpen,
      };

    case 'TOGGLE_ADD_TILE_MODAL':
      return {
        ...state,
        isAddTileModalOpen: action.isOpen ?? !state.isAddTileModalOpen,
      };

    case 'LOAD_STATE':
      return action.state;

    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  currentProfile: Profile | null;
  createProfile: (config: ProfileConfig) => void;
  switchProfile: (profileId: string) => void;
  addTile: (config: TileConfig) => void;
  updateTile: (tileId: string, updates: Partial<TileState>) => void;
  removeTile: (tileId: string) => void;
  focusTile: (tileId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, getInitialState());

  // Load state from storage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedProfiles = storage.loadProfiles();
    const savedAppState = storage.loadAppState();

    const loadedState: AppState = {
      ...getInitialState(),
      ...savedAppState,
      profiles: savedProfiles,
    };

    dispatch({ type: 'LOAD_STATE', state: loadedState });
  }, []);

  // Save state to storage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    storage.saveProfiles(state.profiles);
    storage.saveAppState({
      currentProfileId: state.currentProfileId,
      nextZIndex: state.nextZIndex,
      canvasSize: state.canvasSize,
    });
  }, [state.profiles, state.currentProfileId, state.nextZIndex, state.canvasSize]);

  // Helper functions
  const currentProfile = state.currentProfileId
    ? state.profiles.find(p => p.id === state.currentProfileId) || null
    : null;

  const createProfile = (config: ProfileConfig) => {
    const newProfile: Profile = {
      id: uuidv4(),
      name: config.name,
      description: config.description,
      tiles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dispatch({ type: 'ADD_PROFILE', profile: newProfile });
  };

  const switchProfile = (profileId: string) => {
    dispatch({ type: 'SET_CURRENT_PROFILE', profileId });
  };

  const addTile = (config: TileConfig) => {
    dispatch({ type: 'ADD_TILE', tileConfig: config });
  };

  const updateTile = (tileId: string, updates: Partial<TileState>) => {
    dispatch({ type: 'UPDATE_TILE', tileId, updates });
  };

  const removeTile = (tileId: string) => {
    dispatch({ type: 'REMOVE_TILE', tileId });
  };

  const focusTile = (tileId: string) => {
    dispatch({ type: 'FOCUS_TILE', tileId });
  };

  const contextValue: AppContextType = {
    state,
    dispatch,
    currentProfile,
    createProfile,
    switchProfile,
    addTile,
    updateTile,
    removeTile,
    focusTile,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Hook
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
