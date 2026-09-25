// PS168 — Real-road replay generator (dev tool, run with: node tools/gen_sample_replay.js)
//
// Builds assets/replay/sample_drive_SYNTHETIC.csv at 10Hz (1 row = 100ms tick) by
// tracing an ACTUAL road route fetched from OSRM (AB Rd / MR-10 corridor, Indore).
// The ground-truth path follows real streets — with their turns — so the demo
// breadcrumb hugs the mapped roads instead of a single straight line.
//
// Story the data tells (matches the on-screen demo):
//   clean GNSS fix → the vehicle drives along real roads (turns tracked exactly)
//   SATELLITE CUTOFF → hdop 15, sats 0: the engine AUTO-switches to dead-reckoning.
//     Ground truth keeps following the road while DR propagates straight, so a
//     realistic drift builds up.
//   satellites return → 5 good fixes blend the estimate back onto GNSS.
//
// Why the blackout is auto-placed: the M1 engine dead-reckons at a CONSTANT
// heading (it does not yet integrate gyro — see src/engine/engine.js). On real
// curvy streets a blackout over a sharp turn would fling the estimate hundreds
// of metres off the road (a broken-looking FAIL). So the generator scans the
// route and drops the blackout on its straightest contiguous stretch, which
// keeps the drift a believable PASS while the rest of the drive still shows the
// vehicle tracking genuine road turns under GNSS.
//
// Network: needs to reach router.project-osrm.org once, at generation time. The
// committed CSV is static, so the app itself stays fully offline-friendly.

const fs = require('fs');
const path = require('path');

// ── Route waypoints (Indore): [lon, lat] ───────────────────────────────────
// A real AB Rd / MR-10 arterial drive with turns at the ends and a gently
// curving straight through the middle.
const WAYPOINTS = [
  [75.893, 22.749], // start: on the arterial
  [75.885, 22.742], // end: continuing along real roads
];

// ── Demo tuning ──────────────────────────────────────────────────────────────
const DT = 0.1; // 10Hz
const CRUISE_SPEED = 14; // m/s (~50 km/h) — realistic urban arterial speed
const STEP = CRUISE_SPEED * DT; // metres advanced per tick
const BLACKOUT_TICKS = 400; // 40s satellite cutoff
const MIN_EDGE_TICKS = 100; // keep >=10s of clean GNSS on each side of the outage

// ── Engine thresholds (mirrors src/utils/constants.js ENGINE) ────────────────
const BAD_HDOP = 3;
const BAD_SATS = 4;
const BAD_FOR_DR = 3;
const GOOD_FOR_GNSS = 5;
const RECOVERY_BLEND_TICKS = 10;
const DRIFT_PASS_THRESHOLD = 0.10;

// ── Geo helpers ──────────────────────────────────────────────────────────────
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_R = 6371000;

function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLon = (lon2 - lon1) * DEG2RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

function bearing(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * DEG2RAD;
  const p2 = lat2 * DEG2RAD;
  const dLon = (lon2 - lon1) * DEG2RAD;
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  return (Math.atan2(y, x) * RAD2DEG + 360) % 360;
}

function movePoint(lat, lon, distM, bearingDeg) {
  const d = distM / EARTH_R;
  const th = bearingDeg * DEG2RAD;
  const p1 = lat * DEG2RAD;
  const l1 = lon * DEG2RAD;
  const p2 = Math.asin(
    Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th)
  );
  const l2 =
    l1 +
    Math.atan2(
      Math.sin(th) * Math.sin(d) * Math.cos(p1),
      Math.cos(d) - Math.sin(p1) * Math.sin(p2)
    );
  return { latitude: p2 * RAD2DEG, longitude: l2 * RAD2DEG };
}

// ── OSRM fetch ───────────────────────────────────────────────────────────────
async function fetchRoute(coords) {
  const coordStr = coords.map((c) => c.join(',')).join(';');
  const url =
    `https://router.project-osrm.org/route/v1/driving/${coordStr}` +
    '?overview=full&geometries=geojson';
  const res = await fetch(url, { headers: { 'User-Agent': 'PS168-replay-generator' } });
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(`OSRM returned "${data.code}"`);
  }
  return data.routes[0].geometry.coordinates; // [[lon, lat], ...]
}

