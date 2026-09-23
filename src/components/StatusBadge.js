// PS168 — Status Badge (Layer 2)
// Top-right pill: "GNSS OK" ⇄ "GNSS→DR {n}s"
// Flips in <300ms on outage detection, pulsing dot while in DR,
// fades back once the badge has been on screen for a while (demo framing)

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, StatusBar } from 'react-native';
import { DEMO } from '../utils/constants';
import { RADIUS, SHADOW } from '../utils/theme';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

export default function StatusBadge({ source = 'gnss', drSeconds = 0, visible = true }) {
  const modeAnim = useRef(new Animated.Value(source === 'gnss' ? 0 : 1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(modeAnim, {
      toValue: source === 'dr' ? 1 : 0,
      duration: 250, // < 300ms per spec
      useNativeDriver: false,
    }).start();
  }, [source, modeAnim]);

  // Settle to half opacity after 20s in DR so the map stays readable
  useEffect(() => {
    const aged = source === 'dr' && drSeconds > 20;
    Animated.timing(fadeAnim, {
      toValue: aged ? 0.55 : 1,
      duration: 600,
      // JS driver: fadeAnim feeds opacity on the SAME outer Animated.View as
      // modeAnim's color interpolations (JS driver). A native start here would
      // mark the shared props node native and crash modeAnim's next .start().
      useNativeDriver: false,
    }).start();
  }, [source, drSeconds > 20, fadeAnim]);

  // Pulsing dot loop while in DR
  useEffect(() => {
    if (source !== 'dr') {
      pulseAnim.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [source, pulseAnim]);

  if (!visible) return null;

  const backgroundColor = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [DEMO.greenFill, DEMO.amberCard],
  });
  const borderColor = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [DEMO.green, DEMO.amber],
  });
  const textColor = source === 'dr' ? DEMO.amberDark : DEMO.greenDark;
  const label = source === 'dr'
    ? `GNSS→DR ${Math.round(drSeconds)}s`
    : 'GNSS OK';

  const dotScale = source === 'dr' ? pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) : 1;
  const dotOpacity = source === 'dr' ? pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) : 1;

  return (
    <Animated.View style={[styles.badge, { backgroundColor, borderColor, opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: source === 'dr' ? DEMO.amber : DEMO.green, transform: [{ scale: dotScale }], opacity: dotOpacity },
        ]}
      />
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
      {source === 'dr' && <View style={styles.ball} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: STATUS_BAR_HEIGHT + 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 38,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    gap: 8,
    zIndex: 20,
    ...SHADOW.s3,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  ball: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FACC15',
    marginLeft: 2,
  },
  text: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontFamily: 'monospace',
  },
});
