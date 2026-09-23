// PS168 — Map Controls (Layer 1)
// Google Maps 3-state Location FAB (Free / Follow / Compass) + Zoom in/out controls
// Positioned bottom-right of the map

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../utils/theme';

export default function MapControls({
  onRecenter,
  onZoomIn,
  onZoomOut,
  trackingMode = 'free', // 'free' | 'follow' | 'compass'
  bottomOffset,
}) {
  const isFollowing = trackingMode === 'follow';
  const isCompass = trackingMode === 'compass';

  return (
    <View style={[styles.container, bottomOffset != null && { bottom: bottomOffset }]}>
      {/* 3-State Google Maps Location FAB */}
      <TouchableOpacity
        style={[
          styles.button,
          (isFollowing || isCompass) && styles.buttonActive,
        ]}
        onPress={onRecenter}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.icon,
            (isFollowing || isCompass) && styles.iconActive,
          ]}
        >
          {isCompass ? '🧭' : isFollowing ? '⦿' : '◎'}
        </Text>
      </TouchableOpacity>

      {/* Zoom controls */}
      <View style={styles.zoomGroup}>
        <TouchableOpacity
          style={[styles.button, styles.zoomTop]}
          onPress={onZoomIn}
          activeOpacity={0.7}
        >
          <Text style={styles.zoomIcon}>＋</Text>
        </TouchableOpacity>
        <View style={styles.zoomSep} />
        <TouchableOpacity
          style={[styles.button, styles.zoomBottom]}
          onPress={onZoomOut}
          activeOpacity={0.7}
        >
          <Text style={styles.zoomIcon}>−</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    zIndex: 10,
    alignItems: 'center',
    gap: 12,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.s3,
  },
  buttonActive: {
    backgroundColor: COLORS.primarySoft,
  },
  icon: {
    fontSize: 22,
    color: COLORS.textTertiary,
  },
  iconActive: {
    color: COLORS.primary,
  },
  zoomGroup: {
    borderRadius: RADIUS.capsule,
    overflow: 'hidden',
    ...SHADOW.s3,
  },
  zoomTop: {
    borderRadius: 0,
    borderTopLeftRadius: RADIUS.capsule,
    borderTopRightRadius: RADIUS.capsule,
  },
  zoomBottom: {
    borderRadius: 0,
    borderBottomLeftRadius: RADIUS.capsule,
    borderBottomRightRadius: RADIUS.capsule,
  },
  zoomSep: {
    height: 1,
    backgroundColor: COLORS.surfaceBorder,
  },
  zoomIcon: {
    fontSize: 22,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
