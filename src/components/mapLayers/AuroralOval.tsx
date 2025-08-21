import React, { useMemo } from 'react';

interface AuroralOvalProps {
  opacity: number;
  enabled: boolean;
  kIndex?: number; // Geomagnetic K-index to determine oval size
}

// Calculate auroral oval based on K-index
const calculateAuroralOval = (kIndex: number = 3) => {
  // Base oval parameters (simplified model)
  const baseRadius = 15; // degrees
  const kIndexMultiplier = 1 + (kIndex / 9) * 0.8; // Expand with higher K-index
  const radius = baseRadius * kIndexMultiplier;
  
  // Northern oval (centered around magnetic north pole)
  const northMagneticPole = { lat: 86.5, lng: -164.04 };
  const northernOval: Array<[number, number]> = [];
  
  // Southern oval (centered around magnetic south pole)
  const southMagneticPole = { lat: -64.07, lng: 136.02 };
  const southernOval: Array<[number, number]> = [];
  
  // Generate oval points
  for (let angle = 0; angle <= 360; angle += 5) {
    const rad = (angle * Math.PI) / 180;
    
    // Northern oval
    const northLat = northMagneticPole.lat + radius * Math.cos(rad);
    const northLng = northMagneticPole.lng + (radius * Math.sin(rad)) / Math.cos((northLat * Math.PI) / 180);
    
    if (northLat <= 90 && northLat >= 45) {
      northernOval.push([
        ((northLng + 540) % 360) - 180, // Normalize longitude
        Math.min(85, northLat)
      ]);
    }
    
    // Southern oval
    const southLat = southMagneticPole.lat - radius * Math.cos(rad);
    const southLng = southMagneticPole.lng + (radius * Math.sin(rad)) / Math.cos((southLat * Math.PI) / 180);
    
    if (southLat >= -90 && southLat <= -45) {
      southernOval.push([
        ((southLng + 540) % 360) - 180, // Normalize longitude
        Math.max(-85, southLat)
      ]);
    }
  }
  
  return { northernOval, southernOval, radius, kIndex };
};

// Get aurora intensity color based on K-index
const getAuroraColor = (kIndex: number) => {
  if (kIndex <= 2) return 'rgba(0, 255, 0, 0.3)'; // Green - quiet
  if (kIndex <= 4) return 'rgba(255, 255, 0, 0.4)'; // Yellow - unsettled
  if (kIndex <= 6) return 'rgba(255, 165, 0, 0.5)'; // Orange - active
  if (kIndex <= 8) return 'rgba(255, 0, 0, 0.6)'; // Red - storm
  return 'rgba(128, 0, 128, 0.7)'; // Purple - severe storm
};

// Get aurora activity description
const getAuroraActivity = (kIndex: number) => {
  if (kIndex <= 2) return 'Quiet';
  if (kIndex <= 4) return 'Unsettled';
  if (kIndex <= 6) return 'Active';
  if (kIndex <= 8) return 'Storm';
  return 'Severe Storm';
};

export default function AuroralOval({ opacity, enabled, kIndex = 3 }: AuroralOvalProps) {
  const auroraData = useMemo(() => {
    if (!enabled) return null;
    return calculateAuroralOval(kIndex);
  }, [enabled, kIndex]);

  if (!enabled || !auroraData) {
    return null;
  }

  const { northernOval, southernOval } = auroraData;
  const auroraColor = getAuroraColor(kIndex);
  const activity = getAuroraActivity(kIndex);

  // Convert lat/lng points to SVG path
  const createOvalPath = (points: Array<[number, number]>) => {
    if (points.length === 0) return '';
    
    const svgPoints = points.map(([lng, lat]) => {
      const x = ((lng + 180) / 360) * 100;
      const y = ((90 - lat) / 180) * 100;
      return `${x},${y}`;
    });
    
    return `M ${svgPoints.join(' L ')} Z`;
  };

  return (
    <div 
      className="auroral-oval"
      style={{ 
        opacity: opacity / 100,
        pointerEvents: 'none',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 8,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          <filter id="auroraGlow">
            <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          <radialGradient id="auroraGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={auroraColor} />
            <stop offset="70%" stopColor={auroraColor.replace(/[\d.]+\)$/, '0.2)')} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        
        {/* Northern auroral oval */}
        {northernOval.length > 0 && (
          <path
            d={createOvalPath(northernOval)}
            fill="url(#auroraGradient)"
            stroke={auroraColor.replace(/[\d.]+\)$/, '0.8)')}
            strokeWidth="0.3"
            filter="url(#auroraGlow)"
          />
        )}
        
        {/* Southern auroral oval */}
        {southernOval.length > 0 && (
          <path
            d={createOvalPath(southernOval)}
            fill="url(#auroraGradient)"
            stroke={auroraColor.replace(/[\d.]+\)$/, '0.8)')}
            strokeWidth="0.3"
            filter="url(#auroraGlow)"
          />
        )}
      </svg>
      
      {/* Aurora info */}
      <div className="aurora-info">
        <span className="aurora-label">
          🌌 Auroral Oval
        </span>
        <span className="aurora-activity">
          K{kIndex} - {activity}
        </span>
      </div>
    </div>
  );
}
