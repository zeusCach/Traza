import { router } from 'expo-router';
import { ArrowLeft, Bike, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { darkColors, lightColors, radius, spacing, themedStyles, typography, useTheme, type AppearancePreference } from '@/theme';

const choices: { value: AppearancePreference; label: string }[] = [
  { value: 'system', label: 'Predeterminado por el teléfono' },
  { value: 'light', label: 'Modo claro' },
  { value: 'dark', label: 'Modo oscuro' },
];

export default function AppearanceScreen() {
  const { colors, preference, systemScheme, savePreference } = useTheme();
  const styles = useStyles();
  const [error, setError] = useState(false);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" style={styles.back}
            onPress={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/', params: { section: 'tu' } })}>
            <ArrowLeft size={25} color={colors.textPrimary} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>Aspecto</Text>
        </View>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {choices.map(({ value, label }) => {
            const selected = preference === value;
            return (
              <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: selected }}
                style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}
                onPress={() => {
                  setError(false);
                  void savePreference(value).catch(() => setError(true));
                }}>
                <ThemePreview mode={value} />
                <View style={styles.copy}>
                  <Text style={styles.label}>{label}</Text>
                  {value === 'system' && <Text style={styles.secondary}>{systemScheme === 'light' ? 'Modo claro' : 'Modo oscuro'}</Text>}
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <Check size={15} color={colors.background} strokeWidth={3} />}
                </View>
              </Pressable>
            );
          })}
        </View>
        {error && <Text accessibilityLiveRegion="polite" style={styles.error}>No pudimos guardar el aspecto. Vuelve a intentarlo.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function ThemePreview({ mode }: { mode: AppearancePreference }) {
  if (mode !== 'system') return <View style={previewStyles.clip}><Sample dark={mode === 'dark'} /></View>;

  return (
    <View style={previewStyles.clip}>
      <Sample dark />
      <View style={previewStyles.half}><Sample dark={false} /></View>
    </View>
  );
}

function Sample({ dark }: { dark: boolean }) {
  const palette = dark ? darkColors : lightColors;
  return (
    <View style={[previewStyles.sample, { backgroundColor: palette.surfaceElevated }]}>
      <View style={[previewStyles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Bike size={23} color={palette.primary} />
        <View style={[previewStyles.line, { backgroundColor: palette.primary }]} />
        <View style={[previewStyles.lineShort, { backgroundColor: palette.border }]} />
      </View>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  clip: { width: 84, height: 78, borderRadius: radius.md, overflow: 'hidden' },
  half: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 42, overflow: 'hidden' },
  sample: { width: 84, height: 78, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: radius.sm, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', gap: 4 },
  line: { height: 3, width: 28, borderRadius: 2 },
  lineShort: { height: 3, width: 18, borderRadius: 2 },
});

const useStyles = themedStyles(colors => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: spacing.md, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, color: colors.textPrimary },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.sm, backgroundColor: colors.surface,
    borderRadius: radius.card, borderWidth: 1, borderColor: colors.border,
  },
  selected: { borderColor: colors.primary },
  pressed: { backgroundColor: colors.surfaceElevated },
  copy: { flex: 1, gap: spacing.xs },
  label: { ...typography.body, color: colors.textPrimary },
  secondary: { ...typography.bodySmall, color: colors.textSecondary },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.textSecondary, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  error: { ...typography.bodySmall, color: colors.error },
}));
