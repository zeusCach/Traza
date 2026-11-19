import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Polyline, Stop } from 'react-native-svg';

import { AppCard } from '@/components';
import { spacing, typography, useTheme, themedStyles } from '@/theme';

import { formatDistance, formatDuration, formatElevationGain } from '../format';
import { type groupWeeks, shiftDays } from '../progress';

const shortDate = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const width = 336;
const bottom = 120;

export function WeeklyProgress({ weeks }: { weeks: ReturnType<typeof groupWeeks>['weeks'] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [selected, setSelected] = useState(weeks.length - 1);
  const week = weeks[selected];
  const maxDistance = Math.max(1000, ...weeks.map(item => item.distance));
  const points = weeks.map((item, index) => ({
    x: (index + 0.5) * width / weeks.length,
    y: bottom - item.distance / maxDistance * (bottom - 10),
  }));
  const line = points.map(({ x, y }) => `${x},${y}`).join(' ');
  const active = points[selected];

  return (
    <AppCard style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>Últimas 12 semanas</Text>
      <Text style={styles.caption}>{shortDate.format(week.start)} – {shortDate.format(shiftDays(week.start, 6))} {shiftDays(week.start, 6).getFullYear()}</Text>
      <View style={styles.metrics} accessibilityLiveRegion="polite">
        {[
          ['Distancia', `${formatDistance(week.distance)} km`],
          ['Desnivel', `${formatElevationGain(week.elevation)} m`],
          ['Duración', formatDuration(week.duration)],
        ].map(([label, value]) => (
          <View key={label} style={styles.metric}>
            <Text style={styles.caption}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.chart}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} 130`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="weekly-distance" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.3} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[10, 65, bottom].map(y => (
            <Line key={y} x1={0} x2={width} y1={y} y2={y} stroke={colors.border} />
          ))}
          <Polygon points={`${points[0].x},${bottom} ${line} ${points[points.length - 1].x},${bottom}`} fill="url(#weekly-distance)" />
          <Line x1={active.x} x2={active.x} y1={10} y2={bottom} stroke={colors.textSecondary} />
          <Polyline points={line} fill="none" stroke={colors.primary} strokeWidth={2} strokeLinejoin="round" />
          {points.map(({ x, y }, index) => (
            <Circle key={x} cx={x} cy={y} r={index === selected ? 5 : 3} fill={index === selected ? colors.primary : colors.surface} stroke={colors.primary} strokeWidth={2} />
          ))}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.targets]}>
          {weeks.map((item, index) => (
            <Pressable
              key={item.start.getTime()}
              accessibilityRole="button"
              accessibilityLabel={`Semana del ${shortDate.format(item.start)}, ${formatDistance(item.distance)} kilómetros`}
              accessibilityState={{ selected: index === selected }}
              onPress={() => setSelected(index)}
              style={styles.target}
            />
          ))}
        </View>
      </View>
      <View style={styles.labels}>
        <Text style={styles.caption}>{shortDate.format(weeks[0].start)}</Text>
        <Text style={styles.caption}>{shortDate.format(weeks[5].start)}</Text>
        <Text style={styles.caption}>{shortDate.format(weeks[11].start)}</Text>
      </View>
    </AppCard>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  card: { gap: spacing.sm },
  title: { ...typography.subtitle, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexGrow: 1, minWidth: 65 },
  value: { ...typography.button, color: colors.textPrimary },
  chart: { height: 130 },
  targets: { flexDirection: 'row' },
  target: { flex: 1 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
}));
