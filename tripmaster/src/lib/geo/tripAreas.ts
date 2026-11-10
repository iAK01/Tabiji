// Where a trip happens: its destination first, then any further stops, then home
// (stations and airports on the way out). Address suggestions and pins are kept to
// within AREA_KM of one of these. Client-safe.

import { haversineKm, words } from './geocode';

export interface TripArea {
  lat:   number;
  lng:   number;
  city?: string;
}

interface Place {
  city?:        string | null;
  coordinates?: { lat?: number | null; lng?: number | null } | null;
}

export const AREA_KM = 40;

export function tripAreas(trip?: {
  destination?:            Place | null;
  additionalDestinations?: Place[] | null;
  origin?:                 Place | null;
} | null): TripArea[] {
  const places = [trip?.destination, ...(trip?.additionalDestinations ?? []), trip?.origin];
  return places.flatMap(p => {
    const lat = p?.coordinates?.lat, lng = p?.coordinates?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ lat, lng, ...(p?.city ? { city: p.city } : {}) }];
  });
}

export function inTripArea(areas: TripArea[], lat: number, lng: number): boolean {
  return areas.some(a => haversineKm(a.lat, a.lng, lat, lng) <= AREA_KM);
}

/** True when the text (as a set of its words) names the place — every word of it. */
export function namesPlace(text: Set<string>, place: string): boolean {
  const w = words(place);
  return w.length > 0 && w.every(x => text.has(x));
}
