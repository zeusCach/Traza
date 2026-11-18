import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, sizes, spacing, typography } from '@/theme';

import { AppCard } from './AppCard';

export interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  icon?: LucideIcon;
  highlighted?: boolean;
}

export function MetricCard({ label, value, unit, icon: Icon, highlighted = false }: MetricCardProps) {
  return (
    <AppCard padding="sm" style={styles.card} accessibilityLabel={`${label}: ${value} ${unit ?? ''}`}>
      <View style={styles.header}>
        {Icon ? <Icon size={sizes.iconSm} color={colors.primary} strokeWidth={2} /> : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, highlighted && styles.valueHighlighted]}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  value: {
    ...typography.metricMedium,
    color: colors.textPrimary,
  },
  valueHighlighted: {
    color: colors.primary,
  },
  unit: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});