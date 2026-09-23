// PS168 — Engine (Layer 2)
// THE plug-in contract: onTick({lat,lon,hdop,sats,acc,gyro}) → {lat,lon,heading,speed,sigma,source}
//
// Stub logic (~30 lines of actual logic):
// - 3 consecutive HDOP>3 → source="dr", forward propagation by last speed+heading
// - 5 good fixes → blend back over 1s (linear blend-back of residual DR offset)
// - sigma grows linearly during DR, decays over the blend-back
// - Outage detection is AUTOMATIC — no UI buttons trigger it
//
// M3 swap: replace internals with SpeedNet.tflite + gyro heading + map snap. Signature stays.

import { haversine, bearing, movePoint } from '../utils/geo';
import { ENGINE } from '../utils/constants';

class Engine {
  constructor() {
    this.reset();
  }

  reset() {
    // State tracking
    this.badFixCount = 0;
    this.goodFixCount = 0;
    this.source = 'gnss'; // 'gnss' | 'dr'
    this.drTickCount = 0;

    // Last known good values
    this.lastGoodLat = null;
    this.lastGoodLon = null;
    this.lastHeading = 0;
    this.lastSpeed = 0; // m/s

    // Current output position
    this.currentLat = null;
    this.currentLon = null;

    // Drift tracking
    this.totalGnssDistance = 0;
    this.driftDistance = 0;
    this.gnssPathLength = 0;
    this.prevGnssLat = null;
    this.prevGnssLon = null;

    // DR entry point (for drift calculation)
    this.drEntryLat = null;
    this.drEntryLon = null;

    // Recovery blend-back (1s glide from DR offset onto GNSS fixes)
    this.blendBackTicks = 0;
    this.blendOffsetLat = 0;
    this.blendOffsetLon = 0;
    this.blendSigma = 0;

    // Tick counter
    this.tickCount = 0;
  }

  configure() {
    // Load OSM graph once at START (stub: no-op, graph loading is M3)
    this.reset();
  }

