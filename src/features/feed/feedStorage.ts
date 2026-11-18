import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Activity, ActivityRoute } from '@/database/activities';
import { distanceBetween } from '@/features/activities/routeDistance';

export interface FeedPost {
  id: string;
  author: string;
  activity: Activity;
  route: ActivityRoute;
  traces: number;
}

interface FeedState {
  published: FeedPost[];
  traced: string[];
  saved: string[];
}

const key = 'traza.feed.v1';
let pendingWrite = Promise.resolve();

async function readFeed(): Promise<FeedState> {
  const stored = await AsyncStorage.getItem(key);
  return stored === null ? { published: [], traced: [], saved: [] } : JSON.parse(stored);
}

export function loadFeed() {
  return pendingWrite.then(readFeed);
}

export function updateFeed(update: (state: FeedState) => FeedState) {
  const result = pendingWrite.then(async () => {
    const next = update(await readFeed());
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return next;
  });
  pendingWrite = result.then(() => undefined, () => undefined);
  return result;
}

export function togglePost(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];
}

function examplePost(
  id: string, author: string, name: string, startedAt: number, durationMs: number, traces: number,
  coordinates: [latitude: number, longitude: number, altitudeM: number][],
): FeedPost {
  const route = coordinates.map(([latitude, longitude, altitudeM], index) => ({
    latitude, longitude, altitudeM, timestamp: startedAt + durationMs * index / (coordinates.length - 1),
  }));
  return {
    id, author, traces, route: [route],
    activity: {
      name, startedAt, durationMs,
      distanceM: route.reduce((total, point, index) => total + distanceBetween(route[index - 1] ?? point, point), 0),
      elevationGainM: route.reduce((total, point, index) =>
        total + Math.max(0, point.altitudeM - (route[index - 1]?.altitudeM ?? point.altitudeM)), 0),
    },
  };
}

export const examplePosts = [
  examplePost('costa', 'Mariana Luna', 'Rodada por la costa', Date.UTC(2026, 10, 17, 13), 3_780_000, 24, [
    [21.17, -86.81, 4], [21.15, -86.77, 7], [21.12, -86.75, 12],
    [21.08, -86.77, 8], [21.03, -86.79, 10], [21.01, -86.81, 6],
  ]),
  examplePost('selva', 'Diego Reyes', 'Vuelta por la selva', Date.UTC(2026, 10, 15, 14), 4_440_000, 16, [
    [20.86, -86.89, 7], [20.87, -86.94, 14], [20.85, -86.99, 26],
    [20.81, -87.02, 34], [20.79, -86.98, 20], [20.81, -86.93, 11], [20.84, -86.89, 8],
  ]),
];
