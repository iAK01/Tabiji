// The map pin for an address someone typed or pasted. Google's geocoder — the same
// data as Google Maps, where people copy addresses from. The typed text stays the
// address of record; this only adds the point, and only when Google places the
// address itself:
//   • a building, a numbered point on the street, or a named place — never the
//     centre of a street, district or town
//   • the house number typed, when one was
//   • in the town the text names; text naming no town must land in the trip's area
// Spellings differ ("39 Rue Youssef Ibn Tachfine, Rabat 10020" is "39 Av. Youssef
// Ben Tachfine, Rabat 10010" to Google), so Google's partial-match flag decides nothing.
// Server only: GOOGLE_ROUTES_API_KEY is the Maps Platform key (Routes + Geocoding).

import { words } from './geocode';
import { AREA_KM, inTripArea, namesPlace, type TripArea } from './tripAreas';

export interface Pin {
  lat:   number;
  lng:   number;
  /** Google's own wording of where the pin is */
  label: string;
}

const PRECISE = new Set(['ROOFTOP', 'RANGE_INTERPOLATED']);
const A_PLACE = new Set(['premise', 'subpremise', 'establishment', 'point_of_interest', 'street_address']);
const PLUS_CODE = /(^|[\s,])[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}([\s,]|$)/i;
const TOWN    = new Set(['locality', 'postal_town', 'sublocality', 'neighborhood', 'administrative_area_level_2', 'administrative_area_level_3']);

// Every number in the text — a house number, or a postcode that can't match one
function numbersIn(text: string): Set<string> {
  return new Set(text.split(/[^\p{L}\p{N}]+/u).map(t => t.match(/^\d+/)?.[0]).filter((n): n is string => !!n));
}

function bounds({ lat, lng }: TripArea): string {
  const dLat = AREA_KM / 111;
  const dLng = AREA_KM / (111 * Math.cos((lat * Math.PI) / 180));
  return `${(lat - dLat).toFixed(4)},${(lng - dLng).toFixed(4)}|${(lat + dLat).toFixed(4)},${(lng + dLng).toFixed(4)}`;
}

/** Null when Google has no exact match; throws when it couldn't be asked. */
export async function pinAddress(address: string, areas: TripArea[]): Promise<Pin | null> {
  const text = address.trim();
  if (text.length < 3) return null;
  const key = process.env.GOOGLE_ROUTES_API_KEY;
  if (!key) throw new Error('GOOGLE_ROUTES_API_KEY not set');

  const near = areas[0] ? `&bounds=${encodeURIComponent(bounds(areas[0]))}` : '';   // a preference, not a limit
  const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(text)}&language=en${near}&key=${key}`);
  if (!res.ok) throw new Error(`Google geocoding HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === 'ZERO_RESULTS') return null;
  if (data.status !== 'OK') throw new Error(`Google geocoding ${data.status}`);

  const typed     = new Set(words(text));
  const numbers   = numbersIn(text);
  const namesCity = areas.some(a => a.city && namesPlace(typed, a.city));
  const hasCity   = areas.some(a => a.city);

  for (const r of data.results ?? []) {
    const { lat, lng } = r.geometry?.location ?? {};
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;

    const precision = r.geometry.location_type;
    const types: string[] = r.types ?? [];
    // A plus code ("25C9+65F, Rabat") is an exact spot of a few metres
    if (types.includes('plus_code')) {
      if (PLUS_CODE.test(text) && inTripArea(areas, lat, lng)) return { lat, lng, label: r.formatted_address };
      continue;
    }
    if (!PRECISE.has(precision) && !(precision === 'GEOMETRIC_CENTER' && types.some(t => A_PLACE.has(t)))) continue;

    const parts: { long_name: string; short_name: string; types: string[] }[] = r.address_components ?? [];
    const number = parts.find(p => p.types.includes('street_number'))?.short_name.match(/^\d+/)?.[0];
    if (number && numbers.size && !numbers.has(number)) continue;   // another building on the street

    const towns  = parts.filter(p => p.types.some(t => TOWN.has(t))).flatMap(p => [p.long_name, p.short_name]);
    const inTown = towns.some(t => namesPlace(typed, t));
    // Naming one of the trip's towns but landing in another is a wrong match, however near.
    // Naming no town, it must land in one of the trip's towns: every town has its
    // Avenue Mohammed V, and the next town's is still inside the trip's area.
    const inTripTown = hasCity
      ? areas.some(a => !!a.city && towns.some(t => namesPlace(new Set(words(a.city ?? '')), t)))
      : inTripArea(areas, lat, lng);
    if (!inTown && (namesCity || !inTripTown)) continue;

    return { lat, lng, label: r.formatted_address };
  }
  return null;
}

/** For saves: a failed lookup leaves the stop unpinned rather than failing the save. */
export async function pinIfFound(address: string, areas: TripArea[]): Promise<{ lat: number; lng: number } | null> {
  try {
    const pin = await pinAddress(address, areas);
    return pin && { lat: pin.lat, lng: pin.lng };
  } catch (err) {
    console.error('[pinAddress]', err);
    return null;
  }
}
