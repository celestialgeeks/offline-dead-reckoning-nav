// PS168 — RouteLayer (Google Maps blue road route line + destination pin)
// Renders real road network polylines computed from OSRM driving engine
// Progressive draw: the polyline reveals head→tail over ~900ms when a new
// route arrives; destination pin drops in with a spring

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import MapLibreGL from '../map/maplibre';
import { COLORS, SHADOW } from '../utils/theme';

export default function RouteLayer({
  origin,
  destination,
  routeCoordinates,
  visible = true,
}) {
  const originCoords = useMemo(() => {
    if (!origin) return null;
    if (Array.isArray(origin)) return origin;
    if (origin.longitude != null && origin.latitude != null) return [origin.longitude, origin.latitude];
    if (origin.lon != null && origin.lat != null) return [origin.lon, origin.lat];
    return null;
  }, [origin]);

  const destCoords = useMemo(() => {
    if (!destination) return null;
    if (Array.isArray(destination)) return destination;
    if (destination.longitude != null && destination.latitude != null) return [destination.longitude, destination.latitude];
    if (destination.lon != null && destination.lat != null) return [destination.lon, destination.lat];
    return null;
  }, [destination]);

  // --- Progressive route draw (~30fps throttled reveal) ---
  const [revealT, setRevealT] = useState(1);
  useEffect(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return undefined;
    setRevealT(0);
    const anim = new Animated.Value(0);
    let lastEmit = 0;
    const listenerId = anim.addListener(({ value }) => {
      const now = Date.now();
      if (value < 1 && now - lastEmit < 33) return;
      lastEmit = now;
      setRevealT(value);
    });
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      anim.removeListener(listenerId);
      animation.stop();
    };
  }, [routeCoordinates]);

  const visibleCoords = useMemo(() => {
    if (!routeCoordinates) return null;
    if (revealT >= 1) return routeCoordinates;
    return routeCoordinates.slice(0, Math.max(2, Math.ceil(revealT * routeCoordinates.length)));
  }, [routeCoordinates, revealT]);

  const routeGeoJSON = useMemo(() => {
    if (!destCoords || !visibleCoords || visibleCoords.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'nav-route' },
          geometry: {
            type: 'LineString',
            coordinates: visibleCoords,
          },
        },
      ],
    };
  }, [destCoords, visibleCoords]);

  // --- Destination pin drop spring ---
  const dropAnim = useRef(new Animated.Value(0)).current;
  const destKey = destCoords ? `${destCoords[0]},${destCoords[1]}` : null;
  useEffect(() => {
    if (!destKey) return;
    dropAnim.setValue(0);
    Animated.spring(dropAnim, {
      toValue: 1,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [destKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dropTranslateY = dropAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] });
  const dropScale = dropAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  if (!visible || !destCoords) return null;

  return (
    <>
      {routeGeoJSON && (
        <MapLibreGL.ShapeSource id="nav-route-source" shape={routeGeoJSON}>
          {/* Outer Casing / Outline (dark blue) */}
          <MapLibreGL.LineLayer
            id="nav-route-casing"
            style={{
              lineColor: COLORS.primaryDark,
              lineWidth: 9,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.95,
            }}
          />
          {/* Inner Route Polyline (Google Maps active blue) */}
          <MapLibreGL.LineLayer
            id="nav-route-inner"
            style={{
              lineColor: '#4285F4',
              lineWidth: 6,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 1.0,
            }}
          />
        </MapLibreGL.ShapeSource>
      )}

      {/* Destination Pin Marker */}
      <MapLibreGL.PointAnnotation
        id="nav-dest-marker"
        coordinate={destCoords}
      >
        <Animated.View style={{ transform: [{ translateY: dropTranslateY }, { scale: dropScale }] }}>
          <View style={styles.destPinContainer}>
            {/* Red teardrop with white center dot (Google Maps destination) */}
            <View style={styles.destPinTeardrop}>
              <View style={styles.destPinDot} />
            </View>
          </View>
        </Animated.View>
      </MapLibreGL.PointAnnotation>
    </>
  );
}

const styles = StyleSheet.create({
  destPinContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 34,
    height: 40,
  },
  destPinTeardrop: {
    width: 26,
    height: 26,
    backgroundColor: COLORS.alert, // Google Maps Red
    borderWidth: 2.5,
    borderColor: COLORS.surface,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    borderBottomRightRadius: 13,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: '45deg' }],
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.s2,
  },
  destPinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
  },
});
