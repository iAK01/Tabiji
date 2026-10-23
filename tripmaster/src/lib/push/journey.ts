// The trip's transport read as a journey: which departures start one (vs a
// connection you're already airside for), which arrivals land somewhere new,
// where you'll be sleeping, and which zone you're in at any moment. Shared by
// the notification planner and the arrival sheet, so both agree.

import { DateTime } from 'luxon';
import { airportByIata } from '@/lib/data/airports';
import {
  airportCodeIn, airportCountryCode, atTime, placeCity, placeZone, tripZones, wallClock, ymd,
} from '@/lib/push/timezones';

export const JOURNEY_TYPES = new Set(['flight', 'train', 'bus', 'ferry']);

// Same rule as syncLogistics: the next flight leaves from the airport this one
// lands at, within 8 hours.
const CONNECTION_MAX_MS = 8 * 60 * 60 * 1000;

export type LatLng = { lat: number; lng: number };

export interface Leg {
  index:          number;          // position in logistics.transportation
  t:              any;
  type:           string;
  dep:            DateTime;        // in the departure point's zone
  arr:            DateTime | null; // in the arrival point's zone
  depCode:        string | null;   // IATA, flights only
  arrCode:        string | null;
  arrCity:        string;
  arrCountry:     string | null;   // ISO code, when it can be told
  isConnection:   boolean;         // departs on a connection
  landsInTransit: boolean;         // arrives at a connection airport
  arrivesHome:    boolean;
}

type PlaceLike = { city?: string | null; countryCode?: string | null; timezone?: string | null; iataCode?: string | null };

type TripLike = {
  startDate?: string | Date | null;
  endDate?:   string | Date | null;
  origin?:      PlaceLike | null;
  destination?: PlaceLike | null;
  additionalDestinations?: Array<PlaceLike & { arrivalDate?: string | Date | null; departureDate?: string | Date | null }>;
};

export interface Home { countryCode: string | null; zone?: string }

export const placeName = placeCity;

function tripCities(trip: TripLike) {
  return [trip.destination, ...(trip.additionalDestinations ?? [])]
    .filter((d): d is NonNullable<typeof d> => !!d?.city)
    .map(d => ({ city: d.city!.toLowerCase(), countryCode: d.countryCode ?? null }));
}

export function buildLegs(trip: TripLike, transportation: any[], home: Home): Leg[] {
  const homeCountry = home.countryCode;
  const zoneFor = tripZones(trip as any);
  const cities  = tripCities(trip);
  const based   = new Set(cities.map(c => c.countryCode).filter(Boolean));

  const legs: Leg[] = [];
  transportation.forEach((t, index) => {
    const type = t?.type || 'flight';
    if (!JOURNEY_TYPES.has(type) || !t.departureTime) return;
    const depLoc = t.departureLocation ?? t.departureAirport;
    const arrLoc = t.arrivalLocation ?? t.arrivalAirport;
    const dep = wallClock(t.departureTime, placeZone(trip as any, zoneFor, depLoc, ymd(t.departureTime), home.zone));
    if (!dep) return;
    const arr = t.arrivalTime
      ? wallClock(t.arrivalTime, placeZone(trip as any, zoneFor, arrLoc, ymd(t.arrivalTime), home.zone))
      : null;

    const depCode = type === 'flight' ? airportCodeIn(depLoc) : null;
    const arrCode = type === 'flight' ? airportCodeIn(arrLoc) : null;
    const name    = placeName(arrLoc);
    const match   = cities.find(c => name && (c.city.includes(name.toLowerCase()) || name.toLowerCase().includes(c.city)));

    legs.push({
      index, t, type, dep, arr, depCode, arrCode,
      arrCity:        airportByIata(arrCode)?.city ?? name,
      arrCountry:     airportCountryCode(arrCode) ?? match?.countryCode ?? null,
      isConnection:   false,
      landsInTransit: false,
      arrivesHome:    false,
    });
  });

  legs.sort((a, b) => a.dep.toMillis() - b.dep.toMillis());

  const flights = legs.filter(l => l.type === 'flight');
  for (let i = 0; i < flights.length - 1; i++) {
    const prev = flights[i];
    const next = flights[i + 1];
    if (!prev.arrCode || prev.arrCode !== next.depCode || !prev.arr) continue;
    const layover = next.dep.toMillis() - prev.arr.toMillis();
    if (layover <= 0 || layover > CONNECTION_MAX_MS) continue;
    next.isConnection   = true;
    prev.landsInTransit = true;
  }

  const last    = legs[legs.length - 1];
  const endDate = trip.endDate ? ymd(trip.endDate) : null;
  for (const leg of legs) {
    // Landing back in the home country from abroad, or the final leg of the
    // trip leaving on (or after) its last day.
    const backFromAbroad = !!homeCountry && leg.arrCountry === homeCountry && !based.has(homeCountry);
    const finalLeg       = leg === last && !!endDate && leg.dep.toISODate()! >= endDate;
    leg.arrivesHome = backFromAbroad || finalLeg;
  }

  return legs;
}

