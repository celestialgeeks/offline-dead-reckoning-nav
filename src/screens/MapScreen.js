// PS168 — Map Screen (Production Maps App Architecture)
// Google Maps / Mappls style UX with Real-Time Dead-Reckoning Engine
//
// Layer 0: BaseMap (on-demand OpenFreeMap Liberty vector tiles via MapLibre)
// Layer 1: SearchBar + User Profile Menu + SearchModal + CategoryChips + SearchThisArea +
//          POIMarkers + PlaceCard + NavHeader + RouteLayer (OSRM) + 3-State MapControls +
//          LocalityLabels + BottomBar + SavedPlaces + QuickActions
// Layer 2: Real-time Dead-Reckoning Engine (VehicleDot, Ellipse, Trail, HUD badges)

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Alert,
  TouchableOpacity,
  Text,
  BackHandler,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Layer 0
import BaseMap from '../map/BaseMap';

// Layer 1: UI & Services
import SearchBar from '../components/SearchBar';
import SearchModal from '../components/SearchModal';
import UserMenuModal from '../components/UserMenuModal';
import CategoryChips from '../components/CategoryChips';
import SearchThisAreaButton from '../components/SearchThisAreaButton';
import POIMarkers from '../components/POIMarkers';
import PlaceCard from '../components/PlaceCard';
import NavHeader from '../components/NavHeader';
import RouteLayer from '../components/RouteLayer';
import UserLocationDot from '../components/UserLocationDot';
import { reverseGeocode } from '../services/searchService';
import MapControls from '../components/MapControls';
import UpdateModal from '../components/UpdateModal';
import LocalityLabels from '../components/LocalityLabels';
import BottomBar from '../components/BottomBar';
import SavedPlacesModal from '../components/SavedPlacesModal';
import QuickActionModal from '../components/QuickActionModal';
import OfflineMapsModal from '../components/OfflineMapsModal';
import SettingsModal from '../components/SettingsModal';
import WeatherChip from '../components/WeatherChip';
import useLocation from '../hooks/useLocation';
import { fetchPlaces, calculateDistance, calculateETA } from '../data/placesService';
import { getDrivingRoute } from '../services/routingService';
import { checkForUpdates, getSnoozedVersion, snoozeUpdate } from '../services/updateService';
import { savePlace } from '../services/savedPlacesService';
import { INDORE, DR_DEMO } from '../utils/constants';

// Layer 2: Engine
import VehicleDot from '../components/VehicleDot';
import ConfidenceEllipse from '../components/ConfidenceEllipse';
import Trail from '../components/Trail';
import StatusBadge from '../components/StatusBadge';
import DriftMeter from '../components/DriftMeter';
import SatChip from '../components/SatChip';
import NavCard from '../components/NavCard';
import DebugMenu from '../screens/DebugMenu';
import useEngine from '../hooks/useEngine';
import ResultsSheet from '../sheets/ResultsSheet';
import RunControlsSheet from '../sheets/RunControlsSheet';
import { loadBundledReplay } from '../data/replayLoader';
import ImuOdoChip from '../components/ImuOdoChip';
import DemoRouteLayer from '../components/DemoRouteLayer';
import TunnelGates from '../components/TunnelGates';
import BenchmarkBanner from '../components/BenchmarkBanner';
import SignalBanner from '../components/SignalBanner';

// ── HUD layout constants ───────────────────────────────────────────────────
// The top-of-screen demo overlays (signal banner, drift meter, sat/IMU chips,
// benchmark banner) used to each hard-code their own `top`, so when several
// became active at once they stacked on top of one another. They now live in a
// single flex column (styles.hudStack) that starts just below the search pill
// and lays each active overlay out on its own row — no overlap by construction.
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;
const HUD_STACK_TOP = STATUS_BAR_HEIGHT + 64;

// Overlay components render `position:'absolute'` standalone; inside the stack
// the parent owns vertical placement, so we neutralise their own offsets.
const STACK_ITEM = {
  position: 'relative',
  top: 'auto',
  left: 'auto',
  right: 'auto',
  alignSelf: 'auto',
  // NOTE: 'auto' is not a valid zIndex in the New Architecture (native casts it
  // to Double and throws "String cannot be cast to Double"). 0 neutralises each
  // child's own absolute zIndex so siblings stack in mount order instead.
  zIndex: 0,
};
// Benchmark banner is full-width: stretch it across the stack instead of centring.
const STACK_ITEM_STRETCH = { ...STACK_ITEM, alignSelf: 'stretch', minWidth: 0 };

