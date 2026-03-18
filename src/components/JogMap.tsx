/**
 * JogMap — Live & review map for jog sessions
 *
 * Uses MapLibre GL with OpenFreeMap tiles (free, no API key, zero telemetry).
 * Shows:
 *   - User's current position (live mode)
 *   - Route polyline trail (accent green)
 *   - Start / end markers
 *   - Distance badge overlay
 *   - City-level context (auto-zoom to fit route with padding)
 */

import React, { useRef, useEffect, useMemo, memo, useState, Component, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { GeoPoint } from '../engines/DistanceEngine';

// Lazy-import MapLibre — native module may not be registered on first run
let MapView: any;
let Camera: any;
let UserLocation: any;
let ShapeSource: any;
let LineLayer: any;
let PointAnnotation: any;
let mapLibreAvailable = false;

// MapLibre native module requires a dev-client build — it cannot work in Expo Go.
// The import is wrapped in try/catch to gracefully degrade to the fallback UI.
try {
  const ML = require('@maplibre/maplibre-react-native');
  // Check if the default export has the expected shape
  const MLDefault = ML.default || ML;

  MapView = MLDefault.MapView || ML.MapView;
  Camera = MLDefault.Camera || ML.Camera;
  UserLocation = MLDefault.UserLocation || ML.UserLocation;
  ShapeSource = MLDefault.ShapeSource || ML.ShapeSource;
  LineLayer = MLDefault.LineLayer || ML.LineLayer;
  PointAnnotation = MLDefault.PointAnnotation || ML.PointAnnotation;

  // Initialize MapLibre — required before any map usage
  if (typeof MLDefault.setAccessToken === 'function') {
    MLDefault.setAccessToken(null); // No token needed for free tile servers
  } else if (typeof ML.setAccessToken === 'function') {
    ML.setAccessToken(null);
  }

  if (typeof MLDefault.setConnected === 'function') {
    MLDefault.setConnected(true);
  } else if (typeof ML.setConnected === 'function') {
    ML.setConnected(true);
  }

  // Verify a critical component actually exists (catches registration failures)
  if (MapView) {
    mapLibreAvailable = true;
  }
} catch {
  // MapLibre native module not available — component will show fallback
  // This is expected in Expo Go; rebuild with dev-client to enable maps
}

// OpenFreeMap — free vector tiles, no API key, no telemetry
// Dark style for dark theme, positron for light
const TILE_STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
} as const;

// ============================================
// TYPES
// ============================================

interface JogMapProps {
  /** Route points from DistanceEngine */
  routePoints: GeoPoint[] | [number, number][];
  /** Whether the jog is currently active (follows user) */
  isLive?: boolean;
  /** Map height */
  height?: number;
  /** Total distance in meters (shown as badge) */
  distanceMeters?: number;
  /** Optional: pace string to show */
  pace?: string;
  /** Called when map is ready */
  onReady?: () => void;
}

// ============================================
// HELPERS
// ============================================

/** Normalize route data to [lng, lat] coordinate pairs (GeoJSON order) */
function normalizeRoute(
  points: GeoPoint[] | [number, number][]
): [number, number][] {
  if (points.length === 0) return [];
  // Check if first element is a GeoPoint object or a tuple
  const first = points[0];
  if (typeof first === 'object' && 'lat' in first) {
    // GeoPoint[] — convert to [lng, lat] for GeoJSON
    return (points as GeoPoint[]).map((p) => [p.lng, p.lat]);
  }
  // Already [lat, lng] tuples from usePedometer — swap to [lng, lat] for GeoJSON
  return (points as [number, number][]).map(([lat, lng]) => [lng, lat]);
}

/** Calculate bounding box for route */
function getBounds(coords: [number, number][]): {
  ne: [number, number];
  sw: [number, number];
} {
  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return {
    ne: [maxLng, maxLat],
    sw: [minLng, minLat],
  };
}

/** Build GeoJSON LineString from coordinates */
function routeToGeoJSON(
  coords: [number, number][]
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      },
    ],
  };
}

/** Format distance for badge */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

// ============================================
// MAP ERROR BOUNDARY
// ============================================

interface MapErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface MapErrorBoundaryState {
  hasError: boolean;
}

class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  state: MapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) console.warn('[JogMap] MapView crashed:', error.message);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ============================================
// COMPONENT
// ============================================

