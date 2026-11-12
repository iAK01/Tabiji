import { locatePlace, localityWords, sameName } from '@/lib/geo/geocode';

export interface Locatable {
  name?:              string;
  address?:           string;
  building?:          string;
  searchQuery?:       string;
  coordinates?:       { lat: number; lng: number };
  addressUnverified?: boolean;
}

/**
 * Resolves real addresses + coordinates for extracted places, in place.
 *
 * People walk to these pins. A place gets coordinates only when the lookup
 * finds that exact place (see locatePlace); otherwise it's flagged, never guessed.
 * A room/stage/stand is located by its building, and reuses a pin the trip
 * already has for that building rather than looking it up again.
 * `searchQuery` and `building` are consumed and removed.
 */
export async function locateExtracted(items: Locatable[], trip: any, logistics: any): Promise<void> {
  const dest = trip.destination?.coordinates;
  if (!dest?.lat || !dest?.lng) return;

  const locality = [trip.destination?.city, trip.destination?.country].filter(Boolean).join(', ');
  const area     = { center: { lat: dest.lat, lng: dest.lng }, locality, maxKm: 40 };
  const words    = localityWords(locality);
  const norm     = (s: string) => s.trim().toLowerCase();
  const pinned   = [...(logistics?.venues ?? []), ...(logistics?.accommodation ?? [])]
    .filter((k: any) => k?.name && k.coordinates?.lat);
  // Dozens of sessions share a handful of rooms — one lookup per distinct place.
  const lookups = new Map<string, ReturnType<typeof locatePlace>>();

  const locate = async (item: Locatable) => {
    const building = String(item.building ?? '').trim();
    const name     = building || String(item.name ?? '').trim();
    const known    = pinned.find((k: any) => norm(k.name) === norm(name) || sameName(name, k.name, words));
    const hit      = known
      ? { address: known.address || item.address, lat: known.coordinates.lat, lng: known.coordinates.lng }
      : await (() => {
          const key = [name, item.searchQuery, item.address].map(v => norm(String(v ?? ''))).join('|');
          if (!lookups.has(key)) lookups.set(key, locatePlace({ name, query: item.searchQuery, address: item.address }, area));
          return lookups.get(key)!;
        })();
    if (hit) {
      item.address     = hit.address;
      item.coordinates = { lat: hit.lat, lng: hit.lng };
    } else if (!item.address?.trim()) {
      item.addressUnverified = true;
    }
    delete item.searchQuery;
    delete item.building;
  };

  await Promise.all(items.map(locate));
}
