import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components';
import { type ActivityRoute } from '@/database/activities';
import { type DraftRoutePoint, loadDraftRoutePoints } from '@/database/rideDraft';
import { ActivityRouteMap } from '@/features/activities/components/ActivityRouteMap';
import { colors, radius, spacing, typography } from '@/theme';

interface LiveRideMapProps {
  startedAt: number;
  running: boolean;
  locationMessage: string | null;
}

export function LiveRideMap({ startedAt, running, locationMessage }: LiveRideMapProps) {
  const [route, setRoute] = useState<ActivityRoute>([]);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const cursor = useRef<DraftRoutePoint | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let pending = false;

    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const previous = cursor.current;
        const points = await loadDraftRoutePoints(startedAt, previous);
        if (!active) return;
        setLoadError(false);
        if (!points.length) return;
        cursor.current = points[points.length - 1];
        setRoute(current => {
          const updated = [...current];
          let segment = previous?.segment;
          let tail = [...(updated.pop() ?? [])];
          for (const { segment: nextSegment, ...point } of points) {
            if (segment !== nextSegment) {
              if (tail.length) updated.push(tail);
              tail = [];
              segment = nextSegment;
            }
            tail.push(point);
          }
          updated.push(tail);
          return updated;
        });
      } catch {
        if (active) setLoadError(true);
      } finally {
        pending = false;
      }
    }

    void refresh();
    const interval = running ? setInterval(() => void refresh(), 1_000) : undefined;
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [attempt, running, startedAt]);

  return (
    <View style={styles.frame}>
      <ActivityRouteMap route={route} live />
      {!route.length && (
        <View style={styles.empty}>
          <Text style={styles.message}>
            {loadError ? 'No pudimos cargar el recorrido' : locationMessage ?? (running ? 'Buscando señal GPS…' : 'Sin puntos GPS registrados')}
          </Text>
        </View>
      )}
      {loadError && (
        <View style={styles.retry}>
          <AppButton label="Actualizar mapa" size="md" variant="secondary" onPress={() => setAttempt(current => current + 1)} />
        </View>
      )}
      {route.length > 0 && locationMessage && (
        <Text style={styles.status}>{locationMessage}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  empty: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  message: { ...typography.bodySmall, color: colors.textPrimary, textAlign: 'center' },
  status: { ...typography.bodySmall, color: colors.textSecondary, padding: spacing.sm },
  retry: { position: 'absolute', bottom: spacing.sm, alignSelf: 'center' },
});
