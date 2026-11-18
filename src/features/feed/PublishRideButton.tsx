import { router } from 'expo-router';
import { Send, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { AppButton } from '@/components';
import type { Activity, ActivityRoute } from '@/database/activities';
import { colors, typography } from '@/theme';

import { useFeed } from './useFeed';
import { publishRemoteRide, removeRemotePost } from './remoteFeed';

export function PublishRideButton({ activity, route }: { activity: Activity; route: ActivityRoute }) {
  const { state, error, busy, run, retry, accountId } = useFeed(`ride:${activity.startedAt}`);
  const [confirm, setConfirm] = useState(false);
  const published = accountId && state?.published[0];

  function press() {
    if (error) return retry();
    if (!accountId) return router.push('/cuenta');
    if (!published) return void run(() => publishRemoteRide(accountId, activity, route));
    if (!confirm) return setConfirm(true);
    setConfirm(false);
    void run(() => removeRemotePost(accountId, published.id));
  }

  return (
    <>
      <AppButton
        label={error ? 'Reintentar carga del feed' : !accountId ? 'Inicia sesión para publicar' :
          published ? confirm ? 'Confirmar retiro' : 'Quitar del Feed' : 'Publicar en el Feed'}
        icon={published ? Trash2 : Send}
        size="md"
        variant="secondary"
        loading={busy || (!state && !error)}
        onPress={press}
      />
      {confirm && <AppButton label="Cancelar" size="md" variant="ghost" onPress={() => setConfirm(false)} />}
      {(error || accountId) && (
        <Text style={{ ...typography.bodySmall, color: error ? colors.error : colors.textSecondary }}>
          {error ? 'No pudimos actualizar la publicación.' : published
            ? 'Tu rodada seguirá en Actividades si la quitas del Feed.'
            : 'Al publicar, otros ciclistas podrán ver este recorrido.'}
        </Text>
      )}
    </>
  );
}
