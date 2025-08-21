import React, { useMemo } from 'react';

interface DayNightTerminatorProps {
  opacity: number;
  enabled: boolean;
}

// Solar position calculations
const getSolarPosition = (date: Date) => {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const solarDeclination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180);
  
  const timeOfDay = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const solarHourAngle = 15 * (timeOfDay - 12);
  
  return {
    declination: solarDeclination,
    hourAngle: solarHourAngle,
  };
};

// Calculate terminator line points
const calculateTerminatorPoints = (date: Date): Array<[number, number]> => {
  const { declination } = getSolarPosition(date);
  const points: Array<[number, number]> = [];
  
  // Calculate terminator for each longitude
  for (let lng = -180; lng <= 180; lng += 2) {
    // Solar hour angle at this longitude
    const timeOfDay = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const solarHourAngle = 15 * (timeOfDay - 12) + lng;
    
    // Calculate latitude where sun is at horizon
    const cosLat = -Math.tan(declination * Math.PI / 180) * Math.tan(solarHourAngle * Math.PI / 180);
    
    if (Math.abs(cosLat) <= 1) {
      const lat = Math.acos(Math.abs(cosLat)) * 180 / Math.PI;
      const terminatorLat = cosLat > 0 ? lat : -lat;
      
      // Adjust for solar declination
      const adjustedLat = terminatorLat + (declination > 0 ? -declination : declination);
      
      if (adjustedLat >= -90 && adjustedLat <= 90) {
        points.push([lng, Math.max(-85, Math.min(85, adjustedLat))]);
      }
    }
  }
  
  return points;
};

export default function DayNightTerminator({ opacity, enabled }: DayNightTerminatorProps) {
  const terminatorData = useMemo(() => {
    if (!enabled) return null;
    
    const now = new Date();
    const points = calculateTerminatorPoints(now);
    
    // Create SVG path for the terminator
    if (points.length === 0) return null;
    
    // Convert lat/lng to SVG coordinates (simplified projection)
    const svgPoints = points.map(([lng, lat]) => {
      const x = ((lng + 180) / 360) * 100; // 0-100%
      const y = ((90 - lat) / 180) * 100;   // 0-100%
      return `${x},${y}`;
    });
    
    return {
      pathData: `M ${svgPoints.join(' L ')}`,
      timestamp: now,
    };
  }, [enabled]);

  if (!enabled || !terminatorData) {
    return null;
  }

  return (
    <div 
      className="day-night-terminator"
      style={{ 
        opacity: opacity / 100,
        pointerEvents: 'none',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
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
          <linearGradient id="nightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 0, 50, 0.7)" />
            <stop offset="50%" stopColor="rgba(0, 0, 100, 0.5)" />
            <stop offset="100%" stopColor="rgba(0, 0, 50, 0.7)" />
          </linearGradient>
        </defs>
        
        {/* Night side overlay */}
        <path
          d={`${terminatorData.pathData} L 100,100 L 0,100 Z`}
          fill="url(#nightGradient)"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="0.2"
        />
        
        {/* Terminator line */}
        <path
          d={terminatorData.pathData}
          fill="none"
          stroke="rgba(255, 215, 0, 0.8)"
          strokeWidth="0.3"
          strokeDasharray="1,0.5"
        />
      </svg>
      
      {/* Info overlay */}
      <div className="terminator-info">
        <span className="terminator-label">
          🌅 Day/Night Terminator
        </span>
        <span className="terminator-time">
          {terminatorData.timestamp.toUTCString().slice(17, 25)} UTC
        </span>
      </div>
    </div>
  );
}
