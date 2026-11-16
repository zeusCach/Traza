import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton, AppCard } from '@/components';
import { colors, radius, spacing, typography } from '@/theme';

import { formatDistance } from '../format';

const storageKey = 'traza.monthlyGoals.v1';
const emptyGoals = { kilometers: 0, rides: 0 };

export async function loadMonthlyGoals() {
  const stored = await AsyncStorage.getItem(storageKey);
  if (stored === null) return emptyGoals;
  const goals = JSON.parse(stored);
  if (!goals || !Number.isSafeInteger(goals.kilometers) || goals.kilometers < 0 ||
    !Number.isSafeInteger(goals.rides) || goals.rides < 0) {
    throw new Error('Formato de metas inválido');
  }
  return { kilometers: Number(goals.kilometers), rides: Number(goals.rides) };
}

export function MonthlyGoals({ initialGoals, distance, count }: {
  initialGoals: typeof emptyGoals;
  distance: number;
  count: number;
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [kilometers, setKilometers] = useState(initialGoals.kilometers ? String(initialGoals.kilometers) : '');
  const [rides, setRides] = useState(initialGoals.rides ? String(initialGoals.rides) : '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);

  async function save() {
    if (pending.current) return;
    if (![kilometers, rides].every(value => /^\d{0,5}$/.test(value.trim()))) {
      setMessage('Escribe números enteros de hasta 5 cifras.');
      return;
    }
    const next = { kilometers: Number(kilometers), rides: Number(rides) };
    pending.current = true;
    setSaving(true);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      setGoals(next);
      setMessage('Metas guardadas.');
    } catch {
      setMessage('No se pudieron guardar las metas. Intenta de nuevo.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <AppCard style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>Metas mensuales</Text>
      {[
        { label: 'Distancia', amount: distance / 1000, goal: goals.kilometers, display: formatDistance(distance), unit: 'km' },
        { label: 'Rodadas', amount: count, goal: goals.rides, display: String(count), unit: 'rodadas' },
      ].filter(item => item.goal > 0).map(item => {
        const percentage = Math.min(100, Math.floor(item.amount / item.goal * 100));
        return (
          <View key={item.label} style={styles.progress}>
            <Text style={styles.label}>{item.display} / {item.goal} {item.unit}{percentage === 100 ? ' · Meta cumplida' : ''}</Text>
            <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel={item.label} accessibilityValue={{ min: 0, max: 100, now: percentage }}>
              <View style={[styles.fill, { width: `${percentage}%` }]} />
            </View>
          </View>
        );
      })}
      <Text style={styles.caption}>Se repiten cada mes. Deja un campo vacío para desactivar esa meta.</Text>
      <View style={styles.fields}>
        {[
          { label: 'Kilómetros', value: kilometers, update: setKilometers },
          { label: 'Rodadas', value: rides, update: setRides },
        ].map(field => (
          <View key={field.label} style={styles.field}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              accessibilityLabel={field.label}
              inputMode="numeric"
              editable={!saving}
              value={field.value}
              onChangeText={value => {
                field.update(value);
                setMessage('');
              }}
              style={styles.input}
            />
          </View>
        ))}
      </View>
      <AppButton label="Guardar metas" variant="secondary" size="md" onPress={save} loading={saving} />
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.caption}>{message}</Text>}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { ...typography.subtitle, color: colors.textPrimary },
  caption: { ...typography.bodySmall, color: colors.textSecondary },
  label: { ...typography.label, color: colors.textPrimary },
  progress: { gap: spacing.xs },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary },
  fields: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1, gap: spacing.xs },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
});
