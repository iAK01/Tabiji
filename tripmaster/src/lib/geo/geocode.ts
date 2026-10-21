// Place lookup for AI-extracted and AI-picked places. People walk to these pins,
// so a lookup either finds *the named place* or returns nothing:
//   • a stated street address must resolve to a numbered point on that street
//   • otherwise a POI must carry the place's own name — sharing the town's name
//     doesn't count. "Talleres Palermo, Gran Canaria" once resolved to Calle Gran
//     Canaria, 2 km away, and every room of the conference landed there with it.
// Street, district and town centroids are never returned.

export interface GeoHit {
  address: string;
  lat:     number;
  lng:     number;
}

export interface PlaceLookup {
  /** What the place is called. A POI result must carry this name. */
  name:     string;
  /** Free-text search hint, e.g. "Talleres Palermo, Las Palmas de Gran Canaria, Spain". */
  query?:   string;
  /** Street address as the source states it, if any. */
  address?: string;
}

export interface SearchArea {
  center:   { lat: number; lng: number };
  /** The trip destination as text ("Gran Canaria, Spain"). Its words never prove a match. */
  locality: string;
  maxKm?:   number;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dG = ((lng2 - lng1) * Math.PI) / 180;
  const a  = Math.sin(dL / 2) ** 2 +
             Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
             Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Name matching ────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'an', 'of', 'and', 'at', 'in', 'on', 'to', 'for', 'by',
  'de', 'del', 'della', 'dei', 'di', 'da', 'do', 'dos', 'das', 'du', 'des', 'la', 'le', 'les',
  'el', 'lo', 'los', 'las', 'et', 'und', 'der', 'die', 'den', 'dem', 'im', 'am', 'zum', 'zur',
  'van', 'von', 'het', 'en', 'og', 'au', 'aux',
  'calle', 'avenida', 'avda', 'av', 'avenue', 'ave', 'street', 'st', 'road', 'rd', 'rue',
  'strasse', 'str', 'carrer', 'via', 'ulica', 'ul', 'lane', 'ctra', 'carretera',
]);

// Words that say *what* a place is, not *which* one. "Conference Room 1" names no
// particular place, so it must never match whichever conference centre is nearby.
const GENERIC = new Set([
  'room', 'rooms', 'sala', 'salon', 'hall', 'halls', 'stage', 'escenario', 'auditorium', 'auditorio',
  'theatre', 'theater', 'teatro', 'conference', 'congress', 'centre', 'center', 'centro', 'venue',
  'stand', 'booth', 'library', 'film', 'cinema', 'cine', 'reception', 'space', 'area', 'lobby',
  'foyer', 'floor', 'level', 'building', 'main', 'hotel', 'hostel', 'apartment', 'apartments',
  'restaurant', 'restaurante', 'bar', 'cafe', 'coffee', 'pub', 'club', 'museum', 'museo',
  'gallery', 'church', 'iglesia', 'park', 'parque', 'beach', 'playa', 'station', 'airport',
  'terminal', 'parking', 'office', 'shop', 'store', 'market', 'mercado',
  'breakfast', 'brunch', 'lunch', 'dinner', 'drinks', 'networking', 'meeting', 'session',
  'workshop', 'panel', 'event', 'opening', 'closing', 'welcome', 'party', 'concert', 'showcase',
]);

function words(s: string): string[] {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/ß/g, 'ss').toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length > 1 && !/^\d+$/.test(w) && !STOPWORDS.has(w));
}

const NONE = new Set<string>();

function distinctive(name: string, locality: Set<string>, generic: Set<string>): string[] {
  return [...new Set(words(name).filter(w => !generic.has(w) && !locality.has(w)))];
}

export function localityWords(locality: string): Set<string> {
  return new Set(words(locality));
}

/**
 * True when `candidate` is the place called `name`: every distinctive word of the
 * name appears in it (or, for a longer name, the candidate is ≥2 of its words and
 * nothing else). Words of the destination itself are ignored on both sides.
 * Streets and districts pass `generic = NONE` — "Station Road" is a real name.
 */
