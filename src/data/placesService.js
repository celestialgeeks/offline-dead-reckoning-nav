// PS168 — Dynamic Places & POI Service
// Queries real-world amenities dynamically using OSM Overpass API
// Viewport-aware, filtering POI density by bounding box size (zoom level)
// Uses proper HTTP headers and queries both nodes and ways

import { haversine } from '../utils/geo';

export const CATEGORIES = [
  { id: 'all', label: 'All Places', icon: '📍', color: '#1A73E8' },
  { id: 'hospital', label: 'Hospitals', icon: '🏥', color: '#EA4335' },
  { id: 'fuel', label: 'Petrol', icon: '⛽', color: '#1A73E8' },
  { id: 'food', label: 'Restaurants', icon: '🍔', color: '#FA7B17' },
  { id: 'pharmacy', label: 'Pharmacies', icon: '💊', color: '#34A853' },
  { id: 'atm', label: 'ATMs', icon: '🏧', color: '#0F9D58' },
  { id: 'shop', label: 'Groceries', icon: '🛒', color: '#9C27B0' },
];

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

let lastGoodPlacesCache = [];
const globalPlacesCache = new Map();


function getCategoryTags(categoryId) {
  switch (categoryId) {
    case 'hospital': return '["amenity"~"hospital|clinic"]';
    case 'fuel': return '["amenity"="fuel"]';
    case 'food': return '["amenity"~"restaurant|cafe|fast_food"]';
    case 'pharmacy': return '["amenity"="pharmacy"]';
    case 'atm': return '["amenity"~"atm|bank"]["atm"!="no"]';
    case 'shop': return '["shop"~"supermarket|convenience|mall"]';
    case 'all':
    default:
      return '["amenity"~"hospital|fuel|restaurant|cafe|pharmacy|atm|bank|clinic"]';
  }
}

function getCategoryInfo(tags) {
  let cat = CATEGORIES[0]; // fallback 'all'
  if (tags.amenity === 'hospital' || tags.amenity === 'clinic') cat = CATEGORIES[1];
  else if (tags.amenity === 'fuel') cat = CATEGORIES[2];
  else if (tags.amenity === 'restaurant' || tags.amenity === 'cafe' || tags.amenity === 'fast_food') cat = CATEGORIES[3];
  else if (tags.amenity === 'pharmacy') cat = CATEGORIES[4];
  else if (tags.amenity === 'atm' || tags.amenity === 'bank') cat = CATEGORIES[5];
  else if (tags.shop) cat = CATEGORIES[6];

  let address = tags['addr:street'] || tags['addr:full'] || tags['addr:city'] || '';
  if (!address) {
    if (tags.city) address = tags.city;
    else if (tags.district) address = tags.district;
  }
  
  return {
    category: cat.id,
    categoryLabel: cat.label,
    icon: cat.icon,
    pinColor: cat.color,
    address: address || 'Address not available',
  };
}

/**
 * Main fetch places helper used across MapScreen and components
 */