/** The leg that continues a journey from where `leg` lands, if it's a connection. */
export function connectingLeg(legs: Leg[], leg: Leg): Leg | null {
  if (!leg.landsInTransit) return null;
  const i = legs.indexOf(leg);
  return legs.slice(i + 1).find(l => l.type === 'flight') ?? null;
}

// Before the first leg we know about: at home if it's the trip out (it leaves on
// or before the start date), otherwise already there — the outbound flight just
// isn't entered and the first leg is a mid-trip train.
function startsFromHome(trip: TripLike, legs: Leg[]): boolean {
  const start = trip.startDate ? ymd(trip.startDate) : null;
  return !!legs[0] && (!start || legs[0].dep.toISODate()! <= start);
}

function withinTrip(trip: TripLike, ms: number): string | null {
  const zoneFor = tripZones(trip as any);
  const start   = trip.startDate ? ymd(trip.startDate) : null;
  const end     = trip.endDate ? ymd(trip.endDate) : null;
  const day     = DateTime.fromMillis(ms, { zone: zoneFor() }).toISODate()!;
  return start && end && day >= start && day <= end ? zoneFor(day) : null;
}

/** Whether the traveller is at home at a moment (not yet left, or back). */
export function homeAt(trip: TripLike, legs: Leg[]): (ms: number) => boolean {
  const fromHome = startsFromHome(trip, legs);
  return (ms: number) => {
    let last: Leg | null = null;
    for (const leg of legs) if (leg.dep.toMillis() <= ms) last = leg;
    if (!last) return legs.length ? fromHome || !withinTrip(trip, ms) : !withinTrip(trip, ms);
    return last.arrivesHome && (!last.arr || last.arr.toMillis() <= ms);
  };
}

/**
 * Which zone the traveller is in at a moment: home before setting off, in
 * transit the departure zone, after landing the arrival zone. Without transport
 * to go on, the trip's own zone between its dates.
 */
export function whereAt(trip: TripLike, legs: Leg[], homeZone: string): (ms: number) => string {
  const zoneFor  = tripZones(trip as any);
  const fromHome = startsFromHome(trip, legs);
  return (ms: number) => {
    let last: Leg | null = null;
    for (const leg of legs) if (leg.dep.toMillis() <= ms) last = leg;
    if (!last) {
      if (legs.length && fromHome) return homeZone;
      return withinTrip(trip, ms) ?? homeZone;
    }
    if (last.arr && ms < last.arr.toMillis()) return last.dep.zoneName ?? homeZone;
    if (last.arrivesHome) return homeZone;
    return last.arr?.zoneName ?? zoneFor(DateTime.fromMillis(ms).toISODate());
  };
}

/** A stop's stored wall-clock time, read in `zone`. */
export function stopTime(dayDate: string, stop: any, zone: string): DateTime | null {
  if (stop.scheduledStart) {
    return wallClock(String(stop.scheduledStart).includes('T') ? stop.scheduledStart : `${ymd(dayDate)}T${stop.scheduledStart}`, zone);
  }
  return stop.time ? atTime(dayDate, stop.time, zone) : null;
}

/**
 * When an itinerary stop happens. Its time is local to wherever you are then — on
 * a travel day that can be home rather than the trip's zone. Read it in the trip's
 * zone, see where you'd be at that moment, and re-read it there if that's
 * somewhere else. Shared by the planner and the itinerary, so both agree.
 */
