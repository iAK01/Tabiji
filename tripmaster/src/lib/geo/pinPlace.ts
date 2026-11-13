// The pin for a place on the trip — a stop, a venue, an extracted or AI-picked place.
// People walk and drive to these, and a map app given loose text guesses: "Place Bab
// El Had, Avenue Hassan II, Rabat" routed to the far end of Avenue Hassan II, 11 km
// from the gate. So a place is pinned only when it's certain:
//   1. a stated street address → the numbered building, in the town it names
//      (Google, then Mapbox)
//   2. otherwise the place's own name → a result that carries that name, in the
//      area: Google Places, Mapbox, OpenStreetMap, then Google's geocoder. Every
//      name the stop gives ("Live Showcase: X — Bahnini Stage", the address's
//      leading "Kasbah of the Oudayas") is tried, and they must all agree on one
//      place — two different answers means no pin.
// Streets, districts and towns are never pins. Null = not certain; the caller asks.
// Server only.

import { haversineKm, locateAddress, locatePlace, localityWords, sameName, words, type GeoHit, type SearchArea } from './geocode';
import { viaPlaces } from './findPlace';
import { pinAddress } from './pinAddress';
import type { TripArea } from './tripAreas';

export interface PlacePin extends GeoHit {
  source: 'google' | 'mapbox' | 'osm';
}

export interface PlaceToPin {
  name?:    string;
  address?: string;
  /** Free-text search hint from the source, e.g. "Talleres Palermo, Las Palmas" */
  query?:   string;
}

/** Two answers further apart than this are different places. */
const SAME_PLACE_KM = 0.25;

// Words that describe the visit, not the place. A name made only of these and
// generic words ("medina gate", "optional dinner") isn't worth looking up.
const DESCRIPTIVE = new Set([
  'optional', 'walk', 'walking', 'heritage', 'tour', 'visit', 'mint', 'tea', 'craft', 'waterfront', 'live', 'showcase',
  'showcases', 'electro', 'stages', 'depart', 'departs', 'from', 'bring', 'cash', 'check', 'arrive', 'arrival', 'departure',
  'gate', 'medina', 'quick', 'early', 'late', 'free', 'time', 'day', 'night', 'morning', 'afternoon', 'evening',
]);

const STREET_START = /^(rue|avenue|av\.?|boulevard|bd\.?|calle|avenida|avda\.?|carrer|street|road|place|plaza|plaça|zankat|zanqat|derb|via|viale|strasse|straße)\b/i;

const clean = (s: string) => s.replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim();

/** Every name the stop gives for its place, most complete first. */
export function placeNames(name = '', address = ''): string[] {
  const full  = clean(name);
  const out   = [full];
  for (const m of full.matchAll(/\(([^)]+)\)/g)) out.push(m[1]);
  const plain = full.replace(/\([^)]*\)/g, ' ');
  for (const part of plain.split(/\s[—–-]\s/)) {
    out.push(part);
    const afterLabel = part.split(/:\s/).slice(1).join(': ');   // "Live Showcase: Chloë's Clue" → "Chloë's Clue"
    if (afterLabel) out.push(afterLabel);
  }
  const lead = clean(address.split(',')[0] ?? '');
  if (lead && !/\d/.test(lead) && !STREET_START.test(lead)) out.push(lead);

  const seen = new Set<string>();
  return out.map(clean).filter(s => {
    const key = s.toLowerCase();
    if (!s || seen.has(key)) return false;
    seen.add(key);
    return words(s).some(w => !DESCRIPTIVE.has(w));
  });
}

// ─── Name sources ─────────────────────────────────────────────────────────────

const googleKey = () => process.env.GOOGLE_ROUTES_API_KEY;
let placesOffUntil = 0;   // Places (New) not switched on for the key — don't ask again for a while

async function byGooglePlaces(name: string, area: SearchArea): Promise<PlacePin | null> {
  if (!googleKey() || Date.now() < placesOffUntil) return null;
  const hit = await viaPlaces({
    name, query: `${name}, ${area.locality}`, centre: area.center, near: area.center,
    locality: area.locality, maxKm: area.maxKm ?? 40,
  });
  if (hit === 'unavailable') { placesOffUntil = Date.now() + 10 * 60_000; return null; }
  // A chain with branches in town: which one is meant isn't certain
  return hit && hit.branches === 1 ? { address: hit.address, lat: hit.lat, lng: hit.lng, source: 'google' } : null;
}

async function byMapbox(name: string, area: SearchArea): Promise<PlacePin | null> {
  const hit = await locatePlace({ name }, area);
  return hit && { ...hit, source: 'mapbox' };
}

// OpenStreetMap's public search asks for at most one request a second.
let osmNext = 0;
const OSM_SKIP = new Set(['highway', 'boundary', 'place', 'landuse', 'route', 'waterway']);

