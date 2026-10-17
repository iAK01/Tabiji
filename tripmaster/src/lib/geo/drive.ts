// Driving time between two points, for "leave by" reminders. Mapbox when the
// token is set, cached for a few hours (the notification run asks about the
// same airport trips every few minutes); otherwise an estimate from the
// straight-line distance.

import { haversineKm } from '@/lib/geo/geocode';

type LatLng = { lat: number; lng: number };

export interface DriveTime { minutes: number; estimated: boolean }

const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { value: DriveTime; at: number }>();

/** Roads aren't straight and there's traffic: ~37 km/h door to door, plus 10 min. */
export function estimateDrive(from: LatLng, to: LatLng): DriveTime {
  const km = haversineKm(from.lat, from.lng, to.lat, to.lng);
  return { minutes: Math.max(10, Math.round((10 + km * 1.6) / 5) * 5), estimated: true };
}

export async function drivingTime(from: LatLng, to: LatLng): Promise<DriveTime> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return estimateDrive(from, to);

  const key = `${from.lng.toFixed(4)},${from.lat.toFixed(4)};${to.lng.toFixed(4)},${to.lat.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  let value = estimateDrive(from, to);
  try {
    const res  = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${key}?access_token=${token}`);
    const data = await res.json();
    const secs = data.routes?.[0]?.duration;
    if (typeof secs === 'number') value = { minutes: Math.max(5, Math.round(secs / 60 / 5) * 5), estimated: false };
  } catch { /* keep the estimate */ }

  cache.set(key, { value, at: Date.now() });
  return value;
}
