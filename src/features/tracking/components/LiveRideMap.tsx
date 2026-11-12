import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components';
import { type ActivityRoute } from '@/database/activities';
import { type DraftRoutePoint, loadDraftRoutePoints } from '@/database/rideDraft';
import { colors, radius, spacing, typography } from '@/theme';

import { RideBasemap } from './RideBasemap';

interface LiveRideMapProps {
  startedAt: number;
  running: boolean;
  locationMessage: string | null;
  header: ReactNode;
  children: (route: ActivityRoute) => ReactNode;
}

export function LiveRideMap({ startedAt, running, locationMessage, header, children }: LiveRideMapProps) {
  const [route, setRoute] = useState<ActivityRoute>([]);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [panelHeight, setPanelHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const viewport = useMemo(() => ({ ...insets, bottom: insets.bottom + panelHeight }), [insets, panelHeight]);
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

  const status = loadError ? 'No pudimos cargar el recorrido' : locationMessage ??
    (!route.length ? (running ? 'Buscando señal GPS…' : 'Sin puntos GPS registrados') : null);

  return (
    <View style={styles.screen}>
      <RideBasemap route={route} viewport={viewport} />
      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="box-none" style={styles.top}>
          {header}
          {status && <Text style={styles.message}>{status}</Text>}
          {loadError && (
            <View style={styles.retry}>
              <AppButton label="Actualizar mapa" size="md" variant="secondary" onPress={() => setAttempt(current => current + 1)} />
            </View>
          )}
        </View>
        <View
          pointerEvents="box-none"
          onLayout={event => setPanelHeight(event.nativeEvent.layout.height)}
          style={styles.bottom}
        >
          {children(route)}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  top: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 90,
  },
  bottom: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  message: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: radius.card,
    padding: spacing.sm,
  },
  retry: { alignSelf: 'flex-start' },
});
