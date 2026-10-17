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

function airportCountryCode(iata: string | null | undefined): string | null {
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

type ZonedTrip = {
  destination?: Place;
  additionalDestinations?: Array<NonNullable<Place> & { arrivalDate?: string | Date | null; departureDate?: string | Date | null }>;
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

/**
 * Zone for a departure. Leaving from an airport in a country the trip isn't
 * based in (the flight out from home, a connection) → that country's zone.
 * Otherwise the trip's own zone for the date, which can be more precise than a
 * country-level guess.
 */
export function departureZone(
  trip: ZonedTrip,
  zoneFor: (date?: string | Date | null) => string,
  location: string | null | undefined,
  date: string | Date,
): string {
  const country = airportCountryCode(airportCodeIn(location));
  const based = new Set(
    [trip.destination?.countryCode, ...(trip.additionalDestinations ?? []).map(d => d.countryCode)].filter(Boolean),
  );
  if (country && !based.has(country)) return countryTz(country) ?? zoneFor(date);
  return zoneFor(date);
}
