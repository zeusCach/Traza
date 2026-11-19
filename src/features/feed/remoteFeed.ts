import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Activity, ActivityRoute, RideEffort } from '@/database/activities';
import { supabase } from '@/database/supabase';

import type { FeedPost, FeedState } from './feedStorage';

const postColumns = 'id, author_id, profile:profiles!ride_posts_author_id_fkey(display_name)';
const rideColumns = 'started_at_ms, duration_ms, distance_m, elevation_gain_m, name, effort, route';
const postFields = `${postColumns}, ride:rides(${rideColumns})`;

type PostRow = {
  id: string;
  author_id: string;
  profile: { display_name: string };
  ride: {
    started_at_ms: number;
    duration_ms: number;
    distance_m: number | null;
    elevation_gain_m: number | null;
    name: string | null;
    effort: RideEffort | null;
    route: ActivityRoute;
  };
};

export type FeedQuery = 'recent' | 'saved' | `post:${string}` | `ride:${number}`;

function client() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

function toPost(row: PostRow, accountId: string): FeedPost {
  const { ride, profile } = row;
  return {
    id: row.id,
    author: row.author_id === accountId ? 'Tú' : profile.display_name,
    owned: row.author_id === accountId,
    activity: {
      startedAt: ride.started_at_ms,
      durationMs: ride.duration_ms,
      distanceM: ride.distance_m,
      elevationGainM: ride.elevation_gain_m,
      name: ride.name ?? undefined,
      effort: ride.effort ?? undefined,
    },
    route: ride.route,
    traces: 0,
  };
}

const tracesKey = (accountId: string) => `traza.feed.traces.${accountId}`;

export async function loadRemoteFeed(accountId: string, query: FeedQuery): Promise<FeedState> {
  const db = client();
  const savedQuery = db.from('saved_posts')
    .select(query === 'saved' ? `post_id, post:ride_posts(${postFields})` : 'post_id')
    .eq('user_id', accountId).order('saved_at', { ascending: false })
    .overrideTypes<{ post_id: string; post?: PostRow }[], { merge: false }>();

  const posts = db.from('ride_posts').select(postFields);
  const postId = query.startsWith('post:') ? query.slice(5) : null;
  const startedAt = query.startsWith('ride:') ? Number(query.slice(5)) : null;
  const postQuery = query === 'recent'
    ? posts.order('published_at', { ascending: false }).order('id', { ascending: false }).limit(30)
    : startedAt !== null
      ? db.from('ride_posts').select(`${postColumns}, ride:rides!inner(${rideColumns})`)
        .eq('author_id', accountId).eq('ride.started_at_ms', startedAt)
      : postId && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(postId) ? posts.eq('id', postId) : null;

  const [saved, result, traced] = await Promise.all([
    savedQuery,
    postQuery?.overrideTypes<PostRow[], { merge: false }>(),
    AsyncStorage.getItem(tracesKey(accountId)),
  ]);
  if (saved.error) throw saved.error;
  if (result?.error) throw result.error;
  const rows = query === 'saved' ? saved.data.flatMap(item => item.post ? [item.post] : []) : result?.data ?? [];
  return {
    published: rows.map(row => toPost(row, accountId)),
    saved: saved.data.map(item => item.post_id),
    traced: traced ? JSON.parse(traced) : [],
  };
}

export async function setRemoteSaved(accountId: string, postId: string, saved: boolean) {
  const db = client();
  const result = saved
    ? await db.from('saved_posts').upsert({ post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
    : await db.from('saved_posts').delete().eq('user_id', accountId).eq('post_id', postId);
  if (result.error) throw result.error;
}

export function setLocalTraces(accountId: string, traces: string[]) {
  return AsyncStorage.setItem(tracesKey(accountId), JSON.stringify(traces));
}

export async function publishRemoteRide(accountId: string, activity: Activity, route: ActivityRoute) {
  const db = client();
  const { error: createError } = await db.from('rides').upsert({
    owner_id: accountId,
    started_at_ms: activity.startedAt,
    duration_ms: Math.round(activity.durationMs),
    distance_m: activity.distanceM,
    elevation_gain_m: activity.elevationGainM ?? null,
    name: activity.name ?? null,
    effort: activity.effort ?? null,
    route,
  }, { onConflict: 'owner_id,started_at_ms', ignoreDuplicates: true });
  if (createError) throw createError;

  const { data: ride, error: readError } = await db.from('rides').select('id')
    .eq('owner_id', accountId).eq('started_at_ms', activity.startedAt).single();
  if (readError) throw readError;

  const { error } = await db.from('ride_posts').upsert({ ride_id: ride.id }, {
    onConflict: 'ride_id',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

export async function removeRemotePost(accountId: string, postId: string) {
  const { error } = await client().from('ride_posts').delete().eq('author_id', accountId).eq('id', postId);
  if (error) throw error;
}
