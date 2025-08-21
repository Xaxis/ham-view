import React, { useMemo } from 'react';

interface MaidenheadGridProps {
  opacity: number;
  enabled: boolean;
  zoom?: number; // Map zoom level to determine grid density
}

// Convert Maidenhead grid square to lat/lng bounds
const gridSquareToBounds = (grid: string): { north: number; south: number; east: number; west: number } => {
  if (grid.length < 2) return { north: 90, south: -90, east: 180, west: -180 };
  
  // Field (first 2 characters)
  const fieldLng = (grid.charCodeAt(0) - 65) * 20 - 180;
  const fieldLat = (grid.charCodeAt(1) - 65) * 10 - 90;
  
  if (grid.length === 2) {
    return {
      west: fieldLng,
      east: fieldLng + 20,
      south: fieldLat,
      north: fieldLat + 10,
    };
  }
  
  // Square (next 2 digits)
  const squareLng = parseInt(grid[2]) * 2;
  const squareLat = parseInt(grid[3]) * 1;
  
  if (grid.length === 4) {
    return {
      west: fieldLng + squareLng,
      east: fieldLng + squareLng + 2,
      south: fieldLat + squareLat,
      north: fieldLat + squareLat + 1,
    };
  }
  
  // Subsquare (next 2 characters)
  const subsquareLng = (grid.charCodeAt(4) - 65) * (2/24);
  const subsquareLat = (grid.charCodeAt(5) - 65) * (1/24);
  
  return {
    west: fieldLng + squareLng + subsquareLng,
    east: fieldLng + squareLng + subsquareLng + (2/24),
    south: fieldLat + squareLat + subsquareLat,
    north: fieldLat + squareLat + subsquareLat + (1/24),
  };
};

// Generate grid squares for display
const generateGridSquares = (zoom: number = 1) => {
  const squares: Array<{
    grid: string;
    bounds: { north: number; south: number; east: number; west: number };
    level: 'field' | 'square' | 'subsquare';
  }> = [];
  
  // Determine grid level based on zoom
  const showFields = zoom <= 3;
  const showSquares = zoom > 2 && zoom <= 6;
  const showSubsquares = zoom > 5;
  
  // Generate field squares (AA-RR, AA-RX)
  if (showFields) {
    for (let i = 0; i < 18; i++) { // A-R
      for (let j = 0; j < 18; j++) { // A-R
        const field = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);
        squares.push({
          grid: field,
          bounds: gridSquareToBounds(field),
          level: 'field',
        });
      }
    }
  }
  
  // Generate square level (AA00-AA99, etc.)
  if (showSquares && !showFields) {
    for (let i = 0; i < 18; i++) {
      for (let j = 0; j < 18; j++) {
        const field = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);
        for (let x = 0; x < 10; x++) {
          for (let y = 0; y < 10; y++) {
            const square = field + x + y;
            squares.push({
              grid: square,
              bounds: gridSquareToBounds(square),
              level: 'square',
            });
          }
        }
      }
    }
  }
  
  return squares;
};

export default function MaidenheadGrid({ opacity, enabled, zoom = 1 }: MaidenheadGridProps) {
  const gridData = useMemo(() => {
    if (!enabled) return [];
    return generateGridSquares(zoom);
  }, [enabled, zoom]);

  if (!enabled) {
    return null;
  }

  return (
    <div 
      className="maidenhead-grid"
      style={{ 
        opacity: opacity / 100,
        pointerEvents: 'none',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="-180 -90 360 180"
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {gridData.map((square) => {
          const { bounds, grid, level } = square;
          const strokeWidth = level === 'field' ? 0.5 : level === 'square' ? 0.3 : 0.1;
          const strokeColor = level === 'field' 
            ? 'rgba(255, 255, 255, 0.8)' 
            : level === 'square' 
            ? 'rgba(255, 255, 255, 0.6)' 
            : 'rgba(255, 255, 255, 0.4)';
          
          return (
            <g key={grid}>
              {/* Grid square outline */}
              <rect
                x={bounds.west}
                y={-bounds.north} // SVG Y is inverted
                width={bounds.east - bounds.west}
                height={bounds.north - bounds.south}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                vectorEffect="non-scaling-stroke"
              />
              
              {/* Grid square label */}
              {level === 'field' && (
                <text
                  x={bounds.west + (bounds.east - bounds.west) / 2}
                  y={-bounds.south - (bounds.north - bounds.south) / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="rgba(255, 255, 255, 0.9)"
                  fontSize="3"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {grid}
                </text>
              )}
              
              {level === 'square' && zoom > 4 && (
                <text
                  x={bounds.west + (bounds.east - bounds.west) / 2}
                  y={-bounds.south - (bounds.north - bounds.south) / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="rgba(255, 255, 255, 0.7)"
                  fontSize="1"
                  fontFamily="monospace"
                >
                  {grid}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      
      {/* Grid info */}
      <div className="grid-info">
        <span className="grid-label">
          🗂️ Maidenhead Grid
        </span>
        <span className="grid-count">
          {gridData.length} squares
        </span>
      </div>
    </div>
  );
}
