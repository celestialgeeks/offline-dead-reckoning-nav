// PS168 — POIMarkers (Google Maps Style)
// Interactive pins dropped on the map for hospitals, fuel, food, pharmacies, etc.
// Distinct colored badges with category icons and place name labels

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import MapLibreGL from '../map/maplibre';
import Supercluster from 'supercluster';
import { COLORS, RADIUS, SHADOW } from '../utils/theme';

// Google-style pin drop: falls in from above with a slight overshoot
function DropIn({ children, animKey }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [animKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
      {children}
    </Animated.View>
  );
}

// Cluster badge that pops when its count changes
function ClusterBadge({ count }) {
  const anim = useRef(new Animated.Value(1)).current;
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    anim.setValue(0.7);
    Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View
      style={[
        styles.clusterBadge,
        {
          transform: [{ scale: anim }],
          opacity: anim.interpolate({ inputRange: [0.7, 1], outputRange: [0.6, 1] }),
        },
      ]}
    >
      <Text style={styles.clusterText}>{count}</Text>
    </Animated.View>
  );
}

// Expanding highlight ring pulsed once at a freshly selected result
function PulseRing({ coordinate }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] });
  return (
    <MapLibreGL.MarkerView coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }}>
      <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />
    </MapLibreGL.MarkerView>
  );
}

export default function POIMarkers({ places = [], selectedPlace, selectedPlaceId, onSelectPlace, bounds, zoom, onClusterPress }) {
  const [clusters, setClusters] = useState([]);
  
  const superclusterRef = useRef(null);
  if (!superclusterRef.current) {
    try {
      const SuperclusterClass = (Supercluster && Supercluster.default) ? Supercluster.default : Supercluster;
      if (typeof SuperclusterClass === 'function') {
        superclusterRef.current = new SuperclusterClass({
          radius: 40,
          maxZoom: 16,
        });
      }
    } catch (e) {
      console.warn('Supercluster init failed:', e);
    }
  }

  useEffect(() => {
    if (!places || places.length === 0) {
      setClusters([]);
      return;
    }
    const validPlaces = places.filter(p => p && p.latitude != null && p.longitude != null);
    const points = validPlaces.map(p => ({
      type: 'Feature',
      properties: { cluster: false, placeId: p.id, place: p },
      geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] }
    }));

    if (superclusterRef.current && bounds && bounds.length === 4 && zoom != null) {
      try {
        superclusterRef.current.load(points);
        const clusterResults = superclusterRef.current.getClusters(bounds, Math.round(zoom));
        setClusters(clusterResults);
        return;
      } catch (err) {
        console.warn('Supercluster clustering failed, falling back to points:', err);
      }
    }
    setClusters(points);
  }, [places, bounds, zoom]);

  // Label decluttering (Google-style): name tags only for the selected pin,
  // street-level zoom, or the 3 most prominent places in the current batch
  const topProminence = useMemo(() => {
    const scores = places
      .map((p) => p?.prominence ?? 0)
      .sort((a, b) => b - a);
    return scores.length >= 3 ? scores[2] : Infinity;
  }, [places]);
  const showLabels = zoom != null && zoom >= 15.5;

  if (!clusters || clusters.length === 0) return null;

  return (
    <>
      {selectedPlace?.latitude != null && (
        <PulseRing
          key={`pulse_${selectedPlace.id}`}
          coordinate={[selectedPlace.longitude, selectedPlace.latitude]}
        />
      )}
      {clusters.map((cluster) => {
        const [longitude, latitude] = cluster.geometry.coordinates;
        const { cluster: isCluster, point_count: pointCount, place } = cluster.properties || {};

        if (isCluster) {
          return (
            <MapLibreGL.PointAnnotation
              key={`cluster_${cluster.id}`}
              id={`cluster_${cluster.id}`}
              coordinate={[longitude, latitude]}
              onSelected={() => onClusterPress?.(cluster.id, { latitude, longitude })}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <ClusterBadge count={pointCount} />
            </MapLibreGL.PointAnnotation>
          );
        }

        const placeObj = place || cluster.properties?.place;
        if (!placeObj) return null;
        const placeId = placeObj.id || cluster.properties?.placeId;
        const isSelected = selectedPlace?.id === placeId || selectedPlaceId === placeId;
        const showName =
          isSelected ||
          showLabels ||
          (topProminence !== Infinity && (placeObj.prominence ?? 0) >= topProminence && topProminence > 0);
        return (
          <MapLibreGL.PointAnnotation
            key={placeId ? String(placeId) : `poi_${longitude}_${latitude}`}
            id={placeId ? String(placeId) : `poi_${longitude}_${latitude}`}
            coordinate={[placeObj.longitude, placeObj.latitude]}
            onSelected={() => onSelectPlace?.(placeObj)}
            anchor={{ x: 0.5, y: 1 }}
          >
            <DropIn animKey={placeId}>
              <View style={styles.markerContainer}>
                {/* Pin badge */}
                <View
                  style={[
                    styles.pinBadge,
                    { backgroundColor: placeObj.pinColor || '#EA4335' },
                    isSelected && styles.pinBadgeSelected,
                  ]}
                >
                  <Text style={styles.pinIcon}>{placeObj.icon || '📍'}</Text>
                </View>
                {/* Pin pointer tip */}
                <View
                  style={[
                    styles.pinTip,
                    { borderTopColor: placeObj.pinColor || '#EA4335' },
                  ]}
                />

                {/* Place Name Tag (decluttered) */}
                {showName && (
                  <View style={[styles.nameTag, isSelected && styles.nameTagSelected]}>
                    <Text
                      style={[styles.nameText, isSelected && styles.nameTextSelected]}
                      numberOfLines={1}
                    >
                      {placeObj.name}
                    </Text>
                  </View>
                )}
              </View>
            </DropIn>
          </MapLibreGL.PointAnnotation>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  clusterBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.surface,
    ...SHADOW.s2,
  },
  clusterText: {
    color: COLORS.textOnColor,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pulseRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(26, 115, 232, 0.15)',
  },
  markerContainer: {
    alignItems: 'center',
  },
  pinBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
    ...SHADOW.s2,
  },
  pinBadgeSelected: {
    transform: [{ scale: 1.25 }],
    borderColor: '#FEEFC3',
    borderWidth: 2.5,
  },
  pinIcon: {
    fontSize: 14,
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -1,
  },
  nameTag: {
    backgroundColor: COLORS.chipTranslucent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    marginTop: 3,
    borderWidth: 0.5,
    borderColor: COLORS.surfaceBorder,
    maxWidth: 130,
    ...SHADOW.s1,
  },
  nameTagSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  nameText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: COLORS.textSecondary,
  },
  nameTextSelected: {
    color: COLORS.textOnColor,
    fontWeight: '700',
  },
});