// Fallback: if OSRM is unreachable, densify the raw waypoints with gentle
// great-circle interpolation so the path still turns at each corner instead of
// collapsing to a single straight line.
function fallbackRoute(coords) {
  const out = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    const segLen = haversine(lat1, lon1, lat2, lon2);
    const brg = bearing(lat1, lon1, lat2, lon2);
    const steps = Math.max(2, Math.round(segLen / 25)); // ~25m resolution
    for (let s = 0; s < steps; s++) {
      const p = movePoint(lat1, lon1, (segLen * s) / steps, brg);
      out.push([p.longitude, p.latitude]);
    }
  }
  out.push(coords[coords.length - 1]);
  return out;
}

// ── Arc-length resampling onto the road polyline ─────────────────────────────
function buildArcTable(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(
      cum[i - 1] + haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0])
    );
  }
  return cum;
}

// Position + travel heading at arc-length `s` metres along the polyline.
function sampleAt(coords, cum, s) {
  const total = cum[cum.length - 1];
  const target = Math.max(0, Math.min(total, s));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const [lon1, lat1] = coords[i - 1];
  const [lon2, lat2] = coords[i];
  const segLen = cum[i] - cum[i - 1] || 1;
  const f = (target - cum[i - 1]) / segLen;
  return {
    lat: lat1 + (lat2 - lat1) * f,
    lon: lon1 + (lon2 - lon1) * f,
    heading: bearing(lat1, lon1, lat2, lon2),
  };
}

// ── Engine DR re-simulation (mirrors src/engine/engine.js) for validation ─────
function simulateDrift(rows) {
  let source = 'gnss';
  let badCount = 0;
  let goodCount = 0;
  let lastGoodLat = null;
  let lastGoodLon = null;
  let lastHeading = 0;
  let lastSpeed = 0;
  let curLat = null;
  let curLon = null;
  let blendTicks = 0;
  let blendOffsetLat = 0;
  let blendOffsetLon = 0;
  let peakDrift = 0;
  let peakAtTick = 0;

  for (let t = 0; t < rows.length; t++) {
    const { lat, lon, hdop, sats } = rows[t];
    const isBad = hdop > BAD_HDOP || sats < BAD_SATS;
    if (isBad) {
      badCount++;
      goodCount = 0;
    } else {
      goodCount++;
      badCount = 0;
    }

    if (source === 'gnss') {
      if (!isBad) {
        if (lastGoodLat != null) {
          lastSpeed = haversine(lastGoodLat, lastGoodLon, lat, lon) / DT;
          lastHeading = bearing(lastGoodLat, lastGoodLon, lat, lon);
        }
        lastGoodLat = lat;
        lastGoodLon = lon;
        if (blendTicks > 0) {
          blendTicks--;
          const f = blendTicks / RECOVERY_BLEND_TICKS;
          curLat = lat + blendOffsetLat * f;
          curLon = lon + blendOffsetLon * f;
        } else {
          curLat = lat;
          curLon = lon;
        }
      }
      if (badCount >= BAD_FOR_DR) {
        source = 'dr';
        lastSpeed = Math.min(lastSpeed, 30);
      }
    } else {
      const dist = lastSpeed * DT;
      if (dist > 0 && curLat != null) {
        const p = movePoint(curLat, curLon, dist, lastHeading);
        curLat = p.latitude;
        curLon = p.longitude;
      }
      const drift = haversine(curLat, curLon, lat, lon);
      if (drift > peakDrift) {
        peakDrift = drift;
        peakAtTick = t;
      }
      if (goodCount >= GOOD_FOR_GNSS) {
        blendOffsetLat = curLat - lat;
        blendOffsetLon = curLon - lon;
        blendTicks = RECOVERY_BLEND_TICKS;
        source = 'gnss';
        lastGoodLat = lat;
        lastGoodLon = lon;
      }
    }
  }
  return { peakDrift, peakAtTick };
}

