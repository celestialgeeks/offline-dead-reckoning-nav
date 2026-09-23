// PS168 — Saved Places Service
// Persistent bookmark storage. All reads/writes go through the shared jsonStore
// primitive (atomic writes, per-file serialization, corrupt-file quarantine).
// Stores saved/bookmarked places + shortcut slots (home/work) to a local JSON
// file on device.

import * as FileSystem from 'expo-file-system/legacy';
import { loadJson, mutateJson } from './jsonStore';

const SAVED_PLACES_FILE = FileSystem.documentDirectory + 'saved_places.json';

const isArray = (v) => Array.isArray(v);
const opts = { fallback: [], validate: isArray };

/**
 * Load saved places from disk (cached by jsonStore after first read).
 */
export function getSavedPlaces() {
  return loadJson(SAVED_PLACES_FILE, opts);
}

/**
 * Save a place (bookmark). De-duplicates by id. Throws on write failure so the
 * caller can revert its optimistic UI.
 */
export function savePlace(place) {
  return mutateJson(SAVED_PLACES_FILE, (places) => {
    const list = Array.isArray(places) ? places : [];
    if (list.some((p) => p && p.id === place.id)) return list;
    const entry = {
      id: place.id,
      name: place.name,
      category: place.category,
      categoryLabel: place.categoryLabel,
      icon: place.icon,
      pinColor: place.pinColor,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      rating: place.rating ?? null,
      savedAt: new Date().toISOString(),
    };
    return [entry, ...list];
  }, opts);
}

/**
 * Remove a saved place.
 */
export function removePlace(id) {
  return mutateJson(
    SAVED_PLACES_FILE,
    (places) => (Array.isArray(places) ? places : []).filter((p) => p && p.id !== id),
    opts
  );
}

/**
 * Check if a place is saved.
 */
export async function isPlaceSaved(id) {
  const places = await getSavedPlaces();
  return Array.isArray(places) && places.some((p) => p && p.id === id);
}

/**
 * Assign a place to a shortcut slot ('home' | 'work'). Pass place = null to
 * clear the slot.
 */
export function setSlotPlace(slot, place) {
  return mutateJson(
    SAVED_PLACES_FILE,
    (places) => {
      const list = Array.isArray(places) ? places : [];
      const rest = list.filter((p) => p && p.slot !== slot);
      if (!place) return rest;
      return [
        {
          id: place.id,
          name: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
          address: place.address,
          category: place.category,
          slot,
          savedAt: new Date().toISOString(),
        },
        ...rest,
      ];
    },
    opts
  );
}

/**
 * Get the place assigned to a shortcut slot ('home' | 'work'), or null.
 */
export async function getSlotPlace(slot) {
  const places = await getSavedPlaces();
  return (Array.isArray(places) && places.find((p) => p && p.slot === slot)) || null;
}
