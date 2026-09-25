// PS168 — Signal Gates (Layer 2)
// Map markers at the start/end of the satellite blackout from replay metadata.
// The entry gate pops in as GNSS cuts out ("SIGNAL LOST") and the exit gate on
// recovery ("SIGNAL BACK"), framing the demo as an automatic switch to
// dead-reckoning whenever the sky is lost — not a literal tunnel.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import MapLibreGL from '../map/maplibre';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { DEMO } from '../utils/constants';

// Small satellite glyph; `slash` overlays a "no signal" strike for the entry gate.
function SatelliteIcon({ color, slash }) {
  return (
    <Svg width={30} height={26} viewBox="0 0 30 26">
      {/* solar panels */}
      <Rect x={2} y={9} width={7} height={8} rx={1} fill={color} opacity={0.85} />
      <Rect x={21} y={9} width={7} height={8} rx={1} fill={color} opacity={0.85} />
      {/* body */}
      <Rect x={11.5} y={8} width={7} height={10} rx={1.5} fill={color} />
      {/* dish */}
      <Circle cx={15} cy={5} r={3} fill="none" stroke={color} strokeWidth={1.6} />
      <Path d="M15 8 L15 10" stroke={color} strokeWidth={1.6} />
      {slash && (
        <Path
          d="M4 22 L26 4"
          stroke="#FFFFFF"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

function Gate({ coordinate, label, kind, visible }) {
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(enterAnim, {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }).start();
    } else {
      enterAnim.setValue(0);
    }
  }, [visible, enterAnim]);

  if (!visible || !coordinate) return null;

  const lost = kind === 'lost';
  const accent = lost ? DEMO.red : DEMO.green;

  return (
    <MapLibreGL.MarkerView coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }}>
      <Animated.View
        style={[
          styles.gate,
          {
            opacity: enterAnim,
            transform: [{ scale: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          },
        ]}
      >
        <View style={[styles.labelChip, { borderColor: accent }]}>
          <Text style={styles.labelText}>{label}</Text>
        </View>
        <View style={[styles.plaque, { borderColor: accent }]}>
          <SatelliteIcon color={lost ? '#FCA5A5' : '#6EE7B7'} slash={lost} />
        </View>
      </Animated.View>
    </MapLibreGL.MarkerView>
  );
}

export default function TunnelGates({ meta, elapsedS = 0, visible = true }) {
  if (!visible || !meta) return null;

  return (
    <>
      <Gate
        coordinate={meta.entryCoord}
        label="SIGNAL LOST"
        kind="lost"
        visible={elapsedS >= meta.entryS - 2}
      />
      <Gate
        coordinate={meta.exitCoord}
        label="SIGNAL BACK"
        kind="back"
        visible={elapsedS >= meta.exitS - 2}
      />
    </>
  );
}

const styles = StyleSheet.create({
  gate: {
    alignItems: 'center',
    gap: 3,
  },
  labelChip: {
    backgroundColor: 'rgba(11, 18, 32, 0.9)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 0.6,
  },
  plaque: {
    backgroundColor: '#0B1220',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1.5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
});
