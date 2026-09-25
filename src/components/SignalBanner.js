// PS168 — Signal Banner (Layer 2)
// Slim top-center pill announcing satellite cutoff / restoration during a run:
//   degraded — amber "📡 Satellite Lost — Dead Reckoning ON"
//   restored — green "✓ Satellite Back — Position Locked"
// Slides down + fades in on mode change; parent unmounts via mode null.

import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, Platform, StatusBar } from 'react-native';
import { DEMO } from '../utils/constants';
import { RADIUS, SHADOW } from '../utils/theme';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

export default function SignalBanner({ mode = null, containerStyle }) {
  const enterAnim = useRef(new Animated.Value(0)).current;

  // Slide-down + fade-in on every mode change
  useEffect(() => {
    if (!mode) return undefined;
    enterAnim.setValue(0);
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    return undefined;
  }, [mode, enterAnim]);

  if (!mode) return null;

  const degraded = mode === 'degraded';
  const label = degraded
    ? '📡 Satellite Lost — Dead Reckoning ON'
    : '✓ Satellite Back — Position Locked';

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        degraded ? styles.bannerDegraded : styles.bannerRestored,
        containerStyle,
        {
          opacity: enterAnim,
          transform: [
            { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
          ],
        },
      ]}
    >
      <Text style={[styles.text, degraded ? styles.textDegraded : styles.textRestored]}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: STATUS_BAR_HEIGHT + 60,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    zIndex: 19, // below modals
    ...SHADOW.s3,
  },
  bannerDegraded: {
    backgroundColor: DEMO.amberCard,
    borderColor: DEMO.amber,
  },
  bannerRestored: {
    backgroundColor: DEMO.greenFill,
    borderColor: DEMO.green,
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontFamily: 'monospace',
  },
  textDegraded: {
    color: DEMO.amberDeep,
  },
  textRestored: {
    color: DEMO.greenDark,
  },
});
