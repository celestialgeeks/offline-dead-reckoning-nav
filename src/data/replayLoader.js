// PS168 — Replay Loader (Layer 3)
// Parses CSV files (lat,lon,hdop,sats,acc_x,acc_y,acc_z,gyro_x,gyro_y,gyro_z)
// Feeds rows at 10Hz (100ms intervals) to engine
// Supports reading from bundled assets
// Also derives demo metadata (tunnel gates, maneuver script, route geometry)

import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { haversine } from '../utils/geo';

/**
 * Parse a CSV string into an array of row objects
 */
export function parseCSV(csvString) {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    if (values.length < headers.length) continue;

    const row = {};
    headers.forEach((header, idx) => {
      row[header] = parseFloat(values[idx]) || 0;
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Load replay CSV from bundled assets
 * Returns parsed array of row objects
 */
export async function loadBundledReplay(assetModule) {
  try {
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();

    const csvString = await FileSystem.readAsStringAsync(asset.localUri);
    return parseCSV(csvString);
  } catch (e) {
    console.error('[ReplayLoader] Failed to load bundled replay:', e);
    return [];
  }
}

/**
 * Load replay CSV from device file system
 */
export async function loadReplayFromFile(uri) {
  try {
    const csvString = await FileSystem.readAsStringAsync(uri);
    return parseCSV(csvString);
  } catch (e) {
    console.error('[ReplayLoader] Failed to load replay file:', e);
    return [];
  }
}

/**
 * Get available replay files from assets
 * Returns list of { name, module } objects
 */
export function getAvailableReplays() {
  return [
    {
      name: 'sample_drive_SYNTHETIC.csv',
      description: '100s Indore drive · 60s tunnel blackout (synthetic)',
      module: require('../../assets/replay/sample_drive_SYNTHETIC.csv'),
    },
  ];
}

// Scripted turn-by-turn maneuvers for the demo run (triggered by elapsed seconds)
const DEMO_MANEUVERS = [
  {
    atS: 0,
    icon: '↰',
    stepM: 350,
    instruction: 'Keep left',
    toward: 'Towards Vijay Nagar Square • AB Rd',
  },
  {
    atS: 45,
    icon: '↰',
    stepM: 200,
    instruction: 'Keep left',
    toward: 'Towards Vijay Nagar Square • AB Rd Tunnel',
  },
  {
    atS: 80,
    icon: '↑',
    stepM: 600,
    instruction: 'Continue straight on Vijay Nagar Corridor',
    toward: null,
  },
];

const metaCache = new Map();
const META_CACHE_MAX = 5;

/**
 * Derive demo metadata from parsed replay rows:
 * tunnel gate indices/coords, route geometry split by section, cumulative
 * distance table and the scripted maneuver timeline.
 */
export function getReplayMeta(rows) {
  if (!rows || rows.length === 0) return null;
  if (metaCache.has(rows)) return metaCache.get(rows);

  const isBad = (r) => r.hdop > 3 || r.sats < 4;
  let entryIdx = -1;
  let exitIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (entryIdx < 0 && isBad(rows[i])) {
      entryIdx = i;
    } else if (entryIdx >= 0 && exitIdx < 0 && i > entryIdx && !isBad(rows[i])) {
      exitIdx = i;
      break;
    }
  }
  if (entryIdx < 0) entryIdx = Math.floor(rows.length / 2);
  if (exitIdx < 0) exitIdx = rows.length - 1;

  // Cumulative ground-truth distance table (for remaining/progress readouts)
  const cumDist = new Array(rows.length);
  cumDist[0] = 0;
  for (let i = 1; i < rows.length; i++) {
    cumDist[i] = cumDist[i - 1] + haversine(rows[i - 1].lat, rows[i - 1].lon, rows[i].lat, rows[i].lon);
  }

  // Route geometry per section (downsampled for the map line layers)
  const pick = (from, to) => {
    const coords = [];
    for (let i = from; i <= to; i += 4) coords.push([rows[i].lon, rows[i].lat]);
    const last = [rows[to].lon, rows[to].lat];
    if (coords[coords.length - 1] !== last) coords.push(last);
    return coords;
  };

  const meta = {
    entryIdx,
    exitIdx,
    entryS: entryIdx / 10,
    exitS: exitIdx / 10,
    entryCoord: [rows[entryIdx - 1]?.lon ?? rows[0].lon, rows[entryIdx - 1]?.lat ?? rows[0].lat],
    exitCoord: [rows[exitIdx].lon, rows[exitIdx].lat],
    startCoord: [rows[0].lon, rows[0].lat],
    totalDistM: cumDist[rows.length - 1],
    cumDist,
    tunnelFrac: [cumDist[entryIdx] / cumDist[rows.length - 1], cumDist[exitIdx] / cumDist[rows.length - 1]],
    pathPre: pick(0, entryIdx - 1),
    pathTunnel: pick(entryIdx - 1, exitIdx),
    pathPost: pick(exitIdx, rows.length - 1),
    maneuvers: DEMO_MANEUVERS,
    durationS: rows.length / 10,
  };
  // Bound the cache (keyed by row-array reference) so repeated runs can't grow
  // it without limit — evict the oldest entry FIFO once over capacity.
  if (metaCache.size >= META_CACHE_MAX) {
    const oldestKey = metaCache.keys().next().value;
    metaCache.delete(oldestKey);
  }
  metaCache.set(rows, meta);
  return meta;
}
