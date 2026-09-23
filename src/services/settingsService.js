// PS168 — Settings Service
// User preferences + recent-search history. Storage goes through the shared
// jsonStore primitive (atomic writes, per-file serialization, corrupt-file
// quarantine). saveSettings always merges onto the CURRENT on-disk value, so a
// partial save can never drop keys it didn't touch (e.g. a stored geocoder key).

import * as FileSystem from 'expo-file-system/legacy';
import { loadJson, mutateJson, removeJson } from './jsonStore';
import { clearPlacesCache } from '../data/placesService';

const SETTINGS_FILE = FileSystem.documentDirectory + 'settings.json';
const SEARCH_HISTORY_FILE = FileSystem.documentDirectory + 'search_history.json';

const DEFAULT_SETTINGS = { units: 'metric', voiceGuidance: true };

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isArray = (v) => Array.isArray(v);
const settingsOpts = { fallback: {}, validate: isObj };
const historyOpts = { fallback: [], validate: isArray };

export async function getSettings() {
  const stored = await loadJson(SETTINGS_FILE, settingsOpts);
  return { ...DEFAULT_SETTINGS, ...(isObj(stored) ? stored : {}) };
}

export function saveSettings(settings) {
  return mutateJson(
    SETTINGS_FILE,
    (current) => {
      const base = isObj(current) ? current : {};
      return { ...DEFAULT_SETTINGS, ...base, ...settings };
    },
    settingsOpts
  );
}

export function getRecentSearches() {
  return loadJson(SEARCH_HISTORY_FILE, historyOpts);
}

export function addRecentSearch(query) {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return getRecentSearches();
  }
  return mutateJson(
    SEARCH_HISTORY_FILE,
    (history) => {
      const list = Array.isArray(history) ? history : [];
      const filtered = list.filter((q) => String(q).toLowerCase() !== query.toLowerCase());
      return [query, ...filtered].slice(0, 10);
    },
    historyOpts
  );
}

export async function clearAllData() {
  try {
    await removeJson(SEARCH_HISTORY_FILE, historyOpts);
  } catch (err) {
    console.warn('[settingsService] Clear history failed:', err);
  }
  if (clearPlacesCache) clearPlacesCache();
}
