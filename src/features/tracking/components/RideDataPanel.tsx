import { ChevronDown, ChevronUp, Gauge, Route, Timer } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard, MetricCard } from '@/components';
import { averageSpeed, formatDistance, formatDuration, formatSpeed } from '@/features/activities/format';
import { colors, radius, spacing, typography } from '@/theme';

interface RideDataPanelProps {
  elapsedMs: number;
  distanceM: number | null;
  currentSpeedKmh: number | null;
}

export function RideDataPanel({ elapsedMs, distanceM, currentSpeedKmh }: RideDataPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const Chevron = expanded ? ChevronDown : ChevronUp;
  const time = formatDuration(elapsedMs);
  const distance = formatDistance(distanceM);

  return (
    <AppCard padding="sm" style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Datos de la rodada"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(current => !current)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <View style={styles.handle} />
        <View style={styles.row}>
          <View style={styles.label}>
            <Text style={styles.title}>Datos de la rodada</Text>
            {!expanded && <Text style={styles.summary}>{time} · {distance} km</Text>}
          </View>
          <Chevron size={22} color={colors.primary} />
        </View>
      </Pressable>
      {expanded && (
        <View style={styles.metrics}>
          <View style={styles.row}>
            <MetricCard label="Tiempo activo" value={time} icon={Timer} />
            <MetricCard label="Distancia" value={distance} unit="km" icon={Route} />
          </View>
          <View style={styles.row}>
            <MetricCard label="Vel. actual" value={formatSpeed(currentSpeedKmh)} unit="km/h" icon={Gauge} highlighted />
            <MetricCard label="Vel. media" value={formatSpeed(averageSpeed(distanceM, elapsedMs))} unit="km/h" />
          </View>
        </View>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.sm },
  toggle: { paddingHorizontal: spacing.xs, paddingBottom: spacing.xs, gap: spacing.xs, minHeight: 44 },
  handle: { width: 34, height: 4, borderRadius: radius.sm, backgroundColor: colors.textSecondary, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1 },
  title: { ...typography.subtitle, color: colors.textPrimary },
  summary: { ...typography.bodySmall, color: colors.textSecondary },
  metrics: { gap: spacing.sm },
  pressed: { opacity: 0.7 },
});
