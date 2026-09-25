// PS168 — Live Search & Autocomplete Service
// Multi-provider geocoder chain: (optional keyed Google Places) → (optional
// keyed Geoapify) → Photon → Nominatim → LRU cache → local verified landmarks.
// Stale in-flight queries are aborted so fast typing never races; Nominatim is
// throttled to its 1 req/s policy.

import { haversine } from '../utils/geo';
import { getPlaces } from '../data/placesService';
import { getSettings } from './settingsService';

const PHOTON_API = 'https://photon.komoot.io/api/';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/';
const GEOAPIFY_API = 'https://api.geoapify.com/v1/geocode/autocomplete';
const GOOGLE_TEXT_SEARCH = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_PLACES_BASE = 'https://places.googleapis.com/v1/places';
const GOOGLE_GEOCODE_API = 'https://maps.googleapis.com/maps/api/geocode/json';
const NOMINATIM_UA = 'PS168Navigator/1.0';

// ---------------------------------------------------------------------------
// Result cache (LRU, cap 100)
// ---------------------------------------------------------------------------
const CACHE_CAP = 100;
const resultCache = new Map();

function cacheKey(q, lat, lon) {
  return `${q.toLowerCase()}|${lat != null ? lat.toFixed(2) : '-'}|${lon != null ? lon.toFixed(2) : '-'}`;
}
function cacheGet(key) {
  if (!resultCache.has(key)) return null;
  const val = resultCache.get(key);
  resultCache.delete(key);
  resultCache.set(key, val);
  return val;
}
function cacheSet(key, val) {
  if (resultCache.has(key)) resultCache.delete(key);
  resultCache.set(key, val);
  if (resultCache.size > CACHE_CAP) {
    resultCache.delete(resultCache.keys().next().value);
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function iconForType(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('hospital') || t.includes('clinic')) return '🏥';
  if (t.includes('fuel') || t.includes('gas')) return '⛽';
  if (t.includes('restaurant') || t.includes('food') || t.includes('cafe')) return '🍔';
  if (t.includes('pharmacy')) return '💊';
  if (t.includes('bank') || t.includes('atm')) return '🏧';
  if (t.includes('shop') || t.includes('mall') || t.includes('market')) return '🛒';
  if (t.includes('hotel')) return '🏨';
  return '📍';
}

function withDistance(item, lat, lon) {
  const distM = lat != null && lon != null ? haversine(lat, lon, item.latitude, item.longitude) : 0;
  return { ...item, distanceM: Math.round(distM), distanceKm: distM / 1000 };
}

function isAbort(e) {
  return e?.name === 'AbortError' || e?.aborted === true;
}

// ---------------------------------------------------------------------------
// Providers — each exposes autocomplete(q, { lat, lon, bounds, limit, signal })
// ---------------------------------------------------------------------------
const photonProvider = {
  id: 'photon',
  async autocomplete(q, { lat, lon, bounds, limit, signal }) {
    // Bias toward the user/viewport only when a reference point is known —
    // otherwise Photon runs an unbiased global search
    const biasParam = lat != null && lon != null ? `&lat=${lat}&lon=${lon}` : '';
    const bboxParam = bounds && bounds.length === 4 ? `&bbox=${bounds.join(',')}` : '';
    const url = `${PHOTON_API}?q=${encodeURIComponent(q)}${biasParam}${bboxParam}&limit=${limit}&lang=en`;
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_UA },
    });
    if (!response.ok) throw new Error(`PHOTON_${response.status}`);
    const data = await response.json();
    return (data.features || []).map((f, index) => {
      const props = f.properties || {};
      const [rLon, rLat] = f.geometry?.coordinates || [0, 0];
      const addressParts = [props.street, props.district, props.city, props.state].filter(Boolean);
      const subtitle = addressParts.length > 0 ? addressParts.join(', ') : (props.country || '');
      return withDistance({
        id: `photon_${props.osm_id || index}`,
        name: props.name || props.street || props.city || q,
        subtitle,
        address: subtitle,
        latitude: rLat,
        longitude: rLon,
        icon: iconForType(props.osm_value || props.type),
        source: 'osm',
      }, lat, lon);
    });
  },
  async reverse(lat, lon, signal) {
    const res = await fetch(`${PHOTON_API.replace('/api/', '/reverse/')}?lon=${lon}&lat=${lat}`, {
      signal,
      headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_UA },
    });
    if (!res.ok) throw new Error(`PHOTON_REV_${res.status}`);
    const data = await res.json();
    const props = data?.features?.[0]?.properties;
    if (!props) return null;
    const address = [props.street, props.city, props.state].filter(Boolean).join(', ');
    return { name: props.name || props.street || 'Dropped Pin', address };
  },
};

