import { isRunningInExpoGo } from 'expo';
import { lazy, Suspense } from 'react';
import { StyleSheet, Text, TurboModuleRegistry, View } from 'react-native';

import { ActivityRouteMap } from '@/features/activities/components/ActivityRouteMap';
import { spacing, typography, themedStyles } from '@/theme';

import type { RideBasemapProps } from './RideBasemap';

const NativeRideBasemap = lazy(() => import('./NativeRideBasemap'));

export function RideBasemap({ route, guideRoute, position, viewport, variant = 'live' }: RideBasemapProps) {
  const styles = useStyles();
  const fallback = variant === 'preview' ? null : <ActivityRouteMap route={route} guideRoute={guideRoute} live={variant === 'live'} fill={!!viewport} />;
  const expoGo = isRunningInExpoGo();
  if (expoGo || !TurboModuleRegistry.get('MLRNLocationModule')) {
    return (
      <View style={viewport && styles.fullscreen}>
        {fallback}
        <Text accessibilityRole="alert" style={[styles.notice, viewport && styles.floatingNotice]}>
          {expoGo
            ? 'Estás en Expo Go. Abre Traza en una compilación de desarrollo para ver calles y relieve.'
            : 'Esta versión de Traza no incluye MapLibre. Instala una compilación nueva para ver calles y relieve.'}
        </Text>
      </View>
    );
  }
  return (
    <Suspense fallback={fallback}>
      <NativeRideBasemap route={route} guideRoute={guideRoute} position={position} viewport={viewport} variant={variant} />
    </Suspense>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  notice: { ...typography.bodySmall, color: colors.textPrimary, padding: spacing.sm },
  fullscreen: { flex: 1 },
  floatingNotice: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    maxWidth: '85%',
    backgroundColor: colors.background,
  },
}));
