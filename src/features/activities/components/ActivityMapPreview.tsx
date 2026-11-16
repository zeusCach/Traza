import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { loadActivityRoute, type ActivityRoute } from '@/database/activities';
import { RideBasemap } from '@/features/tracking/components/RideBasemap';
import { colors, radius, spacing, typography } from '@/theme';

export const ActivityMapPreview = memo(function ActivityMapPreview({ startedAt, visible }: {
  startedAt: number;
  visible: boolean;
}) {
  const [route, setRoute] = useState<ActivityRoute | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadActivityRoute(startedAt).then(result => {
      if (active) setRoute(result);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [startedAt]);

  if (failed) return <Text style={styles.notice}>No se pudo abrir el recorrido.</Text>;
  if (route && !route.some(segment => segment.length > 0)) return null;

  return (
    <View style={styles.frame}>
      {route && visible && <RideBasemap route={route} variant="preview" />}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { height: 164, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.background },
  notice: { ...typography.caption, color: colors.textSecondary, padding: spacing.xs },
});