  /**
   * Core tick function — called every 100ms
   * @param {object} input
   * @param {number} input.lat - Raw GNSS latitude
   * @param {number} input.lon - Raw GNSS longitude
   * @param {number} input.hdop - Horizontal dilution of precision
   * @param {number} input.sats - Satellite count
   * @param {number[]} input.acc - Accelerometer [x, y, z] (stub: unused in M1)
   * @param {number[]} input.gyro - Gyroscope [x, y, z] (stub: unused in M1)
   * @returns {object} {lat, lon, heading, speed, sigma, source}
   */
  onTick({ lat, lon, hdop, sats, acc = [0, 0, 0], gyro = [0, 0, 0] }) {
    this.tickCount++;
    const isBadFix = hdop > ENGINE.BAD_HDOP_THRESHOLD || sats < ENGINE.BAD_SATS_THRESHOLD;

    if (isBadFix) {
      this.badFixCount++;
      this.goodFixCount = 0;
    } else {
      this.goodFixCount++;
      this.badFixCount = 0;
    }

    // --- STATE TRANSITIONS ---

    if (this.source === 'gnss') {
      // Track GNSS path for drift calculation
      if (this.prevGnssLat != null) {
        this.gnssPathLength += haversine(this.prevGnssLat, this.prevGnssLon, lat, lon);
      }

      if (!isBadFix) {
        // Update last known good position
        if (this.lastGoodLat != null) {
          const dist = haversine(this.lastGoodLat, this.lastGoodLon, lat, lon);
          const dt = ENGINE.TICK_INTERVAL_MS / 1000;
          this.lastSpeed = dist / dt;
          this.lastHeading = bearing(this.lastGoodLat, this.lastGoodLon, lat, lon);
        }
        this.lastGoodLat = lat;
        this.lastGoodLon = lon;
        if (this.blendBackTicks > 0) {
          // Kalman-style blend-back: shrink residual DR offset linearly to zero
          this.blendBackTicks--;
          const f = this.blendBackTicks / ENGINE.RECOVERY_BLEND_TICKS;
          this.currentLat = lat + this.blendOffsetLat * f;
          this.currentLon = lon + this.blendOffsetLon * f;
        } else {
          this.currentLat = lat;
          this.currentLon = lon;
        }
        this.prevGnssLat = lat;
        this.prevGnssLon = lon;
      }

      // 3 consecutive bad → switch to DR
      if (this.badFixCount >= ENGINE.BAD_FIXES_FOR_DR) {
        this.source = 'dr';
        this.drTickCount = 0;
        this.drEntryLat = this.currentLat;
        this.drEntryLon = this.currentLon;
        // Cap speed to reasonable value to prevent runaway
        this.lastSpeed = Math.min(this.lastSpeed, 30); // max 30 m/s = 108 km/h
      }
    }

    if (this.source === 'dr') {
      this.drTickCount++;

      // Forward propagation: move by last speed + heading
      const dt = ENGINE.TICK_INTERVAL_MS / 1000; // 0.1s
      const dist = this.lastSpeed * dt;
      if (dist > 0 && this.currentLat != null) {
        const newPos = movePoint(this.currentLat, this.currentLon, dist, this.lastHeading);
        this.currentLat = newPos.latitude;
        this.currentLon = newPos.longitude;
      }

      // 5 good fixes → blend back to GNSS
      if (this.goodFixCount >= ENGINE.GOOD_FIXES_FOR_GNSS) {
        // Calculate drift before recovery
        if (this.drEntryLat != null) {
          this.driftDistance = haversine(this.currentLat, this.currentLon, lat, lon);
        }

        // Start 1s blend-back: residual DR offset glides to zero instead of snapping
        this.blendOffsetLat = this.currentLat - lat;
        this.blendOffsetLon = this.currentLon - lon;
        this.blendBackTicks = ENGINE.RECOVERY_BLEND_TICKS;
        this.blendSigma = this.driftDistance;

        // Transition back
        this.source = 'gnss';
        this.lastGoodLat = lat;
        this.lastGoodLon = lon;
        this.prevGnssLat = lat;
        this.prevGnssLon = lon;
        this.drTickCount = 0;
      }
    }

    // --- SIGMA (uncertainty) ---
    let sigma;
    if (this.source === 'dr') {
      // Grows linearly during DR
      sigma = ENGINE.SIGMA_MIN + this.drTickCount * ENGINE.SIGMA_GROWTH_RATE;
    } else if (this.blendBackTicks > 0) {
      // Shrinks with the blend-back after recovery
      sigma = ENGINE.SIGMA_MIN + this.blendSigma * (this.blendBackTicks / ENGINE.RECOVERY_BLEND_TICKS);
    } else {
      sigma = ENGINE.SIGMA_MIN;
    }

    return {
      lat: this.currentLat ?? lat,
      lon: this.currentLon ?? lon,
      heading: this.lastHeading,
      speed: this.lastSpeed,
      sigma,
      source: this.source,
    };
  }

  /**
   * Indicative drift magnitude at an arbitrary moment.
   *
   * `driftDistance` is only assigned on the DR→GNSS recovery transition, so a
   * LIVE run that is stopped mid-outage would otherwise report 0 drift. When we
   * are still in DR with no recovery yet, estimate the drift as how far the
   * dead-reckoned position has propagated since the outage entry point (a lower
   * bound on accumulated error) and never regress below a measured value.
   */
  getCurrentDriftMeters() {
    if (this.source === 'dr' && this.drEntryLat != null && this.currentLat != null) {
      const sinceEntry = haversine(
        this.drEntryLat,
        this.drEntryLon,
        this.currentLat,
        this.currentLon
      );
      return Math.max(this.driftDistance, sinceEntry);
    }
    return this.driftDistance;
  }

  /**
   * Get current drift stats
   */
  getDriftStats() {
    const totalPath = Math.max(this.gnssPathLength, 1);
    const driftMeters = this.getCurrentDriftMeters();
    const driftPct = (driftMeters / totalPath) * 100;
    return {
      driftMeters,
      totalMeters: totalPath,
      driftPercent: driftPct,
      pass: driftPct <= ENGINE.DRIFT_PASS_THRESHOLD * 100,
    };
  }
}

// Singleton
const engine = new Engine();
export default engine;
