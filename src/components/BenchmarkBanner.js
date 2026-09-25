// PS168 — Benchmark Banner (Layer 2)
// Green full-width banner raised at GNSS recovery:
//   "BENCHMARKED RUN [FROZEN] · 68m / 1000m = 6.8% PASS ✅ · Lock Restored <1.2m CEP"
// Slides down under the search row and stays until the results modal opens

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, StatusBar } from 'react-native';
import { DEMO } from '../utils/constants';
import { RADIUS } from '../utils/theme';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

export default function BenchmarkBanner({ snapshot, visible = true, containerStyle }) {
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && snapshot) {
      Animated.spring(enterAnim, {
        toValue: 1,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }).start();
    } else {
      enterAnim.setValue(0);
    }
  }, [visible, snapshot, enterAnim]);

  if (!visible || !snapshot) return null;

  const { driftMeters, totalMeters, driftPercent, pass, cepM } = snapshot;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        containerStyle,
        {
          opacity: enterAnim,
          transform: [
            { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.checkCircle}>
        <Text style={styles.checkMark}>✓</Text>
      </View>

      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>BENCHMARKED RUN</Text>
          <View style={styles.frozenTag}>
            <Text style={styles.frozenTagText}>FROZEN</Text>
          </View>
        </View>
        <Text style={styles.metric}>
          {driftMeters.toFixed(0)}m / {totalMeters.toFixed(0)}m = {driftPercent.toFixed(1)}%{' '}
          {pass ? 'PASS ✅' : 'FAIL ❌'}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.rightTitle}>Lock Restored</Text>
        <Text style={styles.rightMetric}>{`<${cepM}m CEP`}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: STATUS_BAR_HEIGHT + 64,
    left: 8,
    right: 8,
    backgroundColor: '#059669',
    borderRadius: RADIUS.capsule,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 9,
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    zIndex: 22,
  },
  checkCircle: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  main: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  frozenTag: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  frozenTagText: {
    color: '#ECFDF5',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  metric: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    fontFamily: 'monospace',
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rightTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
  },
  rightMetric: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
    fontFamily: 'monospace',
  },
});
