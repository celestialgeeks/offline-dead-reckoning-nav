# Bharat Maps — Dead-Reckoning Engine & Offline Navigation

**Phone-only positioning that keeps a vehicle marker moving through GNSS-blackout zones (tunnels, underpasses, urban canyons) and then glides back onto the satellite fix with zero visual jump — running entirely on offline vector maps.** A modular dead-reckoning (DR) engine wrapped in a production-quality navigation app.

> **Solo build.** Designed, architected, and implemented end-to-end by one developer — from the positioning engine and geospatial data pipeline to the offline map layer, native Android build, and in-app OTA update system. Built for **Smart India Hackathon 2026, Problem Statement 168** (ISRO / NavIC-agnostic continuous positioning in GNSS-denied environments).

[![Version](https://img.shields.io/badge/Release-v1.0.12%20(Build%2013)-0D652D?style=for-the-badge)](https://github.com/celestialgeeks/ps168-releases/releases/latest)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React%20Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactnative.dev)
[![MapLibre](https://img.shields.io/badge/MapLibre%20GL%20Native-v11-4B5563?style=for-the-badge&logo=maplibre&logoColor=white)](https://maplibre.org)
[![Offline](https://img.shields.io/badge/Offline-First%20Vector%20Maps-2E7D32?style=for-the-badge)](https://openfreemap.org)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-1A73E8?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-gray?style=for-the-badge)](./LICENSE)

---

## Table of Contents

- [The Problem](#the-problem)
- [Why It's Hard](#why-its-hard)
- [The Approach](#the-approach)
- [System Architecture](#system-architecture)
- [How the Engine Works](#how-the-engine-works)
- [Engineering Beyond the Algorithm](#engineering-beyond-the-algorithm)
- [Demo, Telemetry & Benchmark Harness](#demo-telemetry--benchmark-harness)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Getting Started](#getting-started)
- [Builds & Distribution](#builds--distribution)
- [Roadmap](#roadmap)
- [License](#license)

---

## The Problem

Every phone navigation app depends on GNSS (GPS / NavIC / GLONASS). The moment you enter a **tunnel, multi-level flyover, underpass, or dense urban canyon**, the satellite signal drops. On a normal map the location puck does one of three ugly things:

1. **Freezes** in place and then teleports forward when satellites return.
2. **Drifts** erratically across blocks and buildings.
3. **Snaps** discontinuously back onto the recovered fix — a jarring visual jump.

For 60-second outages, the user is effectively blind, and the map lies about where you are.

**Bharat Maps keeps positioning alive with nothing but the phone.** During an outage it dead-reckons the last known velocity vector forward at 10 Hz, keeps a growing uncertainty model honest, and — crucially — eases back onto real satellite fixes with a smooth blend instead of a snap. The whole map stack works with zero connectivity.

## Why It's Hard

- **No wheel odometer, no gear/steering CAN bus** like a car head unit — only a phone's GNSS chip plus noisy, uncalibrated IMU.
- **Pure extrapolation diverges fast.** A constant-velocity model accumulates error the longer you are off GPS, so you need principled uncertainty and a fast re-lock.
- **The naive re-acquisition "jump" is what users actually notice**, so recovery has to be continuous, not just accurate.
- **Offline-first** means no tile server, no routing server, no geocoder in the hot path — everything the demo touches must survive airplane mode.

## The Approach

A **pluggable, contract-driven positioning engine** decoupled from the UI, sitting on an offline vector-map base, wrapped in a benchmark harness so its behaviour is *measurable* (not just demoable) against the SIH gate of **<10% drift over a 60-second blackout**.

The key design decision: the engine exposes a tiny, stable interface (raw fixes in → fused position + uncertainty out). That lets the baseline kinematic model ship today while leaving a clean seam to swap in a learned IMU/EKF/map-matching engine later **without touching a single UI component**.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — NAVIGATION & UI SHELL                                         │
│  Google-Maps-class design system · tiered geocoder (Google/Photon/       │
│  Nominatim) · OSRM turn-by-turn · viewport POI discovery + clustering ·  │
│  saved places · offline-map manager · OTA update flow                    │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER 2 — DEAD-RECKONING ENGINE (the core)                              │
│  autonomous outage detection · 10 Hz kinematic forward propagation ·     │
│  growing uncertainty (σ) · Kalman-style zero-jump blend-back ·           │
│  10 Hz replay harness + live drift scoring vs ground truth               │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER 0 — OFFLINE MAP ENGINE                                            │
│  MapLibre GL Native v11 vector rendering · pre-cached OpenFreeMap tiles  │
│  (z12–z17) · fully functional in airplane mode                           │
└─────────────────────────────────────────────────────────────────────────┘
```

The three layers talk through narrow interfaces: the UI never computes position, and the engine never knows a map exists. That separation is what makes the whole thing testable and swappable.

---

## How the Engine Works

The engine is a fixed-rate state machine ticking at **10 Hz** (`ENGINE.TICK_INTERVAL_MS = 100ms`). Transitions are fully autonomous — no user button, no manual "I'm entering a tunnel" toggle.

### 1. Outage detection
A fix is judged "bad" when HDOP is high or satellite count is low:

$$\text{bad} \iff \text{HDOP} > 3 \;\lor\; \text{sats} < 4$$

Switching is debounced so a single multipath glitch never flips modes:
- **GNSS → DR** after **3 consecutive** bad fixes (≈0.3 s detection latency).
- **DR → GNSS** after **5 consecutive** good fixes, triggering recovery.

### 2. Kinematic forward propagation
While in DR, the marker advances the last latched velocity vector (speed capped at 30 m/s to prevent runaway):

$$\Delta d = v_{\text{last}} \cdot \Delta t, \qquad P_t = \text{movePoint}(P_{t-1},\, \Delta d,\, \theta_{\text{heading}})$$

This is a constant-velocity/heading **odometry model** — deliberately simple and explainable, with IMU (accelerometer + gyroscope) samples already captured and threaded through the input contract for the planned engine upgrade (see [Roadmap](#roadmap)).

### 3. Honest uncertainty
The confidence radius grows linearly with blackout duration and drives the on-map error ellipse:

$$\sigma = \sigma_{\min} + N_{\text{ticks}} \cdot \text{growth\_rate}$$

So the UI never pretends to be more accurate than it is — the ellipse visibly widens the longer you're off GPS.

### 4. Zero-jump blend-back recovery
On re-acquisition the marker does **not** teleport to the new satellite coordinate. The residual DR-vs-GNSS offset is glided to zero over **10 ticks (1 s)**:

$$P_{\text{out}} = P_{\text{GNSS}} + \text{Offset}_{\text{initial}} \cdot \frac{\text{ticks}_{\text{remaining}}}{\text{ticks}_{\text{total}}}$$

That continuous glide — rather than a hard snap — is the most visible quality difference between this and a stock map app.

### 5. The contract (`src/engine/engine.js`)

```javascript
// Input — raw fix + sensor frame at 10 Hz
engine.onTick({ lat, lon, hdop, sats, acc: [x,y,z], gyro: [x,y,z] })

// Output — fused position, heading, speed, uncertainty, and active source
→ { lat, lon, heading, speed, sigma, source: 'gnss' | 'dr' }
```

One file, one stable shape. `useEngine` drives the 10 Hz loop and feeds it; every map layer, HUD widget, and the benchmark sheet only read the output.

---

## Engineering Beyond the Algorithm

A navigation demo is easy; a *reliable app* is the actual work. The parts I'd point a reviewer at:

- **Offline-first everything.** MapLibre GL Native renders pre-cached OpenFreeMap vector tiles (z12–z17); POI discovery is viewport-scoped over the Overpass API with retry/backoff and a last-good fallback. Navigation is fully functional in airplane mode.
- **Crash-safe local persistence.** Saved places, settings, search history, update snooze and DR session history all go through a small shared store primitive (`src/services/jsonStore.js`) that gives **atomic temp-file + rename writes, per-file write serialization (no lost updates), corrupt-file quarantine, and optimistic-cache rollback**. Local data can't be wiped by an interrupted write or a concurrent save.
- **Real OTA delivery on Android without an app store.** An in-app updater reads the GitHub Releases API, semver-compares against the bundled version, respects a per-version "Later" snooze, and installs the signed APK directly — with a mandatory pre-publish verification gate that rejects stale JS bundles and version/manifest mismatches.
- **A replay benchmark, not a vibes demo.** Positioning is scored against a recorded ground-truth trajectory at 10 Hz so drift is a real number, reproducible offline — the harness is what makes the benchmark claims honest.
- **Reproducible native build tooling.** New Architecture + Hermes release builds, dedicated upload keystore signing, and scripted APK verification (bundle-string-table freshness + `aapt2` manifest + `apksigner` cert checks) gated before every release.

---

## Demo, Telemetry & Benchmark Harness

To evaluate and *show* behaviour without needing a real tunnel, the app ships a demo suite:

- **Synthetic 10 Hz drive replay** (`assets/replay/sample_drive_SYNTHETIC.csv`): a recorded trajectory with satellite telemetry and ground truth through a simulated blackout.
- **Live HUD:** tunnel gate markers, drift meter (metres + %), `GNSS OK 🟢` ↔ `GNSS→DR {n}s 🟡` status badge, uncertainty ellipse, dual-colour breadcrumb trail (blue under GNSS, amber under DR), IMU/odometry and satellite-constellation chips.
- **Persistent DR history:** every completed run is frozen into a session (peak drift, blackout length, recovery blend, error curve) that can be reviewed later (`DrHistoryPanel` + `DriftCurveChart`).
- **Benchmark sheet:** on completion the run's metrics are frozen against the SIH gate (<10% drift = PASS), the error curve is graphed, and telemetry can be exported as CSV.

### Measured on the replay harness (SIH criteria)

> Figures below are produced by the **synthetic replay harness** against the shipped baseline engine. They are reproducible offline by running the demo; they are targets validated *by the harness*, not a claim about a specific street test.

| Metric | Target | Harness result | Status |
|--------|--------|----------------|--------|
| Drift ratio | < 10% of distance travelled | within <10% band on replay | **PASS** |
| Outage detection latency | < 1.0 s | ~0.3 s (3 × 100 ms frames) | **PASS** |
| Recovery behaviour | 0 m visual snap | continuous 1 s glide | **PASS** |
| Tick rate | 10 Hz steady | 10 Hz (100 ms loop) | **PASS** |
| Offline operation | 100% without internet | zero network calls in nav/DR | **PASS** |
| NavIC / constellation | agnostic lat/lon | platform GNSS telemetry surfaced | **PASS** |

---

## Tech Stack

| Concern | Technology | Notes |
|---------|-----------|-------|
| App framework | **Expo SDK 57 / React Native 0.86 / React 19** | New Architecture + Hermes |
| Map rendering | **MapLibre GL Native v11** (`@maplibre/maplibre-react-native`) | C++/GPU vector tiles, offline |
| Tiles / style | **OpenFreeMap** (Positron / Liberty) | OpenStreetMap-derived, pre-cached |
| Positioning engine | Custom JS engine + `useEngine` 10 Hz loop | Contract-driven, swappable |
| Sensors / location | `expo-location`, `expo-sensors` | GNSS fixes + IMU frames |
| Routing | **OSRM** | turn maneuvers + polyline |
| Geocoding | Google Places API → Photon → Nominatim → offline POIs | tiered fallback chain |
| POI discovery | **Overpass API** + `supercluster` | viewport-scoped + clustering |
| Persistence | `expo-file-system` + custom atomic `jsonStore` | crash-safe, serialized |
| Animation / sheets | `react-native-reanimated`, `@gorhom/bottom-sheet`, `react-native-svg` | 60 fps map + smooth transitions |
| Distribution | GitHub Releases + in-app OTA updater | signed APK, verified pre-publish |

---

## Repository Layout

```
offline-dead-reckoning-nav/
├── App.js                     # App root: gesture handler + providers
├── index.js                   # Metro entry
├── app.json                   # Expo config (package com.bharatmaps.app, permissions)
├── package.json               # Expo 57 / RN 0.86 / MapLibre 11 dependencies
├── assets/replay/             # 10 Hz ground-truth drive replay (CSV)
├── tools/
│   ├── gen_sample_replay.js   # generates & validates the synthetic replay dataset
│   └── verify_release_apk.js  # pre-publish gate: bundle freshness + manifest version
└── src/
    ├── engine/engine.js       # ★ core dead-reckoning state machine + blend-back
    ├── hooks/
    │   ├── useEngine.js       # 10 Hz tick loop, trail, drift scoring, session freeze/persist
    │   └── useLocation.js     # expo-location wrapper with smoothing
    ├── map/                   # BaseMap container, style, OfflineTileManager, MapLibre init
    ├── data/                  # placesService (Overpass POIs), localitiesService, replayLoader
    ├── services/
    │   ├── jsonStore.js       # ★ atomic + serialized + quarantining local persistence
    │   ├── routingService.js  # OSRM routing + maneuver parsing
    │   ├── searchService.js   # tiered geocoding (Google / Photon / Nominatim)
    │   ├── savedPlacesService.js · settingsService.js · drHistoryService.js
    │   └── updateService.js   # GitHub Releases OTA + semver + snooze
    ├── components/            # engine HUD (ellipse, drift meter, badges, chips), map layers,
    │                           nav cards, search/saved/settings modals, DR history + chart
    ├── sheets/                # RunControlsSheet (start/calibrate) · ResultsSheet (benchmark)
    ├── screens/               # MapScreen (orchestration) · DebugMenu (sensor sim)
    └── utils/                 # constants (engine thresholds) · geo (haversine/bearing/move) · theme
```

---

## Getting Started

### Prerequisites
- **Node.js** 18.x / 20.x
- **Android Studio** with Android SDK (API 34) *or* Xcode for iOS

> Because MapLibre compiles native C++, the app runs via **Expo prebuild / dev client**, not standard Expo Go.

```bash
# 1. Clone
git clone https://github.com/celestialgeeks/offline-dead-reckoning-nav.git
cd offline-dead-reckoning-nav

# 2. Install
npm install

# 3. (Optional) configure the Google Places key for richer search
cp .env.example .env          # EXPO_PUBLIC_GOOGLE_PLACES_KEY=your_key_here

# 4. Run on a device/emulator
npx expo run:android          # or: npx expo run:ios
```

### Trying the dead-reckoning demo
1. Open the app — the offline vector map loads immediately.
2. Open the **DR Demo** controls and tap **START** (runs a short calibration, then the 10 Hz replay).
3. Watch the puck cross the tunnel gate: signal drops, the badge flips to `GNSS→DR`, the trail turns amber and the uncertainty ellipse widens.
4. On exit the marker glides back onto the satellite fix over 1 second — no jump.
5. The run freezes into a benchmark sheet (drift %, error curve, CSV export) and is saved to DR history.

---

## Builds & Distribution

The app is signed with a dedicated Android upload keystore under `com.bharatmaps.app`. Release APKs are published to [GitHub Releases](https://github.com/celestialgeeks/ps168-releases/releases/latest) and delivered to devices by the **in-app updater**.

```bash
# Local release build (clean first to avoid stale Hermes bundles)
cd android && ./gradlew clean && ./gradlew :app:assembleRelease -x lint

# Verify the artifact before publishing (bundle freshness + manifest version)
node tools/verify_release_apk.js
```

---

## Roadmap

- [x] **M1 — Foundation:** offline vector engine, MapLibre integration, synthetic replay harness, baseline DR engine with soft blend-back.
- [x] **M2 — Navigation & UX:** Bharat Maps rebrand, Google-Maps-class design system, OSRM turn-by-turn, tiered search, viewport POI clustering, in-app OTA updater.
- [x] **M3 — Demo & benchmark suite:** tunnel gates, live drift meter, confidence ellipse, telemetry chips, benchmark results sheet, persistent DR history, and hardened data layer.
- [ ] **M4 — Production engine swap (planned):** IMU-derived speed/heading, an Extended Kalman Filter, and Hidden-Markov-model road-network map matching behind the existing engine contract.

---

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE).

## Acknowledgements

- **Smart India Hackathon 2026** — Problem Statement 168, and **ISRO / NavIC** for the GNSS-denied positioning benchmark.
- **OpenStreetMap, OpenFreeMap & MapLibre** — open data and open-source native vector rendering.
- **OSRM, Photon, Nominatim & Overpass** — open routing and geocoding infrastructure.
- **Expo & the React Native team** — the cross-platform mobile toolchain.
