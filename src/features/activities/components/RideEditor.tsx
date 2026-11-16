import { useRef, useState } from 'react';
import {
  Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { AppButton, AppCard } from '@/components';
import { rideEffortLabels, rideEfforts, rideNameLimit, type RideDetails } from '@/database/activities';
import { colors, radius, spacing, typography } from '@/theme';

const effortColors = [colors.primary, '#65DDA0', '#FFAA52', colors.error];
const lastLevel = rideEfforts.length - 1;
const thumbRadius = 9;

function EffortSlider({ level, onChange, disabled }: {
  level: number;
  onChange: (level: number) => void;
  disabled: boolean;
}) {
  const [width, setWidth] = useState(0);
  const [position] = useState(() => new Animated.Value(level));
  const origin = useRef({ pageX: 0, localX: 0 });
  const span = Math.max(1, width - thumbRadius * 2);
  const inputRange = rideEfforts.map((_, index) => index);
  const offset = position.interpolate({ inputRange: [0, lastLevel], outputRange: [0, span] });
  const tint = position.interpolate({ inputRange, outputRange: effortColors });
  const currentLabel = rideEffortLabels[rideEfforts[level]];

  function select(next: number) {
    const selected = Math.max(0, Math.min(lastLevel, next));
    onChange(selected);
    Animated.timing(position, { toValue: selected, duration: 140, useNativeDriver: false }).start();
  }

  function drag(x: number) {
    const next = Math.min(lastLevel, Math.max(0, (x - thumbRadius) / span * lastLevel));
    position.setValue(next);
    onChange(Math.round(next));
    return next;
  }

  return (
    <View>
      <View style={styles.effortHeading}>
        <Text style={styles.label}>Esfuerzo de la rodada</Text>
        <Text style={[styles.label, { color: effortColors[level] }]}>{currentLabel}</Text>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Esfuerzo de la rodada"
        accessibilityValue={{ min: 0, max: lastLevel, now: level, text: currentLabel }}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (!disabled) select(level + (nativeEvent.actionName === 'increment' ? 1 : -1));
        }}
        onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
        onStartShouldSetResponder={() => !disabled && width > thumbRadius * 2}
        onResponderTerminationRequest={() => false}
        onResponderGrant={({ nativeEvent }) => {
          origin.current = { pageX: nativeEvent.pageX, localX: nativeEvent.locationX };
          drag(nativeEvent.locationX);
        }}
        onResponderMove={({ nativeEvent }) => drag(origin.current.localX + nativeEvent.pageX - origin.current.pageX)}
        onResponderRelease={({ nativeEvent }) => select(Math.round(drag(origin.current.localX + nativeEvent.pageX - origin.current.pageX)))}
        onResponderTerminate={() => select(level)}
        style={styles.slider}
      >
        <View pointerEvents="none" style={styles.track}>
          <Animated.View style={[styles.fill, { width: offset, backgroundColor: tint }]} />
        </View>
        <Animated.View pointerEvents="none" style={[styles.thumb, { backgroundColor: tint, transform: [{ translateX: offset }] }]} />
      </View>
      <View style={styles.options}>
        {rideEfforts.map((effort, index) => (
          <Pressable
            key={effort}
            accessibilityRole="button"
            accessibilityState={{ selected: level === index, disabled }}
            disabled={disabled}
            onPress={() => select(index)}
            style={styles.option}
          >
            <Text style={[styles.optionLabel, level === index && { color: effortColors[index] }]}>
              {rideEffortLabels[effort]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function RideEditor({ initial, onCancel, onSave }: {
  initial?: RideDetails;
  onCancel: () => void;
  onSave: (details: RideDetails) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [level, setLevel] = useState(rideEfforts.indexOf(initial?.effort ?? 'normal'));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);

  async function submit() {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setFailed(false);
    try {
      await onSave({ name: name.trim() || undefined, effort: rideEfforts[level] });
    } catch {
      setFailed(true);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  function close() {
    if (!pending.current) onCancel();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialog}>
          <AppCard style={styles.card} elevated>
            <Text accessibilityRole="header" style={styles.title}>{initial ? 'Editar rodada' : 'Guardar rodada'}</Text>
            <Text style={styles.label}>Nombre de la rodada</Text>
            <TextInput
              accessibilityLabel="Nombre de la rodada"
              placeholder="Ej. Vuelta de descanso"
              placeholderTextColor={colors.textSecondary}
              maxLength={rideNameLimit}
              value={name}
              onChangeText={setName}
              editable={!saving}
              style={styles.input}
            />
            <EffortSlider level={level} onChange={setLevel} disabled={saving} />
            {failed && <Text accessibilityRole="alert" style={styles.error}>No pudimos guardar la rodada. Intenta de nuevo.</Text>}
            <AppButton label={initial ? 'Guardar cambios' : 'Guardar rodada'} onPress={submit} loading={saving} />
            <AppButton label="Cancelar" variant="ghost" size="md" onPress={close} disabled={saving} />
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000A' },
  dialog: { flexGrow: 1, justifyContent: 'center', padding: spacing.md },
  card: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: spacing.sm },
  title: { ...typography.title, color: colors.textPrimary },
  label: { ...typography.label, color: colors.textPrimary },
  input: {
    ...typography.body, color: colors.textPrimary, minHeight: 48,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm,
  },
  effortHeading: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
  slider: { height: 44, justifyContent: 'center' },
  track: { marginHorizontal: thumbRadius, height: 8, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  thumb: { position: 'absolute', left: 0, width: thumbRadius * 2, height: thumbRadius * 2, borderRadius: thumbRadius },
  options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  option: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  optionLabel: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.bodySmall, color: colors.error },
});
