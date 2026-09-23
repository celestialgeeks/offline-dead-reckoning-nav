// PS168 — Synthetic replay generator (dev tool, run with: node tools/gen_sample_replay.js)
// Emits assets/replay/sample_drive_SYNTHETIC.csv at 10Hz (1 row = 100ms tick):
//   20s GNSS cruise → 60s tunnel blackout (hdop 15, sats 0-2) → 20s recovery cruise
// Ground truth keeps moving inside the tunnel (reference for drift scoring) while
// speed eases 14.0 → 12.2 → 14.0 m/s and heading curves +2°, so straight-line dead
// reckoning accumulates ~60-70m drift (~6% of path) — a PASS under the 10% threshold.
// Route: Vijay Nagar Corridor → A.B. Road tunnel section, Indore (bearing ~200°).

const fs = require('fs');
const path = require('path');

const DT = 0.1; // 10Hz
const PRE_TICKS = 200;   // 20s
const TUN_TICKS = 600;   // 60s blackout
const POST_TICKS = 200;  // 20s recovery

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_R = 6371000;

function movePoint(lat, lon, distM, bearingDeg) {
  const d = distM / EARTH_R;
  const th = bearingDeg * DEG2RAD;
  const p1 = lat * DEG2RAD;
  const l1 = lon * DEG2RAD;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th));
  const l2 = l1 + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { latitude: p2 * RAD2DEG, longitude: l2 * RAD2DEG };
}

// True speed inside tunnel (seconds since tunnel entry)
function tunnelSpeed(tSec) {
  if (tSec < 10) return 14.0;
  if (tSec < 30) return 14.0 - (1.5 * (tSec - 10)) / 20; // ease down
  if (tSec < 50) return 12.5;
  return 12.5 + (1.5 * (tSec - 50)) / 10; // ease back up
}

let lat = 22.75800;
let lon = 75.90000;
const rows = [];

function emit(phase, iInPhase) {
  const tSec = iInPhase * DT;
  let speed;
  let heading;
  if (phase === 'T') {
    speed = tunnelSpeed(tSec);
    heading = 200 + 2 * (tSec / 60); // gentle 2° curve through tunnel
  } else if (phase === 'P') {
    speed = 14.0 + 0.15 * Math.sin(iInPhase / 7);
    heading = 202;
  } else {
    speed = 14.0 + 0.15 * Math.sin(iInPhase / 7);
    heading = 200;
  }

  const p = movePoint(lat, lon, speed * DT, heading);
  lat = p.latitude;
  lon = p.longitude;

  let hdop;
  let sats;
  let acc = [0.1, 0.2, 9.8];
  let gyro = [0.01, 0.02, 0.0];
  if (phase === 'T') {
    hdop = 15.0;
    sats = iInPhase === 0 ? 2 : iInPhase < 4 ? 1 : 0;
    acc = [0.5, 0.7, 9.5];
    gyro = [0.1, 0.07, 0.03];
  } else if (phase === 'P') {
    if (iInPhase < 5) {
      hdop = [2.8, 2.4, 2.0, 1.6, 1.2][iInPhase];
      sats = 5 + iInPhase;
    } else {
      hdop = 1.0 + (iInPhase % 3) * 0.1;
      sats = 10 + (iInPhase % 4);
    }
  } else {
    hdop = 1.0 + (iInPhase % 3) * 0.1;
    sats = 10 + (iInPhase % 4);
  }

  rows.push([
    lat.toFixed(6),
    lon.toFixed(6),
    hdop.toFixed(1),
    String(sats),
    acc[0].toFixed(1), acc[1].toFixed(1), acc[2].toFixed(1),
    gyro[0].toFixed(2), gyro[1].toFixed(2), gyro[2].toFixed(2),
  ].join(','));
}

for (let i = 0; i < PRE_TICKS; i++) emit('R', i);
const entryRow = rows.length; // index of first blackout row
for (let i = 0; i < TUN_TICKS; i++) emit('T', i);
const exitRow = rows.length; // index of first good fix after tunnel
for (let i = 0; i < POST_TICKS; i++) emit('P', i);

const header = 'lat,lon,hdop,sats,acc_x,acc_y,acc_z,gyro_x,gyro_y,gyro_z';
const out = path.join(__dirname, '..', 'assets', 'replay', 'sample_drive_SYNTHETIC.csv');
fs.writeFileSync(out, header + '\n' + rows.join('\n') + '\n');

console.log(`Wrote ${rows.length} rows (${(rows.length * DT).toFixed(0)}s) to ${out}`);
console.log(`Tunnel: rows ${entryRow}..${exitRow - 1} (entry ${rows[entryRow - 1].split(',')[0]},${rows[entryRow - 1].split(',')[1]} / exit ${rows[exitRow].split(',')[0]},${rows[exitRow].split(',')[1]})`);