const JogMap = memo(function JogMap({
  routePoints,
  isLive = false,
  height = 280,
  distanceMeters,
  pace,
  onReady,
}: JogMapProps) {
  const { theme } = useTheme();
  const cameraRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  // Normalize route to [lng, lat] GeoJSON format
  const coords = useMemo(() => normalizeRoute(routePoints), [routePoints]);
  const routeGeoJSON = useMemo(() => routeToGeoJSON(coords), [coords]);

  // Start and end points
  const startPoint = coords.length > 0 ? coords[0] : null;
  const endPoint = coords.length > 1 ? coords[coords.length - 1] : startPoint;

  // Choose tile style based on theme
  const styleURL = theme.isDark ? TILE_STYLES.dark : TILE_STYLES.light;

  // Fit camera to route bounds (review mode)
  useEffect(() => {
    if (!isLive && coords.length >= 2 && cameraRef.current) {
      const bounds = getBounds(coords);
      cameraRef.current.fitBounds(bounds.ne, bounds.sw, [60, 60, 60, 60], 500);
    }
  }, [isLive, coords]);

  // Follow user in live mode
  useEffect(() => {
    if (isLive && endPoint && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: endPoint,
        zoomLevel: 16,
        animationDuration: 800,
      });
    }
  }, [isLive, endPoint]);

  // Fallback when MapLibre native module is not available
  if (!mapLibreAvailable) {
    if (__DEV__) console.warn('[JogMap] MapLibre native module unavailable (dev-client build required)');
    return (
      <View style={[styles.emptyContainer, { height, backgroundColor: theme.colors.surfaceVariant }]}> 
        <MaterialCommunityIcons name="map-marker-path" size={36} color={theme.colors.textMuted} />
        <Text style={[styles.emptyText, { color: theme.colors.textMuted, marginTop: 8 }]}> 
          {isLive ? 'Live map requires native build' : 'Map unavailable'}
        </Text>
        {distanceMeters != null && distanceMeters > 0 && (
          <Text style={[styles.distanceText, { color: theme.colors.accent, marginTop: 8 }]}> 
            {formatDistance(distanceMeters)}
          </Text>
        )}
        {pace && (
          <Text style={[styles.emptyText, { color: theme.colors.textMuted, marginTop: 4 }]}>
            {pace}
          </Text>
        )}
      </View>
    );
  }

  if (coords.length === 0 && !isLive) {
    if (__DEV__) console.warn('[JogMap] No route coords available (routePoints empty)');
    return (
      <View style={[styles.emptyContainer, { height, backgroundColor: theme.colors.surfaceVariant }]}> 
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}> 
          No route data available
        </Text>
      </View>
    );
  }

  const defaultCenter: [number, number] = startPoint || [28.0473, -26.2041]; // Johannesburg fallback
  const accentColor = theme.colors.accent; // #10B981

  const mapFallback = (
    <View style={[styles.emptyContainer, { height, backgroundColor: theme.colors.surfaceVariant }]}>
      <MaterialCommunityIcons name="map-marker-path" size={32} color={theme.colors.textMuted} />
      <Text style={[styles.emptyText, { color: theme.colors.textMuted, marginTop: 8 }]}>
        Map unavailable
      </Text>
      {distanceMeters != null && distanceMeters > 0 && (
        <Text style={[styles.distanceText, { color: theme.colors.accent, marginTop: 8 }]}>
          {formatDistance(distanceMeters)}
        </Text>
      )}
      {pace && (
        <Text style={[styles.emptyText, { color: theme.colors.textMuted, marginTop: 4 }]}>
          {pace}
        </Text>
      )}
    </View>
  );

  return (
    <MapErrorBoundary fallback={mapFallback}>
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={styleURL}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        onDidFinishLoadingMap={onReady}
      >
        {/* Camera */}
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: defaultCenter,
            zoomLevel: isLive ? 16 : 14,
          }}
          {...(isLive && endPoint
            ? {
                centerCoordinate: endPoint,
                zoomLevel: 16,
                animationMode: 'flyTo',
                animationDuration: 800,
              }
            : {})}
        />

        {/* User location puck (live mode only) */}
        {isLive && (
          <UserLocation
            visible
            showsUserHeadingIndicator
            androidRenderMode="compass"
          />
        )}

        {/* Route trail */}
        {coords.length >= 2 && (
          <ShapeSource id="routeSource" shape={routeGeoJSON}>
            {/* Glow layer (wider, semi-transparent beneath) */}
            <LineLayer
              id="routeGlow"
              style={{
                lineColor: accentColor + '40',
                lineWidth: 8,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Main route line */}
            <LineLayer
              id="routeLine"
              style={{
                lineColor: accentColor,
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        )}

        {/* Start marker */}
        {startPoint && (
          <PointAnnotation
            id="startMarker"
            coordinate={startPoint}
          >
            <View style={[styles.marker, styles.startMarker, { backgroundColor: accentColor }]}>
              <View style={styles.markerInner} />
            </View>
          </PointAnnotation>
        )}

        {/* End / current position marker (review mode) */}
        {!isLive && endPoint && coords.length > 1 && (
          <PointAnnotation
            id="endMarker"
            coordinate={endPoint}
          >
            <View style={[styles.marker, styles.endMarker, { backgroundColor: theme.colors.error }]}>
              <View style={styles.markerInner} />
            </View>
          </PointAnnotation>
        )}
      </MapView>

      {/* Distance badge overlay */}
      {distanceMeters != null && distanceMeters > 0 && (
        <View style={[styles.distanceBadge, { backgroundColor: theme.colors.surface + 'DD' }]}>
          <Text style={[styles.distanceText, { color: accentColor }]}>
            {formatDistance(distanceMeters)}
          </Text>
          {pace && (
            <Text style={[styles.paceText, { color: theme.colors.textMuted }]}>
              {pace}
            </Text>
          )}
        </View>
      )}

      {/* LIVE indicator */}
      {isLive && (
        <View style={[styles.liveBadge, { backgroundColor: theme.colors.error }]}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}

      {/* Loading overlay for initial tile download */}
      {coords.length === 0 && isLive && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={accentColor} size="small" />
          <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
            Waiting for GPS...
          </Text>
        </View>
      )}
    </View>
    </MapErrorBoundary>
  );
});

export default JogMap;

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Markers
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    // Shadow
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
    }),
  },
  startMarker: {},
  endMarker: {},
  markerInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },

  // Distance badge (bottom-left)
  distanceBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceText: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  paceText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // LIVE badge (top-right)
  liveBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Loading state
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