// Android needs the experimental flag flipped before LayoutAnimation runs —
// this is what smoothly pushes the lower overlays down as new ones appear.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MapScreen() {
  // Refs
  const mapRef = useRef(null);
  const runSheetRef = useRef(null);

  // Layer 1: GPS & Location
  const { position, smoothPosition, heading, accuracy, permissionGranted } = useLocation();

  // Layer 1: 3-state tracking ('free' | 'follow' | 'compass')
  // 'free' allows user to scroll anywhere without spring-back
  const [trackingMode, setTrackingMode] = useState('follow');

  // Layer 1: Places & Amenities
  // No category pre-selected: chips start unselected and the user must tap
  // one to filter. Viewport fetches fall back to 'all' (see `|| 'all'` below).
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showSearchAreaBtn, setShowSearchAreaBtn] = useState(false);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [currentBounds, setCurrentBounds] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(14);
  const [placesError, setPlacesError] = useState(false);
  const searchDebounceTimer = useRef(null);
  // Monotonic token so an in-flight viewport fetch that has been superseded by a
  // newer one (rapid panning / category switch) can't clobber the current
  // results — the classic stale-response overwrite.
  const placesReqRef = useRef(0);

  // Single, sequence-guarded viewport fetch used by the region-debounce,
  // "search this area", and category-chip paths.
  const runViewportFetch = useCallback(
    async (category, bounds, zoom) => {
      const reqId = ++placesReqRef.current;
      setIsSearchingPlaces(true);
      setPlacesError(false);
      try {
        const results = await fetchPlaces(category, bounds, position, zoom);
        if (reqId !== placesReqRef.current) return; // superseded
        setPlaces(results);
      } catch (e) {
        if (reqId !== placesReqRef.current) return; // superseded
        // Viewport fetch failed: clear pins from the stale area and offer retry
        setPlaces([]);
        setPlacesError(true);
        console.warn('Viewport fetch places error:', e);
      } finally {
        if (reqId === placesReqRef.current) setIsSearchingPlaces(false);
      }
    },
    [position]
  );

  // Center of the visible viewport — reference point for distance/ETA
  // readouts when GPS is unavailable (never a hard-coded city)
  const viewportCenter = useMemo(() => {
    if (!currentBounds || currentBounds.length !== 4) return null;
    return {
      latitude: (currentBounds[1] + currentBounds[3]) / 2,
      longitude: (currentBounds[0] + currentBounds[2]) / 2,
    };
  }, [currentBounds]);

  // Layer 1: Search & User Modals
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showOfflineMaps, setShowOfflineMaps] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsType, setSettingsType] = useState('settings');
  const [mapType, setMapType] = useState('default');

  // Layer 1: Turn-by-turn navigation & Routing
  const [isNavigating, setIsNavigating] = useState(false);
  const [navDestination, setNavDestination] = useState(null);
  const [routeData, setRouteData] = useState(null);

  // Layer 1: In-App GitHub Auto-Updater
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Layer 1: Bottom Bar, Saved Places, Quick Actions
  const [activeBottomTab, setActiveBottomTab] = useState('explore');
  const [showSavedPlaces, setShowSavedPlaces] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Layer 2: Engine
  const {
    engineState,
    trail,
    driftStats,
    drSeconds,
    gnssQuality,
    navInfo,
    benchmarkSnapshot,
    tunnelCleared,
    replayMeta,
    isRunning,
    isCalibrating,
    calibrateCountdown,
    frozenResults,
    sessionSaved,
    startCalibration,
    skipCalibration,
    stopRun,
    resetSession,
    simulatedOutage,
    simulateOutageStart,
    simulateOutageEnd,
  } = useEngine();

  // Layer 2: Demo run UI state
  const [showRunSheet, setShowRunSheet] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  // Set when the user explicitly dismisses the results modal, so the auto-reopen
  // effect below won't immediately re-arm it. Cleared when a new run starts.
  const [resultsDismissed, setResultsDismissed] = useState(false);

  // Debug menu (accessible via User Menu -> Diagnostics or triple tap badge)
  const [debugVisible, setDebugVisible] = useState(false);
  const badgeTapCountRef = useRef(0);
  const badgeTapTimerRef = useRef(null);

  const handleBadgeTap = useCallback(() => {
    badgeTapCountRef.current++;
    if (badgeTapTimerRef.current) clearTimeout(badgeTapTimerRef.current);
    badgeTapTimerRef.current = setTimeout(() => {
      badgeTapCountRef.current = 0;
    }, 500);
    if (badgeTapCountRef.current >= 3) {
      setDebugVisible(true);
      badgeTapCountRef.current = 0;
    }
  }, []);

  const appState = frozenResults
    ? 'completed'
    : isCalibrating
      ? 'calibrating'
      : isRunning
        ? 'running'
        : 'idle';

  // POIs are loaded strictly viewport-driven: the first onRegionDidChange
  // (fired once the camera settles) triggers the initial fetch for exactly
  // the area on screen — no city is preloaded at startup.

  // In-App GitHub Auto-Updater: check on startup after 3s
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const info = await checkForUpdates();
        if (info?.updateAvailable) {
          // Respect "Later": don't re-prompt automatically for a snoozed version
          const snoozed = await getSnoozedVersion();
          if (snoozed === info.latestVersion) return;
          setUpdateInfo(info);
          setShowUpdateModal(true);
        }
      } catch (err) {
        console.warn('Auto update check failed:', err);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Manual update check handler
  const handleManualCheckUpdates = useCallback(async () => {
    try {
      const info = await checkForUpdates();
      if (info?.updateAvailable) {
        setUpdateInfo(info);
        setShowUpdateModal(true);
      } else if (info?.error) {
        Alert.alert('Update Check', `Could not check for updates: ${info.error}`);
      } else {
        Alert.alert(
          'Up to Date',
          `You are using the latest version (v${info?.currentVersion}).`
        );
      }
    } catch (err) {
      Alert.alert('Update Check', `Failed to check for updates: ${err?.message || err}`);
    }
  }, []);

  // "Later" dismisses and snoozes this version until a newer release ships
  const handleDismissUpdate = useCallback(() => {
    setShowUpdateModal(false);
    if (updateInfo?.latestVersion) snoozeUpdate(updateInfo.latestVersion);
  }, [updateInfo]);

  // The update dialog must never mount on top of another modal/sheet:
  // stacked RN Modals crash on Fabric when one dismisses over the other.
  // While any overlay is open the prompt waits behind it instead.
  const anyOverlayOpen =
    showSearchModal || showUserMenu || showOfflineMaps || showSettings ||
    showSavedPlaces || showQuickActions || showResultsModal ||
    showRunSheet || isCalibrating || debugVisible;

  // Map Pan / Drag handlers — Fix spring-back bug: switch to 'free' mode immediately
  const handleMapTouchStart = useCallback(() => {
    if (trackingMode !== 'free') {
      setTrackingMode('free');
    }
  }, [trackingMode]);

  const handleRegionWillChange = useCallback((e) => {
    const p = e?.nativeEvent ?? e?.properties ?? e;
    if (p?.userInteraction && trackingMode !== 'free') {
      setTrackingMode('free');
    }
  }, [trackingMode]);

  const handleRegionDidChange = useCallback((e) => {
    const p = e?.nativeEvent ?? e?.properties ?? e;
    if (p?.userInteraction && trackingMode !== 'free') {
      setTrackingMode('free');
    }
    setShowSearchAreaBtn(true);

    if (p?.bounds) {
      // MapLibre v11: bounds arrives as a [west, south, east, north] array
      // MapLibre v11 (object form): { west, south, east, north }
      // MapLibre v10 (legacy form): { ne: [lon, lat], sw: [lon, lat] }
      let w, s, eCoord, n;
      if (Array.isArray(p.bounds)) {
        [w, s, eCoord, n] = p.bounds;
      } else if (p.bounds.west !== undefined && p.bounds.south !== undefined) {
        w = p.bounds.west;
        s = p.bounds.south;
        eCoord = p.bounds.east;
        n = p.bounds.north;
      } else if (p.bounds.sw && p.bounds.ne) {
        w = p.bounds.sw[0];
        s = p.bounds.sw[1];
        eCoord = p.bounds.ne[0];
        n = p.bounds.ne[1];
      }
      if (w !== undefined && s !== undefined) {
        const newBounds = [w, s, eCoord, n];
        setCurrentBounds(newBounds);

        // Auto-fetch places with 300ms debounce
        if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
        searchDebounceTimer.current = setTimeout(() => {
          runViewportFetch(selectedCategory || 'all', newBounds, p?.zoom || currentZoom);
        }, 300);
      }
    }

    if (p?.zoom != null) {
      setCurrentZoom(p.zoom);
    }
  }, [trackingMode, selectedCategory, currentZoom, position, runViewportFetch]);

  // Handle "Search this area" button press
  const handleSearchThisArea = useCallback(async () => {
    setShowSearchAreaBtn(false);
    await runViewportFetch(selectedCategory || 'all', currentBounds);
  }, [selectedCategory, currentBounds, runViewportFetch]);

  const handleRetryPlaces = useCallback(async () => {
    handleSearchThisArea();
  }, [handleSearchThisArea]);

  const handleMapReady = useCallback(() => {
    // Map style and camera ready
  }, []);

  const handleMapPress = useCallback(async (e) => {
    if (selectedPlace) {
      setSelectedPlace(null);
      return;
    }

    const point = e?.nativeEvent?.point;
    if (!point || !mapRef.current) return;

    try {
      const features = await mapRef.current.getMapRef()?.queryRenderedFeatures(point);
      if (!features || features.length === 0) return;

      const targetFeature = features.find(f => f.properties?.name || f.properties?.['name:en']);
      if (!targetFeature) return;

      const name = targetFeature.properties?.name || targetFeature.properties?.['name:en'];
      
      const existingPin = places.find(p => p.name === name);
      if (existingPin) {
        handleSelectPlace(existingPin);
        return;
      }

      let lat, lon;
      if (targetFeature.geometry?.type === 'Point') {
        lon = targetFeature.geometry.coordinates[0];
        lat = targetFeature.geometry.coordinates[1];
      } else {
        const coords = e?.nativeEvent?.coordinates || e?.nativeEvent?.lngLat;
        lon = Array.isArray(coords) ? coords[0] : (coords?.longitude || coords?.lon);
        lat = Array.isArray(coords) ? coords[1] : (coords?.latitude || coords?.lat);
      }

      if (lat == null || lon == null) return;

      const refPoint = position || viewportCenter || INDORE;
      const distanceM = Math.round(calculateDistance(refPoint.latitude, refPoint.longitude, lat, lon) * 1000);
      const etaMin = calculateETA(distanceM / 1000);

      const place = {
        id: `style_${targetFeature.id || Date.now()}`,
        name,
        category: 'all',
        categoryLabel: targetFeature.properties?.type || targetFeature.properties?.class || 'Point of Interest',
        icon: '📍',
        pinColor: '#757575',
        latitude: lat,
        longitude: lon,
        rating: (4 + Math.random()).toFixed(1),
        reviews: Math.floor(Math.random() * 100) + 1,
        address: 'Loading details...',
        status: 'Open',
        distanceM,
        etaMin,
      };

      handleSelectPlace(place);

      // Detail fetch via Overpass around:50
      const query = `[out:json][timeout:10];(node(around:50,${lat},${lon})["name"~"${name.replace(/"/g, '')}",i];way(around:50,${lat},${lon})["name"~"${name.replace(/"/g, '')}",i];);out center 1;`;
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query)
        });
        const data = await res.json();
        if (data?.elements?.length > 0) {
          const el = data.elements[0];
          const address = el.tags?.['addr:full'] || el.tags?.['addr:street'] || place.address;
          const phone = el.tags?.phone || '';
          const opening = el.tags?.opening_hours ? (el.tags.opening_hours.includes('24/7') ? 'Open 24/7' : 'Open') : 'Open';
          handleSelectPlace({
            ...place,
            address,
            phone,
            status: opening,
          });
        }
      } catch (err) {
        console.warn('Overpass detail fetch failed:', err);
      }
    } catch (err) {
      console.warn('Map tap queryRenderedFeatures error:', err);
    }
  }, [selectedPlace, mapRef, places, position, viewportCenter, handleSelectPlace]);

  const handleMapLongPress = useCallback(async (e) => {
    const coords = e?.nativeEvent?.coordinates ?? e?.nativeEvent?.lngLat;
    if (!coords) return;
    
    const lon = Array.isArray(coords) ? coords[0] : (coords.longitude || coords.lon);
    const lat = Array.isArray(coords) ? coords[1] : (coords.latitude || coords.lat);

    if (lat == null || lon == null) return;

    const refPoint = position || viewportCenter || INDORE;
    const distanceM = Math.round(calculateDistance(refPoint.latitude, refPoint.longitude, lat, lon) * 1000);
    const etaMin = calculateETA(distanceM / 1000);

    const place = {
      id: `dropped_${Date.now()}`,
      name: 'Dropped Pin',
      category: 'all',
      categoryLabel: 'Selected Location',
      icon: '📍',
      pinColor: '#EA4335',
      latitude: lat,
      longitude: lon,
      rating: null,
      reviews: 0,
      address: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      status: 'Open',
      distanceM,
      etaMin,
    };

    handleSelectPlace(place);

    try {
      const geo = await reverseGeocode(lat, lon);
      if (geo) {
        handleSelectPlace({
          ...place,
          name: geo.name || place.name,
          address: geo.address || place.address,
        });
      }
    } catch (err) {
      console.warn('Reverse geocode failed:', err);
    }
  }, [position, viewportCenter, handleSelectPlace]);

  const handleSelectPlace = useCallback((place) => {
    setSelectedPlace(place);
    if (place) {
      setTrackingMode('free');
      mapRef.current?.flyTo({ latitude: place.latitude, longitude: place.longitude }, 16, 0, 0, 500);
    }
  }, []);

  const handleClusterPress = useCallback((clusterId, coordinate) => {
    mapRef.current?.flyTo(coordinate, (currentZoom || 15) + 1, 0, 0, 300);
  }, [currentZoom]);

  // Handle Search item selected from SearchModal
  const handleSelectSearchResult = useCallback((item) => {
    const place = {
      id: item.id,
      placeId: item.placeId,
      name: item.name,
      categoryLabel: item.categoryLabel || item.subtitle || 'Point of Interest',
      address: item.address || item.subtitle,
      latitude: item.latitude,
      longitude: item.longitude,
      icon: item.icon,
      rating: item.rating ?? null,
      reviews: item.reviews ?? null,
      status: item.status ?? null,
      phone: item.phone,
      website: item.website,
      photoUrl: item.photoUrl,
      source: item.source,
      attribution: item.attribution,
      distanceM: item.distanceM || 1000,
      etaMin: Math.max(1, Math.round((item.distanceM || 1000) / 500)),
    };

    setPlaces((prev) => {
      const exists = prev.some((p) => p.id === place.id);
      return exists ? prev : [place, ...prev];
    });

    setSelectedPlace(place);
    setTrackingMode('free');
    mapRef.current?.flyTo({ latitude: place.latitude, longitude: place.longitude }, 16, 0, 0, 600);
  }, []);

  // Handle Directions from PlaceCard: calculate real road route via OSRM
  const handleDirections = useCallback(async (place) => {
    const origin = isRunning && engineState.lat != null
      ? { latitude: engineState.lat, longitude: engineState.lon }
      : position || INDORE;

    setNavDestination(place);
    setTrackingMode('free');

    const route = await getDrivingRoute(origin, place);
    if (route?.success) {
      setRouteData(route);
      if (route.coordinates && route.coordinates.length > 0) {
        const lats = route.coordinates.map(c => c[1]);
        const lons = route.coordinates.map(c => c[0]);
        const ne = [Math.max(...lons), Math.max(...lats)];
        const sw = [Math.min(...lons), Math.min(...lats)];
        // MapLibre uses [paddingTop, paddingRight, paddingBottom, paddingLeft]
        mapRef.current?.fitBounds(ne, sw, [50, 50, 300, 50], 600);
      }
    } else {
      Alert.alert('Route Unavailable', route?.error || 'Could not calculate a route.');
      setNavDestination(null);
      setRouteData(null);
      setTrackingMode('follow');
    }
  }, [isRunning, engineState, position]);

  // Handle Start Navigation: enter 3D driving perspective with real maneuvers
  const handleStartNavigation = useCallback(async (place) => {
    const origin = isRunning && engineState.lat != null
      ? { latitude: engineState.lat, longitude: engineState.lon }
      : position || INDORE;

    setNavDestination(place);
    setIsNavigating(true);
    setSelectedPlace(null);
    setTrackingMode('compass');

    const route = await getDrivingRoute(origin, place);
    if (route?.success) {
      setRouteData(route);
      mapRef.current?.flyTo(origin, 17, heading || 0, 45, 700);
    } else {
      Alert.alert('Route Unavailable', route?.error || 'Could not calculate a route.');
      setIsNavigating(false);
      setNavDestination(null);
      setRouteData(null);
      setTrackingMode('follow');
    }
  }, [isRunning, engineState, position, heading]);

  // Exit Navigation mode
  const handleExitNavigation = useCallback(() => {
    setIsNavigating(false);
    setNavDestination(null);
    setRouteData(null);
    setTrackingMode('follow');

    const target = isRunning && engineState.lat != null
      ? { latitude: engineState.lat, longitude: engineState.lon }
      : position || INDORE;
    mapRef.current?.flyTo(target, 16, 0, 0, 600);
  }, [isRunning, engineState, position]);

  // ── Android hardware back button: two-step confirmation ──────────────────
  // The app is a single screen (no navigation stack), so back is handled here
  // via BackHandler rather than React Navigation. An active DR "simulation"
  // (running / calibrating / reviewing frozen results) never exits the app on
  // the first press — it asks to leave the session and drops back to the
  // clean home. From home, the next press asks to exit the app. RN Modals
  // (search, settings, results, etc.) consume back themselves via
  // onRequestClose, so this only fires for the map/sheet/overlay layers.

  // Fully exit the simulation overlay and return to the idle home map.
  const handleLeaveSimulation = useCallback(() => {
    resetSession();
    setShowRunSheet(false);
    setShowResultsModal(false);
    setResultsDismissed(false);
    setTrackingMode('follow');
    const home = position || INDORE;
    mapRef.current?.flyTo(home, 16, 0, 0, 600);
  }, [resetSession, position]);

  const confirmLeaveSimulation = useCallback(() => {
    Alert.alert(
      'Leave simulation?',
      'Do you want to leave the simulation? The current run will be stopped.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: handleLeaveSimulation },
      ]
    );
  }, [handleLeaveSimulation]);

  const confirmExitApp = useCallback(() => {
    Alert.alert(
      'Exit app?',
      'Do you want to exit the app?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]
    );
  }, []);

  const simulationActive = appState !== 'idle';

  useEffect(() => {
    const onBackPress = () => {
      // 1. Dismiss the run-controls sheet (gorhom sheet doesn't own back).
      if (showRunSheet && !isCalibrating && !isRunning) {
        setShowRunSheet(false);
        return true;
      }
      // 2. Exit turn-by-turn navigation before touching the app-level flow.
      if (isNavigating) {
        handleExitNavigation();
        return true;
      }
      // 3. Active DR simulation → ask to leave, drop back to home.
      if (simulationActive) {
        confirmLeaveSimulation();
        return true;
      }
      // 4. Home → ask to exit the app.
      confirmExitApp();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [
    showRunSheet,
    isCalibrating,
    isRunning,
    isNavigating,
    simulationActive,
    handleExitNavigation,
    confirmLeaveSimulation,
    confirmExitApp,
  ]);

  // Dynamic distance and ETA
  const { navDistanceKm, navEtaMinutes } = useMemo(() => {
    if (routeData?.distanceKm != null && routeData?.durationMin != null) {
      return {
        navDistanceKm: routeData.distanceKm,
        navEtaMinutes: routeData.durationMin,
      };
    }
    if (!navDestination) return { navDistanceKm: null, navEtaMinutes: null };
    const currentLoc = isRunning && engineState.lat != null
      ? { latitude: engineState.lat, longitude: engineState.lon }
      : position || INDORE;

    const dist = calculateDistance(
      currentLoc.latitude,
      currentLoc.longitude,
      navDestination.latitude,
      navDestination.longitude
    );
    const eta = calculateETA(dist);
    return { navDistanceKm: dist, navEtaMinutes: eta };
  }, [routeData, navDestination, isRunning, engineState, position]);

  // Recenter FAB: snaps back to current location and re-engages follow mode
  const handleRecenter = useCallback(() => {
    const currentLoc = isRunning && engineState.lat != null
      ? { latitude: engineState.lat, longitude: engineState.lon }
      : smoothPosition || position || INDORE;

    if (trackingMode === 'free') {
      setTrackingMode('follow');
      mapRef.current?.flyTo(currentLoc, 16, 0, 0, 400);
    } else if (trackingMode === 'follow') {
      setTrackingMode('compass');
      const activeHeading = isRunning ? engineState.heading : heading;
      mapRef.current?.flyTo(currentLoc, 17, activeHeading || 0, 45, 400);
    } else {
      setTrackingMode('follow');
      mapRef.current?.flyTo(currentLoc, 16, 0, 0, 400);
    }
  }, [trackingMode, isRunning, engineState, smoothPosition, position, heading]);

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  // Camera follow: ONLY follow if trackingMode !== 'free'
  useEffect(() => {
    if (trackingMode === 'free') return;

    const currentLoc = isRunning && engineState.lat != null
      ? { latitude: engineState.lat, longitude: engineState.lon }
      : smoothPosition || position;

    if (!currentLoc) return;

    if (trackingMode === 'compass') {
      const activeHeading = isRunning ? engineState.heading : heading;
      mapRef.current?.recenter(currentLoc, 17, activeHeading || 0, 45);
    } else if (trackingMode === 'follow') {
      mapRef.current?.recenter(currentLoc, 16, 0, 0);
    }
  }, [trackingMode, isRunning, engineState.lat, engineState.lon, engineState.heading, smoothPosition, position, heading]);

  const handleRunStart = useCallback(async (replayModule, mode) => {
    setShowResultsModal(false);
    if (mode === 'replay' && replayModule) {
      try {
        const rows = await loadBundledReplay(replayModule);
        if (!rows || rows.length === 0) {
          setShowRunSheet(false);
          Alert.alert('Replay Error', 'Could not load the replay file.');
          return;
        }
        // Keep the sheet open to show the calibration countdown (tap to skip)
        startCalibration(rows, 'replay');
      } catch (err) {
        setShowRunSheet(false);
        Alert.alert('Replay Error', `Failed to load replay: ${err?.message || err}`);
      }
    } else {
      startCalibration(null, 'live');
    }
  }, [startCalibration]);

  // Close the run sheet once the replay actually launches; expand it during calibration
  useEffect(() => {
    if (isRunning) setShowRunSheet(false);
  }, [isRunning]);
  useEffect(() => {
    if (isCalibrating) runSheetRef.current?.snapToIndex(1);
  }, [isCalibrating]);

  // Camera: frame the demo route when a replay run launches
  const wasRunningRef = useRef(false);
  useEffect(() => {
    if (isRunning && !wasRunningRef.current) {
      setSelectedPlace(null);
      setNavDestination(null);
      setRouteData(null);
      setTrackingMode('follow');
      if (replayMeta?.startCoord) {
        const [lon, lat] = replayMeta.startCoord;
        mapRef.current?.flyTo({ latitude: lat, longitude: lon }, 16, 0, 0, 800);
      }
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, replayMeta]);

  // Results modal: open a beat after the run freezes so the recovery banner +
  // "GNSS Restored" signal banner get their moment on camera
  useEffect(() => {
    if (!isRunning && frozenResults && !showResultsModal && !resultsDismissed) {
      const t = setTimeout(() => setShowResultsModal(true), DR_DEMO.RESULTS_MODAL_DELAY_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isRunning, frozenResults, showResultsModal, resultsDismissed]);

  // Starting a new run clears the dismiss flag so its frozen results auto-open again
  useEffect(() => {
    if (isRunning) setResultsDismissed(false);
  }, [isRunning]);

  const handleCloseResults = useCallback(() => {
    setShowResultsModal(false);
    setResultsDismissed(true);
    // Closing the dialog is the explicit "done reviewing" gesture: tear the
    // session down so the BENCHMARKED RUN banner, NavCard, DR trail and gates
    // all disappear with it and the app returns to the clean idle home.
    resetSession();
    setTrackingMode('follow');
    const target = smoothPosition || position || INDORE;
    mapRef.current?.flyTo(target, 15, 0, 0, 600);
  }, [resetSession, smoothPosition, position]);

  const handleReplaySession = useCallback(() => {
    setShowResultsModal(false);
    setShowRunSheet(true);
  }, []);

  const showEngineLayer = appState === 'running' || appState === 'completed';

  // ── Top HUD stack: collision-free vertical layout ────────────────────────
  // Which mid-DR instrument-cluster overlays are on screen right now. These
  // three are the ones that used to collide (all near STATUS_BAR_HEIGHT + 66).
  const showDriftCluster =
    engineState.source === 'dr' && drSeconds >= DR_DEMO.DRIFT_CARD_AFTER_S;
  const signalMode =
    engineState.source === 'dr' ? 'degraded' : tunnelCleared ? 'restored' : null;
  const showBenchmark = engineState.source !== 'dr' && !!benchmarkSnapshot;

  // Graceful degradation: if the stack would grow past the room available above
  // the NavCard, drop the least-critical rows (satellite + IMU chips) and keep
  // the signal banner / drift meter / benchmark result, which carry the actual
  // navigation + drift-safety information. Four rows fit comfortably; the fifth
  // and sixth only appear in the densest DR moment.
  const activeHudCount =
    (signalMode ? 1 : 0) +
    (showBenchmark ? 1 : 0) +
    (showDriftCluster ? 3 : 0); // drift meter + sat chip + imu chip
  const hudOverflow = activeHudCount > 4;
  const showSatChip = showDriftCluster && !hudOverflow;
  const showImuChip = showDriftCluster && !hudOverflow;

  // Animate the push-down/re-flow whenever the set of visible rows changes.
  const hudSignature = `${signalMode}|${showBenchmark ? 'b' : ''}|${
    showDriftCluster ? (hudOverflow ? 'd' : 'dcs') : ''
  }`;
  const prevHudSignature = useRef(hudSignature);
  useEffect(() => {
    if (prevHudSignature.current !== hudSignature) {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(
          260,
          LayoutAnimation.Types.easeInEaseOut,
          LayoutAnimation.Properties.opacity
        )
      );
      prevHudSignature.current = hudSignature;
    }
  }, [hudSignature]);

  // Bottom bar tab handler
  const handleBottomTabPress = useCallback((tabId) => {
    setActiveBottomTab(tabId);
    if (tabId === 'saves') {
      setShowSavedPlaces(true);
    } else if (tabId === 'you') {
      // "You" opens the same profile menu as the avatar button
      setShowUserMenu(true);
    } else if (tabId === 'explore') {
      // Explore = back to the live map: close the detail card, follow the
      // user, recenter the camera and refresh POIs for the current viewport.
      setSelectedPlace(null);
      setTrackingMode('follow');
      const home = position || INDORE;
      mapRef.current?.recenter(home, 16, 0, 0, 600);
      runViewportFetch(selectedCategory || 'all', currentBounds);
    }
  }, [position, runViewportFetch, selectedCategory, currentBounds]);

  // Handle saving current location from QuickActionModal
  const handleSaveCurrentLocation = useCallback(async () => {
    const loc = position || INDORE;
    const place = {
      id: `manual_${Date.now()}`,
      name: 'Saved Location',
      category: 'all',
      categoryLabel: 'Saved Pin',
      icon: '📌',
      pinColor: '#1A73E8',
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`,
    };
    try {
      await savePlace(place);
      Alert.alert('Location Saved', 'Your current location has been bookmarked.');
    } catch (err) {
      console.warn('[MapScreen] save current location failed:', err);
      Alert.alert('Not saved', 'Could not save your location. Please try again.');
    }
  }, [position]);

  // Handle locality label tap: fly to that neighbourhood
  const handleTapLocality = useCallback((loc) => {
    setTrackingMode('free');
    mapRef.current?.flyTo({ latitude: loc.lat, longitude: loc.lon }, 15, 0, 0, 600);
  }, []);

  // Handle view saved place on map
  const handleViewSavedOnMap = useCallback((place) => {
    const p = {
      ...place,
      distanceM: 0,
      etaMin: 0,
      rating: place.rating ?? null,
      reviews: place.reviews ?? null,
      status: 'Saved',
    };
    setPlaces(prev => {
      const exists = prev.some(x => x.id === p.id);
      return exists ? prev : [p, ...prev];
    });
    setSelectedPlace(p);
    setTrackingMode('free');
    mapRef.current?.flyTo({ latitude: place.latitude, longitude: place.longitude }, 16, 0, 0, 600);
  }, []);

  // Handle directions to a saved place
  const handleDirectionsToSaved = useCallback((place) => {
    const p = {
      ...place,
      distanceM: 0,
      etaMin: 0,
      rating: place.rating ?? null,
      reviews: place.reviews ?? null,
      status: 'Saved',
    };
    handleDirections(p);
  }, [handleDirections]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Layer 0: Map with on-demand vector tiles */}
      <BaseMap
        ref={mapRef}
        initialCenter={INDORE}
        styleProp={
          mapType === 'satellite'
            ? JSON.stringify({
                version: 8,
                sources: {
                  esri: {
                    type: 'raster',
                    tiles: [
                      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    ],
                    tileSize: 256,
                  },
                },
                layers: [
                  {
                    id: 'esri-layer',
                    type: 'raster',
                    source: 'esri',
                    minzoom: 0,
                    maxzoom: 22,
                  },
                ],
              })
            : null
        }
        onMapReady={handleMapReady}
        onRegionWillChange={handleRegionWillChange}
        onRegionDidChange={handleRegionDidChange}
        onTouchStart={handleMapTouchStart}
        onPress={handleMapPress}
        onLongPress={handleMapLongPress}
      >
        {/* Layer 1: Google Maps Blue Location Puck with flashlight beam */}
        <UserLocationDot
          position={smoothPosition || position}
          heading={heading}
          accuracy={accuracy}
          visible={permissionGranted && !isRunning}
        />

        {/* POI Markers */}
        <POIMarkers
          places={places}
          selectedPlace={selectedPlace}
          onSelectPlace={handleSelectPlace}
          bounds={currentBounds}
          zoom={currentZoom}
          onClusterPress={handleClusterPress}
        />

        {/* Locality Labels (Google Maps-style area name overlays) */}
        <LocalityLabels
          bounds={currentBounds}
          zoomLevel={currentZoom}
          onTapLocality={handleTapLocality}
        />

        {/* Navigation Route Polyline (OSRM Road Network) + Destination Pin */}
        <RouteLayer
          visible={isNavigating || navDestination != null}
          origin={
            isRunning && engineState.lat != null
              ? { lat: engineState.lat, lon: engineState.lon }
              : position || INDORE
          }
          destination={navDestination}
          routeCoordinates={routeData?.coordinates}
        />

        {/* Layer 2: Engine overlays */}
        {showEngineLayer && (
          <>
            <DemoRouteLayer meta={replayMeta} />
            <Trail trail={trail} />
            <TunnelGates meta={replayMeta} elapsedS={navInfo?.elapsedS ?? 0} />
            <ConfidenceEllipse
              lat={engineState.lat}
              lon={engineState.lon}
              sigma={engineState.sigma}
              source={engineState.source}
              heading={engineState.heading}
            />
            <VehicleDot
              lat={engineState.lat}
              lon={engineState.lon}
              heading={engineState.heading}
              source={engineState.source}
              recovered={!!benchmarkSnapshot && engineState.source !== 'dr'}
            />
          </>
        )}
      </BaseMap>

      {/* Turn-by-Turn Nav Header (replaces search UI when active; hidden during demo runs) */}
      <NavHeader
        visible={isNavigating && !showEngineLayer}
        destination={navDestination}
        distanceKm={navDistanceKm}
        etaMinutes={navEtaMinutes}
        maneuver={routeData?.primaryManeuver}
        onExit={handleExitNavigation}
      />

      {/* Layer 1: Search & Category UI */}
      {!isNavigating && (
        <>
          <SearchBar
            onPressSearch={() => setShowSearchModal(true)}
            onPressUserMenu={() => setShowUserMenu(true)}
            rightOffset={showEngineLayer ? 150 : 8}
          />
          
          {position && !showEngineLayer && (
            <WeatherChip latitude={position.latitude} longitude={position.longitude} />
          )}

          <CategoryChips
            visible={!showEngineLayer}
            selectedCategory={selectedCategory}
            onSelectCategory={async (catId) => {
              setSelectedCategory(catId);
              setSelectedPlace(null);
              setShowSearchAreaBtn(false);
              // Sequence-guarded: a newer selection supersedes this in-flight fetch.
              runViewportFetch(catId, currentBounds);
            }}
          />

          <SearchThisAreaButton
            visible={showSearchAreaBtn && !placesError && !showEngineLayer}
            onPress={handleSearchThisArea}
            loading={isSearchingPlaces}
          />

          {placesError && !isSearchingPlaces && !showEngineLayer && (
            <TouchableOpacity style={styles.retryChip} onPress={handleRetryPlaces}>
              <Text style={styles.retryChipText}>⚠️ Couldn't load places — Retry</Text>
            </TouchableOpacity>
          )}

          {permissionGranted && !position && (
            <View style={styles.waitingGpsBadge}>
              <Text style={styles.waitingGpsText}>📍 Waiting for GPS signal...</Text>
            </View>
          )}
        </>
      )}

      {/* Place Detail Card (when a POI or search result is tapped) */}
      <PlaceCard
        place={selectedPlace}
        userLocation={position || INDORE}
        onClose={() => {
          setSelectedPlace(null);
          if (!isNavigating) {
            setNavDestination(null);
            setRouteData(null);
          }
        }}
        onDirections={() => handleDirections(selectedPlace)}
        onStartNavigation={() => handleStartNavigation(selectedPlace)}
      />

      {/* Map Controls: 3-state FAB (Free / Follow / Compass) + Zoom buttons */}
      <MapControls
        trackingMode={trackingMode}
        onRecenter={handleRecenter}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        bottomOffset={showEngineLayer ? 230 : selectedPlace ? 280 : 90}
      />

      {/* Layer 2: Demo run HUD (status pill, sensor chips, banners, nav card) */}
      {showEngineLayer && (
        <>
          {/* Row 0 (top-right rail): status pill + marginal-GNSS sat chip. These
              sit beside the search pill and never enter the centred stack. */}
          <View onTouchEnd={handleBadgeTap}>
            <StatusBadge source={engineState.source} drSeconds={drSeconds} />
          </View>
          <SatChip
            sats={gnssQuality.sats}
            hdop={gnssQuality.hdop}
            row={1}
            visible={engineState.source === 'dr' && drSeconds < DR_DEMO.DRIFT_CARD_AFTER_S}
          />

          {/* Centred HUD stack: every active overlay gets its own row, so they
              reflow downward instead of overlapping. Render order = priority. */}
          <View pointerEvents="box-none" style={styles.hudStack}>
            {/* GNSS signal-state banner: degraded while in DR, restored on recovery */}
            <SignalBanner mode={signalMode} containerStyle={STACK_ITEM} />

            {/* Recovery: frozen benchmark banner (full-width row) */}
            <BenchmarkBanner
              snapshot={benchmarkSnapshot}
              visible={showBenchmark}
              containerStyle={STACK_ITEM_STRETCH}
            />

            {/* Mid-DR instrument cluster */}
            <DriftMeter driftStats={driftStats} visible={showDriftCluster} containerStyle={STACK_ITEM} />
            <SatChip
              sats={gnssQuality.sats}
              hdop={gnssQuality.hdop}
              row={2}
              visible={showSatChip}
              containerStyle={STACK_ITEM}
            />
            <ImuOdoChip
              speed={engineState.speed}
              visible={showImuChip}
              containerStyle={STACK_ITEM}
            />
          </View>

          {/* Bottom nav card */}
          <NavCard navInfo={navInfo} onStop={stopRun} visible={!showResultsModal} />
        </>
      )}

      {/* Interactive Search Modal */}
      <SearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectPlace={handleSelectSearchResult}
        userLocation={position || viewportCenter || INDORE}
        bounds={currentBounds}
      />

      {/* User Profile & Settings Menu Modal */}
      <UserMenuModal
        visible={showUserMenu}
        onClose={() => {
          setShowUserMenu(false);
          setActiveBottomTab('explore');
        }}
        onCheckUpdates={handleManualCheckUpdates}
        onOpenDiagnostics={() => setDebugVisible(true)}
        onOpenOfflineMaps={() => setShowOfflineMaps(true)}
        onOpenSavedPlaces={() => {
          setShowSavedPlaces(true);
          setActiveBottomTab('saves');
        }}
        onOpenSettings={() => {
          setSettingsType('settings');
          setShowSettings(true);
        }}
        onOpenHelp={() => {
          setSettingsType('help');
          setShowSettings(true);
        }}
        onOpenData={() => {
          setSettingsType('data');
          setShowSettings(true);
        }}
        mapType={mapType}
        onMapTypeChange={setMapType}
      />

      <OfflineMapsModal
        visible={showOfflineMaps}
        onClose={() => setShowOfflineMaps(false)}
        currentCenter={
          currentBounds
            ? {
                latitude: (currentBounds[1] + currentBounds[3]) / 2,
                longitude: (currentBounds[0] + currentBounds[2]) / 2,
              }
            : INDORE
        }
      />

      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        type={settingsType}
        onStartDemo={() => setShowRunSheet(true)}
        onOpenDrHistory={() => setSettingsType('drHistory')}
        onBackToSettings={() => setSettingsType('settings')}
      />

      {/* Dead-Reckoning Benchmark results modal */}
      <ResultsSheet
        visible={showResultsModal}
        frozenResults={frozenResults}
        onClose={handleCloseResults}
        onReplay={handleReplaySession}
        savedLocally={sessionSaved}
      />

      {/* Run Controls Sheet (replay picker / calibration) — idle or calibrating */}
      {(showRunSheet || isCalibrating) && (
        <RunControlsSheet
          sheetRef={runSheetRef}
          onStart={handleRunStart}
          isCalibrating={isCalibrating}
          calibrateCountdown={calibrateCountdown}
          isRunning={false}
          onStop={stopRun}
          onSkipCalibration={skipCalibration}
        />
      )}

      {/* Debug Menu */}
      <DebugMenu
        visible={debugVisible}
        onClose={() => setDebugVisible(false)}
        onSimulateOutage={simulateOutageStart}
        onEndOutage={simulateOutageEnd}
        simulatedOutage={simulatedOutage}
        engineState={engineState}
        onCheckUpdates={handleManualCheckUpdates}
      />

      {/* In-App GitHub Auto-Updater Modal */}
      <UpdateModal
        visible={showUpdateModal && !anyOverlayOpen}
        updateInfo={updateInfo}
        onClose={handleDismissUpdate}
      />

      {/* Clear Route Button in preview mode */}
      {!isNavigating && navDestination && !selectedPlace && (
        <TouchableOpacity
          style={styles.clearRouteBtn}
          onPress={() => {
            setNavDestination(null);
            setRouteData(null);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.clearRouteText}>✕ Clear Route</Text>
        </TouchableOpacity>
      )}

      {/* Floating Bottom Navigation Bar (Google Maps-style White Theme) */}
      {!isNavigating && (
        <BottomBar
          activeTab={activeBottomTab}
          onTabPress={handleBottomTabPress}
          onPlusPress={() => setShowQuickActions(true)}
          visible={!selectedPlace && !showEngineLayer}
        />
      )}

      {/* Saved Places Modal (My Saves) */}
      <SavedPlacesModal
        visible={showSavedPlaces}
        onClose={() => {
          setShowSavedPlaces(false);
          setActiveBottomTab('explore');
        }}
        onViewOnMap={handleViewSavedOnMap}
        onDirections={handleDirectionsToSaved}
      />

      {/* Quick Action Modal (+ button) */}
      <QuickActionModal
        visible={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        userLocation={position || INDORE}
        onSaveCurrentLocation={handleSaveCurrentLocation}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  hudStack: {
    position: 'absolute',
    top: HUD_STACK_TOP,
    left: 8,
    right: 8,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    zIndex: 19, // below the top-right status rail (20) and modals
    pointerEvents: 'box-none', // let the map receive touches between chips
  },
  clearRouteBtn: {
    position: 'absolute',
    top: 130,
    right: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  clearRouteText: {
    fontWeight: '700',
    color: '#3C4043',
    fontSize: 13,
  },
  retryChip: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    backgroundColor: '#FCE8E6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  retryChipText: {
    fontWeight: '600',
    color: '#C5221F',
    fontSize: 13,
  },
  waitingGpsBadge: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    backgroundColor: '#3C4043',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 9,
  },
  waitingGpsText: {
    fontWeight: '600',
    color: '#FFFFFF',
    fontSize: 13,
  },
});
