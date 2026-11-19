import AsyncStorage from '@react-native-async-storage/async-storage';

export const rideEfforts = ['normal', 'moderate', 'competitive', 'hard'] as const;
export type RideEffort = typeof rideEfforts[number];
export const rideEffortLabels: Record<RideEffort, string> = {
  normal: 'Normal',
  moderate: 'Moderado',
  competitive: 'Competitivo',
  hard: 'Difícil',
};

export interface RideDetails {
  name?: string;
  effort?: RideEffort;
}

export const rideNameLimit = 80;

export interface Activity extends RideDetails {
  startedAt: number;
  durationMs: number;
  distanceM: number | null;
  elevationGainM?: number | null;
  maxSpeedKmh?: number | null;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  altitudeM?: number | null;
}

export type ActivityRoute = RoutePoint[][];

function historyKey(accountId: string) {
  return `traza.activities.v2.${accountId}`;
}

function routeKey(accountId: string, startedAt: number) {
  return `traza.activityRoute.v2.${accountId}.${startedAt}`;
}

export async function loadActivities(accountId: string): Promise<Activity[]> {
  const stored = await AsyncStorage.getItem(historyKey(accountId));
  if (stored === null) return [];

  const activities: unknown = JSON.parse(stored);
  if (!Array.isArray(activities) || !activities.every(isActivity)) {
    throw new Error('Formato de historial inválido');
  }
  return activities;
}

function isActivity(value: unknown): value is Activity {
  if (typeof value !== 'object' || value === null) return false;
  const activity = value as Partial<Activity>;
  return (
    typeof activity.startedAt === 'number' && Number.isFinite(activity.startedAt) &&
    typeof activity.durationMs === 'number' && Number.isFinite(activity.durationMs) &&
    (activity.name === undefined || typeof activity.name === 'string') &&
    (activity.effort === undefined || rideEfforts.includes(activity.effort)) &&
    (activity.distanceM === null ||
      (typeof activity.distanceM === 'number' && Number.isFinite(activity.distanceM))) &&
    (activity.elevationGainM == null ||
      (Number.isFinite(activity.elevationGainM) && activity.elevationGainM >= 0)) &&
    (activity.maxSpeedKmh == null ||
      (Number.isFinite(activity.maxSpeedKmh) && activity.maxSpeedKmh >= 0))
  );
}

export async function loadActivityRoute(accountId: string, startedAt: number): Promise<ActivityRoute> {
  const stored = await AsyncStorage.getItem(routeKey(accountId, startedAt));
  if (stored === null) return [];
  const route: unknown = JSON.parse(stored);
  if (!Array.isArray(route) || !route.every(segment => Array.isArray(segment) && segment.every(isRoutePoint))) {
    throw new Error('Formato de recorrido inválido');
  }
  return route;
}

function isRoutePoint(value: unknown): value is RoutePoint {
  if (typeof value !== 'object' || value === null) return false;
  const { latitude, longitude, timestamp, altitudeM } = value as Partial<RoutePoint>;
  return typeof latitude === 'number' && Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' && Math.abs(longitude) <= 180 &&
    typeof timestamp === 'number' && Number.isFinite(timestamp) &&
    (altitudeM == null || Number.isFinite(altitudeM));
}

let pendingWrite = Promise.resolve();

function writeHistory<T>(operation: () => Promise<T>) {
  const result = pendingWrite.then(operation);
  pendingWrite = result.then(() => undefined, () => undefined);
  return result;
}

export function saveActivity(accountId: string, activity: Activity, route: ActivityRoute) {
  return writeHistory(async () => {
    const history = await loadActivities(accountId);
    const updated = [activity, ...history.filter(item => item.startedAt !== activity.startedAt)];
    if (route.length > 0) {
      await AsyncStorage.setItem(routeKey(accountId, activity.startedAt), JSON.stringify(route));
    }
    await AsyncStorage.setItem(historyKey(accountId), JSON.stringify(updated));
    return updated;
  });
}

export function updateRideDetails(accountId: string, startedAt: number, details: RideDetails) {
  return writeHistory(async () => {
    const history = await loadActivities(accountId);
    const index = history.findIndex(item => item.startedAt === startedAt);
    if (index < 0) throw new Error('Rodada no encontrada');
    const activity = { ...history[index], ...details };
    history[index] = activity;
    await AsyncStorage.setItem(historyKey(accountId), JSON.stringify(history));
    return activity;
  });
}
