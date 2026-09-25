// PS168 — useEngine Hook (Layer 2)
// Wires location/replay data + sensors → engine.onTick() at 10Hz
// Manages trail history, drift calculations, and all engine UI state
//
// Demo harness (replay mode): CSV rows carry ground truth even inside the tunnel
// (hdop 15 / sats 0), so drift is scored LIVE as distance(engine output, truth).
// That drives the drift card, error curve, peak tracking and frozen benchmark.

import { useState, useEffect, useRef, useCallback } from 'react';
import engine from '../engine/engine';
import { ENGINE, DR_DEMO } from '../utils/constants';
import { haversine } from '../utils/geo';
import { getReplayMeta } from '../data/replayLoader';
import { appendDrSession } from '../services/drHistoryService';

// Ring-buffer cap for the breadcrumb trail. Replay demos are ~100s @ 10Hz
// (1000 pts) so this never truncates a demo, but it bounds memory and the
// O(n)-per-tick array copy for very long LIVE runs.
const MAX_TRAIL_POINTS = 3000;

export default function useEngine() {
  // Engine output state
  const [engineState, setEngineState] = useState({
    lat: null,
    lon: null,
    heading: 0,
    speed: 0,
    sigma: ENGINE.SIGMA_MIN,
    source: 'gnss',
  });

  // Trail history (array of {lat, lon, source} points)
  const [trail, setTrail] = useState([]);

  // Drift stats
  const [driftStats, setDriftStats] = useState({
    driftMeters: 0,
    totalMeters: 0,
    driftPercent: 0,
    pass: true,
  });

  // DR timer (seconds in DR mode)
  const [drSeconds, setDrSeconds] = useState(0);

  // Run state
  const [isRunning, setIsRunning] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrateCountdown, setCalibrateCountdown] = useState(0);

  // Frozen results (set on run completion)
  const [frozenResults, setFrozenResults] = useState(null);

  // Whether the last frozen session was persisted to local DR history
  const [sessionSaved, setSessionSaved] = useState(false);

  // Demo HUD state
  const [gnssQuality, setGnssQuality] = useState({ sats: 0, hdop: 0 });
  const [navInfo, setNavInfo] = useState(null);
  const [benchmarkSnapshot, setBenchmarkSnapshot] = useState(null);
  const [tunnelCleared, setTunnelCleared] = useState(false);
  const [replayMeta, setReplayMeta] = useState(null);

  // Internal refs
  const tickIntervalRef = useRef(null);
  const replayDataRef = useRef(null);
  const replayIndexRef = useRef(0);
  const trailRef = useRef([]);
  const isRunningRef = useRef(false);
  const speedSumRef = useRef(0);
  const tickCountRef = useRef(0);

  // Benchmark harness refs (replay ground truth scoring)
  const metaRef = useRef(null);
  const traveledRef = useRef(0);
  const prevRefRef = useRef(null);
  const peakRef = useRef({ m: 0, atS: 0 });
  const curveRef = useRef([]);
  const drTicksRef = useRef(0);
  const blackoutRef = useRef(0);
  const recoveredRef = useRef(false);
  const curveClosedRef = useRef(false);
  const totalAtRecRef = useRef(0);
  const prevSourceRef = useRef('gnss');

  // Simulated outage state (debug menu)
  const [simulatedOutage, setSimulatedOutage] = useState(false);
  const outageTimerRef = useRef(null);

  // Calibration countdown refs
  const calibIntervalRef = useRef(null);
  const pendingRef = useRef(null);
  const clearedTimerRef = useRef(null);

  /**
   * Feed a single tick to the engine.
   * @param {object} input raw sensor/GNSS tick
   * @param {object|null} reference ground-truth row (replay scoring) or null
   */
  const feedTick = useCallback((input, reference = null) => {
    // Apply simulated outage override
    let tickInput = { ...input };
    if (simulatedOutage) {
      tickInput.hdop = 99;
      tickInput.sats = 0;
    }

    // Ground-truth traveled distance (progress / remaining readouts)
    const ref = reference || tickInput;
    if (ref?.lat != null && prevRefRef.current) {
      traveledRef.current += haversine(prevRefRef.current.lat, prevRefRef.current.lon, ref.lat, ref.lon);
    }
    if (ref?.lat != null) prevRefRef.current = { lat: ref.lat, lon: ref.lon };
    const traveled = traveledRef.current;

    const output = engine.onTick(tickInput);
    speedSumRef.current += output.speed || 0;
    tickCountRef.current += 1;
    setEngineState(output);
    setGnssQuality({ sats: tickInput.sats ?? 0, hdop: tickInput.hdop ?? 0 });

    // Append to trail. trailRef.current is a fresh array each tick (spread),
    // so it's already a new reference for React — no second copy needed.
    if (output.lat != null && output.lon != null) {
      const point = { lat: output.lat, lon: output.lon, source: output.source };
      const next = [...trailRef.current, point];
      trailRef.current =
        next.length > MAX_TRAIL_POINTS ? next.slice(next.length - MAX_TRAIL_POINTS) : next;
      setTrail(trailRef.current);
    }

    // --- DRIFT SCORING + STATE TRANSITION EVENTS ---
    const meta = metaRef.current;
    let stats;
    if (output.source === 'dr') {
      drTicksRef.current++;
      setDrSeconds(drTicksRef.current / 10);
      if (reference) {
        const drift = haversine(output.lat, output.lon, reference.lat, reference.lon);
        if (drift > peakRef.current.m) {
          peakRef.current = { m: drift, atS: drTicksRef.current / 10 };
        }
        if (drTicksRef.current % 10 === 0) {
          curveRef.current.push({ t: drTicksRef.current / 10, d: drift });
        }
        const pct = (drift / Math.max(traveled, 1)) * 100;
        stats = {
          driftMeters: drift,
          totalMeters: traveled,
          driftPercent: pct,
          pass: pct <= ENGINE.DRIFT_PASS_THRESHOLD * 100,
        };
      } else {
        stats = engine.getDriftStats();
      }
    } else {
      if (prevSourceRef.current === 'dr') {
        // --- RECOVERY TRANSITION: freeze benchmark, raise banner + chip ---
        recoveredRef.current = true;
        blackoutRef.current = drTicksRef.current / 10;
        totalAtRecRef.current = traveled;
        curveRef.current.push({ t: blackoutRef.current, d: peakRef.current.m });
        const pct = (peakRef.current.m / Math.max(traveled, 1)) * 100;
        setBenchmarkSnapshot({
          driftMeters: peakRef.current.m,
          totalMeters: traveled,
          driftPercent: pct,
          pass: pct <= ENGINE.DRIFT_PASS_THRESHOLD * 100,
          cepM: 1.2,
        });
        setTunnelCleared(true);
        if (clearedTimerRef.current) clearTimeout(clearedTimerRef.current);
        clearedTimerRef.current = setTimeout(() => setTunnelCleared(false), DR_DEMO.TUNNEL_CLEARED_SHOW_S * 1000);
      }
      if (recoveredRef.current) {
        setDrSeconds(0);
        // Sample the blend-back glide-down for the error curve
        if (reference && engine.blendBackTicks > 0) {
          const drift = haversine(output.lat, output.lon, reference.lat, reference.lon);
          const t = blackoutRef.current + (ENGINE.RECOVERY_BLEND_TICKS - engine.blendBackTicks) * 0.1;
          curveRef.current.push({ t, d: drift });
        } else if (!curveClosedRef.current && engine.blendBackTicks === 0) {
          curveClosedRef.current = true;
          curveRef.current.push({ t: blackoutRef.current + ENGINE.RECOVERY_BLEND_TICKS * 0.1, d: 0 });
        }
        const pct = (peakRef.current.m / Math.max(totalAtRecRef.current, 1)) * 100;
        stats = {
          driftMeters: peakRef.current.m,
          totalMeters: totalAtRecRef.current,
          driftPercent: pct,
          pass: pct <= ENGINE.DRIFT_PASS_THRESHOLD * 100,
        };
      } else {
        drTicksRef.current = 0;
        setDrSeconds(0);
        stats = { driftMeters: 0, totalMeters: traveled, driftPercent: 0, pass: true };
      }
    }
    prevSourceRef.current = output.source;
    setDriftStats(stats);

    // --- NAV TELEMETRY for the bottom nav card ---
    if (meta) {
      const elapsed = replayIndexRef.current / 10;
      let maneuver = meta.maneuvers[0];
      for (const m of meta.maneuvers) {
        if (elapsed >= m.atS) maneuver = m;
      }
      const remainingM = Math.max(0, meta.totalDistM - traveled);
      // Live distance-to-maneuver (ground-truth arc length) for the eased
      // countdown in the nav card
      const maneuverTick = Math.min(
        (meta.cumDist?.length || 1) - 1,
        Math.round((maneuver?.atS ?? 0) * 10)
      );
      const stepRemainingM = Math.max(
        0,
        (meta.cumDist?.[maneuverTick] ?? maneuver?.stepM ?? 0) - traveled
      );
      setNavInfo({
        maneuver,
        stepRemainingM,
        remainingM,
        etaMin: Math.max(1, Math.round(remainingM / 14 / 60)),
        clock: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        phase: recoveredRef.current ? 'recovered' : output.source,
        progress: Math.min(1, traveled / meta.totalDistM),
        tunnelFrac: meta.tunnelFrac,
        speed: output.speed,
        drSeconds: drTicksRef.current / 10,
        elapsedS: elapsed,
      });
    }

    return output;
  }, [simulatedOutage]);

  /**
   * Start a replay run
   */
  const startReplay = useCallback((replayData) => {
    engine.configure();
    const meta = getReplayMeta(replayData);
    metaRef.current = meta;
    setReplayMeta(meta);
    replayDataRef.current = replayData;
    replayIndexRef.current = 0;
    trailRef.current = [];
    traveledRef.current = 0;
    prevRefRef.current = null;
    peakRef.current = { m: 0, atS: 0 };
    curveRef.current = [];
    drTicksRef.current = 0;
    blackoutRef.current = 0;
    recoveredRef.current = false;
    curveClosedRef.current = false;
    totalAtRecRef.current = 0;
    prevSourceRef.current = 'gnss';
    speedSumRef.current = 0;
    tickCountRef.current = 0;
    setTrail([]);
    setDrSeconds(0);
    setFrozenResults(null);
    setSessionSaved(false);
    setBenchmarkSnapshot(null);
    setTunnelCleared(false);
    setNavInfo(null);
    setIsRunning(true);
    isRunningRef.current = true;

    // 10Hz tick from replay data
    tickIntervalRef.current = setInterval(() => {
      if (!isRunningRef.current) return;

      const data = replayDataRef.current;
      const idx = replayIndexRef.current;

      if (!data || idx >= data.length) {
        // Replay finished
        stopRun();
        return;
      }

      const row = data[idx];
      feedTick({
        lat: row.lat,
        lon: row.lon,
        hdop: row.hdop,
        sats: row.sats,
        acc: [row.acc_x || 0, row.acc_y || 0, row.acc_z || 0],
        gyro: [row.gyro_x || 0, row.gyro_y || 0, row.gyro_z || 0],
      }, row);

      replayIndexRef.current = idx + 1;
    }, ENGINE.TICK_INTERVAL_MS);
  }, [feedTick]);

  /**
   * Start live GPS run
   */
  const startLive = useCallback(() => {
    engine.configure();
    metaRef.current = null;
    setReplayMeta(null);
    trailRef.current = [];
    traveledRef.current = 0;
    prevRefRef.current = null;
    peakRef.current = { m: 0, atS: 0 };
    curveRef.current = [];
    drTicksRef.current = 0;
    recoveredRef.current = false;
    curveClosedRef.current = false;
    prevSourceRef.current = 'gnss';
    speedSumRef.current = 0;
    tickCountRef.current = 0;
    setTrail([]);
    setDrSeconds(0);
    setFrozenResults(null);
    setSessionSaved(false);
    setBenchmarkSnapshot(null);
    setTunnelCleared(false);
    setNavInfo(null);
    setIsRunning(true);
    isRunningRef.current = true;
    // Live ticks are fed externally via feedTick()
  }, []);

  const launchPending = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setIsCalibrating(false);
    if (calibIntervalRef.current) {
      clearInterval(calibIntervalRef.current);
      calibIntervalRef.current = null;
    }
    if (!pending) return;
    if (pending.mode === 'replay') {
      startReplay(pending.replayData);
    } else {
      startLive();
    }
  }, [startReplay]);

  /**
   * Start calibration countdown, then start run
   */
  const startCalibration = useCallback((replayData, mode = 'replay') => {
    pendingRef.current = { replayData, mode };
    setIsCalibrating(true);
    setCalibrateCountdown(15);

    let count = 15;
    calibIntervalRef.current = setInterval(() => {
      count--;
      setCalibrateCountdown(count);
      if (count <= 0) {
        launchPending();
      }
    }, 1000);
  }, [launchPending]);

  /**
   * Stop the current run and freeze results
   */
  const stopRun = useCallback(() => {
    // Idempotency guard: auto-finish (interval) and a manual Stop can both fire
    // for the same run. Without this, the session is frozen + persisted twice,
    // producing duplicate DR-history entries. isRunningRef is cleared
    // synchronously below, so a re-entrant call can't slip through.
    if (!isRunningRef.current) return;
    isRunningRef.current = false;
    setIsRunning(false);
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }

    // Freeze results (peak drift over the run, reference-scored when available)
    const total = recoveredRef.current ? totalAtRecRef.current : traveledRef.current;
    const stats = metaRef.current
      ? {
          driftMeters: peakRef.current.m,
          totalMeters: Math.max(total, 1),
          driftPercent: (peakRef.current.m / Math.max(total, 1)) * 100,
          pass: (peakRef.current.m / Math.max(total, 1)) * 100 <= ENGINE.DRIFT_PASS_THRESHOLD * 100,
        }
      : engine.getDriftStats();

    const avgSpeedMps = tickCountRef.current ? speedSumRef.current / tickCountRef.current : 0;
    const frozen = {
      ...stats,
      curve: [...curveRef.current],
      peak: { ...peakRef.current },
      blackoutS: Math.round(recoveredRef.current ? blackoutRef.current : drTicksRef.current / 10),
      recoveryBlendS: DR_DEMO.RECOVERY_BLEND_S,
      sensorHz: DR_DEMO.SENSOR_HZ,
      sessionId: DR_DEMO.SESSION_ID,
      sessionPlace: DR_DEMO.SESSION_PLACE,
      peakMaxM: DR_DEMO.PEAK_DRIFT_MAX_M,
      trail: [...trailRef.current],
      timestamp: new Date().toISOString(),
      avgSpeedMps,
    };
    setFrozenResults(frozen);

    // Persist the frozen session to local DR history (fire-and-forget)
    appendDrSession(frozen)
      .then(() => setSessionSaved(true))
      .catch((e) => {
        console.warn('[useEngine] DR session save failed:', e);
        setSessionSaved(false);
      });
  }, []);

  /**
   * Fully tear down the current session and return to a clean idle home.
   * Unlike stopRun (which freezes results for review), this clears every piece
   * of run/overlay state — used when the user backs out of the simulation.
   * Safe to call from any state (idle, calibrating, running, completed).
   */
  const resetSession = useCallback(() => {
    // Stop the tick loop and any in-flight calibration countdown.
    isRunningRef.current = false;
    setIsRunning(false);
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    if (calibIntervalRef.current) {
      clearInterval(calibIntervalRef.current);
      calibIntervalRef.current = null;
    }
    pendingRef.current = null;
    setIsCalibrating(false);
    setCalibrateCountdown(0);
    if (clearedTimerRef.current) {
      clearTimeout(clearedTimerRef.current);
      clearedTimerRef.current = null;
    }

    // Clear all demo/HUD overlay state.
    setFrozenResults(null);
    setSessionSaved(false);
    setBenchmarkSnapshot(null);
    setTunnelCleared(false);
    setNavInfo(null);
    setReplayMeta(null);
    setTrail([]);
    setDrSeconds(0);
    setDriftStats({ driftMeters: 0, totalMeters: 0, driftPercent: 0, pass: true });
    setEngineState({
      lat: null,
      lon: null,
      heading: 0,
      speed: 0,
      sigma: ENGINE.SIGMA_MIN,
      source: 'gnss',
    });

    // Reset benchmark scoring refs so the next run starts clean.
    metaRef.current = null;
    replayDataRef.current = null;
    replayIndexRef.current = 0;
    trailRef.current = [];
    traveledRef.current = 0;
    prevRefRef.current = null;
    peakRef.current = { m: 0, atS: 0 };
    curveRef.current = [];
    drTicksRef.current = 0;
    blackoutRef.current = 0;
    recoveredRef.current = false;
    curveClosedRef.current = false;
    totalAtRecRef.current = 0;
    prevSourceRef.current = 'gnss';
    speedSumRef.current = 0;
    tickCountRef.current = 0;
  }, []);

  /**
   * Simulate outage (debug menu only)
   */
  const simulateOutageStart = useCallback(() => {
    setSimulatedOutage(true);
    outageTimerRef.current = setTimeout(() => {
      setSimulatedOutage(false);
    }, 60000); // 60s
  }, []);

  const simulateOutageEnd = useCallback(() => {
    setSimulatedOutage(false);
    if (outageTimerRef.current) {
      clearTimeout(outageTimerRef.current);
      outageTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (outageTimerRef.current) clearTimeout(outageTimerRef.current);
      if (calibIntervalRef.current) clearInterval(calibIntervalRef.current);
      if (clearedTimerRef.current) clearTimeout(clearedTimerRef.current);
    };
  }, []);

  return {
    // Engine output
    engineState,
    trail,
    driftStats,
    drSeconds,

    // Demo HUD
    gnssQuality,
    navInfo,
    benchmarkSnapshot,
    tunnelCleared,
    replayMeta,

    // Run control
    isRunning,
    isCalibrating,
    calibrateCountdown,
    frozenResults,

    // Persistence
    sessionSaved,

    // Actions
    feedTick,
    startReplay,
    startLive,
    startCalibration,
    skipCalibration: launchPending,
    stopRun,
    resetSession,

    // Debug
    simulatedOutage,
    simulateOutageStart,
    simulateOutageEnd,
  };
}
