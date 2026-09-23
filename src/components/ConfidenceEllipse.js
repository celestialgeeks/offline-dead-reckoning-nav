// PS168 — Confidence Ellipse (Layer 2)
// Uncertainty overlay around the vehicle dot, radius = engine sigma
//   DR       — dashed amber ellipse elongated along heading (grows with sigma)
//   blending — blue circle shrinking back to the GNSS accuracy floor
// Hidden once sigma settles at the floor

import React, { useMemo } from 'react';
import MapLibreGL from '../map/maplibre';
import { movePoint } from '../utils/geo';
import { COLORS, DEMO, ENGINE } from '../utils/constants';

const DEG2RAD = Math.PI / 180;

export default function ConfidenceEllipse({ lat, lon, sigma = 2, source = 'gnss', heading = 0 }) {
  const isDr = source === 'dr';
  // Only render while uncertain (DR growth or recovery blend-back)
  const visible = lat != null && lon != null && sigma > 0 && (isDr || sigma > ENGINE.SIGMA_MIN + 1);

  const fillColor = isDr ? DEMO.amberFill : COLORS.gnssBlueFill;
  const strokeColor = isDr ? DEMO.amber : COLORS.gnssBlue;

  // Ellipse: semi-major along heading, semi-minor across
  const major = sigma;
  const minor = isDr ? sigma * 0.62 : sigma;

  const coords = useMemo(() => {
    const pts = [];
    if (!visible) return pts;
    const numPoints = 40;
    const h = heading * DEG2RAD;
    for (let i = 0; i <= numPoints; i++) {
      const a = (i / numPoints) * 2 * Math.PI;
      const along = major * Math.cos(a);
      const across = minor * Math.sin(a);
      // rotate local (along=forward, across=right) into north/east meters
      const north = along * Math.cos(h) - across * Math.sin(h);
      const east = along * Math.sin(h) + across * Math.cos(h);
      let p = { latitude: lat, longitude: lon };
      if (Math.abs(north) > 0.01) {
        p = movePoint(p.latitude, p.longitude, Math.abs(north), north >= 0 ? 0 : 180);
      }
      if (Math.abs(east) > 0.01) {
        p = movePoint(p.latitude, p.longitude, Math.abs(east), east >= 0 ? 90 : 270);
      }
      pts.push([p.longitude, p.latitude]);
    }
    return pts;
  }, [visible, lat, lon, major, minor, heading]);

  const geoJSON = useMemo(() => ({
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  }), [coords]);

  if (!visible) return null;

  return (
    <MapLibreGL.ShapeSource id="confidence-ellipse" shape={geoJSON}>
      <MapLibreGL.FillLayer
        id="confidence-ellipse-fill"
        style={{
          fillColor: fillColor,
          fillOpacity: isDr ? 0.5 : 0.4,
        }}
      />
      <MapLibreGL.LineLayer
        id="confidence-ellipse-stroke"
        style={{
          lineColor: strokeColor,
          lineWidth: isDr ? 2 : 1.5,
          lineOpacity: 0.9,
          ...(isDr ? { lineDasharray: [2, 1.6] } : null),
        }}
      />
    </MapLibreGL.ShapeSource>
  );
}
