import { Link } from 'expo-router';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard, ErrorState, LoadingState } from '@/components';
import { type Activity, rideEffortLabels } from '@/database/activities';
import { loadMonthlyGoals, MonthlyGoals } from '@/features/activities/components/MonthlyGoals';
import { RideRecords } from '@/features/activities/components/RideRecords';
import { WeeklyProgress } from '@/features/activities/components/WeeklyProgress';
import { activityDateFormat, formatDistance, formatDuration, formatElevationGain } from '@/features/activities/format';
import { groupWeeks, summarize } from '@/features/activities/progress';
import { radius, spacing, typography, useTheme, themedStyles } from '@/theme';

const monthFormat = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });

export function ProgressPanel({ activities }: { activities: Activity[] }) {
  const [goals, setGoals] = useState<Awaited<ReturnType<typeof loadMonthlyGoals>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadMonthlyGoals().then(goals => {
      if (active) setGoals(goals);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [attempt]);

  if (failed) {
    return <ErrorState title="No pudimos abrir tu progreso" message="Intenta cargar de nuevo las metas guardadas." onRetry={() => {
      setFailed(false);
      setAttempt(value => value + 1);
    }} />;
  }
  return goals ? <ProgressDashboard activities={activities} goals={goals} /> : <LoadingState message="Cargando progreso…" />;
}

function ProgressDashboard({ activities, goals }: {
  activities: Activity[];
  goals: Awaited<ReturnType<typeof loadMonthlyGoals>>;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [today] = useState(() => new Date());
  const [monthOffset, setMonthOffset] = useState(0);
  const { weeks, streak } = useMemo(() => groupWeeks(activities, today), [activities, today]);
  const year = today.getFullYear();
  const month = today.getMonth() + monthOffset;
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  const monthly = activities.filter(item => item.startedAt >= monthStart.getTime() && item.startedAt < monthEnd.getTime());
  const totals = summarize(monthly);
  const earliest = activities[activities.length - 1]?.startedAt ?? today.getTime();
  const monthLabel = monthFormat.format(monthStart);

  return (
    <FlatList
      style={styles.list}
      data={monthly}
      keyExtractor={item => String(item.startedAt)}
      contentContainerStyle={[styles.column, styles.content]}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={(
        <View style={styles.sections}>
          <WeeklyProgress weeks={weeks} />
          <AppCard style={styles.streak}>
            <View style={styles.streakIcon}>
              <Flame size={26} color={colors.primary} />
            </View>
            <View style={styles.grow}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Racha semanal</Text>
              <Text style={styles.caption}>Al menos una rodada por semana</Text>
            </View>
            <View style={styles.streakCount}>
              <Text style={styles.number}>{streak}</Text>
              <Text style={styles.caption}>{streak === 1 ? 'semana' : 'semanas'}</Text>
            </View>
          </AppCard>
          <RideRecords activities={activities} />
          <AppCard style={styles.summary}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Mes deportivo</Text>
            <View style={styles.monthPicker}>
              {[
                { label: 'Mes anterior', icon: ChevronLeft, step: -1, disabled: earliest >= monthStart.getTime() },
                { label: 'Mes siguiente', icon: ChevronRight, step: 1, disabled: monthOffset === 0 },
              ].map(({ label, icon: Icon, step, disabled }) => (
                <Pressable key={step} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
                  disabled={disabled} onPress={() => setMonthOffset(offset => offset + step)}
                  style={[styles.iconButton, disabled && styles.disabled]}
                >
                  <Icon size={20} color={colors.textPrimary} />
                </Pressable>
              ))}
              <Text accessibilityLiveRegion="polite" style={styles.monthLabel}>{monthLabel}</Text>
            </View>
            <View style={styles.metrics}>
              {[
                ['Rodadas', totals.count],
                ['Distancia', `${formatDistance(totals.distance)} km`],
                ['Desnivel', `${formatElevationGain(totals.elevation)} m`],
                ['Duración', formatDuration(totals.duration)],
              ].map(([label, value]) => (
                <View key={label} style={styles.metric}>
                  <Text style={styles.caption}>{label}</Text>
                  <Text style={styles.value}>{value}</Text>
                </View>
              ))}
            </View>
          </AppCard>
          <MonthlyGoals initialGoals={goals} distance={totals.distance} count={totals.count} />
          <Text accessibilityRole="header" style={styles.sectionTitle}>Actividades del mes</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.caption}>Sin rodadas guardadas en {monthLabel}.</Text>}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/activity/[id]', params: { id: String(item.startedAt) } }} asChild>
          <Pressable style={({ pressed }) => pressed && styles.disabled}>
            <AppCard style={styles.activity}>
              <View style={styles.grow}>
                <Text style={styles.value}>{item.name || 'Rodada'}</Text>
                <Text style={styles.caption}>{activityDateFormat.format(item.startedAt)}{item.effort && ` · ${rideEffortLabels[item.effort]}`}</Text>
                <Text style={styles.caption}>
                  {formatDuration(item.durationMs)} · {item.distanceM === null ? 'Sin distancia GPS' : `${formatDistance(item.distanceM)} km`}
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </AppCard>
          </Pressable>
        </Link>
      )}
    />
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  list: { flex: 1 },
  column: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: spacing.lg },
  content: { paddingTop: spacing.xs, paddingBottom: spacing.xl },
  sections: { gap: spacing.md, paddingBottom: spacing.sm },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary },
  caption: { ...typography.bodySmall, color: colors.textSecondary },
  iconButton: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  streakIcon: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  streakCount: { alignItems: 'center' },
  number: { ...typography.metricMedium, color: colors.primary },
  grow: { flex: 1 },
  summary: { gap: spacing.sm },
  monthPicker: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  monthLabel: { ...typography.label, color: colors.textPrimary, flex: 1, textAlign: 'center' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexBasis: '40%', flexGrow: 1 },
  value: { ...typography.button, color: colors.textPrimary },
  activity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  separator: { height: spacing.sm },
}));
