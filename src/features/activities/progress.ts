import type { Activity, ActivityRoute } from '@/database/activities';
import { distanceBetween } from './routeDistance';

export function startOfWeek(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - (date.getDay() + 6) % 7);
}

export function shiftDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function summarize(activities: Activity[]) {
  return activities.reduce((total, activity) => ({
    distance: total.distance + Math.max(0, activity.distanceM ?? 0),
    elevation: total.elevation + (activity.elevationGainM ?? 0),
    duration: total.duration + Math.max(0, activity.durationMs),
    count: total.count + 1,
  }), { distance: 0, elevation: 0, duration: 0, count: 0 });
}

export function groupWeeks(activities: Activity[], today: Date) {
  const currentWeek = startOfWeek(today);
  const groups = new Map<number, Activity[]>();
  for (const activity of activities) {
    if (activity.startedAt > today.getTime()) continue;
    const key = startOfWeek(new Date(activity.startedAt)).getTime();
    const group = groups.get(key);
    if (group) group.push(activity);
    else groups.set(key, [activity]);
  }

  // An empty week in progress does not break the series until it ends.
  let cursor = groups.has(currentWeek.getTime()) ? currentWeek : shiftDays(currentWeek, -7);
  let streak = 0;
  while (groups.has(cursor.getTime())) {
    streak += 1;
    cursor = shiftDays(cursor, -7);
  }

  const weeks = Array.from({ length: 12 }, (_, index) => {
    const start = shiftDays(currentWeek, (index - 11) * 7);
    return { start, ...summarize(groups.get(start.getTime()) ?? []) };
  });
  return { weeks, streak };
}

export const recordDistances = [5000, 10000, 20000];

export function bestRouteTimes(route: ActivityRoute, distances = recordDistances) {
  const best = distances.map(() => Number.POSITIVE_INFINITY);
  for (const segment of route) {
    if (segment.length < 2) continue;
    const meters = [0];
    for (let i = 1; i < segment.length; i += 1) {
      meters.push(meters[i - 1] + distanceBetween(segment[i - 1], segment[i]));
    }

    // Each candidate has either its start or its finish at a recorded GPS point.
    // Interpolate the other endpoint and never bridge paused segments.
    distances.forEach((distance, index) => {
      if (meters[meters.length - 1] < distance) return;
      let finish = 1;
      let start = 0;
      for (let i = 0; i < meters.length; i += 1) {
        const endDistance = meters[i] + distance;
        while (finish < meters.length && meters[finish] < endDistance) finish += 1;
        if (finish < meters.length) {
          const ratio = (endDistance - meters[finish - 1]) / (meters[finish] - meters[finish - 1]);
          const endTime = segment[finish - 1].timestamp + ratio * (segment[finish].timestamp - segment[finish - 1].timestamp);
          const duration = endTime - segment[i].timestamp;
          if (duration > 0) best[index] = Math.min(best[index], duration);
        }

        const startDistance = meters[i] - distance;
        if (startDistance < 0) continue;
        while (meters[start + 1] <= startDistance) start += 1;
        const ratio = (startDistance - meters[start]) / (meters[start + 1] - meters[start]);
        const startTime = segment[start].timestamp + ratio * (segment[start + 1].timestamp - segment[start].timestamp);
        const duration = segment[i].timestamp - startTime;
        if (duration > 0) best[index] = Math.min(best[index], duration);
      }
    });
  }
  return best;
}
