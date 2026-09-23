// PS168 — DR History Service
// Persists frozen dead-reckoning sessions to dr_history.json so past runs can
// be revisited. Storage goes through the shared jsonStore primitive, which
// gives us atomic writes, per-file write serialization, and corrupt-file
// quarantine (see jsonStore.js).
//
// Session contract (consumed by history views):
//   { id, timestamp, place, driftMeters, totalMeters, driftPercent, pass,
//     peakM, peakAtS, blackoutS, recoveryBlendS, sensorHz, avgSpeedMps,
//     trailPoints, curve:[{t,d}<=60] }
// The raw trail array is NEVER persisted (only its point count).

import * as FileSystem from 'expo-file-system/legacy';
import { loadJson, mutateJson, removeJson } from './jsonStore';

const DR_HISTORY_FILE = FileSystem.documentDirectory + 'dr_history.json';
const MAX_SESSIONS = 50;
const MAX_CURVE_POINTS = 60;

// Coerce to a finite number then round to 1dp; never throws on null/undefined.
const num1 = (v) => +(Number.isFinite(Number(v)) ? Number(v) : 0).toFixed(1);

const isArray = (v) => Array.isArray(v);

// Downsample to <=60 evenly-spaced points, always keeping first and last
function downsampleCurve(curve) {
  if (!Array.isArray(curve) || curve.length === 0) return [];
  const pick = (p) => ({ t: num1(p.t), d: num1(p.d) });
  if (curve.length <= MAX_CURVE_POINTS) return curve.map(pick);
  const last = curve.length - 1;
  const out = [];
  for (let i = 0; i < MAX_CURVE_POINTS; i++) {
    out.push(pick(curve[Math.round((i * last) / (MAX_CURVE_POINTS - 1))]));
  }
  return out;
}

// Collision-safe session id: millisecond timestamp, de-duplicated against the
// ids already in the store so two runs in the same ms never collide.
function makeSessionId(history) {
  const taken = new Set(history.map((s) => s && s.id));
  let base = 'S' + Date.now();
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function getDrHistory() {
  return loadJson(DR_HISTORY_FILE, { fallback: [], validate: isArray });
}

export async function appendDrSession(frozen) {
  return mutateJson(
    DR_HISTORY_FILE,
    (history) => {
      const safeHistory = Array.isArray(history) ? history : [];
      const session = {
        id: makeSessionId(safeHistory),
        timestamp: frozen.timestamp || new Date().toISOString(),
        place: frozen.sessionPlace,
        driftMeters: num1(frozen.driftMeters),
        totalMeters: num1(frozen.totalMeters),
        driftPercent: num1(frozen.driftPercent),
        pass: !!frozen.pass,
        peakM: num1(frozen.peak?.m ?? 0),
        peakAtS: num1(frozen.peak?.atS ?? 0),
        blackoutS: num1(frozen.blackoutS ?? 0),
        recoveryBlendS: num1(frozen.recoveryBlendS ?? 0),
        sensorHz: frozen.sensorHz ?? null,
        avgSpeedMps: num1(frozen.avgSpeedMps ?? 0),
        trailPoints: frozen.trail?.length || 0,
        curve: downsampleCurve(frozen.curve),
      };
      return [session, ...safeHistory].slice(0, MAX_SESSIONS);
    },
    { fallback: [], validate: isArray }
  );
  // Write failures PROPAGATE so the caller (useEngine) can flip sessionSaved
  // to false via its .catch handler. jsonStore rolls its cache back on failure.
}

export async function clearDrHistory() {
  try {
    await removeJson(DR_HISTORY_FILE, { fallback: [] });
  } catch (err) {
    console.warn('[drHistoryService] Clear history failed:', err);
  }
  return [];
}
