// PS168 — Base Map (Layer 0)
// On-demand streaming MapLibre vector map with OpenFreeMap Liberty style
// Automatically caches visible tiles on disk; zero blocking startup downloads

import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from './maplibre';
import { MAP_STYLE_URL } from './mapStyle';
import { INDORE } from '../utils/constants';
import { haversine } from '../utils/geo';

const BaseMap = forwardRef(({
  children,
  onMapReady,
  onRegionDidChange,
  onRegionWillChange,
  onTouchStart,
  onPress,
  onLongPress,
  initialCenter,
  styleProp,
}, ref) => {
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  // Live viewport mirror fed from region events: powers zoom stepping and
  // distance-aware camera easing without querying native state
  const centerRef = useRef(null);

  // Track live zoom/center so getZoom()-based controls stay accurate
  const handleRegionDidChange = useCallback((e) => {
    const p = e?.nativeEvent ?? e?.properties ?? e;
    if (p?.zoom != null) cameraRef.current?.notifyZoom?.(p.zoom);
    if (Array.isArray(p?.center)) {
      centerRef.current = { lat: p.center[1], lon: p.center[0] };
    }
    onRegionDidChange?.(e);
  }, [onRegionDidChange]);
  const [isReady, setIsReady] = useState(true);

  const center = initialCenter || INDORE;

  useImperativeHandle(ref, () => ({
    // Animate camera to a position
    flyTo(coords, zoom = 15, bearing = 0, pitch = 0, duration = 600) {
      if (!coords) return;
      const lon = Array.isArray(coords) ? coords[0] : (coords.longitude ?? coords.lon);
      const lat = Array.isArray(coords) ? coords[1] : (coords.latitude ?? coords.lat);
      if (lon == null || lat == null) return;
      // Google-style: long jumps get the native "flight" swoop, short hops ease
      const cur = centerRef.current;
      const distM = cur ? haversine(cur.lat, cur.lon, lat, lon) : Infinity;
      if (distM > 2000) {
        cameraRef.current?.flyTo([lon, lat], zoom, duration || 1200, { bearing, pitch });
        return;
      }
      cameraRef.current?.setCamera({
        centerCoordinate: [lon, lat],
        zoomLevel: zoom,
        bearing,
        pitch,
        animationDuration: duration,
      });
    },
    // Recenter to a position
    recenter(coords, zoom = 15, bearing = 0, pitch = 0, duration = 400) {
      if (!coords) return;
      const lon = Array.isArray(coords) ? coords[0] : (coords.longitude ?? coords.lon);
      const lat = Array.isArray(coords) ? coords[1] : (coords.latitude ?? coords.lat);
      if (lon == null || lat == null) return;
      cameraRef.current?.setCamera({
        centerCoordinate: [lon, lat],
        zoomLevel: zoom,
        bearing,
        pitch,
        animationDuration: duration,
      });
    },
    // Zoom in
    zoomIn() {
      const z = cameraRef.current?.getZoom?.() ?? 15;
      cameraRef.current?.zoomTo(Math.min(20, z + 1), 250);
    },
    // Fit Bounds
    fitBounds(ne, sw, padding = 50, duration = 600) {
      if (!ne || !sw) return;
      cameraRef.current?.fitBounds(ne, sw, padding, duration);
    },
    // Zoom out
    zoomOut() {
      const z = cameraRef.current?.getZoom?.() ?? 15;
      cameraRef.current?.zoomTo(Math.max(3, z - 1), 250);
    },
    getMapRef: () => mapRef.current,
    getCameraRef: () => cameraRef.current,
  }));

  return (
    <View style={styles.container} onTouchStart={onTouchStart}>
      <MapLibreGL.MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={styleProp || MAP_STYLE_URL}
        compassEnabled={true}
        compassPosition={{ top: 8, right: 8 }}
        scaleBarEnabled={true}
        scaleBarPosition={{ bottom: 8, right: 8 }}
        logoEnabled={false}
        attributionEnabled={true}
        attributionPosition={{ bottom: 8, left: 8 }}
        onRegionWillChange={onRegionWillChange}
        onPress={onPress}
        onLongPress={onLongPress}
        onDidFinishLoadingMap={() => {
          setIsReady(true);
          onMapReady?.();
        }}
        onRegionDidChange={handleRegionDidChange}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [center.longitude, center.latitude],
            zoomLevel: 14,
          }}
        />
        {isReady && children}
      </MapLibreGL.MapView>
    </View>
  );
});

BaseMap.displayName = 'BaseMap';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

export default BaseMap;
