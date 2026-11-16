import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useUpdates } from 'expo-updates';
import { ChartNoAxesCombined, ChevronRight, Download, History, Map, Pause, Play, Plus, User } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppCard, EmptyState, ErrorState, LoadingState } from '@/components';
import { type Activity, type ActivityRoute, type RideDetails, loadActivities, rideEffortLabels, saveActivity } from '@/database/activities';
import { ActivityMapPreview } from '@/features/activities/components/ActivityMapPreview';
import { ProgressPanel } from '@/features/activities/components/ProgressPanel';
import { RideEditor } from '@/features/activities/components/RideEditor';
import { activityDateFormat, averageSpeed, formatDistance, formatDuration, formatSpeed } from '@/features/activities/format';
import { LiveRideMap } from '@/features/tracking/components/LiveRideMap';
import { RideBasemap } from '@/features/tracking/components/RideBasemap';
import { RideDataPanel } from '@/features/tracking/components/RideDataPanel';
import { useActivityTracking } from '@/features/tracking/hooks/useActivityTracking';
import { colors, radius, spacing, typography } from '@/theme';

const emptyRoute: ActivityRoute = [];
const activityViewability = { itemVisiblePercentThreshold: 10, minimumViewTime: 120 };

export default function HomeScreen() {
  const { section, perfil } = useLocalSearchParams<{ section?: string; perfil?: string }>();
  const showProfile = section === 'tu' || section === 'actividades';
  const showActivities = perfil === 'actividades' || section === 'actividades';
  const tracking = useActivityTracking();
  const { isUpdateAvailable, isUpdatePending } = useUpdates();
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [editingRide, setEditingRide] = useState(false);
  const [visibleActivities, setVisibleActivities] = useState<Set<string>>(() => new Set());
  const onActivitiesVisible = useCallback(({ viewableItems }: { viewableItems: { key: string }[] }) => {
    setVisibleActivities(new Set(viewableItems.map(item => item.key)));
  }, []);

  useFocusEffect(useCallback(() => {
    setLoadAttempt(attempt => attempt + 1);
  }, []));

  useEffect(() => {
    if (loadAttempt === 0) return;
    let active = true;
    loadActivities().then(items => {
      if (active) {
        setActivities(items.sort((a, b) => b.startedAt - a.startedAt));
        setLoadError(false);
      }
    }).catch(() => {
      if (active) setLoadError(true);
    });
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  async function save(details: RideDetails) {
    const activity = tracking.activity;
    if (tracking.busy || tracking.running || !activity) throw new Error('Rodada no disponible');
    const updated = await saveActivity({ ...activity, ...details }, await tracking.getRoute());
    await tracking.reset();
    setActivities(updated);
    setEditingRide(false);
    router.push({ pathname: '/activity/[id]', params: { id: String(activity.startedAt) } });
  }

  const { activity, autoPaused, busy, currentSpeedKmh, elapsedMs, locationMessage, running } = tracking;
  const canStart = tracking.ready && activities !== null && !busy;

  function openRide() {
    router.setParams({ section: 'mapas' });
    if (!activity && canStart) void tracking.start();
  }

  async function finishAutoPausedRide() {
    if (await tracking.pause()) setEditingRide(true);
  }

  if (activity && !showProfile) {
    return (
      <>
        <LiveRideMap
          key={activity.startedAt}
          startedAt={activity.startedAt}
          running={running}
          segment={tracking.segment}
          lastFixAt={tracking.lastFixAt}
          locationMessage={locationMessage}
          header={(
            <View style={styles.rideHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir actividades en Tú"
                onPress={() => router.setParams({ section: 'tu', perfil: 'actividades' })}
                style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}
              >
                <History size={22} color={colors.textPrimary} />
              </Pressable>
              <Text accessibilityRole="header" style={styles.rideTitle}>
                {autoPaused ? 'Pausa automática' : running ? 'Rodada en curso' : 'Rodada pausada'}
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
                running={running && !autoPaused}
              />
              {tracking.error && (
                <Text accessibilityRole="alert" style={styles.rideError}>{tracking.error}</Text>
              )}
              {autoPaused ? (
                <>
                  <AppButton label="Pausar manualmente" icon={Pause} onPress={tracking.pause} loading={busy} />
                  <AppButton label="Guardar rodada" variant="secondary" onPress={finishAutoPausedRide} disabled={busy} />
                </>
              ) : running ? (
                <AppButton label="Pausar" icon={Pause} onPress={tracking.pause} loading={busy} />
              ) : (
                <>
                  <AppButton label="Reanudar" icon={Play} onPress={tracking.resume} loading={busy} />
                  <AppButton label="Guardar rodada" variant="secondary" onPress={() => setEditingRide(true)} disabled={busy} />
                </>
              )}
            </>
          )}
        </LiveRideMap>
        {editingRide && <RideEditor onCancel={() => setEditingRide(false)} onSave={save} />}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {showProfile && (
        <View style={[styles.content, styles.profileHeader]}>
          <Text accessibilityRole="header" style={styles.title}>Tú</Text>
          <View style={styles.profileTabs}>
            {[
              { label: 'Progreso', key: 'progreso', icon: ChartNoAxesCombined, selected: !showActivities },
              { label: 'Actividades', key: 'actividades', icon: History, selected: showActivities },
            ].map(({ label, key, icon: Icon, selected }) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => router.setParams({ section: 'tu', perfil: key })}
                style={[styles.profileTab, selected && styles.profileSelected]}
              >
                <Icon size={20} color={selected ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabLabel, selected && styles.selectedLabel]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {!showProfile ? (
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
                <AppButton
                  icon={Download}
                  label={isUpdatePending ? 'Actualización lista' : isUpdateAvailable ? 'Actualización disponible' : 'Actualizaciones'}
                  variant="secondary"
                  onPress={() => router.push('/actualizaciones')}
                />
              </>
            )}
          </View>
        </ScrollView>
      ) : loadError ? (
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
      ) : !showActivities ? (
        <ProgressPanel activities={activities} />
      ) : (
        <FlatList
          style={styles.page}
          data={activities}
          keyExtractor={item => String(item.startedAt)}
          viewabilityConfig={activityViewability}
          onViewableItemsChanged={onActivitiesVisible}
          extraData={visibleActivities}
          initialNumToRender={4}
          windowSize={5}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <AppCard>
              <EmptyState icon={History} title="Aún no hay actividades" message="Tus sesiones guardadas aparecerán aquí." />
            </AppCard>
          }
          renderItem={({ item }) => {
            const mean = averageSpeed(item.distanceM, item.durationMs);
            return (
              <AppCard style={styles.historyCard}>
                <Link href={{ pathname: '/activity/[id]', params: { id: String(item.startedAt) } }} asChild>
                  <Pressable style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
                    <View style={styles.historyMetrics}>
                      <Text style={styles.activityName}>{item.name || 'Rodada'}</Text>
                      <Text style={styles.body}>{activityDateFormat.format(item.startedAt)}{item.effort && ` · ${rideEffortLabels[item.effort]}`}</Text>
                      <Text style={styles.body}>
                        {formatDuration(item.durationMs)} · {item.distanceM === null ? 'Sin distancia GPS' : formatDistance(item.distanceM) + ' km'}
                      </Text>
                      {mean !== null && <Text style={styles.body}>{formatSpeed(mean)} km/h de media</Text>}
                    </View>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </Pressable>
                </Link>
                <ActivityMapPreview startedAt={item.startedAt} visible={visibleActivities.has(String(item.startedAt))} />
              </AppCard>
            );
          }}
        />
      )}
      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: !showProfile }}
          onPress={() => router.setParams({ section: 'mapas' })}
          style={[styles.tab, !showProfile && styles.selected]}
        >
          <Map size={20} color={showProfile ? colors.textSecondary : colors.primary} />
          <Text style={[styles.tabLabel, !showProfile && styles.selectedLabel]}>Mapas</Text>
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
          accessibilityState={{ selected: showProfile }}
          onPress={() => router.setParams({ section: 'tu' })}
          style={[styles.tab, showProfile && styles.selected]}
        >
          <User size={20} color={showProfile ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabLabel, showProfile && styles.selectedLabel]}>Tú</Text>
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
  profileHeader: { paddingBottom: spacing.xs, gap: spacing.sm },
  profileTabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
  profileTab: {
    flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center',
    gap: spacing.xxs, borderBottomWidth: 2, borderColor: 'transparent',
  },
  profileSelected: { borderColor: colors.primary },
  activityName: { ...typography.subtitle, color: colors.textPrimary },
  historyCard: { gap: spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
