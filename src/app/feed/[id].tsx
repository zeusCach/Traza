import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Bookmark, BookmarkCheck, Gauge, Mountain, Route, Timer } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppCard, EmptyState, ErrorState, LoadingState, MetricCard, UserAvatar } from '@/components';
import { ElevationProfile } from '@/features/activities/components/ElevationProfile';
import { activityDateFormat, averageSpeed, formatDistance, formatDuration, formatElevationGain, formatSpeed } from '@/features/activities/format';
import { examplePosts, togglePost } from '@/features/feed/feedStorage';
import { useFeed } from '@/features/feed/useFeed';
import { RideBasemap } from '@/features/tracking/components/RideBasemap';
import { colors, spacing, typography } from '@/theme';

export default function FeedActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, error, busy, change, retry } = useFeed();
  const post = state && [...state.published, ...examplePosts].find(item => item.id === id);
  const saved = post && state?.saved.includes(post.id);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.back}>
          <AppButton icon={ArrowLeft} label="Volver" variant="ghost" size="md"
            onPress={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/', params: { section: 'feed' } })} />
        </View>
        {error ? <ErrorState title="No pudimos actualizar la publicación" message="Intenta cargar los datos locales de nuevo." onRetry={retry} /> : !state ? (
          <LoadingState message="Cargando publicación…" />
        ) : !post ? (
          <EmptyState icon={Route} title="Publicación no encontrada" />
        ) : (
          <>
            <View style={styles.author}>
              <UserAvatar name={post.author} size="sm" />
              <View style={styles.authorText}>
                <Text style={styles.subtitle}>{post.author}</Text>
                <Text style={styles.caption}>{activityDateFormat.format(post.activity.startedAt)}</Text>
              </View>
            </View>
            <Text accessibilityRole="header" style={styles.title}>{post.activity.name || 'Rodada'}</Text>
            <View style={styles.metrics}>
              <MetricCard label="Distancia" value={formatDistance(post.activity.distanceM)} unit="km" highlighted />
              <MetricCard label="Tiempo activo" value={formatDuration(post.activity.durationMs)} icon={Timer} />
            </View>
            <View style={styles.metrics}>
              <MetricCard label="Velocidad media" icon={Gauge} unit="km/h"
                value={formatSpeed(averageSpeed(post.activity.distanceM, post.activity.durationMs))} />
              {post.activity.elevationGainM != null && (
                <MetricCard label="Desnivel positivo" value={formatElevationGain(post.activity.elevationGainM)} unit="m" icon={Mountain} />
              )}
            </View>
            {post.route.some(segment => segment.length > 0) ? (
              <>
                <Text accessibilityRole="header" style={styles.subtitle}>Recorrido</Text>
                <AppCard><RideBasemap route={post.route} variant="activity" /></AppCard>
                <AppButton icon={saved ? BookmarkCheck : Bookmark}
                  label={saved ? 'Quitar de Mapas' : 'Guardar ruta en Mapas'} variant={saved ? 'secondary' : 'primary'}
                  loading={busy}
                  onPress={() => void change(current => ({ ...current, saved: togglePost(current.saved, post.id) }))} />
                {post.route.some(segment => segment.some(point => point.altitudeM != null)) && <ElevationProfile route={post.route} />}
              </>
            ) : <EmptyState icon={Route} title="Sin recorrido GPS" />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 600, alignSelf: 'center' },
  back: { alignSelf: 'flex-start' },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.subtitle, color: colors.textPrimary },
  caption: { ...typography.bodySmall, color: colors.textSecondary },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  authorText: { flex: 1 },
  metrics: { flexDirection: 'row', gap: spacing.sm },
});
