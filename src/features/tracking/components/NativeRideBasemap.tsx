import { Camera, type CameraRef, GeoJSONSource, type GeoJSONSourceProps, type InitialViewState, Layer, type LngLat, Map, RasterDEMSource } from '@maplibre/maplibre-react-native';
import { LocateFixed, Maximize, Mountain, RefreshCw } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActivityRoute, RoutePoint } from '@/database/activities';
import { ActivityRouteMap } from '@/features/activities/components/ActivityRouteMap';
import { radius, spacing, typography, useTheme, themedStyles } from '@/theme';

import type { RideBasemapProps } from './RideBasemap';

const styleUrl = 'https://tiles.openfreemap.org/styles/liberty';
const terrainTiles = ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'];
const initialView = { center: [-102, 23] as LngLat, zoom: 4 };
const rideZoom = 16;

function coordinates(point: RoutePoint): LngLat {
  return [point.longitude, point.latitude];
}

function routeView(route: ActivityRoute): InitialViewState {
  const origin = route.find(segment => segment.length)?.[0];
  if (!origin) return initialView;
  let west = origin.longitude;
  let east = west;
  let south = origin.latitude;
  let north = south;
  for (const segment of route) {
    for (const point of segment) {
      const longitude = origin.longitude + ((point.longitude - origin.longitude + 540) % 360 - 180);
      west = Math.min(west, longitude);
      east = Math.max(east, longitude);
      south = Math.min(south, point.latitude);
      north = Math.max(north, point.latitude);
    }
  }
  if (Math.max(east - west, north - south) < 0.0005) {
    return { center: [((west + east) / 2 + 540) % 360 - 180, (south + north) / 2], zoom: rideZoom };
  }
  return { bounds: [west, south, east, north], padding: { top: 24, right: 24, bottom: 24, left: 24 } };
}

