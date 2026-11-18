import { Send } from 'lucide-react-native';
import { Text } from 'react-native';

import { AppButton } from '@/components';
import type { Activity, ActivityRoute } from '@/database/activities';
import { colors, typography } from '@/theme';

import { useFeed } from './useFeed';

export function PublishRideButton({ activity, route }: { activity: Activity; route: ActivityRoute }) {
  const { state, error, busy, change, retry } = useFeed();
  const id = `mine-${activity.startedAt}`;
  const published = state?.published.some(post => post.id === id);

  return (
    <>
      <AppButton
        label={error ? 'Reintentar carga del feed' : published ? 'Publicado en el Feed' : 'Publicar en el Feed'}
        icon={Send}
        size="md"
        variant="secondary"
        loading={busy || (!state && !error)}
        disabled={published && !error}
        onPress={error ? retry : () => void change(current => ({
          ...current,
          published: current.published.some(post => post.id === id)
            ? current.published
            : [{ id, author: 'Tú', activity, route, traces: 0 }, ...current.published],
        }))}
      />
      <Text style={{ ...typography.bodySmall, color: error ? colors.error : colors.textSecondary }}>
        {error ? 'No pudimos guardar o cargar la publicación.' : 'Las publicaciones del prototipo se guardan en este dispositivo.'}
      </Text>
    </>
  );
}
