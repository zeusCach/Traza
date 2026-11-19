import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChartNoAxesCombined, ChevronRight, History, Map, Newspaper, Pause, Play, Plus, User } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppCard, EmptyState, ErrorState, LoadingState } from '@/components';
import { type Activity, type RideDetails, loadActivities, rideEffortLabels, saveActivity } from '@/database/activities';
import { useSession } from '@/features/auth/SessionProvider';
import { ProfileMenu } from '@/features/account/ProfileMenu';
import { ActivityMapPreview } from '@/features/activities/components/ActivityMapPreview';
import { ProgressPanel } from '@/features/activities/components/ProgressPanel';
import { RideEditor } from '@/features/activities/components/RideEditor';
import { activityDateFormat, averageSpeed, formatDistance, formatDuration, formatSpeed } from '@/features/activities/format';
import { FeedList, SavedRoutes } from '@/features/feed/FeedList';
import { examplePosts } from '@/features/feed/feedStorage';
import { useFeed } from '@/features/feed/useFeed';
import { LiveRideMap } from '@/features/tracking/components/LiveRideMap';
import { RideDataPanel } from '@/features/tracking/components/RideDataPanel';
import { useActivityTracking } from '@/features/tracking/hooks/useActivityTracking';
import { radius, spacing, typography, useTheme, themedStyles } from '@/theme';

const activityViewability = { itemVisiblePercentThreshold: 10, minimumViewTime: 120 };

export default function HomeScreen() {
  const accountId = useSession()?.user.id;
  return accountId ? <AccountHome key={accountId} accountId={accountId} /> : null;
}

