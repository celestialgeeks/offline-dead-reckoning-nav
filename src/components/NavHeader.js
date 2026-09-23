// PS168 — NavHeader (Google Maps style turn-by-turn green top banner)
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../utils/theme';

// Maneuver circle that spring-swaps with a pulse ring when the turn changes
function ManeuverCircle({ icon }) {
  const swap = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    swap.setValue(0);
    ring.setValue(0);
    Animated.spring(swap, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    Animated.timing(ring, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [icon]); // eslint-disable-line react-hooks/exhaustive-deps
  const scale = swap.interpolate({ inputRange: [0, 1], outputRange: [1.25, 1] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.7] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.45, 0] });
  return (
    <View>
      <Animated.View
        style={[styles.maneuverCircle, styles.maneuverPulse, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
        pointerEvents="none"
      />
      <Animated.View style={[styles.maneuverCircle, { transform: [{ scale }] }]}>
        <Text style={styles.maneuverIcon}>{icon}</Text>
      </Animated.View>
    </View>
  );
}

export default function NavHeader({
  visible,
  destination,
  distanceKm,
  etaMinutes,
  maneuver,
  onExit,
}) {
  if (!visible || !destination) return null;

  const formatDistanceM = (m) => {
    if (m == null) return '0 m';
    if (m < 1000) return `${Math.round(m).toLocaleString()} m`;
    return `${(m / 1000).toFixed(1)} km`;
  };

  const distText = distanceKm != null ? formatDistanceM(distanceKm * 1000) : '250 m';

  const formatEta = (mins) => {
    if (!mins) return '1 min';
    if (mins < 60) return `${Math.max(1, Math.round(mins))} min`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h >= 24) {
      const d = Math.floor(h / 24);
      const remH = h % 24;
      return `${d}d ${remH}h`;
    }
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
  };

  const etaText = etaMinutes != null ? formatEta(etaMinutes) : '5 min';

  const maneuverIcon = maneuver?.icon || '↱';
  const maneuverInstruction = maneuver?.instruction || `Head toward ${destination.name}`;
  const stepDistText = maneuver?.distanceM != null
    ? formatDistanceM(maneuver.distanceM)
    : distText;

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        {/* Maneuver Arrow Icon */}
        <ManeuverCircle icon={maneuverIcon} />

        {/* Turn instruction */}
        <View style={styles.instructionContainer}>
          <Text style={styles.distToTurn}>{stepDistText}</Text>
          <Text style={styles.turnStreet} numberOfLines={1}>
            {maneuverInstruction}
          </Text>
        </View>

        {/* Close / Exit navigation button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onExit} activeOpacity={0.7}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-bar: ETA and destination summary */}
      <View style={styles.subBar}>
        <View style={styles.etaRow}>
          <Text style={styles.etaGreen}>{etaText}</Text>
          <Text style={styles.dotSeparator}>·</Text>
          <Text style={styles.subText}>{distText}</Text>
          <Text style={styles.dotSeparator}>·</Text>
          <Text style={styles.destName} numberOfLines={1}>{destination.name}</Text>
        </View>
        <TouchableOpacity style={styles.stopChip} onPress={onExit}>
          <Text style={styles.stopChipText}>Exit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    ...SHADOW.s4,
  },
  banner: {
    backgroundColor: COLORS.navGreen, // Authentic Google Maps navigation dark green
    paddingTop: Platform.OS === 'android' ? 44 : 54,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  maneuverCircle: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  maneuverPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    marginRight: 0,
  },
  maneuverIcon: {
    color: COLORS.textOnColor,
    fontSize: 24,
    fontWeight: '800',
  },
  instructionContainer: {
    flex: 1,
  },
  distToTurn: {
    color: COLORS.textOnColor,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  turnStreet: {
    color: 'rgba(255, 255, 255, 0.94)',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  closeText: {
    color: COLORS.textOnColor,
    fontSize: 15,
    fontWeight: '700',
  },
  subBar: {
    backgroundColor: '#137333',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: RADIUS.card,
    borderBottomRightRadius: RADIUS.card,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  etaGreen: {
    color: '#A8DAB5',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  dotSeparator: {
    color: 'rgba(255,255,255,0.6)',
    marginHorizontal: 6,
    fontSize: 14,
  },
  subText: {
    color: COLORS.textOnColor,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  destName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  stopChip: {
    backgroundColor: COLORS.alert,
    paddingHorizontal: 16,
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: RADIUS.full,
  },
  stopChipText: {
    color: COLORS.textOnColor,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
