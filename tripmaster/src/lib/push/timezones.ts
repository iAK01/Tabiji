// Which timezone a trip's wall-clock times are in. Times are entered as they're
// printed on the booking ("departs 10:40"), i.e. local to wherever that thing
// happens — so a reminder has to read them in that place's zone, not UTC.

import { DateTime } from 'luxon';
import { airportByIata } from '@/lib/data/airports';
import { COUNTRY_LIST, COUNTRY_META } from '@/lib/data/countries';

// Countries airports.json names differently from COUNTRY_LIST, or that the shared
// country table doesn't carry yet.
const NAME_ALIASES: Record<string, string> = { usa: 'US', turkey: 'TR' };
const EXTRA_COUNTRY_TZ: Record<string, string> = { TR: 'Europe/Istanbul' };

const codeByName = new Map(COUNTRY_LIST.map(c => [c.name.toLowerCase(), c.code]));

type Place = { timezone?: string | null; countryCode?: string | null; iataCode?: string | null } | null | undefined;

function validZone(tz: string | null | undefined): string | null {
  return tz && DateTime.local().setZone(tz).isValid ? tz : null;
}

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
  return countryTz(airportCountryCode(iata));
}

/** "DUB — Dublin" (how the airport picker stores it) → "DUB". */
export function airportCodeIn(location: string | null | undefined): string | null {
  const match = location?.match(/^([A-Z]{3})\b/);
  return match ? match[1] : null;
}

export function placeTz(place: Place): string | null {
  return validZone(place?.timezone) ?? countryTz(place?.countryCode) ?? airportTz(place?.iataCode);
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

// Half a time zone of longitude: closer than this to the trip's own airport, the
// trip's (possibly city-precise) zone beats a country-level guess.
const SAME_ZONE_LNG = 7.5;

/**
 * Zone for a departure or arrival point, most specific first: a city the trip
 * stays in → that place's zone; the trip's starting point → home; an airport
 * elsewhere (home airport, a connection) → its country's zone, unless it sits
 * near the trip's own airport in the same country (one of several US zones);
 * an unrecognised place before the trip starts → home; otherwise the trip's zone
 * for that date.
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

  if (airport) {
    const country = airportCountryCode(airport.iata);
    const based   = new Set([trip.destination?.countryCode, ...(trip.additionalDestinations ?? []).map(d => d.countryCode)].filter(Boolean));
    if (country && based.has(country)) {
      const ref = airportByIata(trip.destination?.iataCode);
      if (!ref || Math.abs(ref.lng - airport.lng) < SAME_ZONE_LNG) return zoneFor(date);
    }
    return countryTz(country) ?? zoneFor(date);
  }

  if (homeZone && trip.startDate && ymd(date) < ymd(trip.startDate)) return homeZone;
  return zoneFor(date);
}
