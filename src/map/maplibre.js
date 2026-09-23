// PS168 — MapLibre compatibility adapter for MapLibre React Native v11
import React from 'react';
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  Marker,
  ViewAnnotation,
  OfflineManager,
  UserLocation,
} from '@maplibre/maplibre-react-native';

// MapView adapter
export const MapView = React.forwardRef(({ styleURL, mapStyle, onDidFinishLoadingMap, children, ...props }, ref) => {
  return (
    <Map
      ref={ref}
      mapStyle={mapStyle || styleURL}
      onLayout={() => {
        onDidFinishLoadingMap?.();
      }}
      onDidFinishLoadingStyle={() => {
        onDidFinishLoadingMap?.();
      }}
      onDidFinishLoadingMap={() => {
        onDidFinishLoadingMap?.();
      }}
      {...props}
    >
      {children}
    </Map>
  );
});

MapView.displayName = 'MapView';

// v11 fitBounds padding accepts a number or an edge object; normalize the
// legacy [top, right, bottom, left] array form used across the app
function normalizePadding(p) {
  if (Array.isArray(p)) {
    return {
      paddingTop: p[0] ?? 50,
      paddingRight: p[1] ?? 50,
      paddingBottom: p[2] ?? 50,
      paddingLeft: p[3] ?? 50,
    };
  }
  return p;
}

// Camera adapter
export const CameraView = React.forwardRef(({ defaultSettings, initialViewState, ...props }, ref) => {
  const internalRef = React.useRef(null);
  const zoomRef = React.useRef(defaultSettings?.zoomLevel || initialViewState?.zoom || 14);

  React.useImperativeHandle(ref, () => ({
    setCamera: (config) => {
      if (config.zoomLevel != null) zoomRef.current = config.zoomLevel;
      if (config.centerCoordinate) {
        internalRef.current?.easeTo({
          center: config.centerCoordinate,
          zoom: config.zoomLevel,
          bearing: config.heading ?? config.bearing,
          pitch: config.pitch,
          duration: config.animationDuration || 500,
        });
      }
    },
    zoomTo: (zoom, duration = 300) => {
      zoomRef.current = zoom;
      internalRef.current?.easeTo({
        zoom,
        duration,
      });
    },
    flyTo: (center, zoom, duration = 1000, options = {}) => {
      if (zoom != null) zoomRef.current = zoom;
      internalRef.current?.flyTo({
        center,
        zoom,
        duration,
        ...options,
      });
    },
    jumpTo: (center, options = {}) => {
      if (options.zoom != null) zoomRef.current = options.zoom;
      internalRef.current?.jumpTo({
        center,
        ...options,
      });
    },
    easeTo: (options) => {
      if (options?.zoom != null) zoomRef.current = options.zoom;
      internalRef.current?.easeTo(options);
    },
    fitBounds: (ne, sw, padding = 50, duration = 600) => {
      internalRef.current?.fitBounds([ne, sw], {
        padding: normalizePadding(padding),
        duration,
        easing: 'fly',
      });
    },
    getZoom: () => zoomRef.current,
    // Fed by BaseMap from onRegionDidChange so getZoom() tracks the live map
    notifyZoom: (z) => {
      if (z != null && !Number.isNaN(z)) zoomRef.current = z;
    },
    getNativeRef: () => internalRef.current,
  }));

  const viewState = initialViewState || (defaultSettings?.centerCoordinate ? {
    center: defaultSettings.centerCoordinate,
    zoom: defaultSettings.zoomLevel || 14,
  } : undefined);

  return (
    <Camera
      ref={internalRef}
      initialViewState={viewState}
      {...props}
    />
  );
});

CameraView.displayName = 'CameraView';

// ShapeSource / GeoJSONSource adapter
export const ShapeSource = ({ id, shape, data, children, ...props }) => {
  return (
    <GeoJSONSource id={id} data={data || shape} {...props}>
      {children}
    </GeoJSONSource>
  );
};

// LineLayer adapter
export const LineLayer = ({ id, style, ...props }) => {
  return <Layer id={id} type="line" style={style} {...props} />;
};

// FillLayer adapter
export const FillLayer = ({ id, style, ...props }) => {
  return <Layer id={id} type="fill" style={style} {...props} />;
};

// CircleLayer adapter
export const CircleLayer = ({ id, style, ...props }) => {
  return <Layer id={id} type="circle" style={style} {...props} />;
};

// MarkerView / Marker adapter
export const MarkerView = ({ coordinate, lngLat, anchor, children, ...props }) => {
  const coords = lngLat || coordinate;
  let normalizedAnchor = 'center';
  if (typeof anchor === 'string') {
    normalizedAnchor = anchor;
  } else if (anchor && typeof anchor === 'object') {
    if (anchor.y === 1 || anchor.y >= 0.8) {
      normalizedAnchor = 'bottom';
    } else if (anchor.y === 0) {
      normalizedAnchor = 'top';
    }
  }

  if (!coords) return null;

  return (
    <Marker lngLat={coords} anchor={normalizedAnchor} {...props}>
      {children}
    </Marker>
  );
};

export const PointAnnotation = MarkerView;

const MapLibreGL = {
  MapView,
  Camera: CameraView,
  ShapeSource,
  GeoJSONSource,
  LineLayer,
  FillLayer,
  CircleLayer,
  MarkerView,
  PointAnnotation,
  OfflineManager,
  offlineManager: OfflineManager,
  UserLocation,
};

export default MapLibreGL;
export {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  Marker,
  ViewAnnotation,
  OfflineManager,
  UserLocation,
};