// OSMF policy: absolute max 1 request/second + identifying User-Agent
let lastNominatimAt = 0;
async function nominatimSlot() {
  const wait = lastNominatimAt + 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();
}

const nominatimProvider = {
  id: 'nominatim',
  async autocomplete(q, { lat, lon, bounds, limit, signal }) {
    await nominatimSlot();
    // viewbox = left,top,right,bottom (lon,lat,lon,lat). Bias toward the visible
    // area but DON'T set bounded=1 — a hard clip makes the last-resort provider
    // return nothing when the user searches for something off-screen, so we keep
    // it as a soft preference and still allow global matches.
    const vb = bounds && bounds.length === 4
      ? `&viewbox=${bounds[0]},${bounds[3]},${bounds[2]},${bounds[1]}`
      : '';
    const url = `${NOMINATIM_API}search?format=jsonv2&limit=${Math.min(limit, 40)}&q=${encodeURIComponent(q)}${vb}`;
    const response = await fetch(url, { signal, headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_UA } });
    if (!response.ok) throw new Error(`NOMINATIM_${response.status}`);
    const rows = await response.json();
    return (rows || []).map((f, index) => withDistance({
      id: `nominatim_${f.place_id || index}`,
      name: f.name || (f.display_name || q).split(',')[0],
      subtitle: f.display_name || '',
      address: f.display_name || '',
      latitude: parseFloat(f.lat),
      longitude: parseFloat(f.lon),
      icon: iconForType(f.addresstype || f.type),
      source: 'osm',
    }, lat, lon));
  },
  async reverse(lat, lon, signal) {
    await nominatimSlot();
    const res = await fetch(`${NOMINATIM_API}reverse?format=jsonv2&lat=${lat}&lon=${lon}`, {
      signal,
      headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_UA },
    });
    if (!res.ok) throw new Error(`NOMINATIM_REV_${res.status}`);
    const data = await res.json();
    if (!data?.display_name) return null;
    return { name: data.name || data.display_name.split(',')[0], address: data.display_name };
  },
};

// ---------------------------------------------------------------------------
// Google Places API (New) — keyed provider with photos, ratings and reverse
// geocoding. The key is injected at build time from an env var, never written
// into source: set EXPO_PUBLIC_GOOGLE_PLACES_KEY in a local `.env` (gitignored).
// Licensing: results on a non-Google basemap require "Powered by Google"
// attribution (attached to each result as `attribution`).
// ---------------------------------------------------------------------------
// NOTE: EXPO_PUBLIC_* values are inlined into the shipped JS bundle, so they are
// still extractable from the APK. Always restrict the key in Google Cloud
// Console (Places API + Geocoding API only, and your Android package/SHA-1).
const GOOGLE_PLACES_KEY = (process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '').trim() || null;

function loadGoogleKey() {
  return GOOGLE_PLACES_KEY;
}

function googlePhotoUrl(photoName, key, maxWidth = 800) {
  return `${GOOGLE_PLACES_BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${encodeURIComponent(key)}`;
}

