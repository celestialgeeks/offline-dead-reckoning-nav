// PS168 — Interactive Search Modal (Google Maps / Mappls style)
// Live typing autocomplete, place discovery, recent & category shortcuts

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { searchPlaces } from '../services/searchService';
import { getSavedPlaces, getSlotPlace } from '../services/savedPlacesService';
import { getRecentSearches, addRecentSearch } from '../services/settingsService';
import { CATEGORIES } from '../data/placesService';
import { COLORS, RADIUS, TYPE } from '../utils/theme';

// Time-of-day context: categories that make sense right now rank first in
// the zero-query state (Google-style contextual suggestions)
function timeOfDayBoosts() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return ['fuel', 'food', 'hospital'];
  if (h >= 11 && h < 16) return ['food', 'shop', 'atm'];
  if (h >= 16 && h < 23) return ['food', 'fuel', 'atm'];
  return ['hospital', 'fuel', 'pharmacy'];
}

// Zero-query state: Home/Work shortcuts → recents → saved (context-ranked)
async function buildDefaultResults() {
  const [recents, saved, home, work] = await Promise.all([
    getRecentSearches(),
    getSavedPlaces(),
    getSlotPlace('home'),
    getSlotPlace('work'),
  ]);
  const defaults = [];
  if (home) defaults.push({ ...home, id: 'slot_home', subtitle: 'Home', icon: '🏠', type: 'slot' });
  if (work) defaults.push({ ...work, id: 'slot_work', subtitle: 'Work', icon: '💼', type: 'slot' });
  if (recents && recents.length > 0) {
    defaults.push(...recents.map((r) => ({
      id: `recent_${r}`,
      name: r,
      type: 'recent',
      subtitle: 'Recent Search',
      icon: '🕒',
    })));
  }
  if (saved && saved.length > 0) {
    const boosts = timeOfDayBoosts();
    const rank = (p) => {
      const i = boosts.indexOf(p.category);
      return i === -1 ? 99 : i;
    };
    defaults.push(...[...saved].sort((a, b) => rank(a) - rank(b)).map((p) => ({
      ...p,
      subtitle: p.address || 'Saved Place',
      icon: p.icon || '🔖',
    })));
  }
  return defaults;
}

// Bold the matched substring of a result name while typing
function highlightName(name, query) {
  const q = query?.trim();
  if (!q || typeof name !== 'string') return name;
  const idx = name.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return name;
  return (
    <Text>
      {name.slice(0, idx)}
      <Text style={{ fontWeight: '800', color: COLORS.primary }}>
        {name.slice(idx, idx + q.length)}
      </Text>
      {name.slice(idx + q.length)}
    </Text>
  );
}

export default function SearchModal({
  visible,
  onClose,
  onSelectPlace,
  userLocation,
  bounds,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const seqRef = useRef(0);

  // Latest props without forcing the init effect to re-run. `userLocation` is a
  // fresh object reference on every GPS fix (~1s), so it must NOT be a
  // dependency of the open effect or it would wipe the query and reset the
  // list to defaults while the user is mid-typing.
  const latestRef = useRef({ userLocation, bounds });
  latestRef.current = { userLocation, bounds };

  // Auto focus input on open and load initial nearby places / saved places.
  // Runs once per open (not on every location update) so typing isn't clobbered.
  useEffect(() => {
    if (!visible) return undefined;

    // Drop any pending debounced search from a previous session and invalidate
    // in-flight results so a late response can't overwrite the fresh list.
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    ++seqRef.current;

    setQuery('');
    setLoading(true);

    buildDefaultResults().then(async (defaults) => {
      if (defaults.length > 0) {
        setResults(defaults);
        setLoading(false);
      } else {
        try {
          const { userLocation: ul, bounds: b } = latestRef.current;
          const res = await searchPlaces('', ul, 8, b);
          setResults(res);
        } catch (e) { /* aborted or offline — keep empty */ }
        setLoading(false);
      }
    });

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(focusTimer);
  }, [visible]);

  // Handle live debounced search
  const handleQueryChange = useCallback(
    (text) => {
      setQuery(text);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      if (!text.trim()) {
        // Revert to recent and saved places if empty
        buildDefaultResults().then(async (defaults) => {
          if (defaults.length > 0) {
            setResults(defaults);
          } else {
            try {
              setResults(await searchPlaces('', userLocation, 8, bounds));
            } catch (e) { /* aborted or offline — keep previous */ }
          }
        });
        return;
      }

      setLoading(true);
      searchTimeoutRef.current = setTimeout(async () => {
        const seq = ++seqRef.current;
        try {
          const places = await searchPlaces(text, userLocation, 8, bounds);
          if (seq !== seqRef.current) return; // superseded by newer typing
          setResults(places);
        } catch (e) {
          if (e?.aborted || seq !== seqRef.current) return;
          console.warn('Search query error:', e);
        } finally {
          if (seq === seqRef.current) setLoading(false);
        }
      }, 250);
    },
    [userLocation, bounds]
  );

  const handleClear = () => {
    setQuery('');
    handleQueryChange('');
  };

  const handleCategoryPress = (catLabel) => {
    handleQueryChange(catLabel);
  };

  const handleItemPress = async (item) => {
    if (item.type === 'recent') {
      handleQueryChange(item.name);
      return;
    }
    if (item.type !== 'slot') await addRecentSearch(query || item.name);
    onSelectPlace?.(item);
    onClose?.();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Search Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Search places, landmarks, hospitals..."
              placeholderTextColor={COLORS.textHint}
              value={query}
              onChangeText={handleQueryChange}
              returnKeyType="search"
              autoCorrect={false}
            />

            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
            ) : query.length > 0 ? (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={handleClear}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Quick Category Chips */}
        <View style={styles.quickChipsRow}>
          {CATEGORIES.filter((c) => c.id !== 'all')
            .slice(0, 4)
            .map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.chip}
                onPress={() => handleCategoryPress(cat.label)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipIcon}>{cat.icon}</Text>
                <Text style={styles.chipText}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
        </View>

        {/* Results List */}
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultItem}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.65}
            >
              <View style={styles.itemIconContainer}>
                <Text style={styles.itemIcon}>{item.icon || '📍'}</Text>
              </View>

              <View style={styles.itemTextContainer}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {highlightName(item.name, query)}
                </Text>
                <Text style={styles.itemSubtitle} numberOfLines={1}>
                  {item.subtitle || item.address}
                </Text>
              </View>

              {item.distanceKm != null && (
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>
                    {item.distanceKm < 1
                      ? `${item.distanceM} m`
                      : `${item.distanceKm.toFixed(1)} km`}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No places found</Text>
                <Text style={styles.emptySubtitle}>
                  Try searching for a different landmark or street
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingTop: Platform.OS === 'android' ? 28 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
    paddingVertical: 0,
  },
  loader: {
    marginLeft: 8,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    backgroundColor: '#DADCE0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  clearText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontWeight: '700',
  },
  quickChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceDim,
    paddingHorizontal: 14,
    minHeight: 34,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    gap: 5,
  },
  chipIcon: {
    fontSize: 13,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  listContent: {
    paddingVertical: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceDim,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemIcon: {
    fontSize: 20,
  },
  itemTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  itemSubtitle: {
    ...TYPE.sub,
  },
  distanceBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
    color: COLORS.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
});
