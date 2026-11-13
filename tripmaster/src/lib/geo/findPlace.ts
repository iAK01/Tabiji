// Finding a named place (a café, a shop, a bar) on Google when Mapbox doesn't
// know it — for things clipped from pages that name a place but give no address.
//
// Same rule as everywhere else: a pin only when the match is certain.
//   • Places search (Text Search, New) returns each result's own name: it must be
//     the place asked for (sameName), open, and in the area. A chain with several
//     branches gets the branch nearest `near` (your hotel).
//   • When Places isn't switched on for the key, Google's geocoder: it doesn't
//     say the name back, so only a single establishment matching the whole query
//     (no partial match) counts.
// Server only: GOOGLE_ROUTES_API_KEY is the Maps Platform key.

import { haversineKm, localityWords, sameName } from './geocode';

export interface FoundPlace {
  address:  string;   // leads with the place's name, so anyone can see what the pin is
  lat:      number;
  lng:      number;
  branches: number;   // how many branches matched; >1 means the nearest was taken
}

interface Search {
  name:    string;
  query:   string;                          // "F.café, Rabat, Morocco"
  centre:  { lat: number; lng: number };    // the town or trip area
  near:    { lat: number; lng: number };    // the stay, else the centre
  locality: string;                         // "Rabat, Morocco"
  maxKm:   number;
}

const key = () => process.env.GOOGLE_ROUTES_API_KEY;

async function viaPlaces(s: Search): Promise<FoundPlace | null | 'unavailable'> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key()!,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.businessStatus',
    },
    body: JSON.stringify({
      textQuery: s.query,
      maxResultCount: 10,
      locationBias: { circle: { center: { latitude: s.centre.lat, longitude: s.centre.lng }, radius: Math.min(s.maxKm, 50) * 1000 } },
    }),
  });
  if (res.status === 403 || res.status === 401) return 'unavailable';
  if (!res.ok) return null;
  const words = localityWords(s.locality);
  const hits = ((await res.json())?.places ?? [])
    .map((p: any) => ({
      name: String(p.displayName?.text ?? ''),
      address: String(p.formattedAddress ?? ''),
      lat: p.location?.latitude, lng: p.location?.longitude,
      closed: p.businessStatus === 'CLOSED_PERMANENTLY',
    }))
    .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !p.closed)
    .filter((p: any) => haversineKm(s.centre.lat, s.centre.lng, p.lat, p.lng) <= s.maxKm)
    .filter((p: any) => sameName(s.name, p.name, words) || sameName(p.name, s.name, words));
  if (!hits.length) return null;
  const best = hits
    .map((p: any) => ({ ...p, km: haversineKm(s.near.lat, s.near.lng, p.lat, p.lng) }))
    .sort((a: any, b: any) => a.km - b.km)[0];
  return {
    address:  best.address.startsWith(best.name) ? best.address : [best.name, best.address].filter(Boolean).join(', '),
    lat:      best.lat,
    lng:      best.lng,
    branches: hits.length,
  };
}

const ESTABLISHMENT = new Set(['establishment', 'point_of_interest']);

async function viaGeocoder(s: Search): Promise<FoundPlace | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', s.query);
  url.searchParams.set('key', key()!);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.status !== 'OK') return null;
  const places = (data.results ?? []).filter((r: any) =>
    (r.types ?? []).some((t: string) => ESTABLISHMENT.has(t)) && !r.partial_match);
  if (places.length !== 1) return null;
  const r = places[0];
  const { lat, lng } = r.geometry?.location ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (haversineKm(s.centre.lat, s.centre.lng, lat, lng) > s.maxKm) return null;
  return { address: `${s.name}, ${r.formatted_address}`, lat, lng, branches: 1 };
}

export async function findNamedPlace(s: Search): Promise<FoundPlace | null> {
  if (!key() || !s.name.trim()) return null;
  try {
    const p = await viaPlaces(s);
    if (p !== 'unavailable') return p;
    return await viaGeocoder(s);
  } catch {
    return null;
  }
}
