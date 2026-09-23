// PS168 — PlaceCard (Google Maps Style)
// Bottom detail sheet when a POI is selected
// Displays ratings, open hours, distance/ETA, and action buttons

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Linking, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { savePlace, removePlace, isPlaceSaved } from '../services/savedPlacesService';
import { COLORS, RADIUS, SHADOW, TYPE } from '../utils/theme';

export default function PlaceCard({
  place,
  onClose,
  onDirections,
  onStartNavigation,
}) {
  const [isSaved, setIsSaved] = useState(false);

  // Reset saved state when place changes
  useEffect(() => {
    if (place?.id) {
      isPlaceSaved(place.id).then(setIsSaved);
    } else {
      setIsSaved(false);
    }
  }, [place?.id]);

  const handleToggleSave = async () => {
    const next = !isSaved;
    try {
      if (isSaved) {
        await removePlace(place.id);
      } else {
        await savePlace(place);
      }
      // Only commit the optimistic UI flip after the write actually lands.
      setIsSaved(next);
    } catch (err) {
      console.warn('[PlaceCard] save toggle failed:', err);
      Alert.alert('Not saved', 'Could not update your saved places. Please try again.');
    }
  };

  if (!place) return null;

  const formatDistanceM = (m) => {
    if (m == null) return '0 m';
    if (m < 1000) return `${Math.round(m).toLocaleString()} m`;
    return `${(m / 1000).toFixed(1)} km`;
  };
  const distText = formatDistanceM(place.distanceM);

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
  const etaText = formatEta(place.etaMin);
  // Real photos if available, else static deterministic fallback
  const photoUrl = place.photoUrl || `https://picsum.photos/seed/${place.id}/400/200`;
  // Google Places licensing: results shown on a non-Google basemap need attribution
  const showGoogleAttribution = place.source === 'google' || !!place.attribution;

  const handleShare = async () => {
    try {
      // MapLibre doesn't have a direct URL, so share standard OSM link
      const url = `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=18/${place.latitude}/${place.longitude}`;
      await Sharing.shareAsync(url, { dialogTitle: `Share ${place.name}` });
    } catch (e) {}
  };

  const handleCall = () => {
    if (place.phone) Linking.openURL(`tel:${place.phone}`);
  };

  const handleWebsite = () => {
    if (place.website) Linking.openURL(place.website);
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: photoUrl }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {/* Header with Title */}
        <View style={styles.header}>
          <View style={styles.titleArea}>
            <Text style={styles.title} numberOfLines={1}>
              {place.name}
            </Text>
            <Text style={styles.categoryLabel}>
              {place.categoryLabel}
            </Text>
          </View>
        </View>

        {/* Ratings & Status Row — rating/reviews are omitted when the data
            source doesn't provide them (no fabricated values). */}
        {(place.rating != null || place.status) && (
          <View style={styles.metaRow}>
            {place.rating != null && (
              <>
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingStar}>★</Text>
                  <Text style={styles.ratingText}>{place.rating}</Text>
                </View>
                {place.reviews != null && (
                  <Text style={styles.reviewsText}>
                    ({place.reviews?.toLocaleString?.() || place.reviews})
                  </Text>
                )}
              </>
            )}
            {place.rating != null && place.status && (
              <Text style={styles.dot}>•</Text>
            )}
            {place.status && <Text style={styles.statusText}>{place.status}</Text>}
          </View>
        )}

        {/* Distance and Address */}
        <View style={styles.addressRow}>
          <Text style={styles.distanceBadge}>{distText}</Text>
          <Text style={styles.etaBadge}>🚗 {etaText}</Text>
        </View>
        <Text style={styles.addressText} numberOfLines={1}>
          {place.address}
        </Text>

        <View style={styles.divider} />

        {/* Google Maps Action Buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionsScroll} contentContainerStyle={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.directionsBtn]}
            onPress={() => onDirections?.(place)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>📍</Text>
            <Text style={styles.directionsBtnText}>Directions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.startBtn]}
            onPress={() => onStartNavigation?.(place)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>▶</Text>
            <Text style={styles.startBtnText}>Start Nav</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.saveBtn, isSaved && styles.savedBtnActive]}
            onPress={handleToggleSave}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>{isSaved ? '🔖' : '📑'}</Text>
            <Text style={[styles.saveBtnText, isSaved && styles.savedBtnTextActive]}>
              {isSaved ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.secondaryBtn]}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>🔗</Text>
            <Text style={styles.secondaryBtnText}>Share</Text>
          </TouchableOpacity>

          {!!place.phone && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.secondaryBtn]}
              onPress={handleCall}
              activeOpacity={0.8}
            >
              <Text style={styles.actionIcon}>📞</Text>
              <Text style={styles.secondaryBtnText}>Call</Text>
            </TouchableOpacity>
          )}

          {!!place.website && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.secondaryBtn]}
              onPress={handleWebsite}
              activeOpacity={0.8}
            >
              <Text style={styles.actionIcon}>🌐</Text>
              <Text style={styles.secondaryBtnText}>Website</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {showGoogleAttribution && (
          <Text style={styles.attributionText}>Powered by Google</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    bottom: 16,
    left: 8,
    right: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.modal,
    zIndex: 20,
    ...SHADOW.s4,
    overflow: 'hidden', // to clip the image to the top borders
  },
  imageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
    backgroundColor: COLORS.surfaceSoft,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.chipTranslucent,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.s2,
  },
  closeIcon: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  contentContainer: {
    padding: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleArea: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: COLORS.textPrimary,
  },
  categoryLabel: {
    ...TYPE.sub,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navGreenSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.tag,
  },
  ratingStar: {
    fontSize: 11,
    color: COLORS.navGreen,
    marginRight: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
    color: COLORS.navGreen,
  },
  reviewsText: {
    fontSize: 12,
    color: COLORS.textHint,
    marginLeft: 6,
  },
  dot: {
    fontSize: 12,
    color: COLORS.textHint,
    marginHorizontal: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.navGreenBright,
  },
  addressRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceBadge: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: COLORS.textPrimary,
  },
  etaBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textTertiary,
    marginLeft: 8,
  },
  addressText: {
    ...TYPE.sub,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.surfaceBorder,
    marginVertical: 12,
  },
  actionsScroll: {
    marginTop: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16, // to ensure scroll isn't clipped
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    marginRight: 8,
  },
  directionsBtn: {
    backgroundColor: COLORS.primary,
  },
  directionsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textOnColor,
    marginLeft: 5,
  },
  startBtn: {
    backgroundColor: COLORS.navGreen,
  },
  startBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textOnColor,
    marginLeft: 5,
  },
  saveBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  savedBtnActive: {
    backgroundColor: COLORS.alertSoft,
    borderColor: COLORS.alertSoft,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginLeft: 5,
  },
  savedBtnTextActive: {
    color: COLORS.alert,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginLeft: 5,
  },
  actionIcon: {
    fontSize: 13,
  },
  attributionText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.textHint,
    marginTop: 10,
    letterSpacing: 0.1,
  },
});
