// PS168 — Nav Card (Layer 2)
// Google-Maps-style bottom navigation card for demo runs, DR-aware:
//   gnss      — blue maneuver tile, "Active route · Smooth traffic"
//   dr        — amber tile + "Signal Degraded"/"DR Estimating" chip,
//               "IMU/Odo Primed/Active" readout, clock in the ETA row
//   recovered — "GNSS Live" chip + "✓ High Accuracy"
// Bottom bar = route profile: dark green traveled, amber tunnel span,
// green remaining, with a white progress knob

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { DEMO } from '../utils/constants';
import { COLORS, RADIUS, SHADOW } from '../utils/theme';

function formatRemaining(m) {
  if (m == null) return '—';
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// Eased countdown: the "In X m" readout glides to new values instead of jumping
function StepDistance({ value }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const animRef = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const from = prevRef.current;
    if (from === value || value == null) return undefined;
    prevRef.current = value;
    animRef.setValue(0);
    const id = animRef.addListener(({ value: t }) => {
      setDisplay(from + (value - from) * t);
    });
    const animation = Animated.timing(animRef, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animRef.removeListeners(id);
      animation.stop();
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = Math.max(0, Math.round((display || 0) / 5) * 5);
  return <Text style={styles.stepDist}>In {shown} m</Text>;
}

// Maneuver tile that spring-swaps and pulses a ring when the maneuver changes
function ManeuverTile({ icon, color }) {
  const swap = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    swap.setValue(0);
    ring.setValue(0);
    Animated.spring(swap, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    Animated.timing(ring, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [icon]); // eslint-disable-line react-hooks/exhaustive-deps
  const scale = swap.interpolate({ inputRange: [0, 1], outputRange: [1.25, 1] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.7] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.45, 0] });
  return (
    <View>
      <Animated.View
        style={[styles.maneuverPulse, { backgroundColor: color, transform: [{ scale: ringScale }], opacity: ringOpacity }]}
        pointerEvents="none"
      />
      <Animated.View style={[styles.maneuverTile, { backgroundColor: color, transform: [{ scale }] }]}>
        <Text style={styles.maneuverIcon}>{icon}</Text>
      </Animated.View>
    </View>
  );
}

export default function NavCard({ navInfo, onStop, visible = true }) {
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && navInfo) {
      Animated.spring(enterAnim, {
        toValue: 1,
        friction: 8,
        tension: 45,
        useNativeDriver: true,
      }).start();
    } else {
      enterAnim.setValue(0);
    }
  }, [visible, navInfo, enterAnim]);

  if (!visible || !navInfo) return null;

  const { maneuver, phase, drSeconds, etaMin, remainingM, clock, progress, tunnelFrac } = navInfo;
  const isDr = phase === 'dr';
  const isRecovered = phase === 'recovered';

  const tileColor = isDr ? DEMO.amber : '#1A73E8';

  // State chip next to the step distance
  let chip = null;
  if (isDr && drSeconds < 10) {
    chip = { label: 'Signal Degraded', icon: '⚠', kind: 'amberOutline' };
  } else if (isDr) {
    chip = { label: 'DR Estimating', icon: null, kind: 'amberSolid' };
  } else if (isRecovered) {
    chip = { label: 'GNSS Live', icon: null, kind: 'greenOutline' };
  }

  const line2 = maneuver.toward || maneuver.instruction;

  // Progress bar geometry
  const [tunStart, tunEnd] = tunnelFrac || [0.4, 0.8];
  const knobLeft = `${Math.min(99, Math.max(1, progress * 100))}%`;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: enterAnim,
          transform: [
            { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [220, 0] }) },
          ],
        },
      ]}
    >
      {/* Row 1: maneuver + instruction + voice */}
      <View style={styles.row1}>
        <ManeuverTile icon={maneuver.icon} color={tileColor} />

        <View style={styles.instruction}>
          <View style={styles.stepRow}>
            <StepDistance value={navInfo.stepRemainingM ?? maneuver.stepM} />
            {chip ? (
              <View
                style={[
                  styles.chip,
                  chip.kind === 'amberOutline' && styles.chipAmberOutline,
                  chip.kind === 'amberSolid' && styles.chipAmberSolid,
                  chip.kind === 'greenOutline' && styles.chipGreenOutline,
                ]}
              >
                {chip.icon && <Text style={styles.chipIcon}>{chip.icon}</Text>}
                <Text
                  style={[
                    styles.chipText,
                    chip.kind === 'amberOutline' && styles.chipTextAmber,
                    chip.kind === 'amberSolid' && styles.chipTextAmberDeep,
                    chip.kind === 'greenOutline' && styles.chipTextGreen,
                  ]}
                >
                  {chip.label}
                </Text>
              </View>
            ) : (
              <Text style={styles.stepHint} numberOfLines={1}>{maneuver.instruction}</Text>
            )}
          </View>
          <Text style={styles.toward} numberOfLines={1}>{line2}</Text>
        </View>

        <View style={styles.voiceBtn}>
          <Text style={styles.voiceIcon}>🔊</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Row 2: ETA / remaining / accuracy state + stop */}
      <View style={styles.row2}>
        <View style={styles.etaBlock}>
          <View style={styles.etaLine}>
            <Text style={[styles.etaBig, !isDr && !isRecovered && styles.etaBigGreen]}>{etaMin}</Text>
            <Text style={styles.etaUnit}>min</Text>
            {isDr || isRecovered ? (
              <Text style={styles.clock}>• {clock}</Text>
            ) : null}
          </View>
          <View style={styles.etaLine2}>
            {!isDr && !isRecovered ? (
              <Text style={styles.remainingInline}>· {formatRemaining(remainingM)} remaining</Text>
            ) : (
              <Text style={styles.remaining}>{formatRemaining(remainingM)} remaining</Text>
            )}
            {isDr && (
              drSeconds < 10 ? (
                <Text style={styles.imuPrimed}>• 🚀 IMU/Odo Primed</Text>
              ) : (
                <View style={styles.imuChip}>
                  <Text style={styles.imuChipText}>IMU/Odo Active</Text>
                </View>
              )
            )}
            {isRecovered && <Text style={styles.highAcc}>• ✓ High Accuracy</Text>}
            {!isDr && !isRecovered && <Text style={styles.smooth}>• Active route · Smooth traffic</Text>}
          </View>
        </View>

        <TouchableOpacity style={styles.stopBtn} onPress={onStop} activeOpacity={0.7}>
          <Text style={styles.stopX}>✕</Text>
          <Text style={styles.stopText}>Stop</Text>
        </TouchableOpacity>
      </View>

      {/* Row 3: route profile progress bar */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barTunnel,
            { left: `${tunStart * 100}%`, width: `${(tunEnd - tunStart) * 100}%` },
          ]}
        />
        <View style={[styles.barTraveled, { width: `${Math.min(100, progress * 100)}%` }]} />
        <View style={[styles.barKnob, { left: knobLeft }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 12,
    backgroundColor: COLORS.chipTranslucent,
    borderRadius: RADIUS.modal,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    zIndex: 30,
    gap: 10,
    ...SHADOW.s4,
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  maneuverTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maneuverPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  maneuverIcon: {
    color: COLORS.textOnColor,
    fontSize: 24,
    fontWeight: '900',
  },
  instruction: {
    flex: 1,
    gap: 3,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepDist: {
    color: COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  stepHint: {
    color: COLORS.textHint,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  toward: {
    color: COLORS.textTertiary,
    fontSize: 14,
    fontWeight: '500',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    minHeight: 28,
    borderRadius: RADIUS.tag,
  },
  chipAmberOutline: {
    backgroundColor: DEMO.amberCard,
    borderWidth: 1.5,
    borderColor: DEMO.amber,
  },
  chipAmberSolid: {
    backgroundColor: COLORS.amberSoft,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  chipGreenOutline: {
    backgroundColor: DEMO.greenFill,
    borderWidth: 1.5,
    borderColor: DEMO.green,
  },
  chipIcon: {
    fontSize: 11,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  chipTextAmber: {
    color: DEMO.amberDark,
  },
  chipTextAmberDeep: {
    color: DEMO.amberDeep,
  },
  chipTextGreen: {
    color: DEMO.greenDark,
  },
  voiceBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceIcon: {
    fontSize: 17,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.surfaceBorder,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  etaBlock: {
    flex: 1,
    gap: 3,
  },
  etaLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  etaBig: {
    color: COLORS.textPrimary,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  etaBigGreen: {
    color: DEMO.green,
  },
  etaUnit: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  clock: {
    color: COLORS.textHint,
    fontSize: 14,
    fontWeight: '600',
  },
  etaLine2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  remainingInline: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  remaining: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  smooth: {
    color: DEMO.green,
    fontSize: 14,
    fontWeight: '700',
  },
  imuPrimed: {
    color: DEMO.amberDark,
    fontSize: 14,
    fontWeight: '700',
  },
  imuChip: {
    backgroundColor: DEMO.amberCard,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    minHeight: 26,
    justifyContent: 'center',
    borderRadius: RADIUS.full,
  },
  imuChipText: {
    color: DEMO.amberDeep,
    fontSize: 12,
    fontWeight: '800',
  },
  highAcc: {
    color: DEMO.green,
    fontSize: 14,
    fontWeight: '700',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.alertSoft,
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: RADIUS.full,
  },
  stopX: {
    color: COLORS.alert,
    fontSize: 13,
    fontWeight: '800',
  },
  stopText: {
    color: COLORS.alert,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: DEMO.green,
    overflow: 'visible',
  },
  barTunnel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: DEMO.amber,
    borderRadius: 3,
  },
  barTraveled: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(13, 101, 45, 0.5)',
    borderRadius: 3,
  },
  barKnob: {
    position: 'absolute',
    top: -2.5,
    width: 3,
    height: 11,
    borderRadius: 1.5,
    backgroundColor: COLORS.surface,
    ...SHADOW.s1,
  },
});
