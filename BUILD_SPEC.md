# PS168 — WHAT TO BUILD (features & scope, command-ready)
Date: 2026-09-10 | For: manual commanding (October canvas + engine team) | Style: WHAT, not HOW

## 1. THE APP (one map + engine layer — October canvas builds this)
One map screen only. The map (offline OSM Indore today, Mappls SDK tomorrow — the layer doesn't care) with the ENGINE LAYER floating on top of it:
- **Engine layer (the product):** vehicle dot + confidence ellipse, trail (blue = GNSS, yellow = DR), status badge ("GNSS OK 🟢" ⇄ "GNSS→DR {n}s 🟡"), live drift meter, sat-count chip ("IRNSS ×6", Android only), edge-mode toggle.
- **Outage detection is AUTOMATIC — no buttons:** 3 consecutive bad fixes (HDOP>3 or sats<4, <300ms) → layer flips to DR on IMU; 5 good fixes → blends back. A "SIMULATE outage" entry lives in the debug menu ONLY (for indoor demo rooms with perfect GPS) — never a big button on the main UI.
- **Run controls (bottom sheet, not a screen):** replay-file pick, Replay/Live toggle, START, 15s auto-calibrate countdown.
- **Results panel (bottom sheet, not a screen):** frozen drift + PASS/FAIL, mini error plot, Export CSV, repo QR.
Why one screen: the layer must be portable — same overlay drops onto OSM now and Mappls later with zero rebuild. That portability IS the PS scope (engine pluggable into existing maps).

## 1b. SINGLE APK — everything ships inside (no separate pieces)
The "two things" were never two apps — just two FILES + one code module, all bundled in one install:
- `assets/maps/indore.mbtiles` (picture) + `assets/graph/indore.graph.pkl` (road constraints, built on laptop via build_graph.py) + `lib/engine/` (matcher + stub now, SpeedNet+EKF later).
- Install on phone → airplane mode → everything still works. Demo it to teammates exactly like Google Maps: open app, map of Indore, blue dot on your location, trip card, TUNNEL → yellow DR mode → recovery. The only visible difference from Google Maps is OUR layer (badge, drift meter, ellipse) — which is the entire point of the showcase.

## 2. THE ENGINE (python team / M3 builds this — app only consumes it)
Six layers, fixed contract `onTick({lat,lon,hdop,sats,acc,gyro}) → {lat,lon,heading,speed,sigma,source}`:
1. **Alignment** — auto-learns phone tilt vs car direction in ~15s; refines every 30s.
2. **Cleaner + Resampler** — kills engine/pothole noise; 10Hz phone + 200Hz edge → shared 100Hz, 2s windows.
3. **SpeedNet** — AI speedometer: vibration pattern → forward speed + uncertainty (v, σ). No double-integration.
4. **EKF 16-D** — fuses AI speed + no-sideways-slide rule + stop detector + GNSS + map; uncertainty scales trust live.
5. **GNSS Handler** — outage in <200ms (3 bad frames); recovery after 5 good frames with soft blend (no jump).
6. **Map Matcher** — snaps dot to offline OSM roads, keeps 2 hypotheses at forks, 25° heading gate.

## 3. FEATURE LIST (the demo must SHOW each of these)
- [ ] Offline map renders with zero internet
- [ ] Dot moves live at 10Hz from phone or replay
- [ ] Real signal loss auto-flips to DR in <1s (no taps); recovery blends with zero jump
- [ ] "Simulate outage" hidden in debug menu for indoor demos (not on main UI)
- [ ] Trail turns yellow + confidence ellipse grows during DR
- [ ] Drift meter counts live (m and %)
- [ ] GNSS return → smooth blend, zero visible jump
- [ ] Results freezes final drift + PASS/FAIL vs 10% benchmark
- [ ] Sat chip shows IRNSS count (Android; hidden on iOS)
- [ ] Edge mode toggle (200Hz path stub for finale)
- [ ] Export run CSV + error plot for proposal PDF

## 4. NUMBERS THAT DECIDE PASS/FAIL
- Drift <10% (<5m/50m, <100m/1km @60km/h) · 10Hz phone / ~200Hz edge · fully offline · NavIC-agnostic (plain lat/lon in).

## 5. OUT OF SCOPE (say no to these on sight)
Routing, search, login, backend, tile servers, raw NavIC decoding, magnetometer yaw, future-path prediction, full map-app rebuild.

## 6. COMMAND ORDER (suggested, you decide)
1. Figma: single map + engine layer (approve before code) → 2. Map + offline tiles → 3. Replay + stub engine → 4. Outage theatre + results panel → 5. Real engine swap (same interface) → 6. Live phone sensors → 7. Demo video + proposal plot.
