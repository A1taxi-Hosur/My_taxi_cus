import { Zone } from '../services/zoneService';

/**
 * Check if a point is within any of the active zones
 */
export function isPointInAnyActiveZone(
  coordinates: { latitude: number; longitude: number },
  zones: Zone[]
): boolean {
  console.log('🔍 Checking if point is in any active zone:', {
    coordinates,
    zonesCount: zones.length,
    zones: zones.map(z => ({ name: z.name, radius: z.radius_km }))
  });

  for (const zone of zones) {
    const isInZone = isPointInZone(coordinates, zone);
    console.log(`🔍 Zone "${zone.name}" check result:`, isInZone);

    if (isInZone) {
      console.log('✅ Point is within zone:', zone.name);
      return true;
    }
  }

  console.log('❌ Point is not within any active zone');
  return false;
}

/**
 * Check if a point is within a specific zone
 */
function isPointInZone(
  coordinates: { latitude: number; longitude: number },
  zone: Zone
): boolean {
  // If zone has polygon coordinates, use polygon check
  if (zone.coordinates && Array.isArray(zone.coordinates)) {
    return isPointInPolygon(coordinates, zone.coordinates);
  }

  // Fallback to circular zone check using center and radius
  return isPointInCircle(
    coordinates,
    { latitude: zone.center_latitude, longitude: zone.center_longitude },
    zone.radius_km
  );
}

/**
 * Check if a point is within a circular zone
 */
function isPointInCircle(
  point: { latitude: number; longitude: number },
  center: { latitude: number; longitude: number },
  radiusKm: number
): boolean {
  const distance = calculateHaversineDistance(
    point.latitude,
    point.longitude,
    center.latitude,
    center.longitude
  );

  const isInside = distance <= radiusKm;
  
  console.log('🔍 Circle zone check:', {
    point,
    center,
    radiusKm,
    distance: distance.toFixed(2) + 'km',
    isInside
  });

  return isInside;
}

/**
 * Check if a point is within a polygon zone
 */
function isPointInPolygon(
  point: { latitude: number; longitude: number },
  polygon: number[][]
): boolean {
  console.log('🔍 Polygon zone check:', {
    point,
    polygonPoints: polygon.length
  });

  if (!polygon || polygon.length < 3) {
    console.warn('⚠️ Invalid polygon data, falling back to false');
    return false;
  }

  let isInside = false;
  const x = point.longitude;
  const y = point.latitude;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1]; // longitude
    const yi = polygon[i][0]; // latitude
    const xj = polygon[j][1]; // longitude
    const yj = polygon[j][0]; // latitude

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      isInside = !isInside;
    }
  }

  console.log('🔍 Polygon check result:', isInside);
  return isInside;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get the zone that contains a specific point
 */
export function getZoneForPoint(
  coordinates: { latitude: number; longitude: number },
  zones: Zone[]
): Zone | null {
  for (const zone of zones) {
    if (isPointInZone(coordinates, zone)) {
      return zone;
    }
  }
  return null;
}

/**
 * Get all zones that contain a specific point
 */
export function getZonesForPoint(
  coordinates: { latitude: number; longitude: number },
  zones: Zone[]
): Zone[] {
  return zones.filter(zone => isPointInZone(coordinates, zone));
}