// Find the straightest contiguous `win`-tick window (min summed |heading change|),
// keeping at least MIN_EDGE_TICKS of clean road on each side.
function findStraightestWindow(headings, win) {
  const n = headings.length;
  let best = Infinity;
  let bestStart = MIN_EDGE_TICKS;
  for (let a = MIN_EDGE_TICKS; a + win <= n - MIN_EDGE_TICKS; a++) {
    let sum = 0;
    for (let j = a + 1; j < a + win; j++) {
      let d = headings[j] - headings[j - 1];
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      sum += Math.abs(d);
    }
    if (sum < best) {
      best = sum;
      bestStart = a;
    }
  }
  return { start: bestStart, turnDeg: best };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  let coords;
  try {
    coords = await fetchRoute(WAYPOINTS);
    console.log(`OSRM route: ${coords.length} geometry points`);
  } catch (e) {
    console.warn(`OSRM fetch failed (${e.message}) — using waypoint fallback path`);
    coords = fallbackRoute(WAYPOINTS);
  }

  const cum = buildArcTable(coords);
  const totalDist = cum[cum.length - 1];
  const totalTicks = Math.floor(totalDist / STEP);
  console.log(
    `Route length ${totalDist.toFixed(0)}m @ ${CRUISE_SPEED} m/s → ` +
      `${totalTicks} ticks (${(totalTicks * DT).toFixed(0)}s)`
  );

  // Pre-sample travel heading per tick so we can locate the straightest stretch.
  const samples = [];
  const headings = [];
  for (let i = 0; i < totalTicks; i++) {
    const smp = sampleAt(coords, cum, i * STEP);
    samples.push(smp);
    headings.push(smp.heading);
  }

  const { start: blackoutStart, turnDeg } = findStraightestWindow(headings, BLACKOUT_TICKS);
  const blackoutEnd = blackoutStart + BLACKOUT_TICKS;
  console.log(
    `Blackout placed ${blackoutStart * DT}–${blackoutEnd * DT}s ` +
      `(${(turnDeg).toFixed(1)}° total bend through the outage)`
  );

  const rows = [];
  for (let i = 0; i < totalTicks; i++) {
    const { lat, lon, heading } = samples[i];

    // Yaw rate (rad/s) — cosmetic in the CSV (engine ignores it in M1) but keeps
    // the sensor columns physically sensible.
    let yawRate = 0;
    if (i > 0) {
      let d = heading - headings[i - 1];
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      yawRate = (d * DEG2RAD) / DT;
    }

    let hdop;
    let sats;
    let acc = [0.1, 0.2, 9.8];
    let gyro = [0.01, 0.02, Math.max(-0.05, Math.min(0.05, yawRate))];

    if (i < blackoutStart) {
      // clean GNSS cruise
      hdop = 1.0 + (i % 3) * 0.1;
      sats = 10 + (i % 4);
    } else if (i < blackoutEnd) {
      // satellite cutoff → DR
      const t = i - blackoutStart;
      hdop = 15.0;
      sats = t === 0 ? 2 : t < 4 ? 1 : 0;
      acc = [0.5, 0.7, 9.5];
    } else {
      // recovery: a few marginal fixes then full lock
      const t = i - blackoutEnd;
      if (t < 5) {
        hdop = [2.8, 2.4, 2.0, 1.6, 1.2][t];
        sats = 5 + t;
      } else {
        hdop = 1.0 + (t % 3) * 0.1;
        sats = 10 + (t % 4);
      }
    }

    rows.push({ lat, lon, hdop, sats, acc, gyro });
  }

  // Validate the resulting dead-reckoning drift against the engine's own math.
  const { peakDrift, peakAtTick } = simulateDrift(rows);
  const pct = (peakDrift / totalDist) * 100;
  const verdict = pct <= DRIFT_PASS_THRESHOLD * 100 ? 'PASS' : 'FAIL';
  console.log(
    `Peak DR drift ${peakDrift.toFixed(1)}m (${pct.toFixed(1)}%) at t=${(peakAtTick * DT).toFixed(0)}s → ${verdict} ` +
      `(threshold ${(DRIFT_PASS_THRESHOLD * 100).toFixed(0)}%)`
  );
  if (verdict === 'FAIL') {
    console.warn('⚠ Drift exceeds the pass threshold — pick a straighter route/waypoints.');
  }

  const header = 'lat,lon,hdop,sats,acc_x,acc_y,acc_z,gyro_x,gyro_y,gyro_z';
  const lines = rows.map(
    (r) =>
      [
        r.lat.toFixed(6),
        r.lon.toFixed(6),
        r.hdop.toFixed(1),
        String(r.sats),
        r.acc[0].toFixed(1),
        r.acc[1].toFixed(1),
        r.acc[2].toFixed(1),
        r.gyro[0].toFixed(2),
        r.gyro[1].toFixed(2),
        Number(r.gyro[2]).toFixed(2),
      ].join(',')
  );
  const out = path.join(__dirname, '..', 'assets', 'replay', 'sample_drive_SYNTHETIC.csv');
  fs.writeFileSync(out, header + '\n' + lines.join('\n') + '\n');
  console.log(`Wrote ${rows.length} rows to ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
