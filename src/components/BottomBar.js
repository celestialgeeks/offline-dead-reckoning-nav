// PS168 — BottomBar (Google Maps-style Floating Navigation Bar)
// White theme floating capsule with Explore, My Saves, Gadgets tabs + floating "+" FAB
// Matches the user's reference image precisely

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { COLORS, RADIUS, SHADOW } from '../utils/theme';

// ─── SVG Icon Components ────────────────────────────────────────────────

// Explore: Map fold icon (Google Maps style)
function ExploreIcon({ color = '#5F6368', size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.5 3l-0.16 0.03L15 5.1 9 3 3.36 4.9c-0.21 0.07-0.36 0.25-0.36 0.48V20.5c0 0.28 0.22 0.5 0.5 0.5l0.16-0.03L9 18.9l6 2.1 5.64-1.9c0.21-0.07 0.36-0.25 0.36-0.48V3.5c0-0.28-0.22-0.5-0.5-0.5zM15 19l-6-2.11V5l6 2.11V19z"
        fill={color}
      />
    </Svg>
  );
}

// My Saves: Bookmark icon
function BookmarkIcon({ color = '#5F6368', size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"
        fill={color}
      />
    </Svg>
  );
}

// Gadgets: Devices icon (screen + phone)
function GadgetsIcon({ color = '#5F6368', size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6z"
        fill={color}
      />
      <Path
        d="M23 8h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"
        fill={color}
      />
    </Svg>
  );
}

// Plus icon for Contribute tab
function PlusIcon({ color = '#5F6368', size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
        fill={color}
      />
    </Svg>
  );
}

// You icon (Profile)
function YouIcon({ color = '#5F6368', size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        fill={color}
      />
    </Svg>
  );
}

// ─── Tab Data ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'explore', label: 'Explore', Icon: ExploreIcon },
  { id: 'saves', label: 'My Saves', Icon: BookmarkIcon },
  { id: 'contribute', label: '', Icon: PlusIcon, isFab: true },
  { id: 'you', label: 'You', Icon: YouIcon },
];

export default function BottomBar({
  activeTab = 'explore',
  onTabPress,
  onPlusPress,
  visible = true,
}) {
  if (!visible) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.capsule}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const iconColor = tab.isFab ? '#FFFFFF' : isActive ? COLORS.primary : COLORS.textTertiary;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => {
                if (tab.id === 'contribute') {
                  onPlusPress?.();
                } else {
                  onTabPress?.(tab.id);
                }
              }}
              activeOpacity={0.7}
            >
              {tab.isFab ? (
                <View style={styles.fab}>
                  <tab.Icon color="#FFFFFF" size={24} />
                </View>
              ) : (
                <>
                  <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                    <tab.Icon color={iconColor} size={22} />
                  </View>
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 15,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.modal,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 60,
    ...SHADOW.s4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  iconContainer: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    marginBottom: 2,
  },
  iconContainerActive: {
    backgroundColor: COLORS.primarySoft,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.s2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textTertiary,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
