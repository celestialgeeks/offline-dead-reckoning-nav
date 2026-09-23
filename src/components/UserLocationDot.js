// PS168 — UserLocationDot (Google Maps Style)
// Real-time GPS Blue Dot with:
//   - Directional flashlight / heading cone (bearing beam)
//   - Pulsing accuracy halo
//   - Crisp Google Blue core with white ring

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import MapLibreGL from '../map/maplibre';

export default function UserLocationDot({ lat, lon, position, heading = 0, accuracy = 15, visible = true }) {
  const pulseAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 1600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 1400,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  if (!visible) return null;

  const targetLat = lat ?? position?.latitude;
  const targetLon = lon ?? position?.longitude;

  if (targetLat == null || targetLon == null) return null;

  // Heading beam cone path: 60-degree wedge pointing up (0 deg)
  // Vertex at (40, 40), arc extending to top
  const conePath = 'M 40 40 L 22 8 A 38 38 0 0 1 58 8 Z';

  return (
    <MapLibreGL.MarkerView coordinate={[targetLon, targetLat]} anchor={{ x: 0.5, y: 0.5 }}>
      <View style={styles.container}>
        {/* Pulsing accuracy halo */}
        <Animated.View
          style={[
            styles.halo,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Directional heading cone (rotates with heading) */}
        <View
          style={[
            styles.headingContainer,
            { transform: [{ rotate: `${heading}deg` }] },
          ]}
        >
          <Svg width={80} height={80} viewBox="0 0 80 80">
            <Defs>
              <RadialGradient id="beamGradient" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#1A73E8" stopOpacity="0.5" />
                <Stop offset="75%" stopColor="#4285F4" stopOpacity="0.18" />
                <Stop offset="100%" stopColor="#4285F4" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Path d={conePath} fill="url(#beamGradient)" />
          </Svg>
        </View>

        {/* Core blue dot with white border */}
        <View style={styles.coreShadow}>
          <View style={styles.whiteRing}>
            <View style={styles.blueDot} />
          </View>
        </View>
      </View>
    </MapLibreGL.MarkerView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  halo: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(66, 133, 244, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(66, 133, 244, 0.35)',
  },
  headingContainer: {
    position: 'absolute',
    width: 80,
    height: 80,
  },
  coreShadow: {
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 6,
  },
  whiteRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blueDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1A73E8',
  },
});
