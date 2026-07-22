export const isStale = (date?: string | null, minutes = 5) => !date || Date.now() - new Date(date).getTime() > minutes * 60_000;

export function relativeTime(value?: string | null) {
  if (!value) return 'Nunca';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours} h`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value));
}

export function distanceKm(a?: { latitude: number; longitude: number } | null, b?: { latitude: number; longitude: number } | null) {
  if (!a || !b) return null;
  const r = 6371;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function formatDistance(distanceKmValue: number) {
  const safeDistance = Math.max(0, distanceKmValue);
  if (safeDistance < 1) return `${Math.round(safeDistance * 1000)} m`;
  return `${safeDistance.toLocaleString('pt-BR', {
    minimumFractionDigits: safeDistance < 100 ? 2 : 1,
    maximumFractionDigits: safeDistance < 100 ? 2 : 1,
  })} km`;
}

export function formatSpeed(speedMetersPerSecond?: number | null) {
  if (speedMetersPerSecond == null || !Number.isFinite(speedMetersPerSecond) || speedMetersPerSecond < 0 || speedMetersPerSecond > 80) return null;
  const speedKmH = Math.max(0, speedMetersPerSecond * 3.6);
  return `${speedKmH.toLocaleString('pt-BR', {
    minimumFractionDigits: speedKmH > 0 && speedKmH < 100 ? 1 : 0,
    maximumFractionDigits: speedKmH < 100 ? 1 : 0,
  })} km/h`;
}
