// One request to Google's Routes API (GOOGLE_ROUTES_API_KEY), shared by the
// Navigate dropdown's live times and the itinerary's stored legs. Server only.
// Billing follows the request, not the fields asked for: walking, transit and
// driving without live traffic are Compute Routes Essentials; driving with
// traffic is Pro.

type LatLng = { lat: number; lng: number };
export type RoutesMode = 'WALK' | 'DRIVE' | 'TRANSIT';

const TIMEOUT_MS = 6_000;

/** "1234s" → 1234 */
export const routeSeconds = (d: unknown) => parseFloat(typeof d === 'string' ? d : '');

/**
 * Google's first route for `fields` (a field mask). null when Google has no
 * route; undefined when it couldn't be asked — no key, an error, the daily cap
 * hit or a timeout — so the caller can try again later rather than remember it.
 */
export async function computeRoute(
  mode:   RoutesMode,
  from:   LatLng,
  to:     LatLng,
  fields: string,
  extra:  Record<string, unknown> = {},
): Promise<any | null | undefined> {
  const key = process.env.GOOGLE_ROUTES_API_KEY;
  if (!key) return undefined;
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fields },
      body: JSON.stringify({
        origin:       { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination:  { location: { latLng: { latitude: to.lat,   longitude: to.lng } } },
        travelMode:   mode,
        languageCode: 'en-GB',   // 24-hour departure times
        ...extra,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    return (await res.json()).routes?.[0] ?? null;
  } catch {
    return undefined;
  }
}