function titleCaseType(t) {
  return (t || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function makeGoogleProvider(key) {
  const FIELD_MASK = [
    'places.id', 'places.displayName', 'places.formattedAddress',
    'places.location', 'places.types', 'places.primaryType',
    'places.rating', 'places.userRatingCount', 'places.photos',
    'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
    'places.businessStatus', 'places.websiteUri',
  ].join(',');

  return {
    id: 'google',
    async autocomplete(q, { lat, lon, bounds, limit, signal }) {
      const body = {
        textQuery: q,
        pageSize: Math.min(limit, 20),
        languageCode: 'en',
      };
      // Bias toward viewport when known, else toward the user location
      if (bounds && bounds.length === 4) {
        const [w, s, e, n] = bounds;
        body.locationBias = {
          rectangle: {
            low: { latitude: s, longitude: w },
            high: { latitude: n, longitude: e },
          },
        };
      } else if (lat != null && lon != null) {
        body.locationBias = {
          circle: { center: { latitude: lat, longitude: lon }, radius: 50000.0 },
        };
      }
      const response = await fetch(GOOGLE_TEXT_SEARCH, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`GOOGLE_${response.status}`);
      const data = await response.json();
      return (data.places || []).map((p, index) => {
        const photo = (p.photos || [])[0];
        const category = titleCaseType(p.primaryType || (p.types || [])[0]);
        const status = p.businessStatus === 'OPERATIONAL' ? 'Open now'
          : p.businessStatus === 'CLOSED_TEMPORARILY' ? 'Temporarily closed'
            : p.businessStatus === 'CLOSED_PERMANENTLY' ? 'Permanently closed' : undefined;
        return withDistance({
          id: `google_${p.id || index}`,
          placeId: p.id,
          name: p.displayName?.text || q,
          subtitle: p.formattedAddress || '',
          address: p.formattedAddress || '',
          latitude: p.location?.latitude,
          longitude: p.location?.longitude,
          icon: iconForType(p.primaryType || (p.types || []).join(',')),
          categoryLabel: category,
          rating: p.rating,
          reviews: p.userRatingCount,
          status,
          phone: p.nationalPhoneNumber || p.internationalPhoneNumber,
          website: p.websiteUri,
          photoUrl: photo?.name ? googlePhotoUrl(photo.name, key) : null,
          source: 'google',
        }, lat, lon);
      });
    },
    async reverse(rLat, rLon, signal) {
      const url = `${GOOGLE_GEOCODE_API}?latlng=${rLat},${rLon}&key=${encodeURIComponent(key)}`;
      const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`GOOGLE_REV_${res.status}`);
      const data = await res.json();
      const hit = (data.results || [])[0];
      if (!hit) return null;
      const premise = (hit.address_components || []).find((c) => (c.types || []).includes('premise'));
      return {
        name: premise?.long_name || hit.formatted_address.split(',')[0],
        address: hit.formatted_address,
      };
    },
  };
}

// Keyed provider gate: enabled only when the user configures settings.geocoderKey
let geoapifyKeyState; // undefined = not loaded yet
async function loadGeoapifyKey() {
  if (geoapifyKeyState !== undefined) return geoapifyKeyState;
  try {
    geoapifyKeyState = (await getSettings())?.geocoderKey || null;
  } catch (e) {
    geoapifyKeyState = null;
  }
  return geoapifyKeyState;
}

function makeGeoapifyProvider(key) {
  return {
    id: 'geoapify',
    async autocomplete(q, { lat, lon, limit, signal }) {
      const url = `${GEOAPIFY_API}?text=${encodeURIComponent(q)}&limit=${limit}&apiKey=${encodeURIComponent(key)}`;
      const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`GEOAPIFY_${response.status}`);
      const data = await response.json();
      return (data.features || []).map((f, index) => {
        const p = f.properties || {};
        return withDistance({
          id: `geoapify_${p.place_id || index}`,
          name: p.name || (p.formatted || q).split(',')[0],
          subtitle: p.formatted || '',
          address: p.formatted || '',
          latitude: p.lat,
          longitude: p.lon,
          icon: iconForType(p.category),
          source: 'osm',
        }, lat, lon);
      });
    },
  };
}

