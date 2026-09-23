// PS168 — Map Style Configuration
// OpenFreeMap Positron (white/day theme) for MapLibre
// OSM attribution is automatic in MapLibre — never strip it

// OpenFreeMap Liberty (Google Maps-like vector style with full road hierarchy, buildings, and POIs)
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Fallback inline style if the URL fails (raster OSM tiles)
export const FALLBACK_MAP_STYLE = {
  version: 8,
  name: 'PS168 Fallback',
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-raster-layer',
      type: 'raster',
      source: 'osm-raster',
    },
  ],
};
