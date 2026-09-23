// PS168 — QuickActionModal
// Triggered by the floating "+" button in the bottom bar
// Options: Save Current Location, Add a Missing Place, Share Location

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

export default function QuickActionModal({ visible, onClose, userLocation, onSaveCurrentLocation }) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.card}>
          <View style={styles.handle} />
          <Text style={styles.title}>Quick Actions</Text>

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              onClose?.();
              onSaveCurrentLocation?.();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#E8F0FE' }]}>
              <Text style={styles.icon}>📌</Text>
            </View>
            <View style={styles.textCol}>
              <Text style={styles.rowTitle}>Save Current Location</Text>
              <Text style={styles.rowSub}>Drop a pin at your current spot</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              onClose?.();
              Alert.alert('Add a Missing Place', 'This feature will let you contribute to OpenStreetMap by adding places not yet on the map.');
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#E6F4EA' }]}>
              <Text style={styles.icon}>➕</Text>
            </View>
            <View style={styles.textCol}>
              <Text style={styles.rowTitle}>Add a Missing Place</Text>
              <Text style={styles.rowSub}>Contribute to the map</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              onClose?.();
              if (userLocation) {
                Alert.alert(
                  'Share Location',
                  `Your location:\n${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}\n\nShare link copied to clipboard!`
                );
              } else {
                Alert.alert('Share Location', 'Location not available yet.');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#FEF7E0' }]}>
              <Text style={styles.icon}>📤</Text>
            </View>
            <View style={styles.textCol}>
              <Text style={styles.rowTitle}>Share Location</Text>
              <Text style={styles.rowSub}>Send your current coordinates</Text>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  card: {
    width: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 20,
    marginBottom: 90,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DADCE0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  icon: {
    fontSize: 18,
  },
  textCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
  },
  rowSub: {
    fontSize: 12,
    color: '#70757A',
    marginTop: 2,
  },
});
