export const activityDateFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const distanceFormat = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const speedFormat = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

export function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, '0');
  const remainder = String(seconds % 60).padStart(2, '0');
  return hours ? [hours, minutes, remainder].join(':') : [minutes, remainder].join(':');
}

export function formatDistance(meters: number | null) {
  return meters === null ? '—' : distanceFormat.format(meters / 1000);
}

export function averageSpeed(distanceM: number | null, durationMs: number) {
  return distanceM !== null && durationMs > 0 ? (distanceM / durationMs) * 3600 : null;
}

export function formatSpeed(kmh: number | null) {
  return kmh === null ? '—' : speedFormat.format(kmh);
}
