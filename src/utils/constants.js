// PS168 — App Constants
// All magic numbers in one place

// Last-resort map center used ONLY until the first GPS fix arrives
// (the camera follow-moves to the user once location is available).
// The app itself is location-agnostic: all data queries are viewport-driven.
export const INDORE = {
  latitude: 22.7196,
  longitude: 75.8577,
};

// ~20km offline download radius in degrees.
// lat span is constant; the lon span in OFFLINE_RADIUS_DEG.lon is only a
// mid-latitude reference — OfflineTileManager scales it by 1/cos(lat).
// 1° latitude ≈ 111km, 1° longitude ≈ 103km at 22.7°N
export const OFFLINE_RADIUS_DEG = {
  lat: 0.18, // ~20km
  lon: 0.194, // ~20km at mid latitudes (scaled per-latitude at use site)
};

// Zoom levels for offline tile download
export const OFFLINE_MIN_ZOOM = 12;
export const OFFLINE_MAX_ZOOM = 17;

// Colors
export const COLORS = {
  // GNSS mode
  gnssBlue: '#2196F3',
  gnssBlueFill: 'rgba(33, 150, 243, 0.15)',
  gnssTrail: '#2196F3',

  // DR mode
  drYellow: '#FFC107',
  drYellowFill: 'rgba(255, 193, 7, 0.2)',
  drTrail: '#FFC107',

  // UI
  white: '#FFFFFF',
  background: '#F5F5F5',
  cardWhite: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#757575',
  textHint: '#BDBDBD',
  shadow: 'rgba(0, 0, 0, 0.1)',
  
  // Status
  passGreen: '#4CAF50',
  failRed: '#F44336',
  badgeGnss: '#E8F5E9',
  badgeDr: '#FFF8E1',

  // Map controls
  controlBg: '#FFFFFF',
  controlIcon: '#616161',
};

// Engine thresholds (from BUILD_SPEC)
export const ENGINE = {
  BAD_HDOP_THRESHOLD: 3,       // HDOP > 3 = bad fix
  BAD_SATS_THRESHOLD: 4,       // sats < 4 = bad fix
  BAD_FIXES_FOR_DR: 3,         // 3 consecutive bad → switch to DR
  GOOD_FIXES_FOR_GNSS: 5,      // 5 consecutive good → blend back
  BLEND_ALPHA: 0.3,            // α for GNSS recovery blend
  RECOVERY_BLEND_TICKS: 10,    // 1s linear blend-back of residual DR offset
  TICK_INTERVAL_MS: 100,       // 10Hz tick rate
  SIGMA_GROWTH_RATE: 0.5,      // meters per DR tick for uncertainty growth
  SIGMA_MIN: 2,                // minimum sigma (GNSS accuracy floor)
  DRIFT_PASS_THRESHOLD: 0.10,  // 10% drift = PASS/FAIL boundary
};

// Calibration
export const CALIBRATION_DURATION_S = 15;

// Demo visualization palette (DR state transitions on map + HUD)
export const DEMO = {
  amber: '#F59E0B',
  amberDark: '#B45309',
  amberDeep: '#92400E',
  amberFill: 'rgba(245, 158, 11, 0.16)',
  amberCard: '#FFFBEB',
  green: '#10B981',
  greenDark: '#047857',
  greenFill: '#ECFDF5',
  red: '#DC2626',
  redFill: '#FEE2E2',
  darkChip: '#0B1220',
  trailDotGnss: '#4FC3F7',
  trailDotDr: '#FBBF24',
  routeBlue: '#4285F4',
  routeBlueHalo: 'rgba(66, 133, 244, 0.30)',
  routeAmberHalo: 'rgba(245, 158, 11, 0.30)',
};

// Demo run sequencing (recorded-video friendly timings)
export const DR_DEMO = {
  TRAIL_DOT_EVERY_TICKS: 8,   // breadcrumb dot spacing (~11m at 14 m/s)
  DRIFT_CARD_AFTER_S: 8,      // live drift card appears after 8s in DR
  TUNNEL_CLEARED_SHOW_S: 8,   // "Tunnel Cleared" chip lifetime after recovery
  RESULTS_MODAL_DELAY_MS: 2500, // pause on frozen banner before results modal
  RECOVERY_BLEND_S: 1.0,      // Kalman blend-back duration shown in results
  SENSOR_HZ: 10,              // IMU + ODO update rate shown in results
  PEAK_DRIFT_MAX_M: 75,       // demo bound for peak drift stat
  SESSION_ID: '#1042',
  SESSION_PLACE: 'Indore Hub (MR-10)',
};

// Simulated outage (debug menu only)
export const SIMULATE_OUTAGE = {
  HDOP_VALUE: 99,
  DURATION_S: 60,
};

// Map style
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
