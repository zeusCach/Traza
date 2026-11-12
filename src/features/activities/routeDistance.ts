import type { RoutePoint } from '@/database/activities';

export function distanceBetween(a: RoutePoint, b: RoutePoint) {
  const radians = Math.PI / 180;
  const latitude = Math.sin((b.latitude - a.latitude) * radians / 2);
  const longitude = Math.sin((b.longitude - a.longitude) * radians / 2);
  const haversine = latitude ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * longitude ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}