export default memo(function NativeRideBasemap({ route, guideRoute, viewport, variant = 'live' }: RideBasemapProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const live = variant === 'live';
  const preview = variant === 'preview';
  const guideView = useMemo(() => guideRoute ? routeView(guideRoute) : null, [guideRoute]);
  const view = useMemo(() => live ? guideView ?? initialView : routeView(route), [guideView, live, route]);
  const camera = useRef<CameraRef>(null);
  const centered = useRef(false);
  const [ready, setReady] = useState(false);
  const [following, setFollowing] = useState(true);
  const [relief, setRelief] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = live ? route.at(-1)?.at(-1) : undefined;
  const guideData = useMemo<GeoJSONSourceProps['data']>(() => ({
    type: 'FeatureCollection',
    features: (guideRoute ?? []).filter(segment => segment.length > 1).map(segment => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: segment.map(coordinates) },
    })),
  }), [guideRoute]);
  const guideStart = guideRoute?.find(segment => segment.length > 0)?.[0];
  const data = useMemo<GeoJSONSourceProps['data']>(() => ({
    type: 'FeatureCollection',
    features: route.filter(segment => segment.length > 0).map(segment => ({
      type: 'Feature',
      properties: {},
      geometry: segment.length === 1
        ? { type: 'Point', coordinates: coordinates(segment[0]) }
        : { type: 'LineString', coordinates: segment.map(coordinates) },
    })),
  }), [route]);
  const position = useMemo<GeoJSONSourceProps['data']>(() => ({
    type: 'FeatureCollection',
    features: latest ? [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: coordinates(latest) },
    }] : [],
  }), [latest]);

  useEffect(() => {
    if (!ready || !following || !latest || !camera.current) return;
    camera.current.easeTo({
      center: coordinates(latest),
      zoom: centered.current ? undefined : rideZoom,
      duration: 300,
    });
    centered.current = true;
  }, [following, latest, ready]);

  function recenter() {
    if (!latest) return;
    if (following) {
      camera.current?.easeTo({ center: coordinates(latest), zoom: rideZoom, duration: 300 });
    } else {
      centered.current = false;
      setFollowing(true);
    }
  }

  const fitRoute = useCallback(() => {
    if ('bounds' in view && view.bounds) {
      camera.current?.fitBounds(view.bounds, { padding: view.padding, duration: 300 });
    } else if ('center' in view && view.center) {
      camera.current?.easeTo({ center: view.center, zoom: view.zoom, duration: 300 });
    }
  }, [view]);

  useEffect(() => {
    if (ready && live && guideView && !latest) fitRoute();
  }, [fitRoute, guideView, latest, live, ready]);

  if (failed) {
    if (preview) return <Text style={styles.previewNotice}>Mapa no disponible</Text>;
    return (
      <View style={viewport && styles.fullscreen}>
        <ActivityRouteMap route={route} guideRoute={guideRoute} live={live} fill={!!viewport} />
        <Pressable accessibilityRole="button" onPress={() => {
          centered.current = false;
          setAttempt(current => current + 1);
          setFailed(false);
        }} style={[styles.retry, viewport && styles.fullscreenRetry]}>
          <RefreshCw color={colors.textPrimary} size={16} />
          <Text style={styles.retryLabel}>No se cargó el mapa · Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={viewport ? styles.fullscreen : preview ? styles.previewFrame : [styles.frame, !live && styles.activityFrame]}>
      <Map
        key={attempt}
        mapStyle={styleUrl}
        androidView="texture"
        logo={false}
        dragPan={!preview}
        touchZoom={!preview}
        doubleTapZoom={!preview}
        doubleTapHoldZoom={!preview}
        touchRotate={!preview}
        touchPitch={!preview}
        compass={!preview}
        contentInset={viewport}
        attributionPosition={viewport ? { top: viewport.top + 8, right: viewport.right + 8 } : { top: 8, left: 8 }}
        compassPosition={viewport ? { top: viewport.top + 8, right: viewport.right + 48 } : { top: 8, right: 8 }}
        onDidFinishLoadingStyle={() => setReady(true)}
        onDidFailLoadingMap={() => {
          setReady(false);
          setFailed(true);
        }}
        onRegionWillChange={({ nativeEvent }) => {
          if (live && nativeEvent.userInteraction) setFollowing(false);
        }}
      >
        <Camera ref={camera} initialViewState={view} />
        {!preview && relief && (
          <RasterDEMSource
            id="ride-elevation"
            tiles={terrainTiles}
            tileSize={512}
            maxzoom={12}
            encoding="terrarium"
            attribution='<a href="https://mapterhorn.com/attribution/">Mapterhorn</a>'
          >
            <Layer
              type="hillshade"
              id="ride-relief"
              beforeId="road_motorway_link_casing"
              paint={{ 'hillshade-exaggeration': 0.45, 'hillshade-illumination-anchor': 'map' }}
            />
          </RasterDEMSource>
        )}
        {guideRoute && (
          <GeoJSONSource id="ride-guide" data={guideData}>
            <Layer id="ride-guide-line" type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.routeGuide, 'line-width': 5, 'line-dasharray': [2, 2] }} />
          </GeoJSONSource>
        )}
        {guideStart && (
          <GeoJSONSource id="ride-guide-start" data={{
            type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: coordinates(guideStart) },
          }}>
            <Layer id="ride-guide-start-marker" type="circle"
              paint={{ 'circle-color': colors.background, 'circle-radius': 5, 'circle-stroke-color': colors.routeGuide, 'circle-stroke-width': 2 }} />
          </GeoJSONSource>
        )}
        <GeoJSONSource id="ride-track" data={data}>
          <Layer
            id="ride-track-outline"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#29342F', 'line-width': 7 }}
          />
          <Layer
            id="ride-track-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.primary, 'line-width': 4 }}
          />
          <Layer id="ride-track-points" type="circle" paint={{ 'circle-color': colors.primary, 'circle-radius': 3 }} />
        </GeoJSONSource>
        {live && <GeoJSONSource id="ride-position" data={position}>
          <Layer
            id="ride-position-marker"
            type="circle"
            paint={{
              'circle-color': '#1479D7',
              'circle-radius': 7,
              'circle-stroke-width': 3,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
        </GeoJSONSource>}
      </Map>
      {!preview && <View style={[
        styles.controls,
        viewport
          ? { top: viewport.top + 56, right: viewport.right + spacing.sm }
          : { bottom: spacing.xl + spacing.sm },
      ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={relief ? 'Ocultar relieve' : 'Mostrar relieve'}
          accessibilityState={{ selected: relief }}
          onPress={() => setRelief(current => !current)}
          style={styles.button}
        >
          <Mountain size={22} color={relief ? colors.primary : colors.textPrimary} />
        </Pressable>
        {live ? <Pressable
          accessibilityRole="button"
          accessibilityLabel="Centrar en mi posición"
          accessibilityState={{ disabled: !latest }}
          disabled={!latest}
          onPress={recenter}
          style={[styles.button, !latest && styles.disabled]}
        >
          <LocateFixed size={22} color={following && latest ? colors.primary : colors.textPrimary} />
        </Pressable> : null}
        {(!live || guideRoute) && (
          <Pressable accessibilityRole="button" accessibilityLabel={live ? 'Ver ruta guardada completa' : 'Ver recorrido completo'} onPress={() => {
            if (live) setFollowing(false);
            fitRoute();
          }} style={styles.button}>
            <Maximize size={22} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>}
    </View>
  );
});

const useStyles = themedStyles(colors => StyleSheet.create({
  frame: { width: '100%', aspectRatio: 360 / 316, maxHeight: 420, backgroundColor: colors.surface },
  activityFrame: { aspectRatio: 360 / 252 },
  previewFrame: { flex: 1, backgroundColor: colors.surface },
  previewNotice: { ...typography.caption, color: colors.textSecondary, padding: spacing.sm },
  fullscreen: { flex: 1, backgroundColor: colors.surface },
  controls: { position: 'absolute', right: spacing.sm, gap: spacing.xs },
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  retry: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.card,
    backgroundColor: colors.background,
  },
  retryLabel: { ...typography.caption, color: colors.textPrimary },
  fullscreenRetry: { top: '42%', left: 'auto', alignSelf: 'center' },
}));