export function sameName(name: string, candidate: string, locality: Set<string>, generic: Set<string> = GENERIC): boolean {
  const want = distinctive(name, locality, generic);
  if (!want.length) return false;
  const got    = new Set(distinctive(candidate, locality, generic));
  const shared = want.filter(w => got.has(w)).length;
  return shared === want.length || (shared >= 2 && shared === got.size);
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

function bbox({ center, maxKm = 40 }: SearchArea): string {
  const dLat = maxKm / 111;
  const dLng = maxKm / (111 * Math.cos((center.lat * Math.PI) / 180));
  return [center.lng - dLng, center.lat - dLat, center.lng + dLng, center.lat + dLat]
    .map(n => n.toFixed(4)).join(',');
}

function inArea(area: SearchArea, lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' &&
    haversineKm(area.center.lat, area.center.lng, lat, lng) <= (area.maxKm ?? 40);
}

// A stated address → the numbered point on that same street, never the street's centre.
async function byAddress(address: string, area: SearchArea, token: string): Promise<GeoHit | null> {
  const street = address.split(',').find(s => /\d/.test(s) && /\p{L}{3,}/u.test(s));
  if (!street) return null;
  const q   = address.includes(',') ? address : `${address}, ${area.locality}`;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
              `?types=address&limit=5&proximity=${area.center.lng},${area.center.lat}&bbox=${bbox(area)}&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  for (const f of data?.features ?? []) {
    const [lng, lat] = f.center ?? [];
    if (!f.address || !inArea(area, lat, lng)) continue;          // no house number = street centroid
    if (!sameName(f.text ?? '', street, NONE, NONE)) continue;     // a different street
    return { address: f.place_name, lat, lng };
  }
  return null;
}

// A named place → a POI carrying that name.
async function byName(p: PlaceLookup, area: SearchArea, token: string): Promise<GeoHit | null> {
  const locality = localityWords(area.locality);
  const fallback = `${p.name}, ${area.locality}`;
  for (const q of [...new Set([p.query?.trim() || fallback, fallback])]) {
    const url = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(q)}` +
                `&types=poi&limit=5&proximity=${area.center.lng},${area.center.lat}&bbox=${bbox(area)}&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = await res.json();
    const hits = (data?.features ?? []).filter((f: any) => {
      const [lng, lat] = f.geometry?.coordinates ?? [];
      return inArea(area, lat, lng) && sameName(p.name, f.properties?.name ?? '', locality);
    });
    // A venue's own car park is beside it but isn't it — only use it when nothing else matches.
    const isParking = (f: any) => (f.properties?.poi_category ?? []).includes('parking') && !words(p.name).includes('parking');
    const f = hits.find((h: any) => !isParking(h)) ?? hits[0];
    if (!f) continue;
    const name = f.properties.name as string;
    const rest = f.properties.full_address ?? f.properties.place_formatted ?? '';
    const [lng, lat] = f.geometry.coordinates;
    // Lead with the matched name so anyone can see what the pin is.
    return { address: rest.startsWith(name) ? rest : [name, rest].filter(Boolean).join(', '), lat, lng };
  }
  return null;
}

/**
 * Find the place the source means, within `area`. A stated street address wins;
 * otherwise a POI with the place's own name. Null when neither is certain —
 * better no pin than a wrong one.
 */
export async function locatePlace(p: PlaceLookup, area: SearchArea): Promise<GeoHit | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || !p.name?.trim()) return null;
  try {
    return (p.address?.trim() ? await byAddress(p.address.trim(), area, token) : null)
        ?? await byName(p, area, token);
  } catch {
    return null;
  }
}

/** A named neighbourhood or district — the area itself, not a street in it. */
export async function locateArea(name: string, query: string, area: SearchArea): Promise<GeoHit | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || !name.trim()) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query || `${name}, ${area.locality}`)}.json` +
                `?types=neighborhood,locality&limit=5&proximity=${area.center.lng},${area.center.lat}&bbox=${bbox(area)}&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    for (const f of data?.features ?? []) {
      const [lng, lat] = f.center ?? [];
      if (inArea(area, lat, lng) && sameName(name, f.text ?? '', NONE, NONE)) return { address: f.place_name, lat, lng };
    }
    return null;
  } catch {
    return null;
  }
}
