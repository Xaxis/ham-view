// PropView Data Processing Service

import type { 
  PropagationSpot, 
  BandCondition, 
  Band, 
  Location,
  PropagationPath,
  MapMarker 
} from '../types';

// Utility functions for geographic calculations
export class GeoUtils {
  // Calculate distance between two points using Haversine formula
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Calculate bearing between two points
  static calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = this.toRadians(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(this.toRadians(lat2));
    const x = Math.cos(this.toRadians(lat1)) * Math.sin(this.toRadians(lat2)) -
              Math.sin(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x);
    bearing = this.toDegrees(bearing);
    return (bearing + 360) % 360;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private static toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}

// Data processing and analysis service
export class DataProcessor {
  // Analyze band conditions from propagation spots
  static analyzeBandConditions(spots: PropagationSpot[]): BandCondition[] {
    const bandData = new Map<Band, {
      spots: PropagationSpot[];
      snrValues: number[];
      distances: number[];
    }>();

    // Group spots by band
    spots.forEach(spot => {
      if (!bandData.has(spot.band)) {
        bandData.set(spot.band, {
          spots: [],
          snrValues: [],
          distances: [],
        });
      }

      const data = bandData.get(spot.band)!;
      data.spots.push(spot);
      
      if (spot.snr !== undefined) {
        data.snrValues.push(spot.snr);
      }

      // Calculate distance if we have coordinates
      if (spot.transmitter.location.latitude && spot.receiver.location.latitude) {
        const distance = GeoUtils.calculateDistance(
          spot.transmitter.location.latitude,
          spot.transmitter.location.longitude,
          spot.receiver.location.latitude,
          spot.receiver.location.longitude
        );
        data.distances.push(distance);
      }
    });

    // Analyze each band
    const conditions: BandCondition[] = [];
    
    bandData.forEach((data, band) => {
      const spotCount = data.spots.length;
      const averageSnr = data.snrValues.length > 0 
        ? data.snrValues.reduce((sum, snr) => sum + snr, 0) / data.snrValues.length
        : undefined;

      // Find best DX
      let bestDx: BandCondition['bestDx'] = undefined;
      if (data.distances.length > 0) {
        const maxDistance = Math.max(...data.distances);
        const bestSpot = data.spots.find(spot => {
          if (!spot.transmitter.location.latitude || !spot.receiver.location.latitude) return false;
          const distance = GeoUtils.calculateDistance(
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
      let condition: BandCondition['condition'] = 'POOR';
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

      // Determine trend (simplified - would need historical data for real trend analysis)
      const trend: BandCondition['trend'] = 'STABLE';

      conditions.push({
        band,
        condition,
        confidence,
        spotCount,
        averageSnr,
        bestDx,
        trend,
      });
    });

    return conditions.sort((a, b) => {
      const bandOrder: Band[] = ['160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '4m', '2m'];
      return bandOrder.indexOf(a.band) - bandOrder.indexOf(b.band);
    });
  }

  // Generate map markers from propagation spots
  static generateMapMarkers(spots: PropagationSpot[]): MapMarker[] {
    const markerData = new Map<string, {
      position: { latitude: number; longitude: number };
      callsigns: Set<string>;
      spots: PropagationSpot[];
      lastActivity: Date;
    }>();

    spots.forEach(spot => {
      // Process transmitter
      const txKey = `${spot.transmitter.location.latitude},${spot.transmitter.location.longitude}`;
      if (!markerData.has(txKey)) {
        markerData.set(txKey, {
          position: spot.transmitter.location,
          callsigns: new Set(),
          spots: [],
          lastActivity: spot.timestamp,
        });
      }
      const txData = markerData.get(txKey)!;
      txData.callsigns.add(spot.transmitter.callsign);
      txData.spots.push(spot);
      if (spot.timestamp > txData.lastActivity) {
        txData.lastActivity = spot.timestamp;
      }

      // Process receiver
      const rxKey = `${spot.receiver.location.latitude},${spot.receiver.location.longitude}`;
      if (!markerData.has(rxKey)) {
        markerData.set(rxKey, {
          position: spot.receiver.location,
          callsigns: new Set(),
          spots: [],
          lastActivity: spot.timestamp,
        });
      }
      const rxData = markerData.get(rxKey)!;
      rxData.callsigns.add(spot.receiver.callsign);
      rxData.spots.push(spot);
      if (spot.timestamp > rxData.lastActivity) {
        rxData.lastActivity = spot.timestamp;
      }
    });

    const markers: MapMarker[] = [];
    let markerId = 0;

    markerData.forEach((data, key) => {
      const callsignArray = Array.from(data.callsigns);
      const primaryCallsign = callsignArray[0];
      
      // Determine marker type based on activity
      const transmittedSpots = data.spots.filter(s => s.transmitter.callsign === primaryCallsign);
      const receivedSpots = data.spots.filter(s => s.receiver.callsign === primaryCallsign);
      
      let type: MapMarker['type'] = 'both';
      if (transmittedSpots.length > 0 && receivedSpots.length === 0) type = 'transmitter';
      else if (receivedSpots.length > 0 && transmittedSpots.length === 0) type = 'receiver';

      markers.push({
        id: `marker-${markerId++}`,
        position: data.position,
        type,
        callsign: primaryCallsign,
        spotCount: data.spots.length,
        lastActivity: data.lastActivity,
        popup: {
          title: callsignArray.join(', '),
          content: `${data.spots.length} spots, last activity: ${data.lastActivity.toLocaleTimeString()}`,
        },
      });
    });

    return markers;
  }

  // Generate propagation paths for visualization
  static generatePropagationPaths(spots: PropagationSpot[]): PropagationPath[] {
    const pathData = new Map<string, PropagationSpot[]>();

    // Group spots by path (simplified - using transmitter/receiver pair)
    spots.forEach(spot => {
      const pathKey = `${spot.transmitter.callsign}-${spot.receiver.callsign}`;
      if (!pathData.has(pathKey)) {
        pathData.set(pathKey, []);
      }
      pathData.get(pathKey)!.push(spot);
    });

    const paths: PropagationPath[] = [];
    let pathId = 0;

    pathData.forEach((pathSpots, pathKey) => {
      if (pathSpots.length === 0) return;

      const firstSpot = pathSpots[0];
      const distance = GeoUtils.calculateDistance(
        firstSpot.transmitter.location.latitude,
        firstSpot.transmitter.location.longitude,
        firstSpot.receiver.location.latitude,
        firstSpot.receiver.location.longitude
      );

      const bearing = GeoUtils.calculateBearing(
        firstSpot.transmitter.location.latitude,
        firstSpot.transmitter.location.longitude,
        firstSpot.receiver.location.latitude,
        firstSpot.receiver.location.longitude
      );

      // Determine path quality based on SNR and spot count
      let quality: PropagationPath['quality'] = 'poor';
      const avgSnr = pathSpots
        .filter(s => s.snr !== undefined)
        .reduce((sum, s, _, arr) => sum + (s.snr! / arr.length), 0);

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

  // Filter spots by geographic criteria
  static filterSpotsByLocation(
    spots: PropagationSpot[], 
    fromLocation?: Location,
    minDistance?: number,
    maxDistance?: number
  ): PropagationSpot[] {
    if (!fromLocation && !minDistance && !maxDistance) {
      return spots;
    }

    return spots.filter(spot => {
      if (fromLocation) {
        const txDistance = GeoUtils.calculateDistance(
          fromLocation.latitude,
          fromLocation.longitude,
          spot.transmitter.location.latitude,
          spot.transmitter.location.longitude
        );

        const rxDistance = GeoUtils.calculateDistance(
          fromLocation.latitude,
          fromLocation.longitude,
          spot.receiver.location.latitude,
          spot.receiver.location.longitude
        );

        const minDistanceToLocation = Math.min(txDistance, rxDistance);

        if (minDistance && minDistanceToLocation < minDistance) return false;
        if (maxDistance && minDistanceToLocation > maxDistance) return false;
      }

      return true;
    });
  }

  // Calculate propagation statistics
  static calculateStatistics(spots: PropagationSpot[]) {
    const stats = {
      totalSpots: spots.length,
      uniqueTransmitters: new Set(spots.map(s => s.transmitter.callsign)).size,
      uniqueReceivers: new Set(spots.map(s => s.receiver.callsign)).size,
      bandDistribution: {} as Record<Band, number>,
      modeDistribution: {} as Record<string, number>,
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
        const distance = GeoUtils.calculateDistance(
          spot.transmitter.location.latitude,
          spot.transmitter.location.longitude,
          spot.receiver.location.latitude,
          spot.receiver.location.longitude
        );
        stats.maxDistance = Math.max(stats.maxDistance, distance);
      }

      // Time range
      if (spot.timestamp < stats.timeRange.start) {
        stats.timeRange.start = spot.timestamp;
      }
      if (spot.timestamp > stats.timeRange.end) {
        stats.timeRange.end = spot.timestamp;
      }
    });

    stats.averageSnr = snrCount > 0 ? snrSum / snrCount : 0;

    return stats;
  }
}
