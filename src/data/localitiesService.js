// PS168 — Universal Locality Discovery & Labeling Service
// Implements Google Maps-style cartographic generalization with:
//   1. Dynamic Overpass viewport query for suburbs/neighbourhoods/quarters/localities
//   2. Hierarchical Tier classification (Settlement Hierarchy)
//   3. Zoom-aware Level of Detail (LOD) filtering
//   4. Greedy Point-Feature Label Placement (PFLP) collision resolution
//   5. Spatial LRU grid cache for zero-latency re-panning

// ─── Tier Classification (Google Maps Settlement Hierarchy) ─────────────
const TIER_WEIGHT = {
  city: 150,
  town: 120,
  suburb: 100,
  borough: 100,
  village: 80,
  quarter: 70,
  neighbourhood: 40,
  locality: 20,
};

// ─── Zoom → Tier Visibility (Level of Detail) ──────────────────────────
// Zoom 10–12  : Only Tier 1 (suburbs / boroughs)
// Zoom 12–14  : Tier 1 + Tier 2 (quarters / sectors)
// Zoom 14–16.5: Tier 1 + Tier 2 + Tier 3 (neighbourhoods)
// Zoom > 16.5 : All tiers fade out so street-level POIs dominate
function getMinTierWeight(zoom) {
  if (zoom <= 12) return 100;   // Only suburbs
  if (zoom <= 14) return 70;    // Suburbs + quarters
  if (zoom <= 16.5) return 20;  // All tiers visible
  return 999;                   // Nothing visible — zoomed in too far
}

// ─── Spatial Grid Cache ─────────────────────────────────────────────────
// Cache results keyed by 0.1° grid cells so revisiting panned areas is instant
const localityCache = new Map();
const CACHE_MAX_SIZE = 100;
const CACHE_CELL_SIZE = 0.1; // degrees (~11 km cells)

function cacheKey(lat, lon) {
  const gLat = Math.floor(lat / CACHE_CELL_SIZE) * CACHE_CELL_SIZE;
  const gLon = Math.floor(lon / CACHE_CELL_SIZE) * CACHE_CELL_SIZE;
  return `${gLat.toFixed(1)}_${gLon.toFixed(1)}`;
}

function getCachedLocalities(bounds) {
  const [west, south, east, north] = bounds;
  const result = [];
  const seen = new Set();

  // Iterate over grid cells covered by the viewport
  for (let lat = Math.floor(south / CACHE_CELL_SIZE) * CACHE_CELL_SIZE;
    lat <= north; lat += CACHE_CELL_SIZE) {
    for (let lon = Math.floor(west / CACHE_CELL_SIZE) * CACHE_CELL_SIZE;
      lon <= east; lon += CACHE_CELL_SIZE) {
      const key = cacheKey(lat, lon);
      const cached = localityCache.get(key);
      if (cached) {
        for (const loc of cached) {
          if (!seen.has(loc.id)) {
            seen.add(loc.id);
            result.push(loc);
          }
        }
      }
    }
  }
  return result.length > 0 ? result : null;
}

function storeInCache(localities) {
  // Evict oldest entries if cache is too large
  while (localityCache.size > CACHE_MAX_SIZE) {
    const firstKey = localityCache.keys().next().value;
    localityCache.delete(firstKey);
  }

  // Bucket each locality into its grid cell
  const buckets = new Map();
  for (const loc of localities) {
    const key = cacheKey(loc.lat, loc.lon);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(loc);
  }
  for (const [key, locs] of buckets) {
    const existing = localityCache.get(key) || [];
    const merged = [...existing];
    const ids = new Set(existing.map(l => l.id));
    for (const l of locs) {
      if (!ids.has(l.id)) {
        merged.push(l);
        ids.add(l.id);
      }
    }
    localityCache.set(key, merged);
  }
}

// ─── Overpass API Query ─────────────────────────────────────────────────
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

let lastFetchTs = 0;
const THROTTLE_MS = 3000; // don't spam Overpass
let activeFetch = null;   // dedup concurrent requests

export async function fetchLocalitiesFromAPI(bounds) {
  const now = Date.now();
  if (now - lastFetchTs < THROTTLE_MS) {
    return getCachedLocalities(bounds) || [];
  }

  // Deduplicate concurrent requests
  if (activeFetch) return activeFetch;

  const [west, south, east, north] = bounds;
  const tags = '["place"~"city|town|village|suburb|quarter|neighbourhood|locality|borough"]';
  const query = `[out:json][timeout:25];(node${tags}(${south},${west},${north},${east});way${tags}(${south},${west},${north},${east}););out center 60;`;

  const doFetch = async () => {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      let retries = 1;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 25000);
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'PS168App/1.0',
            },
            body: 'data=' + encodeURIComponent(query),
            signal: controller.signal,
          });
          clearTimeout(timer);
          
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          
          const data = await res.json();
          lastFetchTs = Date.now();

          if (!data.elements || data.elements.length === 0) return [];

          const localities = data.elements
            .filter(el => el.tags?.name)
            .map(el => {
              const lat = el.lat ?? el.center?.lat;
              const lon = el.lon ?? el.center?.lon;
              return {
                id: `loc_${el.id}`,
                name: el.tags.name,
                nameEn: el.tags['name:en'] || el.tags.name,
                place: el.tags.place || 'locality',
                lat,
                lon,
                tierWeight: TIER_WEIGHT[el.tags.place] || 20,
              };
            });

          storeInCache(localities);
          return localities;
        } catch (err) {
          console.warn(`[localitiesService] Overpass ${endpoint} (Attempt ${attempt+1}) failed:`, err.message);
          if (attempt < retries) {
            await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
          }
        }
      }
    }
    return [];
  };

  activeFetch = doFetch();
  try {
    return await activeFetch;
  } finally {
    activeFetch = null;
  }
}

