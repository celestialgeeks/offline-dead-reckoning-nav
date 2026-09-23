// PS168 — Sat Chip (Layer 2)
// Dark constellation chip: "GPS×8 IRNSS×6" driven by live replay/GNSS sats
// Pairs with a red "⚠ HDOP 99" chip while fixes are degraded
// row=1 sits beside the status badge, row=2 centers under the search pill

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, StatusBar } from 'react-native';
import { DEMO } from '../utils/constants';
import { RADIUS, SHADOW } from '../utils/theme';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

export default function SatChip({ sats = 0, hdop = 0, row = 2, visible = true }) {
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(enterAnim, {
        toValue: 1,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }).start();
    } else {
      enterAnim.setValue(0);
    }
  }, [visible, enterAnim]);

  if (!visible) return null;

  const gps = Math.max(0, Math.min(sats, 8));
  const irnss = Math.max(0, Math.min(sats - 6, 6));
  const degraded = hdop > 3;

  return (
    <Animated.View
      style={[
        styles.wrap,
        row === 1 ? styles.wrapRow1 : styles.wrapRow2,
        {
          opacity: enterAnim,
          transform: [{ scale: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        },
      ]}
    >
      <View style={styles.chip}>
        <Text style={styles.icon}>🛰</Text>
        <Text style={styles.constellation}>
          <Text style={styles.gps}>GPS×{gps}</Text>
          {'  '}
          <Text style={styles.irnss}>IRNSS×{irnss}</Text>
        </Text>
      </View>
      {degraded && (
        <View style={styles.hdopChip}>
          <Text style={styles.hdopText}>⚠ HDOP {Math.round(hdop)}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 18,
  },
  wrapRow1: {
    top: STATUS_BAR_HEIGHT + 16,
    right: 148,
  },
  wrapRow2: {
    top: STATUS_BAR_HEIGHT + 70,
    alignSelf: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 18, 32, 0.92)',
    paddingHorizontal: 14,
    minHeight: 36,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 7,
    ...SHADOW.s3,
  },
  icon: {
    fontSize: 12,
    opacity: 0.7,
  },
  constellation: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    fontFamily: 'monospace',
  },
  gps: {
    color: '#93C5FD',
  },
  irnss: {
    color: '#FDBA74',
  },
  hdopChip: {
    backgroundColor: DEMO.red,
    paddingHorizontal: 12,
    minHeight: 36,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    ...SHADOW.s3,
  },
  hdopText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    fontFamily: 'monospace',
  },
});
