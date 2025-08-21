// PropView Data Processing Web Worker
// Handles heavy data processing tasks in a separate thread

// Utility functions for geographic calculations
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = toRadians(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
  const x = Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
            Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLon);
  
  let bearing = Math.atan2(y, x);
  bearing = toDegrees(bearing);
  return (bearing + 360) % 360;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

// Band condition analysis
function analyzeBandConditions(spots) {
  const bandData = new Map();

  // Group spots by band
  spots.forEach(spot => {
    if (!bandData.has(spot.band)) {
      bandData.set(spot.band, {
        spots: [],
        snrValues: [],
        distances: [],
      });
    }

    const data = bandData.get(spot.band);
    data.spots.push(spot);
    
    if (spot.snr !== undefined) {
      data.snrValues.push(spot.snr);
    }

    // Calculate distance if we have coordinates
    if (spot.transmitter.location.latitude && spot.receiver.location.latitude) {
      const distance = calculateDistance(
        spot.transmitter.location.latitude,
        spot.transmitter.location.longitude,
        spot.receiver.location.latitude,
        spot.receiver.location.longitude
      );
      data.distances.push(distance);
    }
  });

  // Analyze each band
  const conditions = [];
  
  bandData.forEach((data, band) => {
    const spotCount = data.spots.length;
    const averageSnr = data.snrValues.length > 0 
      ? data.snrValues.reduce((sum, snr) => sum + snr, 0) / data.snrValues.length
      : undefined;

    // Find best DX
    let bestDx = undefined;
    if (data.distances.length > 0) {
      const maxDistance = Math.max(...data.distances);
      const bestSpot = data.spots.find(spot => {
        if (!spot.transmitter.location.latitude || !spot.receiver.location.latitude) return false;
        const distance = calculateDistance(
          spot.transmitter.location.latitude,
          spot.transmitter.location.longitude,
          spot.receiver.location.latitude,
          spot.receiver.location.longitude
        );
        return Math.abs(distance - maxDistance) < 1; // Within 1km
      });

      if (bestSpot) {
        bestDx = {
          distance: maxDistance,
          callsign: bestSpot.transmitter.callsign,
          location: bestSpot.transmitter.location,
        };
      }
    }

    // Determine condition quality
    let condition = 'POOR';
    let confidence = 0;

    if (spotCount > 0) {
      confidence = Math.min(100, (spotCount / 50) * 100); // Max confidence at 50+ spots
      
      if (averageSnr !== undefined) {
        if (averageSnr >= -5) condition = 'EXCELLENT';
        else if (averageSnr >= -10) condition = 'GOOD';
        else if (averageSnr >= -15) condition = 'FAIR';
        else condition = 'POOR';
      } else {
        // Base condition on spot count if no SNR data
        if (spotCount >= 20) condition = 'EXCELLENT';
        else if (spotCount >= 10) condition = 'GOOD';
        else if (spotCount >= 5) condition = 'FAIR';
        else condition = 'POOR';
      }
    }

    conditions.push({
      band,
      condition,
      confidence,
      spotCount,
      averageSnr,
      bestDx,
      trend: 'STABLE', // Simplified - would need historical data
    });
  });

  // Sort by band order
  const bandOrder = ['160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '4m', '2m'];
  return conditions.sort((a, b) => bandOrder.indexOf(a.band) - bandOrder.indexOf(b.band));
}

// Generate map markers (PSK Reporter methodology with clustering)
function generateMapMarkers(spots) {
  // PSK Reporter shows RECEIVER locations as primary spots
  // Group by precise coordinates (subsquare level) to handle clustering
  const receiverData = new Map();

  spots.forEach(spot => {
    // Only process receiver locations with valid coordinates (not 0,0)
    if (spot.receiver.location.latitude !== 0 || spot.receiver.location.longitude !== 0) {
      // Use higher precision for clustering (6 decimal places for subsquare accuracy)
      const rxKey = `${spot.receiver.location.latitude.toFixed(6)}_${spot.receiver.location.longitude.toFixed(6)}`;

      if (!receiverData.has(rxKey)) {
        receiverData.set(rxKey, {
          position: spot.receiver.location,
          callsigns: new Set(),
          spots: [],
          lastActivity: new Date(spot.timestamp),
          bestSNR: spot.snr || -999,
          worstSNR: spot.snr || -999,
          bands: new Set(),
          modes: new Set(),
          locators: new Set()
        });
      }

      const data = receiverData.get(rxKey);
      data.callsigns.add(spot.receiver.callsign);
      data.spots.push(spot);
      const spotTime = new Date(spot.timestamp);
      if (spotTime > data.lastActivity) {
        data.lastActivity = spotTime;
      }
      if (spot.snr && spot.snr > data.bestSNR) {
        data.bestSNR = spot.snr;
      }
      if (spot.snr && spot.snr < data.worstSNR) {
        data.worstSNR = spot.snr;
      }
      data.bands.add(spot.band);
      data.modes.add(spot.mode);
      data.locators.add(spot.receiver.location.maidenhead || '');
    }
  });

  // Convert to markers - PSK Reporter style with clustering
  const markers = [];
  let markerId = 0;

  receiverData.forEach((data, key) => {
    const callsignArray = Array.from(data.callsigns);
    const bandsArray = Array.from(data.bands);
    const locatorsArray = Array.from(data.locators);
    const primaryCallsign = callsignArray[0];
    const isMultiStation = callsignArray.length > 1;

    markers.push({
      id: `receiver-${markerId++}`,
      position: data.position,
      type: 'receiver', // All spots are receivers in PSK Reporter methodology
      callsign: isMultiStation ? `${primaryCallsign} +${callsignArray.length - 1}` : primaryCallsign,
      spotCount: data.spots.length,
      lastActivity: data.lastActivity,
      popup: {
        title: isMultiStation ? `Multiple Stations (${callsignArray.length})` : `${primaryCallsign} (Monitor)`,
        content: `${callsignArray.join(', ')} | ${data.spots.length} spots | Best: ${data.bestSNR}dB | Loc: ${locatorsArray.join(', ')}`,
      },
    });
  });

  return markers;
}

// Generate propagation paths
function generatePropagationPaths(spots) {
  const pathData = new Map();

  // Group spots by path (simplified - using transmitter/receiver pair)
  spots.forEach(spot => {
    const pathKey = `${spot.transmitter.callsign}-${spot.receiver.callsign}`;
    if (!pathData.has(pathKey)) {
      pathData.set(pathKey, []);
    }
    pathData.get(pathKey).push(spot);
  });

  const paths = [];
  let pathId = 0;

  pathData.forEach((pathSpots, pathKey) => {
    if (pathSpots.length === 0) return;

    const firstSpot = pathSpots[0];
    const distance = calculateDistance(
      firstSpot.transmitter.location.latitude,
      firstSpot.transmitter.location.longitude,
      firstSpot.receiver.location.latitude,
      firstSpot.receiver.location.longitude
    );

    const bearing = calculateBearing(
      firstSpot.transmitter.location.latitude,
      firstSpot.transmitter.location.longitude,
      firstSpot.receiver.location.latitude,
      firstSpot.receiver.location.longitude
    );

    // Determine path quality based on SNR and spot count
    let quality = 'poor';
    const avgSnr = pathSpots
      .filter(s => s.snr !== undefined)
      .reduce((sum, s, _, arr) => sum + (s.snr / arr.length), 0);

    if (avgSnr >= -5) quality = 'excellent';
    else if (avgSnr >= -10) quality = 'good';
    else if (avgSnr >= -15) quality = 'fair';

    paths.push({
      id: `path-${pathId++}`,
      from: firstSpot.transmitter.location,
      to: firstSpot.receiver.location,
      spots: pathSpots,
      quality,
      distance,
      bearing,
    });
  });

  // Sort by distance (longest paths first for better visualization)
  return paths.sort((a, b) => b.distance - a.distance);
}

// Calculate statistics
function calculateStatistics(spots) {
  const stats = {
    totalSpots: spots.length,
    uniqueTransmitters: new Set(spots.map(s => s.transmitter.callsign)).size,
    uniqueReceivers: new Set(spots.map(s => s.receiver.callsign)).size,
    bandDistribution: {},
    modeDistribution: {},
    averageSnr: 0,
    maxDistance: 0,
    timeRange: {
      start: new Date(),
      end: new Date(0),
    },
  };

  if (spots.length === 0) return stats;

  // Calculate distributions and statistics
  let snrSum = 0;
  let snrCount = 0;

  spots.forEach(spot => {
    // Band distribution
    stats.bandDistribution[spot.band] = (stats.bandDistribution[spot.band] || 0) + 1;
    
    // Mode distribution
    stats.modeDistribution[spot.mode] = (stats.modeDistribution[spot.mode] || 0) + 1;
    
    // SNR statistics
    if (spot.snr !== undefined) {
      snrSum += spot.snr;
      snrCount++;
    }

    // Distance calculation
    if (spot.transmitter.location.latitude && spot.receiver.location.latitude) {
      const distance = calculateDistance(
        spot.transmitter.location.latitude,
        spot.transmitter.location.longitude,
        spot.receiver.location.latitude,
        spot.receiver.location.longitude
      );
      stats.maxDistance = Math.max(stats.maxDistance, distance);
    }

    // Time range
    const spotTime = new Date(spot.timestamp);
    if (spotTime < stats.timeRange.start) {
      stats.timeRange.start = spotTime;
    }
    if (spotTime > stats.timeRange.end) {
      stats.timeRange.end = spotTime;
    }
  });

  stats.averageSnr = snrCount > 0 ? snrSum / snrCount : 0;

  return stats;
}

// Message handler
self.onmessage = function(e) {
  const { type, data, id } = e.data;

  try {
    let result;

    switch (type) {
      case 'ANALYZE_BAND_CONDITIONS':
        result = analyzeBandConditions(data.spots);
        break;

      case 'GENERATE_MAP_MARKERS':
        result = generateMapMarkers(data.spots);
        break;

      case 'GENERATE_PROPAGATION_PATHS':
        result = generatePropagationPaths(data.spots);
        break;

      case 'CALCULATE_STATISTICS':
        result = calculateStatistics(data.spots);
        break;

      case 'PROCESS_ALL':
        result = {
          bandConditions: analyzeBandConditions(data.spots),
          mapMarkers: generateMapMarkers(data.spots),
          propagationPaths: generatePropagationPaths(data.spots),
          statistics: calculateStatistics(data.spots),
        };
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    // Send result back to main thread
    self.postMessage({
      type: 'SUCCESS',
      id,
      result,
    });

  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      type: 'ERROR',
      id,
      error: error.message,
    });
  }
};
