// PS168 — IMU/Odo Chip (Layer 2)
// Dark sensor chip shown while dead-reckoning: green live dot + "IMU/ODO"
// with the AI-fused speed readout "15.8 m/s (AI)"

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, StatusBar } from 'react-native';
import { DEMO } from '../utils/constants';
import { RADIUS, SHADOW } from '../utils/theme';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

export default function ImuOdoChip({ speed = 0, visible = true, containerStyle }) {
  const enterAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (!visible) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulseAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.chip,
        containerStyle,
        {
          opacity: enterAnim,
          transform: [{ scale: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Animated.View
          style={[
            styles.dot,
            { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
          ]}
        />
        <Text style={styles.title}>IMU/ODO</Text>
      </View>
      <View style={styles.speedRow}>
        <Text style={styles.speed}>{speed.toFixed(1)}</Text>
        <Text style={styles.unit}> m/s (AI)</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    top: STATUS_BAR_HEIGHT + 66,
    right: 8,
    backgroundColor: 'rgba(11, 18, 32, 0.94)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.capsule,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 19,
    gap: 2,
    ...SHADOW.s3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: DEMO.green,
  },
  title: {
    color: '#FDE68A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  speed: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontFamily: 'monospace',
  },
  unit: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '600',
  },
});
