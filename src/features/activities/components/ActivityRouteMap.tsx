import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Polyline, Rect } from 'react-native-svg';

import type { ActivityRoute } from '@/database/activities';
import { colors, spacing, typography } from '@/theme';

const width = 360;
const height = 224;
const liveHeight = 316;
const padding = 22;

export function projectRoute(route: ActivityRoute, viewportHeight = height) {
  const origin = route.find(segment => segment.length > 0)?.[0];
  if (!origin) return [];

  const longitudeScale = Math.cos(origin.latitude * Math.PI / 180);
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  const segments = route.filter(segment => segment.length > 0).map(segment => segment.map(point => {
    const x = ((point.longitude - origin.longitude + 540) % 360 - 180) * longitudeScale;
    const y = origin.latitude - point.latitude;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    return { x, y };
  }));

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min((width - 2 * padding) / spanX, (viewportHeight - 2 * padding) / spanY);
  return segments.map(segment => segment.map(({ x, y }) => ({
    x: Number.isFinite(scale) ? width / 2 + (x - (minX + maxX) / 2) * scale : width / 2,
    y: Number.isFinite(scale) ? viewportHeight / 2 + (y - (minY + maxY) / 2) * scale : viewportHeight / 2,
  })));
}

export const ActivityRouteMap = memo(function ActivityRouteMap({
  route, live = false,
}: { route: ActivityRoute; live?: boolean }) {
  const viewportHeight = live ? liveHeight : height;
  const segments = projectRoute(route, viewportHeight);
  const start = segments[0]?.[0];
  const end = segments[segments.length - 1]?.at(-1);
  if (!start && !live) return null;

  return (
    <View style={[styles.map, live && styles.live]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${viewportHeight}`}
        accessible={segments.length > 0}
        accessibilityRole="image"
        accessibilityLabel={`Trazado GPS de la rodada, ${segments.length} ${segments.length === 1 ? 'tramo' : 'tramos'}`}
      >
        {live && (
          <>
            <Defs>
              <Pattern id="ride-grid" width={32} height={32} patternUnits="userSpaceOnUse">
                <Path d="M 0 32 V 0 H 32" fill="none" stroke={colors.border} strokeWidth={1} />
              </Pattern>
            </Defs>
            <Rect width={width} height={viewportHeight} fill="url(#ride-grid)" opacity={0.5} />
          </>
        )}
        {segments.map((segment, index) => (
          segment.length === 1 ? (
            <Circle key={index} cx={segment[0].x} cy={segment[0].y} r={2.5} fill={colors.primary} />
          ) : (
            <Polyline
              key={index}
              points={segment.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}
              fill="none"
              stroke={colors.primary}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        ))}
        {start && <Circle cx={start.x} cy={start.y} r={6} fill={colors.surface} stroke={colors.primary} strokeWidth={2} />}
        {end && <Circle cx={end.x} cy={end.y} r={live ? 5 : 3} fill={colors.primary} stroke={live ? colors.textPrimary : undefined} strokeWidth={2} />}
      </Svg>
      <Text style={styles.north} accessibilityLabel="Norte hacia arriba">↑ N</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  map: { width: '100%', aspectRatio: width / height, backgroundColor: colors.background },
  live: { aspectRatio: width / liveHeight, maxHeight: 420, backgroundColor: colors.surface },
  north: { position: 'absolute', top: spacing.sm, right: spacing.sm, ...typography.caption, color: colors.textSecondary },
});
