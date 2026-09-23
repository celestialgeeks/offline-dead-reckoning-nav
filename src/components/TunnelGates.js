// PS168 — Tunnel Gates (Layer 2)
// Map markers at the tunnel entry/exit gates from replay metadata
// Entry gate pops in as the vehicle approaches the blackout, exit gate on
// recovery — black tunnel-arch plaques with mono labels ("TUNNEL ENTRY")

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import MapLibreGL from '../map/maplibre';
import Svg, { Path, Circle } from 'react-native-svg';
import { DEMO } from '../utils/constants';

function Gate({ coordinate, label, visible }) {
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
        <View style={styles.labelChip}>
          <Text style={styles.labelText}>{label}</Text>
        </View>
        <View style={styles.plaque}>
          <Svg width={34} height={26} viewBox="0 0 34 26">
            {/* Tunnel arch */}
            <Path
              d="M7 24 L7 13 A10 10 0 0 1 27 13 L27 24 Z"
              fill="#1F2937"
              stroke="#FFFFFF"
              strokeWidth={2}
            />
            {/* Road dot inside */}
            <Circle cx={17} cy={19} r={3.5} fill={DEMO.amber} />
          </Svg>
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
        label="TUNNEL ENTRY"
        visible={elapsedS >= meta.entryS - 2}
      />
      <Gate
        coordinate={meta.exitCoord}
        label="TUNNEL EXIT"
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
    borderColor: 'rgba(245, 158, 11, 0.7)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
});