export async function fetchPlaces(categoryId = 'all', bounds = null, userPosition = null, zoom = 15) {
  let s, w, n, e;
  
  if (bounds && bounds.length === 4) {
    w = bounds[0];
    s = bounds[1];
    e = bounds[2];
    n = bounds[3];
  } else if (userPosition) {
    const latOffset = 0.018;
    const lonOffset = 0.018;
    s = userPosition.latitude - latOffset;
    n = userPosition.latitude + latOffset;
    w = userPosition.longitude - lonOffset;
    e = userPosition.longitude + lonOffset;
  } else {
    // No viewport and no user fix: there is nothing to scope the query to.
    // Never fall back to a hard-coded city box — pins must only ever come
    // from the area the user is actually looking at.
    return [];
  }

  let queryLimit = 40;
  if (zoom < 13) queryLimit = 6;
  else if (zoom < 15) queryLimit = 15;

  const cacheKey = bounds ? `${categoryId}_${w.toFixed(2)}_${s.toFixed(2)}_${e.toFixed(2)}_${n.toFixed(2)}_${Math.round(zoom)}` : null;
  if (cacheKey && globalPlacesCache.has(cacheKey)) {
    const cached = globalPlacesCache.get(cacheKey);
    globalPlacesCache.delete(cacheKey);
    globalPlacesCache.set(cacheKey, cached);
    return cached;
  }

  const tags = getCategoryTags(categoryId);
  
  // Overpass QL — query both nodes and ways with center output for ways
  const query = `[out:json][timeout:25];(node${tags}(${s},${w},${n},${e});way${tags}(${s},${w},${n},${e}););out center ${queryLimit};`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    let retries = 1;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25000);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'PS168App/1.0',
          },
          body: 'data=' + encodeURIComponent(query),
          signal: controller.signal,
        });
        clearTimeout(timer);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.elements || data.elements.length === 0) {
          break; // Empty response, move to next endpoint
        }

        // Distance/ETA reference: the user when known, otherwise the center
        // of the queried viewport (never a hard-coded city)
        const uLat = userPosition?.latitude ?? (s + n) / 2;
        const uLon = userPosition?.longitude ?? (w + e) / 2;

        const places = data.elements
          .filter(el => {
            // For ways, use center coordinates
            const lat = el.lat ?? el.center?.lat;
            const lon = el.lon ?? el.center?.lon;
            return lat != null && lon != null;
          })
          .map(el => {
            const lat = el.lat ?? el.center?.lat;
            const lon = el.lon ?? el.center?.lon;
            const info = getCategoryInfo(el.tags || {});
            const name = el.tags?.name || el.tags?.['name:en'] || info.categoryLabel;
            
            const distanceM = haversine(uLat, uLon, lat, lon);
            const etaMin = Math.max(1, Math.round(distanceM / 500));

            const isEmergency = el.tags?.emergency === 'yes';
            const isHospital = el.tags?.amenity === 'hospital';
            const hasBeds = el.tags?.capacity || el.tags?.['healthcare:speciality'];
            const hasName = el.tags?.name || el.tags?.['name:en'];
            
            let prominence = 0;
            if (isEmergency) prominence += 50;
            if (isHospital) prominence += 30;
            if (hasBeds) prominence += 20;
            if (hasName) prominence += 20;
            if (el.type === 'way') prominence += 10; // Simple area proxy

            return {
              id: `osm_${el.id}`,
              name,
              category: info.category,
              categoryLabel: el.tags?.amenity || el.tags?.shop || info.categoryLabel,
              icon: info.icon,
              pinColor: info.pinColor,
              latitude: lat,
              longitude: lon,
              // OSM/Overpass carries no rating/review data. Never fabricate it —
              // the PlaceCard omits the rating block when these are null.
              rating: null,
              reviews: null,
              address: info.address,
              status: el.tags?.opening_hours ? (el.tags.opening_hours === '24/7' ? 'Open 24 hours' : 'See hours') : 'Hours Unknown',
              phone: el.tags?.phone || el.tags?.['contact:phone'] || '',
              website: el.tags?.website || el.tags?.['contact:website'] || '',
              opening_hours: el.tags?.opening_hours || '',
              distanceM: Math.round(distanceM),
              etaMin,
              prominence,
            };
          })
          .filter(p => {
             // Hide small-clinic categories below z15 entirely
             if (zoom < 15 && p.categoryLabel.toLowerCase().includes('clinic')) return false;
             return true;
          });

        const sortedPlaces = places.sort((a, b) => b.prominence - a.prominence).slice(0, queryLimit);
        lastGoodPlacesCache = sortedPlaces;
        
        if (cacheKey) {
          globalPlacesCache.set(cacheKey, sortedPlaces);
          if (globalPlacesCache.size > 20) {
            const firstKey = globalPlacesCache.keys().next().value;
            globalPlacesCache.delete(firstKey);
          }
        }
        
        return sortedPlaces;
      } catch (error) {
        console.warn(`[placesService] Overpass ${endpoint} (Attempt ${attempt+1}) failed:`, error.message);
        if (attempt < retries) {
          await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt))); // Exponential backoff
        }
      }
    }
  }

  // All endpoints failed
  console.warn('[placesService] All Overpass endpoints failed. Triggering failure state.');
  // The UI shows a retry chip and clears the viewport pins — stale pins from
  // another area must never be resurrected. Drop the last-good cache too so
  // getLocalSuggestions() can't surface POIs from a different viewport.
  lastGoodPlacesCache = [];
  throw new Error('OVERPASS_FETCH_FAILED');
}

/**
 * Empty stub updated for C2 parity, returning last cache
 */
export function getPlaces() {
  return lastGoodPlacesCache;
}

/**
 * Calculate distance in km between two coordinates
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  return haversine(lat1, lon1, lat2, lon2) / 1000;
}

/**
 * Calculate estimated travel time in minutes based on distance in km
 */
export function calculateETA(distanceKm, speedKmh = 35) {
  if (distanceKm == null || distanceKm <= 0) return 1;
  return Math.max(1, Math.round((distanceKm / speedKmh) * 60));
}

/**
 * Format distance for display (e.g. "450 m" or "3.2 km")
 */
export function formatDistance(distanceKm) {
  if (distanceKm == null) return '0 m';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Clear the in-memory viewport result caches (used by "Clear all data")
 */
export function clearPlacesCache() {
  globalPlacesCache.clear();
  lastGoodPlacesCache = [];
}