function AccountHome({ accountId }: { accountId: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { section, perfil } = useLocalSearchParams<{ section?: string; perfil?: string }>();
  const showFeed = section === 'feed';
  const profileTab = section === 'actividades' ? 'actividades' : section === 'tu' ? perfil ?? 'progreso' : 'mapas';
  const tracking = useActivityTracking(accountId);
  const feed = useFeed(`post:${tracking.guidePostId ?? ''}`, !!tracking.guidePostId);
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
    loadActivities(accountId).then(items => {
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
  }, [accountId, loadAttempt]);

  async function save(details: RideDetails) {
    const activity = tracking.activity;
    if (tracking.busy || tracking.running || !activity) throw new Error('Rodada no disponible');
    const updated = await saveActivity(accountId, { ...activity, ...details }, await tracking.getRoute());
    await tracking.reset();
    setActivities(updated);
    setEditingRide(false);
    router.push({ pathname: '/activity/[id]', params: { id: String(activity.startedAt) } });
  }

  const { activity, autoPaused, busy, currentSpeedKmh, elapsedMs, locationMessage, recovered, running } = tracking;
  const rideStatus = autoPaused ? 'Pausa automática' : running ? 'Rodada en curso' : recovered ? 'Rodada recuperada' : 'Rodada pausada';
  const canStart = tracking.ready && activities !== null && !busy;
  const guide = tracking.guidePostId
    ? (feed.state?.published.find(post => post.id === tracking.guidePostId) ??
      examplePosts.find(post => post.id === tracking.guidePostId))
    : undefined;

  function openRide(guidePostId?: string) {
    if (guidePostId && (activity || !canStart)) return;
    router.setParams({ section: 'rodada' });
    if (!activity && canStart) void tracking.start(guidePostId);
  }

  async function finishAutoPausedRide() {
    if (await tracking.pause()) setEditingRide(true);
  }

  if (activity && (section === 'rodada' || section === undefined || section === 'mapas')) {
    return (
      <>
        <LiveRideMap
          key={activity.startedAt}
          accountId={accountId}
          startedAt={activity.startedAt}
          guideRoute={guide?.route}
          running={running}
          segment={tracking.segment}
          lastFixAt={tracking.lastFixAt}
          position={tracking.position}
          locationMessage={locationMessage}
          header={(
            <>
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
                {rideStatus}
              </Text>
            </View>
            {guide && (
              <View style={styles.guideLegend}>
                <Text style={styles.guideLabel}>Ruta guardada · {guide.activity.name || 'Rodada'}</Text>
                <Text style={styles.ownTrackLabel}>Mi recorrido</Text>
              </View>
            )}
            {!guide && tracking.guidePostId && feed.error && (
              <AppButton label="Volver a cargar la ruta guardada" size="md" variant="secondary" onPress={feed.retry} />
            )}
            </>
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
                status={rideStatus}
                locationMessage={locationMessage}
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
      {!showFeed && (
        <View style={[styles.content, styles.profileHeader]}>
          <View style={styles.profileTitleRow}>
            <Text accessibilityRole="header" style={styles.title}>Tú</Text>
            <ProfileMenu />
          </View>
          <View style={styles.profileTabs}>
            {[
              { label: 'Progreso', key: 'progreso', icon: ChartNoAxesCombined },
              { label: 'Actividades', key: 'actividades', icon: History },
              { label: 'Mapas', key: 'mapas', icon: Map },
            ].map(({ label, key, icon: Icon }) => {
              const selected = key === profileTab;
              return (
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
              );
            })}
          </View>
        </View>
      )}
      {showFeed ? <FeedList /> : profileTab === 'mapas' ? (
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
          <SavedRoutes canStart={canStart && !activity} onStart={post => openRide(post.id)} />
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
      ) : profileTab !== 'actividades' ? (
        <ProgressPanel accountId={accountId} activities={activities} />
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
                <ActivityMapPreview accountId={accountId} startedAt={item.startedAt} visible={visibleActivities.has(String(item.startedAt))} />
              </AppCard>
            );
          }}
        />
      )}
      {recovered && activity && (
        <View style={[styles.content, styles.trackingFeedback]}>
          <AppCard style={styles.recoveryCard}>
            <Text accessibilityRole="header" style={styles.activityName}>Rodada recuperada</Text>
            <Text style={styles.body}>
              {activityDateFormat.format(activity.startedAt)} · {formatDuration(activity.durationMs)}
              {activity.distanceM !== null && ` · ${formatDistance(activity.distanceM)} km`}
            </Text>
            <AppButton label="Abrir rodada recuperada" size="md" variant="secondary" onPress={() => openRide()} />
          </AppCard>
        </View>
      )}
      {tracking.error && (
        <View style={[styles.content, styles.trackingFeedback]}>
          <Text accessibilityRole="alert" style={styles.error}>{tracking.error}</Text>
          {!tracking.ready && (
            <AppButton label="Reintentar recuperación" size="md" variant="secondary" onPress={tracking.retryRestore} />
          )}
        </View>
      )}
      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: showFeed }}
          onPress={() => router.setParams({ section: 'feed' })}
          style={[styles.tab, showFeed && styles.selected]}
        >
          <Newspaper size={20} color={showFeed ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabLabel, showFeed && styles.selectedLabel]}>Feed</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={activity ? 'Abrir rodada actual' : 'Iniciar rodada'}
          accessibilityState={{ disabled: !activity && !canStart, busy }}
          disabled={!activity && !canStart}
          onPress={() => openRide()}
          style={({ pressed }) => [
            styles.startButton,
            (pressed || (!activity && !canStart)) && styles.pressed,
          ]}
        >
          <Plus size={28} color={colors.background} strokeWidth={2.5} />
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: !showFeed }}
          onPress={() => router.setParams({ section: 'tu' })}
          style={[styles.tab, !showFeed && styles.selected]}
        >
          <User size={20} color={showFeed ? colors.textSecondary : colors.primary} />
          <Text style={[styles.tabLabel, !showFeed && styles.selectedLabel]}>Tú</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  guideLegend: {
    alignSelf: 'flex-start', backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm,
  },
  guideLabel: { ...typography.bodySmall, color: colors.routeGuide },
  ownTrackLabel: { ...typography.bodySmall, color: colors.primary },
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
  title: { ...typography.title, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  error: { ...typography.bodySmall, color: colors.error },
  trackingFeedback: { paddingVertical: spacing.xs, gap: spacing.xs },
  recoveryCard: { gap: spacing.xs },
  profileHeader: { paddingBottom: spacing.xs, gap: spacing.sm },
  profileTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
}));
