// PS168 — LocalityLabels (Google Maps Cartographic Area Labels)
// Dynamic locality overlays rendered as floating labels above neighborhoods
// Uses the PFLP collision-resolved output from localitiesService
// Zoom-aware visibility: prominent zoomed out, fades at street level

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import MapLibreGL from '../map/maplibre';
import { getVisibleLocalities } from '../data/localitiesService';
import { COLORS, RADIUS, SHADOW } from '../utils/theme';

const SCREEN = Dimensions.get('window');

export default function LocalityLabels({ bounds, zoomLevel, onTapLocality }) {
  const [labels, setLabels] = useState([]);
  const lastBoundsRef = useRef(null);
  const debounceRef = useRef(null);
  const lastSigRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Debounced fetch: avoids thrashing on rapid panning
  const fetchLabels = useCallback(async (b, z) => {
    try {
      const result = await getVisibleLocalities(b, z, {
        width: SCREEN.width,
        height: SCREEN.height,
      });
      const sig = result.map((r) => r.id).join(',');
      if (lastSigRef.current !== null && sig !== lastSigRef.current) {
        // LOD cross-fade: fade the old label set out, swap, fade the new in
        Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
          setLabels(result);
          Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        });
      } else {
        setLabels(result);
      }
      lastSigRef.current = sig;
    } catch (err) {
      console.warn('[LocalityLabels] Failed to fetch:', err);
    }
  }, [fadeAnim]);

  useEffect(() => {
    if (!bounds || bounds.length !== 4) return;
    if (zoomLevel > 18) {
      setLabels([]);
      return;
    }

    // Skip if bounds haven't materially changed (within 0.005 deg)
    if (lastBoundsRef.current) {
      const [pw, ps, pe, pn] = lastBoundsRef.current;
      const [nw, ns, ne, nn] = bounds;
      if (Math.abs(pw - nw) < 0.005 && Math.abs(ps - ns) < 0.005 &&
        Math.abs(pe - ne) < 0.005 && Math.abs(pn - nn) < 0.005) {
        return;
      }
    }
    lastBoundsRef.current = bounds;

    // Debounce 500ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchLabels(bounds, zoomLevel);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [bounds, zoomLevel, fetchLabels]);

  if (labels.length === 0 || zoomLevel > 18) return null;

  // Compute opacity: full at zoom 11-15, starts fading at zoom 15+
  const opacity = zoomLevel <= 15 ? 1.0 : Math.max(0, 1 - (zoomLevel - 15) / 3.0);
  // Cartographic generalization: labels grow slightly as we zoom toward street level
  const labelScale = zoomLevel >= 14 ? 1.18 : zoomLevel <= 10.5 ? 0.88 : 1;

  return (
    <>
      {labels.map((loc) => (
        <MapLibreGL.MarkerView
          key={loc.id}
          coordinate={[loc.lon, loc.lat]}
          anchor="center"
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity
              style={[styles.labelContainer, { opacity, transform: [{ scale: labelScale }] }]}
              onPress={() => onTapLocality?.(loc)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.labelText,
                loc.tierWeight >= 100 && styles.labelTextMajor,
                loc.tierWeight >= 70 && loc.tierWeight < 100 && styles.labelTextQuarter,
              ]}>
                {loc.name.toUpperCase()}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </MapLibreGL.MarkerView>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  labelContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 0.5,
    borderColor: COLORS.surfaceBorder,
    ...SHADOW.s1,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textTertiary,
    letterSpacing: 0.8,
  },
  labelTextMajor: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  labelTextQuarter: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textTertiary,
    letterSpacing: 0.9,
  },
});
