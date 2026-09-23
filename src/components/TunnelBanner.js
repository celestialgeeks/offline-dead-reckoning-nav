// PS168 — Tunnel Banner (Layer 2)
// Amber "TUNNEL / Dead-Reckoning" plaque that slides in from the right on DR
// entry (with shield icon), and swaps to the green "Tunnel Cleared" chip for a
// few seconds after GNSS recovery

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { DEMO } from '../utils/constants';
import { COLORS, RADIUS, SHADOW } from '../utils/theme';

function ShieldIcon({ color }) {
  return (
    <Svg width={18} height={20} viewBox="0 0 18 20">
      <Path
        d="M9 1 L16 4 V10 C16 14.5 13 17.8 9 19 C5 17.8 2 14.5 2 10 V4 Z"
        fill={color}
      />
      <Path d="M9 4 L9 16 C11.8 15 14 12.6 14 9.6 V5.2 Z" fill="rgba(0,0,0,0.35)" />
    </Svg>
  );
}

function TunnelArchIcon() {
  return (
    <View style={styles.archBox}>
      <Svg width={26} height={22} viewBox="0 0 26 22">
        <Rect x={0} y={0} width={26} height={22} rx={4} fill="#78350F" />
        <Path d="M6 19 L6 11 A7 7 0 0 1 20 11 L20 19 Z" fill="#0B1220" />
        <Path d="M9 19 L9 12 A4 4 0 0 1 17 12 L17 19 Z" fill="#FDE68A" />
      </Svg>
    </View>
  );
}

export default function TunnelBanner({ visible = false, cleared = false }) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const clearAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible, slideAnim]);

  useEffect(() => {
    if (cleared) {
      Animated.spring(clearAnim, {
        toValue: 1,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }).start();
    } else {
      clearAnim.setValue(0);
    }
  }, [cleared, clearAnim]);

  return (
    <>
      {/* Amber DR banner */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.banner,
          {
            opacity: slideAnim,
            transform: [
              { translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [260, 0] }) },
            ],
          },
        ]}
      >
        <TunnelArchIcon />
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>TUNNEL</Text>
          <Text style={styles.bannerSub}>Dead-Reckoning</Text>
        </View>
        <ShieldIcon color="#78350F" />
      </Animated.View>

      {/* Green cleared chip */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.clearedChip,
          {
            opacity: clearAnim,
            transform: [
              { scale: clearAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
            ],
          },
        ]}
      >
        <View style={styles.clearedDot} />
        <Text style={styles.clearedText}>Tunnel Cleared</Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    right: 16,
    top: '54%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DEMO.amber,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADIUS.capsule,
    gap: 12,
    elevation: 8,
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    zIndex: 21,
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  archBox: {
    width: 34,
    height: 30,
    borderRadius: RADIUS.tag,
    backgroundColor: 'rgba(120, 53, 15, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerText: {
    gap: 1,
  },
  bannerTitle: {
    color: '#0B1220',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bannerSub: {
    color: '#78350F',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  clearedChip: {
    position: 'absolute',
    right: 16,
    top: '56%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: DEMO.green,
    paddingHorizontal: 18,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    gap: 8,
    zIndex: 21,
    ...SHADOW.s3,
  },
  clearedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DEMO.green,
  },
  clearedText: {
    color: DEMO.greenDark,
    fontSize: 14,
    fontWeight: '800',
  },
});
