// Walk / drive / transit minutes between two points, for the Navigate dropdown —
// all from Google's Routes API (GOOGLE_ROUTES_API_KEY), so they match what Google
// Maps shows when you open it. Walking and driving ask for the duration alone;
// transit also asks for its steps, so the dropdown can say which bus or train.
// Walking and transit bill as Compute Routes Essentials (10,000 free a month) —
// response fields aren't on Google's list of what moves a request up a tier.
// Driving with live traffic bills as Compute Routes Pro (5,000 free a month).

import { haversineKm } from '@/lib/geo/geocode';

type LatLng = { lat: number; lng: number };
export type TravelMode = 'walking' | 'driving' | 'transit';

/** One part of a transit journey: a walk, or a ride on one line. */
export type TransitLeg =
  | { kind: 'walk'; minutes: number }
  | {
      kind:         'ride';
      vehicle:      string;          // Google's vehicle type: BUS, TRAM, SUBWAY, HEAVY_RAIL…
      vehicleName:  string;          // "Bus", "Train" — Google's own word for it
      line:         string;          // "46A", "DART"
      color?:       string;
      textColor?:   string;
      headsign?:    string;          // "Howth"
      from:         string;          // stop you get on at
      to:           string;          // stop you get off at
      departs:      string;          // local time at the stop, "13:37"
      arrives:      string;
      stops:        number;
    };

export interface TravelTimes {
  walking:     number | null;        // minutes; null = no route / not available
  driving:     number | null;
  transit:     number | null;
  transitPlan: TransitLeg[] | null;
}

/** Further apart than this, none of the three answers is useful, so Google isn't asked. */
export const MAX_TRAVEL_KM = 150;

const TIMEOUT_MS = 6_000;
const CACHE_MS: Record<TravelMode, number> = {
  walking: 24 * 60 * 60_000,   // streets don't change
  driving: 15 * 60_000,        // traffic does
  transit: 3 * 60_000,         // "board at 13:37" goes stale fast
};
const MAX_CACHED = 5_000;

interface Answer { minutes: number | null; plan?: TransitLeg[] | null }
const NO_ANSWER: Answer = { minutes: null };
const cache = new Map<string, { answer: Answer; at: number }>();

const GOOGLE_MODE: Record<TravelMode, string> = { walking: 'WALK', driving: 'DRIVE', transit: 'TRANSIT' };
const FIELDS: Record<TravelMode, string> = {
  walking: 'routes.duration',
  driving: 'routes.duration',
  transit: 'routes.duration,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.transitDetails',
};

const seconds = (d: unknown) => parseFloat(typeof d === 'string' ? d : '');   // "1234s"

// Google's steps → walk / ride / walk. Back-to-back walking steps (each turn is a
// step) become one walk.
function transitPlan(steps: any[]): TransitLeg[] {
  const plan: TransitLeg[] = [];
  let walkSecs = 0;
  const flushWalk = () => {
    const minutes = Math.round(walkSecs / 60);
    if (minutes > 0) plan.push({ kind: 'walk', minutes });
    walkSecs = 0;
  };
  for (const s of steps) {
    const td = s.transitDetails;
    if (s.travelMode !== 'TRANSIT' || !td) {
      walkSecs += seconds(s.staticDuration) || 0;
      continue;
    }
    flushWalk();
    const line = td.transitLine ?? {};
    plan.push({
      kind:        'ride',
      vehicle:     line.vehicle?.type ?? 'OTHER',
      vehicleName: line.vehicle?.name?.text ?? 'Transit',
      line:        line.nameShort || line.name || '',
      color:       line.color,
      textColor:   line.textColor,
      headsign:    td.headsign,
      from:        td.stopDetails?.departureStop?.name ?? '',
      to:          td.stopDetails?.arrivalStop?.name ?? '',
      departs:     td.localizedValues?.departureTime?.time?.text ?? '',
      arrives:     td.localizedValues?.arrivalTime?.time?.text ?? '',
      stops:       td.stopCount ?? 0,
    });
  }
  flushWalk();
  return plan;
}

// undefined = the lookup failed (not cached, so the next open tries again).
async function google(mode: TravelMode, from: LatLng, to: LatLng): Promise<Answer | undefined> {
  const key = process.env.GOOGLE_ROUTES_API_KEY;
  if (!key) return NO_ANSWER;
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS[mode] },
    body: JSON.stringify({
      origin:       { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination:  { location: { latLng: { latitude: to.lat,   longitude: to.lng } } },
      travelMode:   GOOGLE_MODE[mode],
      languageCode: 'en-GB',   // 24-hour departure times
      ...(mode === 'driving' && { routingPreference: 'TRAFFIC_AWARE' }),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return undefined;   // includes the daily cap being hit
  const route = (await res.json()).routes?.[0];
  const secs  = seconds(route?.duration);
  if (!Number.isFinite(secs)) return NO_ANSWER;
  return {
    minutes: Math.max(1, Math.round(secs / 60)),
    ...(mode === 'transit' && { plan: transitPlan(route.legs?.[0]?.steps ?? []) }),
  };
}

async function cached(mode: TravelMode, from: LatLng, to: LatLng): Promise<Answer> {
  // Origin to ~100 m: a phone's position drifts, and that's well inside a minute's walk.
  const key = `${mode}:${from.lat.toFixed(3)},${from.lng.toFixed(3)};${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS[mode]) return hit.answer;

  let answer: Answer | undefined;
  try { answer = await google(mode, from, to); } catch { answer = undefined; }
  if (!answer) return NO_ANSWER;

  if (cache.size >= MAX_CACHED) cache.clear();
  cache.set(key, { answer, at: Date.now() });
  return answer;
}

export async function travelTimes(from: LatLng, to: LatLng): Promise<TravelTimes> {
  if (haversineKm(from.lat, from.lng, to.lat, to.lng) > MAX_TRAVEL_KM) {
    return { walking: null, driving: null, transit: null, transitPlan: null };
  }
  const [walking, driving, transit] = await Promise.all([
    cached('walking', from, to),
    cached('driving', from, to),
    cached('transit', from, to),
  ]);
  return {
    walking:     walking.minutes,
    driving:     driving.minutes,
    transit:     transit.minutes,
    transitPlan: transit.plan ?? null,
  };
}
