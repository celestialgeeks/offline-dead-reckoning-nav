// PS168 — Offline Tile Manager
// Downloads OSM tiles for a 20km radius around current GPS position
// Uses MapLibre's OfflineManager for native pack management

import MapLibreGL from './maplibre';
import { MAP_STYLE_URL } from './mapStyle';
import { OFFLINE_MIN_ZOOM, OFFLINE_MAX_ZOOM, OFFLINE_RADIUS_DEG, INDORE } from '../utils/constants';
import { boundingBox } from '../utils/geo';

const PACK_NAME = 'ps168-offline-area';

/**
 * Check if an offline pack already exists
 */
export async function hasOfflinePack() {
  try {
    const packs = await MapLibreGL.OfflineManager.getPacks();
    return packs.some((p) => {
      try {
        const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
        return meta?.name === PACK_NAME;
      } catch (e) {
        return false;
      }
    });
  } catch (e) {
    console.warn('[OfflineTileManager] Error checking packs:', e);
    return false;
  }
}

/**
 * Download offline tiles for the area around the given position.
 * If no position provided, falls back to Indore center.
 *
 * @param {object} center - { latitude, longitude }
 * @param {function} onProgress - callback(percentage: number)
 * @returns {Promise<void>}
 */
export async function downloadOfflinePack(center, onProgress) {
  const lat = center?.latitude ?? INDORE.latitude;
  const lon = center?.longitude ?? INDORE.longitude;

  // Longitude degrees shrink with latitude — scale the east/west radius so the
  // pack covers a ~20km radius anywhere on Earth, not just at one latitude
  const lonRadius = OFFLINE_RADIUS_DEG.lat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const bounds = boundingBox(lat, lon, OFFLINE_RADIUS_DEG.lat, lonRadius);

  console.log(`[OfflineTileManager] Downloading tiles for [${lat.toFixed(4)}, ${lon.toFixed(4)}] zoom ${OFFLINE_MIN_ZOOM}-${OFFLINE_MAX_ZOOM}`);

  try {
    await MapLibreGL.OfflineManager.createPack(
      {
        mapStyle: MAP_STYLE_URL,
        minZoom: OFFLINE_MIN_ZOOM,
        maxZoom: OFFLINE_MAX_ZOOM,
        bounds,
        metadata: { name: PACK_NAME },
      },
      (pack, status) => {
        const pct = status.percentage ?? 0;
        if (onProgress) onProgress(pct);
        if (pct >= 100) {
          console.log('[OfflineTileManager] Download complete');
        }
      },
      (pack, error) => {
        console.error('[OfflineTileManager] Download error:', error);
      }
    );
  } catch (e) {
    console.error('[OfflineTileManager] Failed to create pack:', e);
    throw e;
  }
}

/**
 * Delete existing offline pack (for re-download)
 */
export async function deleteOfflinePack() {
  try {
    const packs = await MapLibreGL.OfflineManager.getPacks();
    for (const p of packs) {
      try {
        const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
        if (meta?.name === PACK_NAME) {
          await MapLibreGL.OfflineManager.deletePack(p.id);
        }
      } catch (e) {}
    }
    console.log('[OfflineTileManager] Pack deleted');
  } catch (e) {
    console.warn('[OfflineTileManager] Delete failed:', e);
  }
}
