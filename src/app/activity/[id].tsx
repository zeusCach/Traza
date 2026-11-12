import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Gauge, Route, Timer } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppCard, EmptyState, ErrorState, LoadingState, MetricCard } from '@/components';
import { type Activity, type ActivityRoute, loadActivities, loadActivityRoute } from '@/database/activities';
import { ActivityRouteMap } from '@/features/activities/components/ActivityRouteMap';
import { activityDateFormat, averageSpeed, formatDistance, formatDuration, formatSpeed } from '@/features/activities/format';
import { colors, spacing, typography } from '@/theme';

type SummaryState =
  | { status: 'loading' | 'missing' | 'error' }
  | { status: 'ready'; activity: Activity; route: ActivityRoute | null };

export default function ActivityScreen() {
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
        <Text accessibilityRole="header" style={styles.title}>Resumen de rodada</Text>
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
  const [attempt, setAttempt] = useState(0);
  const [summary, setSummary] = useState<SummaryState>({ status: 'loading' });

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
  return (
    <>
      <Text style={styles.date}>{activityDateFormat.format(activity.startedAt)}</Text>
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
      </View>
      <Text accessibilityRole="header" style={styles.heading}>Recorrido</Text>
      <AppCard>
        {route === null ? (
          <ErrorState title="No pudimos abrir el recorrido" message="Las métricas de la rodada siguen disponibles." onRetry={retry} />
        ) : route.some(segment => segment.length > 0) ? (
          <ActivityRouteMap route={route} />
        ) : (
          <EmptyState icon={Route} title="Sin recorrido GPS" message="Esta rodada se guardó sin puntos GPS." />
        )}
      </AppCard>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 600, alignSelf: 'center' },
  back: { alignSelf: 'flex-start' },
  title: { ...typography.title, color: colors.textPrimary },
  heading: { ...typography.subtitle, color: colors.textPrimary },
  date: { ...typography.body, color: colors.textSecondary },
  metrics: { flexDirection: 'row', gap: spacing.sm },
});
