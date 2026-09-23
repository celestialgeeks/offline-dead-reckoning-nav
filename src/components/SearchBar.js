// PS168 — Search Bar with User Avatar Menu (Google Maps / Mappls style)
// Tapping search area opens SearchModal; tapping avatar opens UserMenuModal
// Edge-to-edge layout with small 8px margin, positioned just below status bar

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../utils/theme';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

export default function SearchBar({ onPressSearch, onPressUserMenu, rightOffset = 8 }) {
  return (
    <View style={[styles.container, { right: rightOffset }]}>
      <View style={styles.pill}>
        {/* Search Tap Area */}
        <TouchableOpacity
          style={styles.searchTouchable}
          onPress={onPressSearch}
          activeOpacity={0.7}
        >
          <Text style={styles.icon}>🔍</Text>
          <Text style={styles.placeholder}>Search here</Text>
        </TouchableOpacity>

        {/* User Profile Avatar Dropdown Button */}
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={onPressUserMenu}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID="user-menu-avatar"
          accessibilityLabel="user-menu-avatar"
        >
          <View style={styles.avatarInner}>
            <Text style={styles.avatarLetter}>B</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: STATUS_BAR_HEIGHT + 8,
    left: 8,
    right: 8,
    zIndex: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.control,
    paddingLeft: 16,
    paddingRight: 8,
    minHeight: 48,
    paddingVertical: 8,
    ...SHADOW.s3,
  },
  searchTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  icon: {
    fontSize: 16,
    marginRight: 12,
  },
  placeholder: {
    fontSize: 15,
    color: COLORS.textTertiary,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  avatarBtn: {
    padding: 2,
  },
  avatarInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primarySoft,
  },
  avatarLetter: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textOnColor,
  },
});
