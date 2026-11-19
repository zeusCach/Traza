import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { loadActivityRoute, type ActivityRoute } from '@/database/activities';
import { RideBasemap } from '@/features/tracking/components/RideBasemap';
import { radius, spacing, typography, themedStyles } from '@/theme';

export const ActivityMapPreview = memo(function ActivityMapPreview({ accountId, startedAt, visible }: {
  accountId: string;
  startedAt: number;
  visible: boolean;
}) {
  const styles = useStyles();
  const [route, setRoute] = useState<ActivityRoute | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadActivityRoute(accountId, startedAt).then(result => {
      if (active) setRoute(result);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [accountId, startedAt]);

  if (failed) return <Text style={styles.notice}>No se pudo abrir el recorrido.</Text>;

  return <RouteMapPreview route={route} visible={visible} />;
});

export const RouteMapPreview = memo(function RouteMapPreview({ route, visible }: {
  route: ActivityRoute | null;
  visible: boolean;
}) {
  const styles = useStyles();
  if (route && !route.some(segment => segment.length > 0)) return null;

  return (
    <View pointerEvents="none" style={styles.frame}>
      {route && visible && <RideBasemap route={route} variant="preview" />}
    </View>
  );
});

const useStyles = themedStyles(colors => StyleSheet.create({
  frame: { height: 164, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.background },
  notice: { ...typography.caption, color: colors.textSecondary, padding: spacing.xs },
}));
