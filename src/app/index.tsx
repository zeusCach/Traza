import { Link, router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, History, Map, Pause, Play, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppCard, EmptyState, ErrorState, LoadingState } from '@/components';
import { type Activity, type ActivityRoute, loadActivities, saveActivity } from '@/database/activities';
import { activityDateFormat, averageSpeed, formatDistance, formatDuration, formatSpeed } from '@/features/activities/format';
import { LiveRideMap } from '@/features/tracking/components/LiveRideMap';
import { RideBasemap } from '@/features/tracking/components/RideBasemap';
import { RideDataPanel } from '@/features/tracking/components/RideDataPanel';
import { useActivityTracking } from '@/features/tracking/hooks/useActivityTracking';
import { colors, radius, spacing, typography } from '@/theme';

const emptyRoute: ActivityRoute = [];

export default function HomeScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const showActivities = section === 'actividades';
  const tracking = useActivityTracking();
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);

  useEffect(() => {
    let active = true;
    loadActivities().then(items => {
      if (active) setActivities(items);
    }).catch(() => {
      if (active) setLoadError(true);
    });
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  async function save() {
    const activity = tracking.activity;
    if (savePending.current || tracking.busy || tracking.running || !activity || !activities) return;
    savePending.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      const updated = await saveActivity(activity, await tracking.getRoute(), activities);
      await tracking.reset();
      setActivities(updated);
    } catch {
      setSaveError(true);
      return;
    } finally {
      savePending.current = false;
      setSaving(false);
    }
    router.push({ pathname: '/activity/[id]', params: { id: String(activity.startedAt) } });
  }

  const { activity, busy, currentSpeedKmh, elapsedMs, locationMessage, running } = tracking;
  const canStart = tracking.ready && activities !== null && !busy;

  function openRide() {
    router.setParams({ section: 'mapas' });
    if (!activity && canStart) void tracking.start();
  }

  if (activity && !showActivities) {
    return (
      <LiveRideMap
        key={activity.startedAt}
        startedAt={activity.startedAt}
        running={running}
        locationMessage={locationMessage}
        header={(
          <View style={styles.rideHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir historial de actividades"
              onPress={() => router.setParams({ section: 'actividades' })}
              style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}
            >
              <History size={22} color={colors.textPrimary} />
            </Pressable>
            <Text accessibilityRole="header" style={styles.rideTitle}>
              {running ? 'Rodada en curso' : 'Rodada pausada'}
            </Text>
          </View>
        )}
      >
        {route => (
          <>
            <RideDataPanel
              route={route}
              elapsedMs={elapsedMs}
              distanceM={activity.distanceM}
              elevationGainM={activity.elevationGainM ?? null}
              currentSpeedKmh={currentSpeedKmh}
              running={running}
            />
            {tracking.error && (
              <Text accessibilityRole="alert" style={styles.rideError}>{tracking.error}</Text>
            )}
            {saveError && !running && (
              <Text accessibilityRole="alert" style={styles.rideError}>
                No pudimos guardar la rodada. Puedes intentarlo de nuevo.
              </Text>
            )}
            {running ? (
              <AppButton label="Pausar" icon={Pause} onPress={tracking.pause} loading={busy} />
            ) : (
              <>
                <AppButton label="Reanudar" icon={Play} onPress={tracking.resume} disabled={saving} loading={busy} />
                <AppButton label="Guardar rodada" variant="secondary" onPress={save} loading={saving} disabled={busy} />
              </>
            )}
          </>
        )}
      </LiveRideMap>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {!showActivities ? (
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.brand}>TRAZA</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Tu próxima rodada
            </Text>
            {!tracking.ready && (
              tracking.error ? (
                <ErrorState
                  title="No pudimos recuperar la rodada"
                  message={tracking.error}
                  onRetry={tracking.retryRestore}
                />
              ) : <LoadingState message="Buscando una rodada pendiente…" />
            )}
            {tracking.ready && tracking.error && (
              <Text accessibilityRole="alert" style={styles.error}>{tracking.error}</Text>
            )}
            {tracking.ready && (
              <>
                <View style={styles.idleMap}>
                  <RideBasemap route={emptyRoute} />
                </View>
                <Text style={styles.body}>Toca + para comenzar una rodada. Activa la ubicación en segundo plano para registrar con la pantalla bloqueada.</Text>
              </>
            )}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          style={styles.page}
          data={activities ?? undefined}
          keyExtractor={item => String(item.startedAt)}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <Text accessibilityRole="header" style={[styles.title, styles.historyTitle]}>Actividades</Text>
          }
          ListEmptyComponent={
            loadError ? (
              <ErrorState
                title="No pudimos abrir el historial"
                message="Intenta cargar de nuevo las actividades guardadas en este dispositivo."
                onRetry={() => {
                  setLoadError(false);
                  setLoadAttempt(attempt => attempt + 1);
                }}
              />
            ) : activities === null ? (
              <LoadingState message="Cargando actividades…" />
            ) : (
              <AppCard>
                <EmptyState icon={History} title="Aún no hay actividades" message="Tus sesiones guardadas aparecerán aquí." />
              </AppCard>
            )
          }
          renderItem={({ item }) => {
            const mean = averageSpeed(item.distanceM, item.durationMs);
            return (
              <Link href={{ pathname: '/activity/[id]', params: { id: String(item.startedAt) } }} asChild>
                <Pressable style={({ pressed }) => pressed && styles.pressed}>
                  <AppCard style={styles.historyCard}>
                    <View style={styles.historyMetrics}>
                      <Text style={styles.date}>{activityDateFormat.format(item.startedAt)}</Text>
                      <Text style={styles.body}>
                        {formatDuration(item.durationMs)} · {item.distanceM === null ? 'Sin distancia GPS' : formatDistance(item.distanceM) + ' km'}
                      </Text>
                      {mean !== null && <Text style={styles.body}>{formatSpeed(mean)} km/h de media</Text>}
                    </View>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </AppCard>
                </Pressable>
              </Link>
            );
          }}
        />
      )}
      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: !showActivities }}
          onPress={() => router.setParams({ section: 'mapas' })}
          style={[styles.tab, !showActivities && styles.selected]}
        >
          <Map size={20} color={showActivities ? colors.textSecondary : colors.primary} />
          <Text style={[styles.tabLabel, !showActivities && styles.selectedLabel]}>Mapas</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={activity ? 'Abrir rodada actual' : 'Iniciar rodada'}
          accessibilityState={{ disabled: !activity && !canStart, busy }}
          disabled={!activity && !canStart}
          onPress={openRide}
          style={({ pressed }) => [
            styles.startButton,
            (pressed || (!activity && !canStart)) && styles.pressed,
          ]}
        >
          <Plus size={28} color={colors.background} strokeWidth={2.5} />
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: showActivities }}
          onPress={() => router.setParams({ section: 'actividades' })}
          style={[styles.tab, showActivities && styles.selected]}
        >
          <History size={20} color={showActivities ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabLabel, showActivities && styles.selectedLabel]}>Actividades</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rideHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideTitle: {
    flexShrink: 1,
    ...typography.subtitle,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rideError: {
    ...typography.bodySmall,
    color: colors.error,
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  screen: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1 },
  content: { padding: spacing.lg, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { gap: spacing.md, marginBottom: spacing.md },
  brand: { ...typography.display, color: colors.primary },
  title: { ...typography.title, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  error: { ...typography.bodySmall, color: colors.error },
  historyTitle: { marginBottom: spacing.md },
  date: { ...typography.label, color: colors.textPrimary },
  historyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyMetrics: { flex: 1 },
  pressed: { opacity: 0.7 },
  separator: { height: spacing.sm },
  idleMap: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    width: '92%',
    maxWidth: 440,
    marginVertical: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xxs,
    borderRadius: radius.pill,
  },
  selected: { backgroundColor: colors.surfaceElevated },
  tabLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  selectedLabel: { color: colors.primary },
  startButton: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
