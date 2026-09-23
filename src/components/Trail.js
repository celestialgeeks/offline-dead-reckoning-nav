// PS168 — Trail (Layer 2)
// Breadcrumb dots colored by position source:
//   Light blue (#4FC3F7) = GNSS fixes
//   Amber (#FBBF24)      = DR propagation
// Plus a dashed amber casing line under the DR section while in the tunnel

import React, { useMemo } from 'react';
import MapLibreGL from '../map/maplibre';
import { DEMO, DR_DEMO } from '../utils/constants';

export default function Trail({ trail = [] }) {
  // Sampled breadcrumb points (every N ticks) with source property for styling
  const dotsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: trail
      .filter((_, i) => i % DR_DEMO.TRAIL_DOT_EVERY_TICKS === 0)
      .map((point, i) => ({
        type: 'Feature',
        properties: { id: i, source: point.source },
        geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
      })),
  }), [trail]);

  // Contiguous DR segments for the dashed casing line
  const drGeoJSON = useMemo(() => {
    const segments = [];
    let current = [];
    trail.forEach((point) => {
      if (point.source === 'dr') {
        if (current.length === 0 && segments.length > 0) {
          // bridge from previous segment end for continuity
          current = [segments[segments.length - 1].coordinates.slice(-1)[0]];
        }
        current.push([point.lon, point.lat]);
      } else if (current.length >= 2) {
        segments.push({ type: 'LineString', coordinates: current });
        current = [];
      } else {
        current = [];
      }
    });
    if (current.length >= 2) segments.push({ type: 'LineString', coordinates: current });
    return {
      type: 'FeatureCollection',
      features: segments.map((geometry, i) => ({
        type: 'Feature',
        properties: { id: `dr-${i}` },
        geometry,
      })),
    };
  }, [trail]);

  const hasDr = drGeoJSON.features.length > 0;

  return (
    <>
      {/* Dashed amber casing under DR breadcrumbs */}
      {hasDr && (
        <MapLibreGL.ShapeSource id="trail-dr-casing" shape={drGeoJSON}>
          <MapLibreGL.LineLayer
            id="trail-dr-casing-line"
            style={{
              lineColor: DEMO.amber,
              lineWidth: 3,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.55,
              lineDasharray: [1.2, 1.8],
            }}
          />
        </MapLibreGL.ShapeSource>
      )}

      {/* Breadcrumb dots colored by source */}
      <MapLibreGL.ShapeSource id="trail-dots" shape={dotsGeoJSON}>
        <MapLibreGL.CircleLayer
          id="trail-dots-circle"
          style={{
            circleRadius: 4,
            circleColor: ['match', ['get', 'source'], 'dr', DEMO.trailDotDr, DEMO.trailDotGnss],
            circleOpacity: 0.95,
            circleStrokeWidth: 0,
          }}
        />
      </MapLibreGL.ShapeSource>
    </>
  );
}
