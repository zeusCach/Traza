import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

export interface AppCardProps {
  children: ReactNode;
  onPress?: () => void;
  elevated?: boolean;
  padding?: keyof typeof spacing;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function AppCard({
  children,
  onPress,
  elevated = false,
  padding = 'md',
  style,
  accessibilityLabel,
}: AppCardProps) {
  const cardStyle: ViewStyle = {
    backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
    padding: spacing[padding],
  };

  if (!onPress) {
    return <View style={[styles.card, cardStyle, style]}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, cardStyle, style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.9,
  },
});