// PS168 — SavedPlacesModal (My Saves tab sheet)
// Lists all bookmarked/saved places with View on Map, Directions, and Remove actions

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { getSavedPlaces, removePlace } from '../services/savedPlacesService';

export default function SavedPlacesModal({ visible, onClose, onViewOnMap, onDirections }) {
  const [places, setPlaces] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (visible) {
      getSavedPlaces().then(setPlaces);
    }
  }, [visible, refreshKey]);

  const handleRemove = useCallback((id, name) => {
    Alert.alert(
      'Remove Saved Place',
      `Remove "${name}" from your saves?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removePlace(id);
              setRefreshKey(k => k + 1);
            } catch (err) {
              console.warn('[SavedPlacesModal] remove failed:', err);
              Alert.alert('Not removed', 'Could not delete this saved place. Please try again.');
            }
          },
        },
      ]
    );
  }, []);

  if (!visible) return null;

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <View style={[styles.iconBadge, { backgroundColor: item.pinColor || '#1A73E8' }]}>
        <Text style={styles.iconText}>{item.icon || '📍'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.address} numberOfLines={1}>
          {item.categoryLabel || item.category} • {item.address || 'Saved place'}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => {
          onClose?.();
          onViewOnMap?.(item);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.actionBtnText}>Map</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, styles.directionsBtn]}
        onPress={() => {
          onClose?.();
          onDirections?.(item);
        }}
        activeOpacity={0.7}
      >
        <Text style={[styles.actionBtnText, styles.directionsBtnText]}>Go</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => handleRemove(item.id, item.name)}
        activeOpacity={0.7}
      >
        <Text style={styles.removeIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerIcon}>🔖</Text>
            <Text style={styles.headerTitle}>My Saves</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {places.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📑</Text>
              <Text style={styles.emptyTitle}>No saved places yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the Save button on any place card to bookmark it here
              </Text>
            </View>
          ) : (
            <FlatList
              data={places}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '70%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  headerIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#202124',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F3F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 14,
    color: '#5F6368',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 16,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
  },
  address: {
    fontSize: 11,
    color: '#70757A',
    marginTop: 2,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F1F3F4',
    marginRight: 6,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3C4043',
  },
  directionsBtn: {
    backgroundColor: '#1A73E8',
  },
  directionsBtnText: {
    color: '#FFFFFF',
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FCE8E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    fontSize: 11,
    color: '#D93025',
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#70757A',
    textAlign: 'center',
    lineHeight: 19,
  },
});
