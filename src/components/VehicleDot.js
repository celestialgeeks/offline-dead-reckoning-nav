// PS168 — Vehicle Dot (Layer 2)
// Custom map marker showing engine-computed position, rotates with heading
// Phases:
//   gnss      — blue puck with soft halo + heading beam
//   dr        — amber puck with pulsing halo (uncertainty breathing)
//   recovered — blue puck + one-shot expanding ring + green check badge
// The gnss⇄dr color swap is a smooth 400ms interpolated blend (legacy Animated)

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import MapLibreGL from '../map/maplibre';
import Svg, { Circle, Path } from 'react-native-svg';
import { DEMO } from '../utils/constants';

const GNSS_HEX = '#1A73E8';
const DR_HEX = DEMO.amber; // '#F59E0B'
const GNSS_HALO = 'rgba(26, 115, 232, 0.16)';
const DR_HALO = 'rgba(245, 158, 11, 0.25)';

// --- Pure color interpolation helpers ---
function parseHex(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function parseRgba(rgba) {
  const inner = rgba.slice(rgba.indexOf('(') + 1, rgba.lastIndexOf(')'));
  return inner.split(',').map((s) => parseFloat(s));
}

function lerpChannel(a, b, t) {
  return a + (b - a) * t;
}

// Linear-interpolate two #RRGGBB colors → 'rgb(r, g, b)'
function lerpColor(from, to, t) {
  const a = parseHex(from);
  const b = parseHex(to);
  return `rgb(${Math.round(lerpChannel(a[0], b[0], t))}, ${Math.round(lerpChannel(a[1], b[1], t))}, ${Math.round(lerpChannel(a[2], b[2], t))})`;
}

// Linear-interpolate two rgba() colors (alpha included) → 'rgba(r, g, b, a)'
function lerpRgba(from, to, t) {
  const a = parseRgba(from);
  const b = parseRgba(to);
  return `rgba(${Math.round(lerpChannel(a[0], b[0], t))}, ${Math.round(lerpChannel(a[1], b[1], t))}, ${Math.round(lerpChannel(a[2], b[2], t))}, ${+lerpChannel(a[3], b[3], t).toFixed(3)})`;
}

function VehicleDot({ lat, lon, heading = 0, source = 'gnss', recovered = false }) {
  const isDr = source === 'dr';

  // 400ms gnss⇄dr blend; JS-thread driver so SVG fills can consume strings
  const mixRef = useRef(new Animated.Value(isDr ? 1 : 0)).current;
  const [mix, setMix] = useState(isDr ? 1 : 0);

  useEffect(() => {
    Animated.timing(mixRef, {
      toValue: isDr ? 1 : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [isDr, mixRef]);

  useEffect(() => {
    const id = mixRef.addListener((v) => setMix(Math.round(v.value * 100) / 100));
    return () => mixRef.removeListener(id);
  }, [mixRef]);

  if (lat == null || lon == null) return null;

  const color = lerpColor(GNSS_HEX, DR_HEX, mix);
  const haloColor = lerpRgba(GNSS_HALO, DR_HALO, mix);

  return (
    <MapLibreGL.MarkerView
      coordinate={[lon, lat]}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.container}>
        {/* Heading-rotated puck */}
        <View style={{ transform: [{ rotate: `${heading}deg` }] }}>
          <Svg width={56} height={56} viewBox="0 0 56 56">
            {/* Heading beam */}
            <Path d="M28 2 L20 20 L36 20 Z" fill={haloColor} />
            {/* Halo ring */}
            <Circle cx="28" cy="28" r="22" fill={haloColor} />
            {/* Main dot */}
            <Circle cx="28" cy="28" r="11" fill={color} />
            {/* White inner ring */}
            <Circle cx="28" cy="28" r="6.5" fill="white" />
            {/* Center dot */}
            <Circle cx="28" cy="28" r="4.5" fill={color} />
          </Svg>
        </View>

        {/* DR breathing halo */}
        {isDr && <PulsingHalo />}

        {/* Recovery ring + check badge */}
        {recovered && !isDr && <RecoveryFx />}
      </View>
    </MapLibreGL.MarkerView>
  );
}

export default React.memo(VehicleDot);

// Amber halo that breathes while dead-reckoning
function PulsingHalo() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseHalo,
        {
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.12] }),
        },
      ]}
    />
  );
}

// One-shot expanding blue ring + green check badge on GNSS recovery
function RecoveryFx() {
  const ring = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(ring, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
    Animated.spring(badge, {
      toValue: 1,
      friction: 6,
      tension: 70,
      useNativeDriver: true,
      delay: 350,
    }).start();
  }, [ring, badge]);

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.recoveryRing,
          {
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.4] }) }],
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.checkBadge,
          {
            opacity: badge,
            transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          },
        ]}
      >
        <Text style={styles.checkText}>✓</Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseHalo: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DEMO.amber,
  },
  recoveryRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#1A73E8',
  },
  checkBadge: {
    position: 'absolute',
    right: 4,
    bottom: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: DEMO.green,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 12,
  },
});
