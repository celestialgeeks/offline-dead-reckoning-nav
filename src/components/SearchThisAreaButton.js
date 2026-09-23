// PS168 — SearchThisAreaButton (Google Maps Style)
// Floating button that appears when user pans away from current POI cluster
// Loads amenities for the newly visible location on-demand

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';

export default function SearchThisAreaButton({ visible, onPress }) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.icon}>🔍</Text>
        <Text style={styles.text}>Search this area</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 164,
    alignSelf: 'center',
    zIndex: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  icon: {
    fontSize: 13,
    marginRight: 6,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A73E8',
  },
});