async function byOsm(name: string, area: SearchArea): Promise<PlacePin | null> {
  const wait = osmNext - Date.now();
  osmNext = Math.max(Date.now(), osmNext) + 1100;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));

  const km   = area.maxKm ?? 40;
  const dLat = km / 111, dLng = km / (111 * Math.cos((area.center.lat * Math.PI) / 180));
  const box  = [area.center.lng - dLng, area.center.lat + dLat, area.center.lng + dLng, area.center.lat - dLat].map(n => n.toFixed(4)).join(',');
  const url  = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&namedetails=1&bounded=1&viewbox=${box}` +
               `&q=${encodeURIComponent(`${name}, ${area.locality.split(',')[0]}`)}`;
  const res  = await fetch(url, { headers: { 'User-Agent': 'trip-planner-place-lookup/1.0' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const locality = localityWords(area.locality);
  for (const r of await res.json()) {
    if (OSM_SKIP.has(r.category ?? r.class)) continue;
    const lat = Number(r.lat), lng = Number(r.lon);
    if (!Number.isFinite(lat) || haversineKm(area.center.lat, area.center.lng, lat, lng) > km) continue;
    const names = [r.name, ...Object.entries(r.namedetails ?? {}).filter(([k]) => /^(name(:\w+)?|alt_name|official_name|short_name)$/.test(k)).map(([, v]) => v)]
      .filter((v): v is string => typeof v === 'string' && !!v);
    const own = names.find(n => sameName(name, n, locality) || sameName(n, name, locality));
    if (!own) continue;
    const rest = String(r.display_name ?? '').split(',').slice(1, 3).map((s: string) => s.trim()).filter(Boolean).join(', ');
    return { address: [own, rest].filter(Boolean).join(', '), lat, lng, source: 'osm' };
  }
  return null;
}

const NOT_A_PLACE = new Set(['route', 'political', 'locality', 'sublocality', 'sublocality_level_1', 'neighborhood', 'plus_code',
  'postal_code', 'country', 'administrative_area_level_1', 'administrative_area_level_2', 'administrative_area_level_3', 'colloquial_area']);

// Google's geocoder rarely says a place's name back — only when its first part is that name.
async function byGoogleName(name: string, area: SearchArea): Promise<PlacePin | null> {
  const key = googleKey();
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(`${name}, ${area.locality}`)}&language=en&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.status !== 'OK') return null;
  const locality = localityWords(area.locality);
  for (const r of data.results ?? []) {
    const types: string[] = r.types ?? [];
    if (!types.length || types.every(t => NOT_A_PLACE.has(t))) continue;
    const own = String(r.address_components?.[0]?.long_name ?? '');
    if (!own || !(sameName(name, own, locality) || sameName(own, name, locality))) continue;
    const { lat, lng } = r.geometry?.location ?? {};
    if (!Number.isFinite(lat) || haversineKm(area.center.lat, area.center.lng, lat, lng) > (area.maxKm ?? 40)) continue;
    const formatted = String(r.formatted_address ?? '');
    return { address: formatted.startsWith(own) ? formatted : `${own}, ${formatted}`, lat, lng, source: 'google' };
  }
  return null;
}

async function byName(name: string, area: SearchArea): Promise<PlacePin | null> {
  for (const source of [byGooglePlaces, byMapbox, byOsm, byGoogleName]) {
    try {
      const hit = await source(name, area);
      if (hit) return hit;
    } catch (err) {
      console.error('[pinPlace]', source.name, err);
    }
  }
  return null;
}

// ─── Pin ──────────────────────────────────────────────────────────────────────

/** The area to search: the trip town nearest `near` (or the destination). */
export function searchArea(areas: TripArea[], near?: { lat: number; lng: number } | null, country?: string): SearchArea | null {
  const sorted = near
    ? [...areas].sort((a, b) => haversineKm(near.lat, near.lng, a.lat, a.lng) - haversineKm(near.lat, near.lng, b.lat, b.lng))
    : areas;
  const a = sorted[0];
  if (!a) return null;
  return { center: { lat: a.lat, lng: a.lng }, locality: [a.city, country].filter(Boolean).join(', '), maxKm: 40 };
}

/**
 * The certain pin for a place, or null. A stated street address wins; otherwise
 * every name the place goes by must lead to the same spot.
 */
export async function pinPlace(p: PlaceToPin, area: SearchArea, areas: TripArea[] = []): Promise<PlacePin | null> {
  const address = p.address?.trim() ?? '';
  if (/\d/.test(address)) {
    try {
      const pin = await pinAddress(address, areas.length ? areas : [{ ...area.center, city: area.locality.split(',')[0] }]);
      if (pin) return { address: pin.label, lat: pin.lat, lng: pin.lng, source: 'google' };
    } catch (err) {
      console.error('[pinPlace] address', err);
    }
    const hit = await locateAddress(address, area);
    if (hit) return { ...hit, source: 'mapbox' };
  }

  const names = placeNames(p.name, address);
  if (p.query?.trim() && !names.some(n => n.toLowerCase() === p.query!.trim().toLowerCase())) names.push(p.query.trim());
  const hits = (await Promise.all(names.map(n => byName(n, area)))).filter((h): h is PlacePin => !!h);
  if (!hits.length) return null;
  // Two names leading to two places: which one is meant isn't certain
  if (hits.some(h => haversineKm(hits[0].lat, hits[0].lng, h.lat, h.lng) > SAME_PLACE_KM)) return null;
  return hits[0];
}