export function stopClock(trip: TripLike, legs: Leg[], homeZone: string): (dayDate: string, stop: any) => DateTime | null {
  const zoneFor = tripZones(trip as any);
  const zoneAt  = whereAt(trip, legs, homeZone);
  return (dayDate, stop) => {
    const guess = stopTime(dayDate, stop, zoneFor(ymd(dayDate)));
    if (!guess) return null;
    const zone = zoneAt(guess.toMillis());
    return zone === guess.zoneName ? guess : stopTime(dayDate, stop, zone);
  };
}

/**
 * The place the traveller is in at a moment, for help getting around it: where
 * they last landed (connections aside). Before anything lands, the main
 * destination, unless the journey starts from home (a flight out of the home
 * country, or a first leg leaving by the start date). Null at home, on the way
 * out, and once back.
 */
export function placeAt(trip: TripLike, legs: Leg[], home: Home, ms: number): { city: string; countryCode: string | null } | null {
  const landed = legs.filter(l => !l.landsInTransit && (l.arr ?? l.dep).toMillis() <= ms);
  const last   = landed[landed.length - 1];
  if (last) {
    if (last.arrivesHome) return null;
    return { city: last.arrCity || trip.destination?.city || '', countryCode: last.arrCountry ?? trip.destination?.countryCode ?? null };
  }
  const leavesHome = startsFromHome(trip, legs)
    || (!!home.countryCode && legs.some(l => airportCountryCode(l.depCode) === home.countryCode));
  if (leavesHome || !trip.destination?.city) return null;
  return { city: trip.destination.city, countryCode: trip.destination.countryCode ?? null };
}

export interface Stay { a: any; index: number }

/** Where you're sleeping the night of `date` (YYYY-MM-DD). */
export function stayOn(accommodation: any[], date: string): Stay | null {
  let found: Stay | null = null;
  accommodation.forEach((a, index) => {
    if (!a?.checkIn) return;
    const inD  = ymd(a.checkIn);
    const outD = a.checkOut ? ymd(a.checkOut) : inD;
    if (inD === date) found = { a, index };
    else if (!found && inD < date && date < outD) found = { a, index };
  });
  return found;
}

/** Where you're leaving from on `date` — the stay checking out that day, else the one you're in. */
export function stayLeaving(accommodation: any[], date: string): Stay | null {
  let found: Stay | null = null;
  accommodation.forEach((a, index) => {
    if (!a?.checkIn || !a.checkOut) return;
    const inD  = ymd(a.checkIn);
    const outD = ymd(a.checkOut);
    if (outD === date) found = { a, index };
    else if (!found && inD < date && date < outD) found = { a, index };
  });
  return found;
}

export function coords(c: any): LatLng | null {
  return c && typeof c.lat === 'number' && typeof c.lng === 'number' ? { lat: c.lat, lng: c.lng } : null;
}

export interface Point { name: string; coords: LatLng | null; address?: string }

/** Where a departure leaves from (the airport or station). */
export function departurePoint(leg: Leg): Point {
  const airport = airportByIata(leg.depCode);
  if (airport) return { name: airport.name, coords: { lat: airport.lat, lng: airport.lng } };
  const loc = leg.t.departureLocation ?? '';
  return { name: placeName(loc) || loc, coords: coords(leg.t.departureCoordinates), address: leg.t.departureAddress ?? loc };
}

/**
 * Where you'd set off for a journey-start departure: the stay you're leaving
 * that day, or home when it leaves from your home country.
 */
export function setOffPoint(
  leg: Leg,
  accommodation: any[],
  home: { coords: LatLng | null; countryCode: string | null },
): Point | null {
  const stay = stayLeaving(accommodation, leg.dep.toISODate()!);
  if (stay && coords(stay.a.coordinates)) return { name: stay.a.name || 'your accommodation', coords: coords(stay.a.coordinates) };
  const depCountry = airportCountryCode(leg.depCode);
  if (home.coords && (!depCountry || depCountry === home.countryCode) && !stay) return { name: 'home', coords: home.coords };
  return null;
}
