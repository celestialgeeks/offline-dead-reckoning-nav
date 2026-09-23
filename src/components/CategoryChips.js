// PS168 — CategoryChips (Google Maps Style with SVG Icons)
// Horizontal scrolling pill-shaped shortcut buttons below the search bar
// Filter by All Places, Hospitals, Petrol, Restaurants, Pharmacies, ATMs, Groceries
// With authentic Google Maps material design vector icons

import React, { useRef } from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View, Platform, StatusBar, Animated } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { CATEGORIES } from '../data/placesService';
import { COLORS, RADIUS, SHADOW, SPRING } from '../utils/theme';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

// ─── SVG Icon Components matching Google Maps category visuals ──────────

function CompassIcon({ size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#1A73E8" />
      <Path d="M6.5 17.5l8-4.5-4.5 8-3.5-3.5zm5.5-5.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" fill="#1A73E8" />
    </Svg>
  );
}

function HospitalIcon({ size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" fill="#EA4335" />
    </Svg>
  );
}

function FuelIcon({ size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5z" fill="#1A73E8" />
    </Svg>
  );
}

function RestaurantIcon({ size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" fill="#FA7B17" />
    </Svg>
  );
}

function PharmacyIcon({ size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M10.5 15H8v-3h2.5V9.5h3V12H16v3h-2.5v2.5h-3V15zM19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" fill="#34A853" />
    </Svg>
  );
}

function AtmIcon({ size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12z" fill="#0F9D58" />
      <Path d="M11.5 16.5h1v-1h.5c.55 0 1-.45 1-1v-2c0-.55-.45-1-1-1H11v-1h3V9.5h-1v-1h-1v1h-.5c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1H13v1h-3v1h1v1z" fill="#0F9D58" />
    </Svg>
  );
}

function GroceryIcon({ size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" fill="#9C27B0" />
    </Svg>
  );
}

// Map category ID to its SVG icon component
const ICON_MAP = {
  all: CompassIcon,
  hospital: HospitalIcon,
  fuel: FuelIcon,
  food: RestaurantIcon,
  pharmacy: PharmacyIcon,
  atm: AtmIcon,
  shop: GroceryIcon,
};

// Chip with a subtle spring press scale (Google Maps feedback feel)
function ChipButton({ selected, onPress, children }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.94, ...SPRING }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, ...SPRING }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.chip, selected && styles.chipSelected]}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CategoryChips({ selectedCategory = 'all', onSelectCategory, visible = true }) {
  if (!visible) return null;
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const IconComp = ICON_MAP[cat.id] || CompassIcon;
          return (
            <ChipButton
              key={cat.id}
              selected={isSelected}
              onPress={() => onSelectCategory?.(isSelected && cat.id !== 'all' ? 'all' : cat.id)}
            >
              <IconComp size={16} />
              <Text
                style={[
                  styles.label,
                  isSelected && styles.labelSelected,
                ]}
              >
                {cat.label}
              </Text>
            </ChipButton>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: STATUS_BAR_HEIGHT + 62,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  container: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    minHeight: 38,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    gap: 7,
    ...SHADOW.s1,
  },
  chipSelected: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    letterSpacing: -0.1,
  },
  labelSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
