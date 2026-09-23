// PS168 — Design tokens (Google Maps 2024 mobile design language)
// Single source of truth for color, radius, elevation and type so the whole
// app stays consistent and a dark theme can be swapped in later by replacing
// the COLORS map only.

export const COLORS = {
  // Core brand / semantic
  primary: '#1A73E8',
  primaryDark: '#1967D2',
  primarySoft: '#E8F0FE',
  alert: '#EA4335',
  alertSoft: '#FCE8E6',
  navGreen: '#0D652D',
  navGreenBright: '#1E8E3E',
  navGreenSoft: '#E6F4EA',
  amber: '#F9AB00',
  amberDeep: '#B06000',
  amberSoft: '#FEF7E0',

  // Text ramp
  textPrimary: '#202124',
  textSecondary: '#3C4043',
  textTertiary: '#5F6368',
  textHint: '#80868B',
  textOnColor: '#FFFFFF',

  // Surfaces
  surface: '#FFFFFF',
  surfaceSoft: '#F1F3F4',
  surfaceBorder: '#E8EAED',
  surfaceDim: '#F8F9FA',
  scrim: 'rgba(32, 33, 36, 0.45)',
  chipTranslucent: 'rgba(255, 255, 255, 0.96)',
};

// 12 cards/pills · 20-22 floating capsules/buttons · 24 modals
export const RADIUS = {
  tag: 12,
  card: 12,
  capsule: 22,
  modal: 24,
  control: 28,
  full: 999,
};

// Material-3-flavoured layered elevation (shadow + android elevation)
export const SHADOW = {
  s1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  s2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  s3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  s4: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
};

// Typography scale: big tight-tracked numerals, semibold labels, quiet subs
export const TYPE = {
  numXL: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: COLORS.textPrimary },
  numL: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: COLORS.textPrimary },
  numM: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: COLORS.textPrimary },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, color: COLORS.textPrimary },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  labelStrong: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  sub: { fontSize: 12.5, fontWeight: '500', color: COLORS.textTertiary },
  caption: { fontSize: 11, fontWeight: '600', color: COLORS.textHint },
};

// 8px spacing grid
export const SPACE = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32 };

// Shared spring for state transitions
export const SPRING = { friction: 5, tension: 80, useNativeDriver: true };

export const APP_NAME = 'Bharat Maps';
