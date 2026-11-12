import { Gauge, Maximize2, Minimize2, Mountain, Route, Timer } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MetricCard } from '@/components';
import type { ActivityRoute } from '@/database/activities';
import { ElevationProfile } from '@/features/activities/components/ElevationProfile';
import { averageSpeed, formatDistance, formatDuration, formatElevationGain, formatSpeed } from '@/features/activities/format';
import { colors, radius, spacing, typography } from '@/theme';

interface RideDataPanelProps {
  route: ActivityRoute;
  elapsedMs: number;
  distanceM: number | null;
  elevationGainM: number | null;
  currentSpeedKmh: number | null;
  running: boolean;
}

export function RideDataPanel({
  route, elapsedMs, distanceM, elevationGainM, currentSpeedKmh, running,
}: RideDataPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const time = formatDuration(elapsedMs);
  const distance = formatDistance(distanceM);
  const elevation = formatElevationGain(elevationGainM);
  const close = () => setExpanded(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ampliar datos de la rodada. Duración ${time}, distancia ${distance} kilómetros, desnivel positivo ${elevation} metros`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(true)}
        style={({ pressed }) => [styles.panel, pressed && styles.pressed]}
      >
        <View style={styles.panelHeader}>
          <Text style={styles.title}>Datos de la rodada</Text>
          <Maximize2 size={20} color={colors.primary} />
        </View>
        <View style={styles.row}>
          <SummaryMetric label="Duración" value={time} />
          <SummaryMetric label="Distancia (km)" value={distance} prominent />
          <SummaryMetric label="Desnivel (m)" value={elevation} />
        </View>
      </Pressable>
      {expanded && (
        <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
          <SafeAreaView style={styles.screen}>
            <View style={styles.detailHeader}>
              <Text accessibilityRole="header" style={styles.heading}>Datos de la rodada</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Minimizar datos y volver al mapa"
                onPress={close}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              >
                <Minimize2 size={22} color={colors.primary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.details}>
              <Text style={styles.status}>{running ? 'Rodada en curso' : 'Rodada pausada'}</Text>
              <MetricCard label="Distancia" value={distance} unit="km" icon={Route} highlighted />
              <View style={styles.row}>
                <MetricCard label="Duración" value={time} icon={Timer} />
                <MetricCard label="Desnivel positivo" value={elevation} unit="m" icon={Mountain} />
              </View>
              <View style={styles.row}>
                <MetricCard label="Velocidad actual" value={formatSpeed(currentSpeedKmh)} unit="km/h" icon={Gauge} />
                <MetricCard label="Velocidad media" value={formatSpeed(averageSpeed(distanceM, elapsedMs))} unit="km/h" />
              </View>
              <ElevationProfile route={route} />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}

function SummaryMetric({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.value, prominent && styles.prominent]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    elevation: 4,
  },
  panelHeader: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  metric: { flex: 1, minWidth: 0, alignItems: 'stretch', justifyContent: 'flex-end', gap: spacing.xxs },
  title: { flex: 1, ...typography.subtitle, color: colors.textPrimary },
  value: { ...typography.subtitle, color: colors.textPrimary, textAlign: 'center', fontVariant: ['tabular-nums'] },
  prominent: { ...typography.title, color: colors.primary },
  label: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  screen: { flex: 1, backgroundColor: colors.background },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  heading: { flex: 1, ...typography.title, color: colors.textPrimary },
  close: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: { gap: spacing.md, padding: spacing.lg, width: '100%', maxWidth: 600, alignSelf: 'center' },
  status: { ...typography.bodySmall, color: colors.textSecondary },
  pressed: { opacity: 0.75 },
});
