# Changelog

All notable changes to **Bharat Maps** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release binaries (signed Android APKs) are distributed via
[GitHub Releases](https://github.com/celestialgeeks/ps168-releases/releases) and
installed in-app through the built-in OTA updater.

## [1.0.12] - 2026-09-24

### Added
- **Dead-Reckoning demo suite** — 10 Hz replay harness, drift curve chart, and a persistent DR session history panel.
- **Shared `jsonStore` persistence primitive** — atomic temp-file+rename writes, per-file write serialization (prevents lost updates), corrupt-file quarantine, and optimistic-cache rollback.

### Fixed
- Duplicate DR sessions when a run was stopped by both auto-finish and a manual stop (`stopRun` is now idempotent).
- Live runs stopped mid-outage now report a real drift estimate instead of 0.
- Viewport POI fetches are sequence-guarded so a stale response can't overwrite fresh results.
- Partial settings saves no longer drop unrelated stored keys.
- Fabricated POI rating/review counts removed — ratings are shown only when the data source provides them.
- Collision-safe session IDs and guarded numeric formatting in persisted records.

### Changed
- All local JSON stores migrated onto `jsonStore`.
- Bounded the replay-metadata cache and capped the breadcrumb trail ring-buffer for long live runs.

## [1.0.10] - baseline release line

### Added
- Rebrand to **Bharat Maps** (`com.bharatmaps.app`) with a Google-Maps-class design system.
- OSRM turn-by-turn navigation and a tiered geocoder (Google Places → Photon → Nominatim → offline POIs).
- Viewport-scoped POI discovery with Supercluster clustering and offline vector-tile caching.
- In-app GitHub Releases OTA updater with semver comparison and per-version snooze.
- Release APKs signed with a dedicated upload keystore (no longer the public debug key).

### Notes
- The signing key changed from debug → upload at v1.0.10, so Android blocks in-place updates across that boundary — installs from **before** v1.0.10 require a one-time uninstall.

[1.0.12]: https://github.com/celestialgeeks/offline-dead-reckoning-nav
[1.0.10]: https://github.com/celestialgeeks/offline-dead-reckoning-nav
