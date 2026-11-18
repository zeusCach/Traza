import { StyleSheet, Text, View } from 'react-native';

import type { ActivityRoute } from '@/database/activities';
import { ActivityRouteMap } from '@/features/activities/components/ActivityRouteMap';
import { colors, spacing, typography } from '@/theme';

export interface RideBasemapProps {
  route: ActivityRoute;
  guideRoute?: ActivityRoute;
  viewport?: { top: number; bottom: number; left: number; right: number };
  variant?: 'live' | 'activity' | 'preview';
}

export function RideBasemap({ route, guideRoute, viewport, variant = 'live' }: RideBasemapProps) {
  if (variant === 'preview') {
    return <Text style={styles.notice}>El mapa de calles está disponible en la app móvil.</Text>;
  }
  return (
    <View style={viewport && styles.fullscreen}>
      <ActivityRouteMap route={route} guideRoute={guideRoute} live={variant === 'live'} fill={!!viewport} />
      <Text style={[styles.notice, viewport && styles.floatingNotice]}>
        Abre Traza en Android o iOS para ver el mapa de calles y relieve.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { ...typography.bodySmall, color: colors.textPrimary, padding: spacing.sm },
  fullscreen: { flex: 1 },
  floatingNotice: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    maxWidth: '85%',
    backgroundColor: colors.background,
  },
});
