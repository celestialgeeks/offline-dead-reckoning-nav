// PS168 — Drift Meter (Layer 2)
// Live DR drift card: "drift: {x}m / {y}m ({z}%)" scored against replay truth
// Amber outlined card with a mini tolerance bar (10% = full scale)
// Freezes with PASS/FAIL in the benchmark banner + results modal at recovery

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, StatusBar } from 'react-native';
import { COLORS, DEMO, ENGINE } from '../utils/constants';
import { COLORS as T, RADIUS, SHADOW } from '../utils/theme';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

export default function DriftMeter({ driftStats, visible = true }) {
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(enterAnim, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }).start();
    } else {
      enterAnim.setValue(0);
    }
  }, [visible, enterAnim]);

  if (!visible || !driftStats) return null;

  const { driftMeters, totalMeters, driftPercent } = driftStats;
  const over = driftPercent > ENGINE.DRIFT_PASS_THRESHOLD * 100;
  const barFrac = Math.min(1, driftPercent / (ENGINE.DRIFT_PASS_THRESHOLD * 100));

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: enterAnim,
          transform: [
            { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
            { scale: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        },
      ]}
    >
      <View style={styles.row}>
        <Text style={styles.icon}>🛰</Text>
        <Text style={styles.label}>Drift Error</Text>
        <Text style={styles.value}>
          drift: {driftMeters.toFixed(0)}m / {totalMeters.toFixed(0)}m ({driftPercent.toFixed(1)}%)
        </Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[styles.barFill, { width: `${Math.max(4, barFrac * 100)}%`, backgroundColor: over ? DEMO.red : DEMO.amber }]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: STATUS_BAR_HEIGHT + 66,
    alignSelf: 'center',
    backgroundColor: T.chipTranslucent,
    borderWidth: 1.5,
    borderColor: DEMO.amber,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.capsule,
    zIndex: 19,
    minWidth: 260,
    ...SHADOW.s3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: DEMO.amberDark,
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
    color: T.textPrimary,
    fontFamily: 'monospace',
  },
  barTrack: {
    height: 6,
    borderRadius: RADIUS.full,
    backgroundColor: T.surfaceSoft,
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: RADIUS.full,
  },
});
