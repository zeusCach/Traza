import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text } from 'react-native';

import { spacing, typography, themedStyles } from '@/theme';

import { RouteBackdrop } from './RouteBackdrop';

export function StartupLoader({ ready, onDismiss }: { ready: boolean; onDismiss: () => void }) {
  const styles = useStyles();
  const [reduceMotion, setReduceMotion] = useState<boolean>();
  const [drawn, setDrawn] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let active = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then(
      value => { if (active) setReduceMotion(current => current ?? value); },
      () => { if (active) setReduceMotion(current => current ?? true); },
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === undefined || drawn) return;
    const draw = Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion ? 0 : 1150,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    });
    draw.start(({ finished }) => { if (finished) setDrawn(true); });
    return () => draw.stop();
  }, [drawn, progress, reduceMotion]);

  useEffect(() => {
    if (!ready || !drawn) return;
    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: reduceMotion ? 0 : 180,
      useNativeDriver: true,
    });
    fade.start(({ finished }) => { if (finished) onDismiss(); });
    return () => fade.stop();
  }, [drawn, onDismiss, opacity, ready, reduceMotion]);

  return (
    <Animated.View
      accessibilityLabel="TRAZA. Cargando la aplicación."
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      accessible
      style={[StyleSheet.absoluteFill, styles.screen, { opacity }]}
    >
      <RouteBackdrop progress={progress} />
      <Text style={styles.brand}>TRAZA</Text>
      <Text style={styles.tagline}>Tu ruta, tu aventura, tus metas.</Text>
    </Animated.View>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  screen: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  brand: { color: '#FFFFFF', fontSize: 62, fontWeight: '800', letterSpacing: 5, textAlign: 'center' },
  tagline: { color: colors.textPrimary, fontSize: typography.body.fontSize, textAlign: 'center' },
}));
