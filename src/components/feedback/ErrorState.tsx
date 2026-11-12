import { TriangleAlert } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, sizes, spacing, typography } from '@/theme';

import { AppButton } from '../ui/AppButton';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'No pudimos cargar la información',
  message = 'Revisa tu conexión e inténtalo de nuevo.',
  onRetry,
  retryLabel = 'Reintentar',
}: ErrorStateProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <TriangleAlert size={sizes.iconLg * 2} color={colors.error} strokeWidth={1.75} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <View style={styles.action}>
          <AppButton label={retryLabel} onPress={onRetry} variant="secondary" size="md" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.md,
    width: '100%',
  },
});