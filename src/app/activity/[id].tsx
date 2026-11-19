import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Gauge, Mountain, Pencil, Route, Timer } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppCard, EmptyState, ErrorState, LoadingState, MetricCard } from '@/components';
import { type Activity, type ActivityRoute, type RideDetails, loadActivities, loadActivityRoute, rideEffortLabels, updateRideDetails } from '@/database/activities';
import { ElevationProfile } from '@/features/activities/components/ElevationProfile';
import { RideEditor } from '@/features/activities/components/RideEditor';
import { RideShareCard } from '@/features/activities/components/RideShareCard';
import { activityDateFormat, averageSpeed, formatDistance, formatDuration, formatElevationGain, formatSpeed } from '@/features/activities/format';
import { RideBasemap } from '@/features/tracking/components/RideBasemap';
import { PublishRideButton } from '@/features/feed/PublishRideButton';
import { spacing, typography, themedStyles } from '@/theme';

type SummaryState =
  | { status: 'loading' | 'missing' | 'error' }
  | { status: 'ready'; activity: Activity; route: ActivityRoute | null };

export default function ActivityScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const startedAt = typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : NaN;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.back}>
          <AppButton
            icon={ArrowLeft}
            label="Volver"
            size="md"
            variant="ghost"
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
          />
        </View>
        {Number.isSafeInteger(startedAt) ? (
          <ActivitySummary key={startedAt} startedAt={startedAt} />
        ) : (
          <EmptyState icon={Route} title="Rodada no encontrada" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivitySummary({ startedAt }: { startedAt: number }) {
  const styles = useStyles();
  const [attempt, setAttempt] = useState(0);
  const [summary, setSummary] = useState<SummaryState>({ status: 'loading' });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const activity = (await loadActivities()).find(item => item.startedAt === startedAt);
        if (!active) return;
        if (!activity) {
          setSummary({ status: 'missing' });
          return;
        }
        const route = await loadActivityRoute(startedAt).catch(() => null);
        if (active) setSummary({ status: 'ready', activity, route });
      } catch {
        if (active) setSummary({ status: 'error' });
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [startedAt, attempt]);

  function retry() {
    setSummary({ status: 'loading' });
    setAttempt(current => current + 1);
  }

  if (summary.status !== 'ready') {
    switch (summary.status) {
      case 'missing':
        return <EmptyState icon={Route} title="Rodada no encontrada" />;
      case 'error':
        return <ErrorState title="No pudimos abrir la rodada" message="Intenta cargarla de nuevo desde este dispositivo." onRetry={retry} />;
      default:
        return <LoadingState message="Cargando rodada…" />;
    }
  }

  const { activity, route } = summary;

  async function saveDetails(details: RideDetails) {
    const updated = await updateRideDetails(startedAt, details);
    setSummary({ status: 'ready', activity: updated, route });
    setEditing(false);
  }

  return (
    <>
      <Text accessibilityRole="header" style={styles.title}>{activity.name || 'Resumen de rodada'}</Text>
      <Text style={styles.date}>{activityDateFormat.format(activity.startedAt)}</Text>
      {activity.effort && <Text style={styles.heading}>Esfuerzo: {rideEffortLabels[activity.effort]}</Text>}
      <AppButton icon={Pencil} label="Editar rodada" variant="secondary" size="md" onPress={() => setEditing(true)} />
      {editing && <RideEditor initial={activity} onCancel={() => setEditing(false)} onSave={saveDetails} />}
      <View style={styles.metrics}>
        <MetricCard label="Tiempo activo" value={formatDuration(activity.durationMs)} icon={Timer} />
        <MetricCard label="Distancia" value={formatDistance(activity.distanceM)} unit="km" highlighted />
      </View>
      <View style={styles.metrics}>
        <MetricCard
          label="Velocidad media"
          icon={Gauge}
          value={formatSpeed(averageSpeed(activity.distanceM, activity.durationMs))}
          unit="km/h"
        />
        {activity.elevationGainM != null && (
          <MetricCard label="Desnivel positivo" value={formatElevationGain(activity.elevationGainM)} unit="m" icon={Mountain} />
        )}
      </View>
      <Text accessibilityRole="header" style={styles.heading}>Recorrido</Text>
      <AppCard>
        {route === null ? (
          <ErrorState title="No pudimos abrir el recorrido" message="Las métricas de la rodada siguen disponibles." onRetry={retry} />
        ) : route.some(segment => segment.length > 0) ? (
          <RideBasemap route={route} variant="activity" />
        ) : (
          <EmptyState icon={Route} title="Sin recorrido GPS" message="Esta rodada se guardó sin puntos GPS." />
        )}
      </AppCard>
      {route?.some(segment => segment.some(point => point.altitudeM != null)) && <ElevationProfile route={route} />}
      {route !== null && <PublishRideButton activity={activity} route={route} />}
      {route?.some(segment => segment.length > 0) && <RideShareCard activity={activity} route={route} />}
    </>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 600, alignSelf: 'center' },
  back: { alignSelf: 'flex-start' },
  title: { ...typography.title, color: colors.textPrimary },
  heading: { ...typography.subtitle, color: colors.textPrimary },
  date: { ...typography.body, color: colors.textSecondary },
  metrics: { flexDirection: 'row', gap: spacing.sm },
}));
