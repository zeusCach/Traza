import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { ArrowLeft } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppCard } from '@/components';
import { loadRideDraft } from '@/database/rideDraft';
import { spacing, typography, themedStyles } from '@/theme';

type UpdateAction = 'check' | 'download' | 'apply';

const actionErrors: Record<UpdateAction, string> = {
  check: 'No pudimos buscar actualizaciones. Intenta de nuevo.',
  download: 'No pudimos descargar la actualización. Intenta de nuevo.',
  apply: 'No pudimos aplicar la actualización. Intenta de nuevo.',
};

export default function UpdatesScreen() {
  const styles = useStyles();
  const updates = Updates.useUpdates();
  const { currentlyRunning, isChecking, isDownloading, isRestarting, isUpdateAvailable, isUpdatePending } = updates;
  const [action, setAction] = useState<UpdateAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runningAction = useRef(false);
  const canUpdate = Updates.isEnabled && !!currentlyRunning.channel;
  const busy = action !== null || isChecking || isDownloading || isRestarting;
  const nextAction = isUpdatePending ? 'apply' : isUpdateAvailable ? 'download' : 'check';

  async function runUpdateAction() {
    if (!canUpdate || busy || runningAction.current) return;
    runningAction.current = true;
    setAction(nextAction);
    setError(null);
    try {
      if (nextAction === 'apply') {
        if ((await loadRideDraft())?.segmentStart != null) {
          setError('Pausa o guarda tu rodada antes de reiniciar TRAZA.');
          return;
        }
        await Updates.reloadAsync();
      } else if (nextAction === 'download') {
        const result = await Updates.fetchUpdateAsync();
        if (!result.isNew && !result.isRollBackToEmbedded && !isUpdatePending) {
          await Updates.checkForUpdateAsync();
        }
      } else {
        await Updates.checkForUpdateAsync();
      }
    } catch {
      setError(actionErrors[nextAction]);
    } finally {
      runningAction.current = false;
      setAction(null);
    }
  }

  let status = 'Busca una actualización para este dispositivo.';
  if (!canUpdate) status = 'Las actualizaciones de TRAZA no están disponibles en esta instalación.';
  else if (action === 'apply' || isRestarting) status = 'Reiniciando TRAZA…';
  else if (action === 'download' || isDownloading) status = 'Descargando actualización…';
  else if (action === 'check' || isChecking) status = 'Buscando actualizaciones…';
  else if (isUpdatePending) status = 'Actualización descargada. Reinicia TRAZA para aplicarla.';
  else if (isUpdateAvailable) status = 'Hay una actualización disponible.';
  else if (updates.checkError) status = actionErrors.check;
  else if (updates.lastCheckForUpdateTimeSinceRestart) status = 'No hay actualizaciones nuevas.';

  const label = nextAction === 'apply'
    ? 'Reiniciar y aplicar'
    : nextAction === 'download' ? 'Descargar actualización' : 'Buscar actualizaciones';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.back}>
          <AppButton
            icon={ArrowLeft}
            label="Volver"
            size="md"
            variant="ghost"
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
          />
        </View>
        <Text accessibilityRole="header" style={styles.title}>Actualizaciones</Text>
        <AppCard style={styles.card}>
          <Text style={styles.subtitle}>Versión instalada</Text>
          <Text style={styles.body}>
            {canUpdate
              ? currentlyRunning.isEmbeddedLaunch ? 'Versión incluida en la APK' : 'Actualización aplicada'
              : 'Instalación sin canal de actualización'}
          </Text>
          {currentlyRunning.createdAt && (
            <Text style={styles.body}>{currentlyRunning.createdAt.toLocaleString('es-MX')}</Text>
          )}
          {currentlyRunning.channel && <Text style={styles.body}>Canal {currentlyRunning.channel}</Text>}
          {currentlyRunning.updateId && <Text selectable style={styles.body}>{currentlyRunning.updateId}</Text>}
        </AppCard>
        <Text accessibilityLiveRegion="polite" style={styles.body}>{status}</Text>
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {canUpdate && <AppButton label={label} loading={busy} onPress={runUpdateAction} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  back: { alignSelf: 'flex-start' },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.subtitle, color: colors.textPrimary },
  card: { gap: spacing.xs },
  body: { ...typography.body, color: colors.textSecondary },
  error: { ...typography.bodySmall, color: colors.error },
}));
