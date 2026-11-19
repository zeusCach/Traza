import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, sizes, spacing, typography, useTheme, themedStyles } from '@/theme';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost';
export type AppButtonSize = 'md' | 'lg';

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  disabled = false,
  loading = false,
  accessibilityLabel,
}: AppButtonProps) {
  const { colors } = useTheme();
  const variantStyles = useVariantStyles();
  const iconColor = variant === 'primary' ? colors.background : variant === 'ghost' ? colors.primary : colors.textPrimary;
  const isDisabled = disabled || loading;
  const height = size === 'lg' ? sizes.buttonLg : sizes.buttonMd;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { height },
        variantStyles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={sizes.iconMd} color={iconColor} strokeWidth={2} /> : null}
          <Text style={[styles.label, { color: iconColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.button,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
});

const useVariantStyles = themedStyles(colors => StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: { backgroundColor: 'transparent' },
}));
