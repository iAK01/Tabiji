// Which timezone a trip's wall-clock times are in. Times are entered as they're
// printed on the booking ("departs 10:40"), i.e. local to wherever that thing
// happens — so a reminder has to read them in that place's zone, not UTC.
//
// Zones come from the place's position on the map wherever there is one. A
// country doesn't decide it: Spain is Madrid time except the Canaries, which
// are Dublin/London time. Reading Gran Canaria as Madrid sent every WOMEX 2026
// reminder an hour early. The per-country zone is only a last resort, for a
// place with no coordinates and no airport.

import { DateTime } from 'luxon';
import tzLookup from '@photostructure/tz-lookup';
import { airportByIata } from '@/lib/data/airports';
import { COUNTRY_LIST, COUNTRY_META } from '@/lib/data/countries';

// Countries airports.json names differently from COUNTRY_LIST, or that the shared
// country table doesn't carry yet.
const NAME_ALIASES: Record<string, string> = { usa: 'US', turkey: 'TR' };
const EXTRA_COUNTRY_TZ: Record<string, string> = { TR: 'Europe/Istanbul' };

const codeByName = new Map(COUNTRY_LIST.map(c => [c.name.toLowerCase(), c.code]));

type LatLng = { lat: number; lng: number };
type Place = {
  timezone?:    string | null;
  countryCode?: string | null;
  iataCode?:    string | null;
  coordinates?: LatLng | null;
} | null | undefined;

function validZone(tz: string | null | undefined): string | null {
  return tz && DateTime.local().setZone(tz).isValid ? tz : null;
}

/** The zone at a point on the map — exact, offline (boundaries ship with the library). */
export function pointTz(c: LatLng | null | undefined): string | null {
  if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return null;
  try { return validZone(tzLookup(c.lat, c.lng)); } catch { return null; }
}

/** One zone per country — wrong for any country with more than one. Last resort only. */
export function countryTz(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_META[code]?.timezone ?? EXTRA_COUNTRY_TZ[code] ?? null;
}

export function airportCountryCode(iata: string | null | undefined): string | null {
  const country = airportByIata(iata)?.country.toLowerCase();
  if (!country) return null;
  return codeByName.get(country) ?? NAME_ALIASES[country] ?? null;
}

export function airportTz(iata: string | null | undefined): string | null {
  const airport = airportByIata(iata);
  return pointTz(airport) ?? countryTz(airportCountryCode(iata));
}

/** "DUB — Dublin" (how the airport picker stores it) → "DUB". */
export function airportCodeIn(location: string | null | undefined): string | null {
  const match = location?.match(/^([A-Z]{3})\b/);
  return match ? match[1] : null;
}

// Map position first; a stored `timezone` came from the country table (profile
// home), so it ranks below the place's own airport.
export function placeTz(place: Place): string | null {
  return pointTz(place?.coordinates)
    ?? airportTz(place?.iataCode)
    ?? validZone(place?.timezone)
    ?? countryTz(place?.countryCode);
}

export function ymd(d: string | Date): string {
  return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

/**
 * A stored time ("2026-07-22T18:00", or with the Z/offset JSON adds) read as
 * wall-clock time in `zone` — the suffix is serialisation, not intent.
 */
export function wallClock(value: string | Date | null | undefined, zone: string): DateTime | null {
  if (!value) return null;
  const str   = typeof value === 'string' ? value : value.toISOString();
  const naive = str.replace(/Z$/, '').replace(/[+-]\d{2}:?\d{2}$/, '');
  const dt    = DateTime.fromISO(naive, { zone });
  return dt.isValid ? dt : null;
}

/** A date (YYYY-MM-DD…) plus an "HH:MM" time, in `zone`. */
export function atTime(date: string | Date | null | undefined, time: string | null | undefined, zone: string): DateTime | null {
  if (!date || !time) return null;
  const dt = DateTime.fromISO(`${ymd(date)}T${time.slice(0, 5)}:00`, { zone });
  return dt.isValid ? dt : null;
}

type CityPlace = NonNullable<Place> & { city?: string | null };

type ZonedTrip = {
  startDate?:   string | Date | null;
  origin?:      CityPlace | null;
  destination?: CityPlace | null;
  additionalDestinations?: Array<CityPlace & { arrivalDate?: string | Date | null; departureDate?: string | Date | null }>;
};

/**
 * The zone for a given date on the trip: the leg of a multi-city trip that covers
 * it, otherwise the main destination.
 */
export function tripZones(trip: ZonedTrip): (date?: string | Date | null) => string {
  const main = placeTz(trip.destination) ?? 'UTC';
  const legs = (trip.additionalDestinations ?? [])
    .map(d => ({
      from: d.arrivalDate ? ymd(d.arrivalDate) : null,
      to:   d.departureDate ? ymd(d.departureDate) : null,
      tz:   placeTz(d),
    }))
    .filter((l): l is { from: string; to: string | null; tz: string } => !!l.from && !!l.tz);

  return (date) => {
    const day = date ? ymd(date) : null;
    if (day) {
      for (const leg of legs) {
        if (day >= leg.from && (!leg.to || day < leg.to)) return leg.tz;
      }
    }
    return main;
  };
}

/** "DUB — Dublin" → "Dublin"; "Berlin Hbf, Berlin" → "Berlin Hbf". */
export function placeCity(location: string | null | undefined): string {
  if (!location) return '';
  const afterCode = location.split(/\s+[—-]\s+/).pop() ?? location;
  return afterCode.split(',')[0].trim();
}

/**
 * Zone for a departure or arrival point, most specific first: a city the trip
 * stays in → that place's zone; the trip's starting point → home; an airport →
 * the zone at the airport; an unrecognised place before the trip starts → home;
 * otherwise the trip's zone for that date.
 */
export function placeZone(
  trip: ZonedTrip,
  zoneFor: (date?: string | Date | null) => string,
  location: string | null | undefined,
  date: string | Date,
  homeZone?: string,
): string {
  const airport = airportByIata(airportCodeIn(location));
  const city    = (airport?.city ?? placeCity(location)).toLowerCase();
  const sameCity = (c?: string | null) => {
    const other = c?.toLowerCase().trim();
    return !!other && city.length >= 3 && (other.includes(city) || city.includes(other));
  };

  for (const d of [trip.destination, ...(trip.additionalDestinations ?? [])]) {
    if (d && sameCity(d.city)) return placeTz(d) ?? zoneFor(date);
  }
  if (trip.origin && sameCity(trip.origin.city)) return placeTz(trip.origin) ?? homeZone ?? zoneFor(date);

  if (airport) return airportTz(airport.iata) ?? zoneFor(date);

  if (homeZone && trip.startDate && ymd(date) < ymd(trip.startDate)) return homeZone;
  return zoneFor(date);
}
