// PS168 — useLocation Hook
// Wraps expo-location for high-accuracy GPS tracking + Compass heading
// Returns current position, heading, accuracy, and permission status

import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { haversine } from '../utils/geo';

export default function useLocation() {
  const [position, setPosition] = useState(null);
  // Interpolated puck position: a 100ms lerp chases the raw fix so the dot
  // glides between GPS updates instead of teleporting (raw `position` stays
  // authoritative for engine/scoring)
  const [smoothPosition, setSmoothPosition] = useState(null);
  const [heading, setHeading] = useState(0);
  const [accuracy, setAccuracy] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState(null);
  const posSubRef = useRef(null);
  const headingSubRef = useRef(null);
  const targetPosRef = useRef(null);
  const smoothPosRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (mounted) {
          setError('Location permission denied');
          setPermissionGranted(false);
        }
        return;
      }
      if (mounted) setPermissionGranted(true);

      // Get initial position
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (mounted && loc?.coords) {
          setPosition({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          targetPosRef.current = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setAccuracy(loc.coords.accuracy);
          if (loc.coords.heading != null && loc.coords.heading >= 0) {
            setHeading(loc.coords.heading);
          }
        }
      } catch (e) {
        console.warn('[useLocation] Initial position failed:', e);
      }

      // Start position watching
      try {
        posSubRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (loc) => {
            if (!mounted || !loc?.coords) return;
            setPosition({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            targetPosRef.current = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            setAccuracy(loc.coords.accuracy);
            if (loc.coords.heading != null && loc.coords.heading >= 0) {
              setHeading(loc.coords.heading);
            }
          }
        );
      } catch (e) {
        console.warn('[useLocation] Watch position failed:', e);
      }

      // Start compass heading watching if available
      try {
        let lastSin = 0;
        let lastCos = 0;
        let isFirstHeading = true;
        const ALPHA = 0.15; // Lower = smoother, higher = more responsive

        headingSubRef.current = await Location.watchHeadingAsync((h) => {
          if (!mounted) return;
          const trueHeading = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (trueHeading != null && trueHeading >= 0) {
            // Apply Exponential Moving Average (EMA) to smooth out jitter
            const rad = trueHeading * (Math.PI / 180);
            const currentSin = Math.sin(rad);
            const currentCos = Math.cos(rad);

            if (isFirstHeading) {
              lastSin = currentSin;
              lastCos = currentCos;
              isFirstHeading = false;
              setHeading(trueHeading);
            } else {
              lastSin = ALPHA * currentSin + (1 - ALPHA) * lastSin;
              lastCos = ALPHA * currentCos + (1 - ALPHA) * lastCos;

              let smoothedHeading = Math.atan2(lastSin, lastCos) * (180 / Math.PI);
              if (smoothedHeading < 0) smoothedHeading += 360;
              setHeading(smoothedHeading);
            }
          }
        });
      } catch (e) {
        // Heading watch may not be supported on some devices/emulators
      }
    })();

    return () => {
      mounted = false;
      posSubRef.current?.remove();
      headingSubRef.current?.remove();
    };
  }, []);

  // 100ms lerp ticker toward the latest fix; snaps on >300m jumps (teleport /
  // GPS reacquisition) and settles once within ~0.5m of the target
  useEffect(() => {
    const timer = setInterval(() => {
      const target = targetPosRef.current;
      if (!target) return;
      const cur = smoothPosRef.current;
      if (!cur) {
        smoothPosRef.current = target;
        setSmoothPosition(target);
        return;
      }
      const gap = haversine(cur.latitude, cur.longitude, target.latitude, target.longitude);
      if (gap > 300) {
        smoothPosRef.current = target;
        setSmoothPosition(target);
        return;
      }
      if (gap < 0.5) return;
      const next = {
        ...target,
        latitude: cur.latitude + (target.latitude - cur.latitude) * 0.18,
        longitude: cur.longitude + (target.longitude - cur.longitude) * 0.18,
      };
      smoothPosRef.current = next;
      setSmoothPosition(next);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return {
    position,
    smoothPosition,
    heading,
    accuracy,
    permissionGranted,
    error,
  };
}
