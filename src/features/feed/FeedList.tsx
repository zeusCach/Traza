import { Link } from 'expo-router';
import { Bookmark, ChevronRight, Heart, Play } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppCard, EmptyState, ErrorState, LoadingState, UserAvatar } from '@/components';
import { RouteMapPreview } from '@/features/activities/components/ActivityMapPreview';
import { activityDateFormat, formatDistance, formatDuration } from '@/features/activities/format';
import { colors, spacing, typography } from '@/theme';

import { examplePosts, togglePost, type FeedPost } from './feedStorage';
import { useFeed } from './useFeed';

const feedViewability = { itemVisiblePercentThreshold: 10, minimumViewTime: 120 };

export function FeedList() {
  const { state, error, busy, change, retry } = useFeed();
  const [visiblePosts, setVisiblePosts] = useState<Set<string>>(() => new Set());
  const onPostsVisible = useCallback(({ viewableItems }: { viewableItems: { key: string }[] }) => {
    setVisiblePosts(new Set(viewableItems.map(item => item.key)));
  }, []);

  if (error) return <ErrorState title="No pudimos actualizar el feed" message="Intenta cargar los datos locales de nuevo." onRetry={retry} />;
  if (!state) return <LoadingState message="Cargando feed…" />;

  return (
    <FlatList
      data={[...state.published, ...examplePosts]}
      keyExtractor={post => post.id}
      viewabilityConfig={feedViewability}
      onViewableItemsChanged={onPostsVisible}
      extraData={visiblePosts}
      initialNumToRender={4}
      windowSize={5}
      contentContainerStyle={styles.content}
      ListHeaderComponent={(
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Feed</Text>
          <Text style={styles.caption}>Actividades de quienes sigues</Text>
        </View>
      )}
      renderItem={({ item: post }) => {
        const traced = state.traced.includes(post.id);
        const saved = state.saved.includes(post.id);
        return (
          <AppCard style={styles.card}>
            <Link href={{ pathname: '/feed/[id]', params: { id: post.id } }} asChild>
              <Pressable accessibilityRole="link" style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <View style={styles.row}>
                  <UserAvatar name={post.author} size="sm" />
                  <View style={styles.info}>
                    <Text style={styles.author}>{post.author}</Text>
                    <Text style={styles.caption}>{activityDateFormat.format(post.activity.startedAt)}</Text>
                  </View>
                  <ChevronRight size={20} color={colors.textSecondary} />
                </View>
                <Text style={styles.subtitle}>{post.activity.name || 'Rodada'}</Text>
                <Text style={styles.caption}>
                  {post.activity.distanceM !== null && `${formatDistance(post.activity.distanceM)} km · `}
                  {formatDuration(post.activity.durationMs)}
                </Text>
                <RouteMapPreview route={post.route} visible={visiblePosts.has(post.id)} />
              </Pressable>
            </Link>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="togglebutton"
                accessibilityState={{ checked: traced, disabled: busy }}
                accessibilityLabel={traced ? 'Quitar Trazo' : 'Dar Trazo'}
                disabled={busy}
                onPress={() => void change(current => ({ ...current, traced: togglePost(current.traced, post.id) }))}
                style={styles.action}
              >
                <Heart size={19} color={traced ? colors.primary : colors.textSecondary} fill={traced ? colors.primary : 'none'} />
                <Text style={[styles.caption, traced && styles.active]}>{post.traces + Number(traced)} Trazos</Text>
              </Pressable>
              {post.route.some(segment => segment.length > 0) && (
                <Pressable
                  accessibilityRole="togglebutton"
                  accessibilityState={{ checked: saved, disabled: busy }}
                  accessibilityLabel={saved ? 'Quitar ruta de Mapas' : 'Guardar ruta en Mapas'}
                  disabled={busy}
                  onPress={() => void change(current => ({ ...current, saved: togglePost(current.saved, post.id) }))}
                  style={styles.action}
                >
                  <Bookmark size={19} color={saved ? colors.primary : colors.textSecondary} fill={saved ? colors.primary : 'none'} />
                  <Text style={[styles.caption, saved && styles.active]}>{saved ? 'Guardada' : 'Guardar ruta'}</Text>
                </Pressable>
              )}
            </View>
          </AppCard>
        );
      }}
    />
  );
}

export function SavedRoutes({ canStart, onStart }: { canStart: boolean; onStart: (post: FeedPost) => void }) {
  const { state, error, retry } = useFeed();
  const posts: FeedPost[] = state ? [...state.published, ...examplePosts].filter(post => state.saved.includes(post.id)) : [];

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.subtitle}>Rutas guardadas</Text>
      {error ? <ErrorState title="No pudimos cargar las rutas" message="Intenta cargar las rutas guardadas en este dispositivo." onRetry={retry} /> : !state ? (
        <LoadingState message="Cargando rutas…" />
      ) : posts.length === 0 ? (
        <EmptyState icon={Bookmark} title="Aún no hay rutas guardadas" message="Guarda una ruta desde el Feed para encontrarla aquí." />
      ) : posts.map(post => (
        <AppCard key={post.id} style={styles.card}>
          <Link href={{ pathname: '/feed/[id]', params: { id: post.id } }} asChild>
            <Pressable accessibilityRole="link" style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <Bookmark size={20} color={colors.primary} />
              <View style={styles.info}>
                <Text style={styles.author}>{post.activity.name || 'Rodada'}</Text>
                <Text style={styles.caption}>{post.author} · {formatDistance(post.activity.distanceM)} km</Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </Pressable>
          </Link>
          <AppButton
            label="Iniciar esta ruta"
            accessibilityLabel={`Iniciar ruta: ${post.activity.name || 'Rodada'}`}
            icon={Play}
            size="md"
            variant="secondary"
            disabled={!canStart}
            onPress={() => onStart(post)}
          />
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.xs },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.subtitle, color: colors.textPrimary },
  author: { ...typography.body, color: colors.textPrimary },
  caption: { ...typography.bodySmall, color: colors.textSecondary },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  info: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.border },
  action: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  active: { color: colors.primary },
  pressed: { opacity: 0.75 },
});
