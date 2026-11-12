import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

import { AppCard } from '@/components';
import type { ActivityRoute, RoutePoint } from '@/database/activities';
import { colors, spacing, typography } from '@/theme';

import { formatDistance, formatElevationGain } from '../format';
import { distanceBetween } from '../routeDistance';

const width = 320;
const height = 112;
const padding = 4;

export const ElevationProfile = memo(function ElevationProfile({ route }: { route: ActivityRoute }) {
  const profile = useMemo(() => {
    const lines: { distance: number; altitude: number }[][] = [];
    let distance = 0;
    let lowest = Infinity;
    let highest = -Infinity;

    for (const segment of route) {
      let previous: RoutePoint | undefined;
      let line: (typeof lines)[number] = [];
      for (const point of segment) {
        if (previous) distance += distanceBetween(previous, point);
        previous = point;
        if (point.altitudeM == null) {
          line = [];
          continue;
        }
        if (!line.length) lines.push(line);
        line.push({ distance, altitude: point.altitudeM });
        lowest = Math.min(lowest, point.altitudeM);
        highest = Math.max(highest, point.altitudeM);
      }
    }

    const connected = lines.filter(line => line.length > 1);
    if (!connected.length || distance === 0) return null;

    const altitudeRange = highest - lowest;
    return {
      lowest,
      highest,
      distance,
      lines: connected.map(line => line.map(point => {
        const x = padding + (point.distance / distance) * (width - padding * 2);
        const fraction = altitudeRange === 0 ? 0.5 : (point.altitude - lowest) / altitudeRange;
        const y = height - padding - fraction * (height - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ')),
    };
  }, [route]);

  return (
    <AppCard style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>Perfil de elevación</Text>
      {profile ? (
        <>
          <Text style={styles.caption}>{formatElevationGain(profile.lowest)} a {formatElevationGain(profile.highest)} m de altitud</Text>
          <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            {[padding, height / 2, height - padding].map(y => (
              <Line key={y} x1={padding} x2={width - padding} y1={y} y2={y} stroke={colors.border} />
            ))}
            {profile.lines.map((line, index) => (
              <Polyline key={index} points={line} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </Svg>
          <View style={styles.axis}>
            <Text style={styles.caption}>0 km</Text>
            <Text style={styles.caption}>{formatDistance(profile.distance)} km</Text>
          </View>
        </>
      ) : (
        <Text style={styles.caption}>Se necesitan dos puntos consecutivos con altitud GPS para mostrar el perfil.</Text>
      )}
    </AppCard>
  );
});

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { ...typography.subtitle, color: colors.textPrimary },
  caption: { ...typography.bodySmall, color: colors.textSecondary },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