// ─── Web Mercator Projection (for screen-space collision) ───────────────
function latLonToScreen(lat, lon, bounds, screenWidth, screenHeight) {
  const [west, south, east, north] = bounds;
  const x = ((lon - west) / (east - west)) * screenWidth;
  const y = ((north - lat) / (north - south)) * screenHeight;
  return { x, y };
}

// ─── PFLP Greedy Collision Resolution (Non-Maximum Suppression) ─────────
// Score = tierWeight + prominence - distanceFromCenter
// Place label if its padded AABB doesn't collide with already-placed labels
const LABEL_PADDING_PX = 20;
const ESTIMATED_CHAR_WIDTH = 7;
const LABEL_HEIGHT_PX = 18;

function estimateLabelWidth(name) {
  return name.length * ESTIMATED_CHAR_WIDTH + LABEL_PADDING_PX;
}

function aabbCollides(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

/**
 * Main entry point: fetch + filter + collision-resolve localities for the viewport
 * @param {number[]} bounds - [west, south, east, north]
 * @param {number} zoomLevel - current map zoom
 * @param {object} screenDims - { width, height } in pixels
 * @returns {Promise<object[]>} optimally placed locality labels
 */
export async function getVisibleLocalities(bounds, zoomLevel, screenDims = { width: 400, height: 800 }) {
  if (!bounds || bounds.length !== 4) return [];

  const minWeight = getMinTierWeight(zoomLevel);
  if (minWeight >= 999) return []; // Too zoomed in

  // 1. Try cache first, then fetch from API
  let raw = getCachedLocalities(bounds);
  if (!raw || raw.length === 0) {
    raw = await fetchLocalitiesFromAPI(bounds);
  } else {
    // Fire background refresh if stale
    fetchLocalitiesFromAPI(bounds).catch(() => {});
  }

  if (!raw || raw.length === 0) return [];

  const [west, south, east, north] = bounds;

  // 2. Filter to viewport bounds and minimum tier weight
  const inView = raw.filter(loc =>
    loc.lat >= south && loc.lat <= north &&
    loc.lon >= west && loc.lon <= east &&
    loc.tierWeight >= minWeight
  );

  // 3. Score candidates: tierWeight + proximity to center bonus
  const centerLat = (north + south) / 2;
  const centerLon = (east + west) / 2;
  const maxDist = Math.sqrt((north - south) ** 2 + (east - west) ** 2) / 2 || 1;

  const candidates = inView.map(loc => {
    const distFromCenter = Math.sqrt((loc.lat - centerLat) ** 2 + (loc.lon - centerLon) ** 2);
    const proximityBonus = (1 - distFromCenter / maxDist) * 30;
    const score = loc.tierWeight + proximityBonus;
    return { ...loc, score };
  });

  // 4. Sort by score descending (highest priority first)
  candidates.sort((a, b) => b.score - a.score);

  // 4.5 Deduplicate by name (keeping the highest scoring one)
  const dedupedCandidates = [];
  const seenNames = new Set();
  for (const candidate of candidates) {
    const normName = candidate.name.toLowerCase();
    if (!seenNames.has(normName)) {
      seenNames.add(normName);
      dedupedCandidates.push(candidate);
    }
  }

  // 5. Greedy PFLP: place labels that don't collide
  const placed = [];
  const placedAABBs = [];

  for (const candidate of dedupedCandidates) {
    const { x, y } = latLonToScreen(candidate.lat, candidate.lon, bounds, screenDims.width, screenDims.height);
    const labelW = estimateLabelWidth(candidate.name);
    const labelH = LABEL_HEIGHT_PX;

    const aabb = {
      left: x - labelW / 2 - LABEL_PADDING_PX,
      right: x + labelW / 2 + LABEL_PADDING_PX,
      top: y - labelH / 2 - LABEL_PADDING_PX,
      bottom: y + labelH / 2 + LABEL_PADDING_PX,
    };

    // Check collision with all already-placed labels
    let collides = false;
    for (const existing of placedAABBs) {
      if (aabbCollides(aabb, existing)) {
        collides = true;
        break;
      }
    }

    if (!collides) {
      placed.push(candidate);
      placedAABBs.push(aabb);
    }

    // Cap at 15 labels maximum for performance
    if (placed.length >= 15) break;
  }

  return placed;
}
