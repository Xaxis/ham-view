// Core types and interfaces for the Ham View application

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds extends Position, Size {}

export interface TileState {
  id: string;
  url: string;
  title: string;
  position: Position;
  size: Size;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  tiles: TileState[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AppState {
  currentProfileId: string | null;
  profiles: Profile[];
  nextZIndex: number;
  canvasSize: Size;
  isProfileModalOpen: boolean;
  isAddTileModalOpen: boolean;
}

export interface TileConfig {
  url: string;
  title: string;
  position?: Position;
  size?: Size;
  originalUrl?: string;
  isProxied?: boolean;
  proxyType?: 'standard' | 'archive' | 'mobile';
  tileType?: 'iframe' | 'link';
  description?: string;
}

export interface ProfileConfig {
  name: string;
  description?: string;
}

// Default values
export const DEFAULT_TILE_SIZE: Size = {
  width: 400,
  height: 300,
};

export const DEFAULT_TILE_POSITION: Position = {
  x: 50,
  y: 50,
};

export const MIN_TILE_SIZE: Size = {
  width: 200,
  height: 150,
};

export const MAX_TILE_SIZE: Size = {
  width: 1200,
  height: 800,
};

// Storage keys
export const STORAGE_KEYS = {
  APP_STATE: 'ham-view-app-state',
  PROFILES: 'ham-view-profiles',
} as const;

// Events
export interface TileEvent {
  type: 'move' | 'resize' | 'minimize' | 'maximize' | 'close' | 'focus';
  tileId: string;
  data?: any;
}

export interface ProfileEvent {
  type: 'create' | 'update' | 'delete' | 'switch';
  profileId: string;
  data?: any;
}
