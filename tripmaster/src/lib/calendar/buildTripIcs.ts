import ical, { ICalCalendarMethod, type ICalEventData } from 'ical-generator';
import { DateTime } from 'luxon';

// ─── Types (all stored loosely as Mixed in Mongo) ─────────────────────────────

export type CalendarCategory = 'itinerary' | 'transport' | 'accommodation' | 'venues';

export interface BuildIcsOptions {
  include: CalendarCategory[];
  alarms:  boolean;
}

interface TripLike {
  _id:        any;
  name:       string;
  startDate?: Date | string | null;
  endDate?:   Date | string | null;
  destination?: { city?: string; country?: string; timezone?: string } | null;
}

interface ItineraryLike { days?: any[] | null }
interface LogisticsLike {
  transportation?: any[] | null;
  accommodation?:  any[] | null;
  venues?:         any[] | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TRANSPORT_EMOJI: Record<string, string> = {
  flight: '✈️', train: '🚆', bus: '🚌', ferry: '⛴️', car: '🚗',
  car_hire: '🚗', taxi: '🚕', private_transfer: '🚐', parking: '🅿️',
};

const VENUE_EMOJI: Record<string, string> = {
  concert: '🎵', conference: '🎤', restaurant: '🍽️', sports: '🏟️',
  attraction: '📸', business: '💼', other: '📍',
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s);

function joinLines(...parts: (string | null | undefined | false)[]): string | undefined {
  const out = parts.filter(Boolean).join('\n').trim();
  return out || undefined;
}

/** A local wall-clock string ("2026-09-25T20:00:00") interpreted in the trip's timezone → UTC JS Date. */
function localToUtc(raw: string, tz: string): Date | null {
  if (!raw) return null;
  const dt = DateTime.fromISO(raw, { zone: tz });
  return dt.isValid ? dt.toUTC().toJSDate() : null;
}

/** Best-effort navigable location string. Falls back to "<name>, <city>, <country>" —
 *  a named-place search still resolves in Maps, unlike a bare "City, Country". */
function locationText(address: string | undefined, name: string, city?: string, country?: string): string | undefined {
  if (address && address.trim()) return address.trim();
  const fallback = [name, city, country].filter(Boolean).join(', ');
  return fallback || undefined;
}

function locationField(
  address: string | undefined,
  coords: { lat?: number; lng?: number } | null | undefined,
  name: string, city?: string, country?: string,
): ICalEventData['location'] {
  const title = locationText(address, name, city, country);
  if (!title) return null;
  if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    return { title, geo: { lat: coords.lat, lon: coords.lng } };
  }
  return title;
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export function buildTripIcs(
  trip: TripLike,
  itinerary: ItineraryLike | null,
  logistics: LogisticsLike | null,
  opts: BuildIcsOptions,
): string {
  const tz      = trip.destination?.timezone || 'UTC';
  const city    = trip.destination?.city;
  const country = trip.destination?.country;
  const tripId  = String(trip._id);
  const uid     = (s: string) => `${s}@tripmaster.app`;

  // No calendar-level timezone: timed events are emitted in UTC (unambiguous in
  // every client), transport stays floating (airport-local, as flight times are
  // quoted), all-day events are date-only.
  const cal = ical({
    name:   trip.name,
    prodId: { company: 'TripMaster', product: 'trip-calendar', language: 'EN' },
    method: ICalCalendarMethod.PUBLISH,
  });

  const want = new Set(opts.include);

  // ── Trip container (all-day span) ──────────────────────────────────────────
  if (trip.startDate && trip.endDate && want.size) {
    const start = DateTime.fromJSDate(new Date(trip.startDate)).toFormat('yyyy-MM-dd');
    const end   = DateTime.fromJSDate(new Date(trip.endDate)).plus({ days: 1 }).toFormat('yyyy-MM-dd');
    cal.createEvent({
      id: uid(`trip-${tripId}`),
      start, end, allDay: true,
      summary: `📍 ${[city, country].filter(Boolean).join(', ') || trip.name}`,
      description: joinLines(`${trip.name}`, city && country ? `${city}, ${country}` : undefined),
      categories: [{ name: 'Trip' }],
      busystatus: 'FREE' as any,
    });
  }

  // ── Itinerary stops ───────────────────────────────────────────────────────
  if (want.has('itinerary')) {
    for (const day of itinerary?.days ?? []) {
      for (const stop of day?.stops ?? []) {
        const raw = stop?.scheduledStart;
        if (!raw) continue;
        const start = localToUtc(raw, tz);
        if (!start) continue;

        const end =
          (stop.scheduledEnd && localToUtc(stop.scheduledEnd, tz)) ||
          new Date(start.getTime() + (Number(stop.duration) || 60) * 60_000);

        cal.createEvent({
          id: uid(`stop-${stop._id ?? `${tripId}-${raw}-${stop.name}`}`),
          start, end,
          summary:     stop.name || 'Itinerary stop',
          location:    locationField(stop.address, stop.coordinates, stop.name || 'stop', city, country),
          description: joinLines(stop.notes, stop.type && `Type: ${cap(stop.type)}`),
          categories:  [{ name: cap(stop.type || 'Activity') }],
          alarms:      opts.alarms ? [{ type: 'display' as any, trigger: 30 * 60 }] : [],
        });
      }
    }
  }

  // ── Transport (floating local time — flight times are quoted airport-local) ─
  if (want.has('transport')) {
    (logistics?.transportation ?? []).forEach((t: any, i: number) => {
      if (!t?.departureTime) return;
      const emoji = TRANSPORT_EMOJI[t.type] ?? '🚌';
      const from  = t.departureLocation || 'Departure';
      const to    = t.arrivalLocation   || '';
      const flightNo = t.details?.flightNumber || t.flightNumber || '';

      const depFloat = DateTime.fromISO(String(t.departureTime), { zone: 'utc' });
      if (!depFloat.isValid) return;
      const arrFloat = t.arrivalTime ? DateTime.fromISO(String(t.arrivalTime), { zone: 'utc' }) : null;

      cal.createEvent({
        id: uid(`txn-${tripId}-${i}`),
        start:    depFloat,
        end:      arrFloat && arrFloat.isValid ? arrFloat : undefined,
        floating: true,
        summary:  `${emoji} ${[from, to].filter(Boolean).join(' → ')}${flightNo ? ` · ${flightNo}` : ''}`,
        location: t.departureLocation || undefined,
        description: joinLines(
          t.details?.airline && `Airline: ${t.details.airline}`,
          flightNo && `Flight: ${flightNo}`,
          t.details?.operator && `Operator: ${t.details.operator}`,
          t.details?.seat && `Seat: ${t.details.seat}`,
          t.details?.cabin && `Cabin: ${t.details.cabin}`,
          t.confirmationNumber && `Confirmation: ${t.confirmationNumber}`,
          t.notes,
        ),
        categories: [{ name: cap(t.type || 'Transport') }],
        alarms: opts.alarms ? [{ type: 'display' as any, trigger: (t.type === 'flight' ? 180 : 60) * 60 }] : [],
      });
    });
  }

  // ── Accommodation (all-day, spanning check-in → check-out) ─────────────────
  if (want.has('accommodation')) {
    (logistics?.accommodation ?? []).forEach((a: any, i: number) => {
      if (!a?.checkIn) return;
      const startDate = DateTime.fromISO(a.checkIn);
      if (!startDate.isValid) return;
      const endBase = a.checkOut && DateTime.fromISO(a.checkOut).isValid
        ? DateTime.fromISO(a.checkOut)
        : startDate;

      cal.createEvent({
        id: uid(`stay-${tripId}-${i}`),
        start:  startDate.toFormat('yyyy-MM-dd'),
        end:    endBase.plus({ days: 1 }).toFormat('yyyy-MM-dd'),
        allDay: true,
        summary:  `🏨 ${a.name || 'Accommodation'}`,
        location: locationField(a.address, a.coordinates, a.name || 'hotel', city, country),
        description: joinLines(
          a.checkOut && `Check-out: ${a.checkOut}`,
          a.confirmationNumber && `Confirmation: ${a.confirmationNumber}`,
          a.includesBreakfast && `Breakfast included${a.breakfastTime ? ` (${a.breakfastTime})` : ''}`,
          a.notes,
        ),
        categories: [{ name: 'Lodging' }],
        busystatus: 'FREE' as any,
      });
    });
  }

  // ── Venues ────────────────────────────────────────────────────────────────
  if (want.has('venues')) {
    (logistics?.venues ?? []).forEach((v: any, i: number) => {
      if (!v?.date) return;
      const emoji = VENUE_EMOJI[v.type] ?? '📍';
      const common: Partial<ICalEventData> = {
        id: uid(`venue-${tripId}-${i}`),
        summary:  `${emoji} ${v.name || 'Venue'}`,
        location: locationField(v.address, v.coordinates, v.name || 'venue', city, country),
        description: joinLines(
          v.confirmationNumber && `Confirmation: ${v.confirmationNumber}`,
          v.website && v.website,
          v.notes,
        ),
        url: v.website || undefined,
        categories: [{ name: cap(v.type || 'Venue') }],
      };

      if (v.time) {
        const start = localToUtc(`${v.date}T${v.time}`, tz);
        if (!start) return;
        const end = (v.endTime && localToUtc(`${v.date}T${v.endTime}`, tz))
          || new Date(start.getTime() + 120 * 60_000);
        cal.createEvent({
          ...common, start, end,
          alarms: opts.alarms ? [{ type: 'display' as any, trigger: 60 * 60 }] : [],
        } as ICalEventData);
      } else {
        cal.createEvent({
          ...common,
          start:  DateTime.fromISO(v.date).toFormat('yyyy-MM-dd'),
          end:    DateTime.fromISO(v.date).plus({ days: 1 }).toFormat('yyyy-MM-dd'),
          allDay: true,
        } as ICalEventData);
      }
    });
  }

  return cal.toString();
}
