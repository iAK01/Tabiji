// Mapbox forward geocoding with a proximity bias + a hard distance gate.
// Used when importing AI-extracted places so we never save "Sartory Hall" with
// coordinates that resolve to the middle of the country.

export interface GeoHit {
  address: string;
  lat:     number;
  lng:     number;
}

// Mapbox place_types that represent an actual point you can navigate to.
// Anything else (place = city, region, district, country, postcode) is a
// zoomed-out fallback and must be rejected — "Cologne, Germany" is not an address.
const NAVIGABLE_TYPES = new Set(['poi', 'address', 'neighborhood']);

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dG = ((lng2 - lng1) * Math.PI) / 180;
  const a  = Math.sin(dL / 2) ** 2 +
             Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
             Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Forward-geocode `query`, biased toward `proximity`. Returns the first result
 * within `maxKm` of the proximity point, or null if nothing lands close enough
 * (better no address than a wrong one).
 */
export async function geocodeNear(
  query:     string,
  proximity: { lat: number; lng: number },
  maxKm     = 40,
): Promise<GeoHit | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || !query.trim()) return null;

  try {
    const prox = `${proximity.lng},${proximity.lat}`;
    const url  = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=3&proximity=${prox}&access_token=${token}`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    for (const f of (data?.features ?? [])) {
      const [lng, lat] = f.center ?? [];
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const types: string[] = f.place_type ?? [];
      if (!types.some(t => NAVIGABLE_TYPES.has(t))) continue;       // reject city/region fallbacks
      if (haversineKm(proximity.lat, proximity.lng, lat, lng) <= maxKm) {
        return { address: f.place_name, lat, lng };
      }
    }
    return null;
  } catch {
    return null;
  }
}
