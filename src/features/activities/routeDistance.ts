import type { ActivityRoute, RoutePoint } from '@/database/activities';

export function distanceBetween(a: RoutePoint, b: RoutePoint) {
  const radians = Math.PI / 180;
  const latitude = Math.sin((b.latitude - a.latitude) * radians / 2);
  const longitude = Math.sin((b.longitude - a.longitude) * radians / 2);
  const haversine = latitude ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * longitude ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function estimateMaxSpeed(route: ActivityRoute | null) {
  let maximum: number | null = null;
  for (const segment of route ?? []) {
    for (let index = 1; index < segment.length; index += 1) {
      const previous = segment[index - 1];
      const point = segment[index];
      const elapsedMs = point.timestamp - previous.timestamp;
      if (elapsedMs <= 0 || elapsedMs > 30_000) continue;
      const speedKmh = distanceBetween(previous, point) / elapsedMs * 3_600;
      if (Number.isFinite(speedKmh)) maximum = Math.max(maximum ?? 0, speedKmh);
    }
  }
  return maximum;
}
