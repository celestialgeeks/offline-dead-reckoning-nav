// PS168 — Demo Route Layer (Layer 2)
// The replay path drawn as a road-style route, colored by section:
//   blue halo+core before/after the tunnel, amber halo+core through it
// Gives the DR segment a visible "tunnel section" on the map

import React, { useMemo } from 'react';
import MapLibreGL from '../map/maplibre';
import { DEMO } from '../utils/constants';

function sectionFeature(coords, id) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id },
        geometry: { type: 'LineString', coordinates: coords },
      },
    ],
  };
}

export default function DemoRouteLayer({ meta, visible = true }) {
  const pre = useMemo(() => (meta ? sectionFeature(meta.pathPre, 'pre') : null), [meta]);
  const tunnel = useMemo(() => (meta ? sectionFeature(meta.pathTunnel, 'tunnel') : null), [meta]);
  const post = useMemo(() => (meta ? sectionFeature(meta.pathPost, 'post') : null), [meta]);

  if (!visible || !meta) return null;

  return (
    <>
      {/* Halos */}
      <MapLibreGL.ShapeSource id="demo-route-pre" shape={pre}>
        <MapLibreGL.LineLayer id="demo-route-pre-halo" style={{ lineColor: DEMO.routeBlueHalo, lineWidth: 10, lineCap: 'round', lineJoin: 'round' }} />
        <MapLibreGL.LineLayer id="demo-route-pre-core" style={{ lineColor: DEMO.routeBlue, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }} />
      </MapLibreGL.ShapeSource>
      <MapLibreGL.ShapeSource id="demo-route-post" shape={post}>
        <MapLibreGL.LineLayer id="demo-route-post-halo" style={{ lineColor: DEMO.routeBlueHalo, lineWidth: 10, lineCap: 'round', lineJoin: 'round' }} />
        <MapLibreGL.LineLayer id="demo-route-post-core" style={{ lineColor: DEMO.routeBlue, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }} />
      </MapLibreGL.ShapeSource>
      <MapLibreGL.ShapeSource id="demo-route-tunnel" shape={tunnel}>
        <MapLibreGL.LineLayer id="demo-route-tunnel-halo" style={{ lineColor: DEMO.routeAmberHalo, lineWidth: 10, lineCap: 'round', lineJoin: 'round' }} />
        <MapLibreGL.LineLayer id="demo-route-tunnel-core" style={{ lineColor: DEMO.amber, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }} />
        <MapLibreGL.LineLayer
          id="demo-route-tunnel-dash"
          style={{
            lineColor: 'rgba(255, 255, 255, 0.85)',
            lineWidth: 1.5,
            lineCap: 'round',
            lineJoin: 'round',
            lineDasharray: [1, 2.2],
          }}
        />
      </MapLibreGL.ShapeSource>
    </>
  );
}