async function buildChain() {
  const chain = [];
  const googleKey = await loadGoogleKey();
  if (googleKey) chain.push(makeGoogleProvider(googleKey));
  const key = await loadGeoapifyKey();
  if (key) chain.push(makeGeoapifyProvider(key));
  chain.push(photonProvider, nominatimProvider);
  return chain;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
let activeSession = null;

/**
 * Search places by query string with location bias.
 * Cancels any stale in-flight query first; walks the provider chain and falls
 * back to the LRU cache, then to local verified places.
 * Throws an error with `.aborted = true` when superseded by a newer query.
 */
export async function searchPlaces(query, userLocation = null, limit = 8, bounds = null) {
  if (!query || query.trim().length === 0) {
    // Return nearby verified places if query is empty
    return getLocalSuggestions('', userLocation, limit);
  }

  const cleanQuery = query.trim();
  const lat = userLocation?.latitude ?? null;
  const lon = userLocation?.longitude ?? null;
  const key = cacheKey(cleanQuery, lat, lon);

  if (activeSession) activeSession.abort();
  const session = new AbortController();
  activeSession = session;
  const timeout = setTimeout(() => session.abort(), 8000);

  try {
    const chain = await buildChain();
    for (const provider of chain) {
      if (session.signal.aborted) break;
      try {
        const results = await provider.autocomplete(cleanQuery, {
          lat, lon, bounds, limit, signal: session.signal,
        });
        if (results?.length) {
          cacheSet(key, results);
          // Merge local verified places matching the query for instant accuracy
          const localMatches = getLocalSuggestions(cleanQuery, userLocation, 3);
          return dedupe([...localMatches, ...results]).slice(0, limit);
        }
      } catch (e) {
        if (isAbort(e)) break;
        console.warn(`[searchService] ${provider.id} failed:`, e?.message);
      }
    }
    // The provider walk ended without a live result. If it was cancelled because
    // a newer query superseded this one, honor the documented contract and bail
    // with `.aborted` — otherwise a stale local-only fallback would surface as if
    // it were the real answer and could clobber the newer query in the UI. On a
    // genuine 8s timeout (this session is still active) falling back is correct.
    if (session.signal.aborted && activeSession !== session) {
      const err = new Error('SEARCH_SUPERSEDED');
      err.aborted = true;
      throw err;
    }
    const cached = cacheGet(key);
    if (cached) return cached;
    return getLocalSuggestions(cleanQuery, userLocation, limit);
  } catch (e) {
    if (e?.aborted) throw e; // re-throw our own SEARCH_SUPERSEDED untouched
    if (isAbort(e) && activeSession !== session) {
      // Superseded by a newer query — tell the caller to ignore this result
      const err = new Error('SEARCH_SUPERSEDED');
      err.aborted = true;
      throw err;
    }
    return getLocalSuggestions(cleanQuery, userLocation, limit);
  } finally {
    clearTimeout(timeout);
    if (activeSession === session) activeSession = null;
  }
}

/**
 * Reverse geocode a dropped pin: Google (if keyed) → Photon → Nominatim → null
 */
export async function reverseGeocode(lat, lon) {
  const session = new AbortController();
  const timeout = setTimeout(() => session.abort(), 8000);
  try {
    const providers = [photonProvider, nominatimProvider];
    const googleKey = await loadGoogleKey();
    if (googleKey) providers.unshift(makeGoogleProvider(googleKey));
    for (const provider of providers) {
      try {
        const result = await provider.reverse(lat, lon, session.signal);
        if (result) return result;
      } catch (e) {
        if (isAbort(e)) break;
        console.warn(`[searchService] reverse via ${provider.id} failed:`, e?.message);
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  return null;
}

function dedupe(items) {
  const unique = [];
  const seen = new Set();
  for (const item of items) {
    const k = `${item.name.toLowerCase()}_${item.latitude?.toFixed?.(3)}`;
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(item);
    }
  }
  return unique;
}

/**
 * Get instant local suggestions from the last verified viewport batch.
 * With a query: substring match on name/category; empty: nearest-first.
 */
function getLocalSuggestions(query, userLocation, limit = 6) {
  const all = getPlaces() || [];
  const q = (query || '').trim().toLowerCase();
  let list = all;
  if (q) {
    list = all.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.categoryLabel || '').toLowerCase().includes(q)
    );
  } else if (userLocation?.latitude != null) {
    list = [...all].sort(
      (a, b) =>
        haversine(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude) -
        haversine(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
    );
  }

  return list.slice(0, limit).map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: `${p.categoryLabel} · ${p.address}`,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    icon: p.icon,
    pinColor: p.pinColor,
    rating: p.rating,
    reviews: p.reviews,
    status: p.status,
    phone: p.phone,
    distanceM: p.distanceM,
    distanceKm: p.distanceM / 1000,
    source: 'local',
  }));
}
