// PS168 — Edge Mode Toggle (Layer 2)
// Toggle switch: "Phone 10Hz" ⇄ "Edge 200Hz"
// Stub: only changes label, no real edge device connection
// 200Hz path for finale (M4)

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

export default function EdgeModeToggle({ visible = true }) {
  const [isEdge, setIsEdge] = useState(false);

  if (!visible) return null;

  return (
    <TouchableOpacity
      style={[styles.toggle, isEdge && styles.toggleActive]}
      onPress={() => setIsEdge(!isEdge)}
      activeOpacity={0.7}
    >
      <View style={[styles.indicator, isEdge && styles.indicatorActive]} />
      <Text style={[styles.label, isEdge && styles.labelActive]}>
        {isEdge ? 'Edge 200Hz' : 'Phone 10Hz'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggle: {
    position: 'absolute',
    left: 16,
    bottom: 120,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
    gap: 6,
  },
  toggleActive: {
    backgroundColor: '#E8F5E9',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textHint,
  },
  indicatorActive: {
    backgroundColor: COLORS.passGreen,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  labelActive: {
    color: '#2E7D32',
  },
});
