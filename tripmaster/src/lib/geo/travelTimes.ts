// Walk / drive / transit minutes between two points, for the Navigate dropdown —
// all from Google's Routes API (GOOGLE_ROUTES_API_KEY), so they match what Google
// Maps shows when you open it. Each asks for the duration alone. Walking and transit
// bill as Compute Routes Essentials (10,000 free a month); driving with live traffic
// bills as Compute Routes Pro (5,000 free a month).

import { haversineKm } from '@/lib/geo/geocode';

type LatLng = { lat: number; lng: number };
export type TravelMode  = 'walking' | 'driving' | 'transit';
export type TravelTimes = Record<TravelMode, number | null>;   // minutes; null = no route / not available

/** Further apart than this, none of the three answers is useful, so Google isn't asked. */
export const MAX_TRAVEL_KM = 150;

const TIMEOUT_MS = 6_000;
const CACHE_MS: Record<TravelMode, number> = {
  walking: 24 * 60 * 60_000,   // streets don't change
  driving: 15 * 60_000,        // traffic does
  transit: 15 * 60_000,        // so does the next departure
};
const MAX_CACHED = 5_000;
const cache = new Map<string, { minutes: number | null; at: number }>();

// Seconds of travel; null = the service found no route; undefined = the lookup
// failed (not cached, so the next open tries again).
type Lookup = () => Promise<number | null | undefined>;

const GOOGLE_MODE: Record<TravelMode, string> = { walking: 'WALK', driving: 'DRIVE', transit: 'TRANSIT' };

async function google(mode: TravelMode, from: LatLng, to: LatLng): Promise<number | null | undefined> {
  const key = process.env.GOOGLE_ROUTES_API_KEY;
  if (!key) return null;
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.duration' },
    body: JSON.stringify({
      origin:      { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat,   longitude: to.lng } } },
      travelMode:  GOOGLE_MODE[mode],
      ...(mode === 'driving' && { routingPreference: 'TRAFFIC_AWARE' }),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return undefined;   // includes the daily cap being hit
  const secs = parseFloat((await res.json()).routes?.[0]?.duration ?? '');   // "1234s"
  return Number.isFinite(secs) ? secs : null;
}

async function cached(mode: TravelMode, from: LatLng, to: LatLng, lookup: Lookup): Promise<number | null> {
  // Origin to ~100 m: a phone's position drifts, and that's well inside a minute's walk.
  const key = `${mode}:${from.lat.toFixed(3)},${from.lng.toFixed(3)};${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS[mode]) return hit.minutes;

  let secs: number | null | undefined;
  try { secs = await lookup(); } catch { secs = undefined; }
  if (secs === undefined) return null;

  const minutes = secs === null ? null : Math.max(1, Math.round(secs / 60));
  if (cache.size >= MAX_CACHED) cache.clear();
  cache.set(key, { minutes, at: Date.now() });
  return minutes;
}

export async function travelTimes(from: LatLng, to: LatLng): Promise<TravelTimes> {
  if (haversineKm(from.lat, from.lng, to.lat, to.lng) > MAX_TRAVEL_KM) {
    return { walking: null, driving: null, transit: null };
  }
  const [walking, driving, transit] = await Promise.all([
    cached('walking', from, to, () => google('walking', from, to)),
    cached('driving', from, to, () => google('driving', from, to)),
    cached('transit', from, to, () => google('transit', from, to)),
  ]);
  return { walking, driving, transit };
}
