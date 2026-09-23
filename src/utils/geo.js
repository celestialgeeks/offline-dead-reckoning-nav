// PS168 — Geo Utilities
// Pure math, no dependencies

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_RADIUS_M = 6371000;

/**
 * Haversine distance between two points in meters
 */
export function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLon = (lon2 - lon1) * DEG2RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Bearing from point 1 to point 2 in degrees (0 = North, 90 = East)
 */
export function bearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * DEG2RAD;
  const y = Math.sin(dLon) * Math.cos(lat2 * DEG2RAD);
  const x =
    Math.cos(lat1 * DEG2RAD) * Math.sin(lat2 * DEG2RAD) -
    Math.sin(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.cos(dLon);
  return ((Math.atan2(y, x) * RAD2DEG) + 360) % 360;
}

/**
 * Move a point by distance (meters) and bearing (degrees)
 * Returns {latitude, longitude}
 */
export function movePoint(lat, lon, distanceM, bearingDeg) {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = bearingDeg * DEG2RAD;
  const φ1 = lat * DEG2RAD;
  const λ1 = lon * DEG2RAD;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

  return {
    latitude: φ2 * RAD2DEG,
    longitude: λ2 * RAD2DEG,
  };
}

/**
 * Compute bounding box around a center point
 * Returns [[west, south], [east, north]] (MapLibre format: [lon, lat])
 */
export function boundingBox(lat, lon, radiusLatDeg, radiusLonDeg) {
  const west = lon - radiusLonDeg;
  const south = lat - radiusLatDeg;
  const east = lon + radiusLonDeg;
  const north = lat + radiusLatDeg;
  return [west, south, east, north];
}

/**
 * Generate circle coordinates for confidence ellipse
 * Returns array of [lon, lat] points forming a circle
 */
export function generateCircleCoords(centerLat, centerLon, radiusMeters, numPoints = 36) {
  const coords = [];
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 360;
    const point = movePoint(centerLat, centerLon, radiusMeters, angle);
    coords.push([point.longitude, point.latitude]);
  }
  return coords;
}

/**
 * Linear interpolation
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
