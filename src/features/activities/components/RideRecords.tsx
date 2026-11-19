import { Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppCard } from '@/components';
import { loadActivityRoute, type Activity } from '@/database/activities';
import { spacing, typography, useTheme, themedStyles } from '@/theme';

import { formatDuration } from '../format';
import { bestRouteTimes, recordDistances } from '../progress';

type RecordTime = { duration: number; startedAt: number };

export function RideRecords({ accountId, activities }: { accountId: string; activities: Activity[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [records, setRecords] = useState<(RecordTime | null)[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const result = recordDistances.map<RecordTime | null>(() => null);
      let hadError = false;
      for (const activity of activities) {
        try {
          const route = await loadActivityRoute(accountId, activity.startedAt);
          if (!active) return;
          bestRouteTimes(route).forEach((duration, index) => {
            if (Number.isFinite(duration) && duration < (result[index]?.duration ?? Infinity)) {
              result[index] = { duration, startedAt: activity.startedAt };
            }
          });
        } catch {
          if (!active) return;
          hadError = true;
        }
      }
      if (active) {
        setRecords(result);
        setFailed(hadError);
      }
    }
    void load();
    return () => { active = false; };
  }, [accountId, activities, attempt]);

  return (
    <AppCard style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>Mejores tiempos</Text>
      <Text style={styles.caption}>Tramos continuos medidos con GPS</Text>
      {records === null ? (
        <Text style={styles.caption}>Calculando tiempos…</Text>
      ) : recordDistances.map((distance, index) => {
        const record = records[index];
        const label = `${distance / 1000} km`;
        if (!record) {
          return (
            <View key={distance} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.caption}>Sin marca</Text>
            </View>
          );
        }
        return (
          <Link key={distance} href={{ pathname: '/activity/[id]', params: { id: String(record.startedAt) } }} asChild>
            <Pressable style={styles.row} accessibilityLabel={`Ver rodada de la marca de ${label}, ${formatDuration(record.duration)}`}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.time}>{formatDuration(record.duration)}</Text>
              <ChevronRight size={16} color={colors.textSecondary} />
            </Pressable>
          </Link>
        );
      })}
      {failed && (
        <>
          <Text accessibilityRole="alert" style={styles.caption}>Algunos recorridos no se pudieron leer.</Text>
          <AppButton label="Reintentar" variant="secondary" size="md" onPress={() => {
            setRecords(null);
            setFailed(false);
            setAttempt(value => value + 1);
          }} />
        </>
      )}
    </AppCard>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  card: { gap: spacing.xs },
  title: { ...typography.subtitle, color: colors.textPrimary },
  caption: { ...typography.bodySmall, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: spacing.xs, borderTopWidth: 1, borderColor: colors.border },
  label: { ...typography.label, color: colors.textPrimary, flex: 1 },
  time: { ...typography.button, color: colors.primary },
}));
