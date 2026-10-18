// Every notification a trip will send one traveller: when it becomes due, until
// when it's still worth sending, and what it says. api/push/notify sends the
// ones due now; api/trips/[id]/reminders shows the rest on the itinerary.
//
// One notification per moment: a departure carries its directions, documents
// and expense proof together rather than as three pings, and taps land in the
// app on the thing itself (a booking sheet, the stop, the file).

import { DateTime } from 'luxon';
import { getProofSlots, type ProofSlot } from '@/lib/logistics/expenseProofs';
import { resolveCheckIn, normaliseTime } from '@/lib/itinerary/checkInTiming';
import { getCountryTransport, resolveServices } from '@/lib/data/ground-transport';
import { atTime, placeZone, tripZones, wallClock, ymd } from '@/lib/push/timezones';
import {
  buildLegs, connectingLeg, coords, departurePoint, homeAt, stayOn, whereAt, JOURNEY_TYPES,
  type LatLng, type Leg, type Point,
} from '@/lib/push/journey';
import { inQuietHours, QUIET_EXEMPT, type NotificationCategory, type NotificationPrefs } from '@/lib/push/prefs';
import type { PushAction, PushPayload } from '@/lib/push/send';
import { passesForSure, passLabel, passSummary } from '@/lib/passes/passes';
import {
  arrivalAt as liveArrival, closingTimes, delayMins, departureAt, flightPhase, landedMs, previousGate, DELAY_MIN,
  type FlightStatus,
} from '@/lib/flights/status';

const MIN  = 60 * 1000;
const HOUR = 60 * MIN;

// Minutes before something its reminder arrives.
const LEAD_MIN: Record<string, number> = {
  train: 60, ferry: 120, bus: 45,
  car_hire: 30, taxi: 20, private_transfer: 20,
  hotel: 60, activity: 45, sightseeing: 45, meal: 30, breakfast: 30,
  meeting: 45, work: 45, other: 30, concert: 60, conference: 60,
  restaurant: 30, event: 45, sport: 60, sports: 60, attraction: 45, business: 45,
};
const DEFAULT_LEAD_MIN = 30;

// Flights: arrive this long before "leave by", so there's time to get going.
const LEAVE_HEADS_UP_MS = 30 * MIN;
// When nothing says where you're setting off from.
const UNKNOWN_DRIVE_MIN = 45;
const CHECKIN_OPENS_MS  = 24 * HOUR;
const BRIEFING_FOR_MS   = 3 * HOUR;
// Proofs that fire after something ends, and to-dos, stay due this long.
export const LATE_LIMIT_MS = 6 * HOUR;
// Reminders timed at the event itself still go out for a short while after.
const AT_EVENT_GRACE_MS = 20 * MIN;

// A boarding pass or ticket exists once you've checked in, so the reminder to
// keep it for expenses rides along with the departure notification.
const PROOF_WITH_DEPARTURE = new Set(['flight', 'train', 'bus', 'ferry']);
// A final invoice only exists after drop-off / checkout.
const PROOF_AFTER_MIN: Record<string, number> = { car_hire: 120, hotel: 120, airbnb: 120, hostel: 120 };

const KIND: Record<string, string> = {
  flight: 'Flight', train: 'Train', ferry: 'Ferry', bus: 'Bus',
  car_hire: 'Car hire', taxi: 'Taxi', private_transfer: 'Transfer',
  car: 'Drive', bicycle: 'Cycle',
  hotel: 'Hotel', activity: 'Activity', sightseeing: 'Sightseeing',
  meal: 'Meal', breakfast: 'Breakfast', meeting: 'Meeting',
  work: 'Work', other: 'Event',
  concert: 'Concert', conference: 'Conference', restaurant: 'Restaurant',
  event: 'Event', sport: 'Event', sports: 'Event', attraction: 'Sightseeing', business: 'Meeting',
};

export type NavApp = 'apple_maps' | 'google_maps' | 'waze';

export interface Recipient {
  userId:            string;
  prefs:             NotificationPrefs;
  airportBufferMins: number;
  navApps:           { driving: NavApp; transit: NavApp };
  home:              { zone: string; countryCode: string | null; coords: LatLng | null };
}

export interface TripData {
  trip:      any;
  logistics: any;
  itinerary: any;
  files:     any[];
  expenses:  any[];
  packing:   { packed: number; total: number } | null;
  flights:   Map<number, FlightStatus>;   // live status by transport index (lib/flights/live.ts)
}

/** Leg index → time to drive to its airport, for journey-start flights. */
export type DriveTimes = Map<number, { minutes: number; estimated: boolean; from: string }>;

export interface PlannedRef {
  stopId?:     string;
  collection?: 'transport' | 'accommodation' | 'venue';
  index?:      number;
  phase?:      string;
  day?:        string;
}

export interface Planned {
  key:        string;
  type:       string;
  category:   NotificationCategory;
  at:         number;    // due from (epoch ms)
  until:      number;    // no longer worth sending from
  deferrable: boolean;   // still worth sending once quiet hours end
  latest?:    number;    // hard stop, even when quiet hours held it back
  zone:       string;    // where the traveller is when it's due
  payload:    PushPayload;
  ref?:       PlannedRef;
}

// ---- Wording ----------------------------------------------------------------

function startsIn(eventMs: number, nowMs: number): string {
  const mins = Math.round((eventMs - nowMs) / MIN / 5) * 5;
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins} minutes`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h} hour${h !== 1 ? 's' : ''}`;
}

function duration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function legName(leg: Leg): string {
  const t = leg.t;
  if (leg.type === 'flight') return [t.details?.airline, t.details?.flightNumber].filter(Boolean).join(' ') || 'Flight';
  return [t.details?.operator, KIND[leg.type]].filter(Boolean).join(' ') || KIND[leg.type] || 'Transport';
}

function transportLabel(t: any): string {
  const from  = t.departureLocation ?? '';
  const to    = t.arrivalLocation   ?? '';
  const route = from && to ? `${from} to ${to}` : (from || to);
  if (t.type === 'car_hire') {
    return [t.details?.rentalCompany, t.details?.pickupLocation ? `Pickup: ${t.details.pickupLocation}` : ''].filter(Boolean).join(' - ') || 'Car hire';
  }
  return [t.details?.operator, route].filter(Boolean).join(' - ') || KIND[t.type] || 'Transport';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Terminal 1 · check-in 1204–1319 · bag drop closes 05:25" — walking into the airport. */
function airportLine(t: any, fs: FlightStatus | null): string | null {
  const close = closingTimes(t);
  const line  = [
    fs?.dep.terminal && `terminal ${fs.dep.terminal}`,
    fs?.dep.desk && `check-in ${fs.dep.desk}`,
    close && `bag drop closes ${close.bagDrop.toFormat('HH:mm')}`,
  ].filter(Boolean).join(' · ');
  return line ? cap(line) : null;
}

/** " · delayed to 06:50" when the flight's running late. */
function delayNote(fs: FlightStatus | null): string {
  const est = fs && delayMins(fs) >= DELAY_MIN ? departureAt(fs) : null;
  return est ? ` · delayed to ${est.toFormat('HH:mm')}` : '';
}

/** How far ahead of or behind home the clock is at a moment. */
function offsetNote(at: DateTime, homeZone: string): string {
  const home  = DateTime.fromMillis(at.toMillis(), { zone: homeZone });
  const hours = (at.offset - home.offset) / 60;
  if (!hours) return '';
  const n = Number.isInteger(hours) ? Math.abs(hours) : Math.abs(hours).toFixed(1);
  return ` · ${n}h ${hours > 0 ? 'ahead of' : 'behind'} home`;
}

// ---- Links ------------------------------------------------------------------

const sheetUrl = (tripId: string, kind: 'transport' | 'accommodation' | 'venue' | 'arrival' | 'pass', i: number) =>
  `/trips/${tripId}?sheet=${kind}&i=${i}`;

const dayUrl = (tripId: string, dayNumber: number) => `/trips/${tripId}?tab=itinerary&day=${dayNumber}`;

function fileTarget(tripId: string, f: any): string {
  if (f.gcsUrl) return `/trips/${tripId}?tab=resources&file=${f._id}`;
  return f.linkUrl ?? `/trips/${tripId}?tab=resources`;
}

const proofUrl = (tripId: string, expense: any, slot: ProofSlot) =>
  `/trips/${tripId}?tab=expenses&expense=${expense._id}&proof=${slot.key}`;

// Web URLs only: these open from notification buttons via the worker.
function navUrl(to: Point | { name?: string; address?: string; coords: LatLng | null }, mode: 'driving' | 'transit', app: NavApp): string | null {
  const c    = to.coords;
  const text = ('address' in to && to.address) || to.name;
  if (!c && !text) return null;
  const dest = c ? `${c.lat},${c.lng}` : encodeURIComponent(text!);
  if (app === 'apple_maps') return `https://maps.apple.com/?daddr=${dest}&dirflg=${mode === 'transit' ? 'r' : 'd'}`;
  if (app === 'waze')       return c ? `https://waze.com/ul?ll=${dest}&navigate=yes` : `https://waze.com/ul?q=${dest}&navigate=yes`;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${mode}`;
}

// ---- Documents & proofs -----------------------------------------------------

// Files linked to a booking or stop: exact links first; failing that, a label
// match among files linked to the same kind of thing (never across kinds — a
// hotel's booking mustn't ride along on the flight to that city).
function linkedFiles(files: any[], collections: string[], entryId: string | number | null, terms: Array<string | undefined>): any[] {
  const docs = files.filter(f => f.resourceType !== 'todo');
  if (entryId != null) {
    const exact = docs.filter(f => collections.includes(f.linkedTo?.collection) && f.linkedTo?.entryId === String(entryId));
    if (exact.length) return exact;
  }
  const wanted = terms.filter((s): s is string => !!s && s.length >= 3).map(s => s.toLowerCase());
  return docs.filter(f => {
    const label = f.linkedTo?.label?.toLowerCase();
    const kind  = f.linkedTo?.collection;
    return !!label && (!kind || collections.includes(kind)) && wanted.some(t => label.includes(t) || t.includes(label));
  });
}

// Keys carry the event time, so a delayed flight or a moved stop gets a fresh
// reminder instead of being treated as already sent.
const at$ = (dt: DateTime) => `@${Math.round(dt.toMillis() / MIN)}`;

function docName(f: any): string {
  switch (f.type) {
    case 'boarding_pass':        return 'Boarding pass';
    case 'train_ticket':         return 'Ticket';
    case 'booking_confirmation': return 'Booking';
    case 'visa':                 return 'Visa';
    case 'insurance':            return 'Insurance';
    default:                     return f.name ?? 'Document';
  }
}

function docsLine(docs: any[]): string | null {
  if (!docs.length) return null;
  const names = [...new Set(docs.map(docName))];
  return `${names.join(', ')} ready in the app`;
}

function docAction(tripId: string, docs: any[]): PushAction[] {
  return docs[0] ? [{ action: 'document', title: docName(docs[0]), url: fileTarget(tripId, docs[0]) }] : [];
}

// A scanned boarding pass or ticket opens on its own, ready to scan; otherwise the first document.
function passAction(tripId: string, files: any[], i: number, t: any, docs: any[]): PushAction[] {
  const passes = passesForSure(files, i, t);
  return passes.length
    ? [{ action: 'pass', title: passLabel(passes[0]), url: sheetUrl(tripId, 'pass', i) }]
    : docAction(tripId, docs);
}

function missingProofs(expenses: any[], collection: string, index: number, category: string) {
  const expense = expenses.find(e => e.linkedTo?.collection === collection && e.linkedTo?.entryId === String(index));
  if (!expense) return null;
  const slots = getProofSlots(category).filter(s =>
    s.phase === 'after' && s.required && !(expense.proofs ?? []).some((p: any) => p.key === s.key));
  return slots.length ? { expense, slots } : null;
}

// ---- Itinerary helpers --------------------------------------------------------

function stopTime(dayDate: string, stop: any, zone: string): DateTime | null {
  if (stop.scheduledStart) {
    return wallClock(String(stop.scheduledStart).includes('T') ? stop.scheduledStart : `${ymd(dayDate)}T${stop.scheduledStart}`, zone);
  }
  return stop.time ? atTime(dayDate, stop.time, zone) : null;
}

// The itinerary's check-in stop for a booking: the same estimate resolveCheckIn
// makes, or the traveller's own time if they've moved it.
function checkInStopTime(itinerary: any, accomIndex: number, zone: string): DateTime | null {
  for (const day of itinerary?.days ?? []) {
    for (const stop of day.stops ?? []) {
      if (stop.source === 'logistics'
        && stop.logisticsRef?.collection === 'accommodation'
        && stop.logisticsRef?.index === accomIndex
        && stop.metadata?.phase === 'checkin') {
        return stopTime(day.date, stop, zone);
      }
    }
  }
  return null;
}

function dayNumberOf(days: any[], date: string, firstDate: string): number {
  const day = days.find(d => d.date && ymd(d.date) === date);
  if (day?.dayNumber) return day.dayNumber;
  return Math.round(DateTime.fromISO(date).diff(DateTime.fromISO(firstDate), 'days').days) + 1;
}

function cityOn(trip: any, date: string): string {
  for (const d of trip.additionalDestinations ?? []) {
    if (d.arrivalDate && ymd(d.arrivalDate) <= date && (!d.departureDate || date < ymd(d.departureDate)) && d.city) return d.city;
  }
  return trip.destination?.city ?? '';
}

function weatherLine(trip: any, date: string): string | null {
  if (cityOn(trip, date) !== trip.destination?.city) return null;   // forecasts are for the main destination
  const w = (trip.weather?.days ?? []).find((d: any) => d.date === date);
  if (!w) return null;
  const rain = typeof w.chanceOfRain === 'number' && w.chanceOfRain >= 40 ? ` · ${w.chanceOfRain}% rain` : '';
  return `${w.icon ?? ''} ${w.condition}, ${Math.round(w.tempMax)}° / ${Math.round(w.tempMin)}°${rain}`.trim();
}

/** What there is to do on a date, in time order. */
function timedStops(days: any[], date: string, read: (dayDate: string, stop: any) => DateTime | null): Array<{ dt: DateTime; name: string }> {
  const day = days.find(d => d.date && ymd(d.date) === date);
  return (day?.stops ?? [])
    .filter((s: any) => !s.skipped)
    .map((s: any) => ({ dt: read(day.date, s), name: String(s.name ?? '').trim() }))
    .filter((s: any): s is { dt: DateTime; name: string } => !!s.dt && !!s.name)
    .sort((a: any, b: any) => a.dt.toMillis() - b.dt.toMillis());
}

function itemsLine(items: Array<{ dt: DateTime; name: string }>): string {
  const shown = items.slice(0, 3).map(s => `${s.dt.toFormat('HH:mm')} ${s.name}`).join(' · ');
  return items.length > 3 ? `${shown} +${items.length - 3} more` : shown;
}

/** One line on getting from an arrival to where you're staying. */
function gettingThereHint(trip: any, leg: Leg, isMainArrival: boolean): string | null {
  const plan = trip.groundTransport?.arrivalLeg;
  if (isMainArrival && plan) {
    if (plan.userPlan?.note) return plan.userPlan.note;
    const step = (plan.steps ?? []).find((s: any) => !(plan.dismissedSteps ?? []).includes(s.label));
    if (step) return [step.label, step.estimatedDuration].filter(Boolean).join(' · ');
  }
  const local = leg.arrCountry ? getCountryTransport(leg.arrCountry) : null;
  const rides = local ? resolveServices(local.rides).slice(0, 2).map(s => s.name) : [];
  return rides.length ? `${rides.join(' and ')} work${rides.length === 1 ? 's' : ''} here` : null;
}

// ---- Planning -----------------------------------------------------------------

export function planTrip(data: TripData, r: Recipient, drive: DriveTimes, nowMs: number): Planned[] {
  const { trip, logistics, itinerary, files, expenses, packing, flights } = data;
  const tripId         = String(trip._id);
  const zoneFor        = tripZones(trip);
  const transportation = logistics?.transportation ?? [];
  const accommodation  = logistics?.accommodation ?? [];
  const venues         = logistics?.venues ?? [];
  const days           = itinerary?.days ?? [];

  const legs     = buildLegs(trip, transportation, r.home);
  const zoneAt   = whereAt(trip, legs, r.home.zone);
  const isHomeAt = homeAt(trip, legs);

  // A stop's time is local to wherever you are then — on a travel day that can
  // be home rather than the trip's zone. Read it in the trip's zone, see where
  // you'd be at that moment, and re-read it there if that's somewhere else.
  const localStopTime = (dayDate: string, stop: any): DateTime | null => {
    const guess = stopTime(dayDate, stop, zoneFor(ymd(dayDate)));
    if (!guess) return null;
    const zone = zoneAt(guess.toMillis());
    return zone === guess.zoneName ? guess : stopTime(dayDate, stop, zone);
  };

  const out: Planned[] = [];
  const add = (p: Omit<Planned, 'zone'> & { zone?: string }) => out.push({ ...p, zone: p.zone ?? zoneAt(p.at) });

  const leaveBy      = new Map<number, DateTime>();  // leg index → leave time, for the evening briefing
  const arrivalAt    = new Map<number, number>();    // stay index → when the arrival notification fires
  let   mainArrival  = true;

  // ── Journeys: flights, trains, buses, ferries ──────────────────────────────
  for (const leg of legs) {
    const t     = leg.t;
    const i     = leg.index;
    const dep   = leg.dep;
    const depMs = dep.toMillis();
    const ref   = t.confirmationNumber ? ` · Ref ${t.confirmationNumber}` : '';
    const name  = legName(leg);
    const to    = leg.arrCity ? ` to ${leg.arrCity}` : '';
    const docs  = linkedFiles(files, ['transport'], i, [t.details?.flightNumber, t.details?.operator]);
    const proof = PROOF_WITH_DEPARTURE.has(leg.type) ? missingProofs(expenses, 'transport', i, leg.type) : null;
    const from  = departurePoint(leg);
    const fs    = leg.type === 'flight' ? flights.get(i) ?? null : null;
    const phase = fs ? flightPhase(fs) : null;
    const gone  = phase === 'airborne' || phase === 'landed' || phase === 'diverted';

    // Online check-in opens
    if (leg.type === 'flight' && !leg.isConnection) {
      const airline = t.details?.airline;
      add({
        key: `transport-${i}${at$(dep)}`, type: 'flight_checkin', category: 'checkin',
        at: depMs - CHECKIN_OPENS_MS, until: depMs - 3 * HOUR, deferrable: true, latest: depMs - 3 * HOUR,
        payload: {
          title:   `Check-in is open: ${name}`,
          body:    `${leg.arrCity ? `To ${leg.arrCity} · ` : ''}${dep.toFormat('EEE HH:mm')}${ref}`,
          url:     sheetUrl(tripId, 'transport', i),
          tag:     `leg-${i}`,
          actions: airline
            ? [{ action: 'checkin', title: 'Check in', url: `https://www.google.com/search?q=${encodeURIComponent(`${airline} online check-in`)}` }]
            : [],
        },
        ref: { collection: 'transport', index: i, phase: 'checkin' },
      });
    }

    // Setting off (connections are covered when the previous flight lands)
    if (!leg.isConnection) {
      const lines: string[] = [];
      let at: number;
      let title: string;
      if (leg.type === 'flight') {
        const atAirport = dep.minus({ minutes: r.airportBufferMins });
        const d         = drive.get(i);
        const leave     = d ? atAirport.minus({ minutes: d.minutes }) : null;
        if (leave) leaveBy.set(i, leave);
        at    = (leave ?? atAirport.minus({ minutes: UNKNOWN_DRIVE_MIN })).toMillis() - LEAVE_HEADS_UP_MS;
        title = leave
          ? `Leave for the airport by ${leave.toFormat('HH:mm')}`
          : `Be at the airport by ${atAirport.toFormat('HH:mm')}`;
        // Leave-by stays on the booked time even when it's running late: bag
        // drop and the gate can still close on the original schedule.
        lines.push(`${name}${to} departs ${dep.toFormat('HH:mm')}${delayNote(fs)}${ref}`);
        if (d) lines.push(`${d.estimated ? 'About ' : ''}${d.minutes} min from ${d.from}`);
        const airport = airportLine(t, fs);
        if (airport) lines.push(airport);
      } else {
        at    = depMs - (LEAD_MIN[leg.type] ?? DEFAULT_LEAD_MIN) * MIN;
        title = `${KIND[leg.type]}${to} ${startsIn(depMs, nowMs)}`;
        lines.push(`${name} departs ${dep.toFormat('HH:mm')}${from.name ? ` from ${from.name}` : ''}${ref}`);
      }
      const docLine = docsLine(docs);
      if (docLine) lines.push(docLine);
      if (proof) lines.push(`Keep your ${proof.slots[0].label.toLowerCase()} for expenses`);

      const nav = navUrl(from, leg.type === 'flight' ? 'driving' : 'transit', leg.type === 'flight' ? r.navApps.driving : r.navApps.transit);
      add({
        key: `transport-${i}${at$(dep)}`, type: `${leg.type}_departure`, category: 'travel',
        at, until: depMs, deferrable: false,
        payload: {
          title, body: lines.join('\n'),
          url: sheetUrl(tripId, 'transport', i),
          tag: `leg-${i}`,
          requireInteraction: leg.type === 'flight',
          actions: [...(nav ? [{ action: 'directions', title: 'Directions', url: nav }] : []), ...passAction(tripId, files, i, t, docs)],
        },
        ref: { collection: 'transport', index: i, phase: 'departure' },
      });
    }

    // At the airport: the boarding pass, for bag drop and security. Replaces
    // the leave-by notification (same tag) — that moment has passed. Once the
    // gate shows, it's the gate notification instead (same tag again), and a
    // new one for every change of gate.
    const passes  = passesForSure(files, i, t);
    const passAt  = depMs - r.airportBufferMins * MIN;
    const gateAt  = fs?.dep.gate && fs.gateSince && !gone && phase !== 'cancelled'
      ? Math.max(Date.parse(fs.gateSince), leg.isConnection ? depMs - 3 * HOUR : passAt)
      : null;
    const gateUntil = Math.max(depMs, fs ? departureAt(fs)?.toMillis() ?? depMs : depMs);

    if (leg.type === 'flight' && !leg.isConnection && passes.length && !(gateAt && gateAt <= passAt)) {
      const one = passes.length === 1 ? passSummary(passes[0]) : `${passes.length} boarding passes`;
      add({
        key: `transport-${i}${at$(dep)}`, type: 'flight_pass', category: 'travel',
        at: passAt, until: depMs, deferrable: false,
        payload: {
          title: `${name} · ${passLabel(passes[0])}`,
          body:  [[one, `Departs ${dep.toFormat('HH:mm')}${delayNote(fs)}`].filter(Boolean).join(' · '), airportLine(t, fs)].filter(Boolean).join('\n'),
          url:   sheetUrl(tripId, 'pass', i),
          tag:   `leg-${i}`,
          requireInteraction: true,
        },
        ref: { collection: 'transport', index: i, phase: 'pass' },
      });
    }

    if (gateAt && fs?.dep.gate) {
      const was   = previousGate(fs);
      const close = closingTimes(t);
      const late  = delayMins(fs) >= DELAY_MIN ? departureAt(fs) : null;
      const lines = [
        ...(was ? [`${name} · was gate ${was}`] : []),
        late
          ? `Delayed to ${late.toFormat('HH:mm')}`
          : [`Departs ${dep.toFormat('HH:mm')}`, close && `gate closes ${close.gate.toFormat('HH:mm')}`].filter(Boolean).join(' · '),
        [fs.dep.terminal && `Terminal ${fs.dep.terminal}`, passes.length === 1 && passSummary(passes[0])].filter(Boolean).join(' · '),
      ].filter(Boolean);
      add({
        // Numbered, so going back to an earlier gate is news too
        key: `transport-${i}-gate-${fs.gates.length}-${fs.dep.gate}${at$(dep)}`, type: was ? 'flight_gate_change' : 'flight_gate', category: 'travel',
        at: gateAt, until: gateUntil, deferrable: false,
        payload: {
          title: was ? `Gate change: now gate ${fs.dep.gate}` : `Gate ${fs.dep.gate} · ${name}`,
          body:  lines.join('\n'),
          url:   sheetUrl(tripId, passes.length ? 'pass' : 'transport', i),
          tag:   `leg-${i}`,
          requireInteraction: true,
          actions: passAction(tripId, files, i, t, docs),
        },
        ref: { collection: 'transport', index: i, phase: 'gate' },
      });
    }

    // Running late, or not running at all. From 6 hours out — earlier than
    // that it waits for the evening briefing — and whatever time of night,
    // since it changes when you leave.
    if (fs && phase === 'cancelled') {
      const airline = t.details?.airline;
      add({
        key: `transport-${i}-cancelled${at$(dep)}`, type: 'flight_cancelled', category: 'travel',
        at: depMs - 24 * HOUR, until: depMs + 2 * HOUR, deferrable: false,
        payload: {
          title: fs.status === 'CanceledUncertain' ? `${name} may be cancelled` : `${name} is cancelled`,
          body:  [`Was due to leave ${dep.toFormat('EEE HH:mm')}${to ? ` for ${leg.arrCity}` : ''}`, `Check with ${airline || 'the airline'} about rebooking`].join('\n'),
          url:   sheetUrl(tripId, 'transport', i),
          tag:   `flight-${i}`,
          requireInteraction: true,
          actions: airline
            ? [{ action: 'airline', title: airline, url: `https://www.google.com/search?q=${encodeURIComponent(`${airline} manage booking`)}` }]
            : [],
        },
        ref: { collection: 'transport', index: i, phase: 'status' },
      });
    } else if (fs && phase === 'scheduled' && delayMins(fs) >= DELAY_MIN) {
      const est = departureAt(fs)!;
      add({
        // Re-sent only when the estimate moves by 10 minutes or more
        key: `transport-${i}-delay-${Math.round(est.toMillis() / (10 * MIN))}${at$(dep)}`, type: 'flight_delay', category: 'travel',
        at: depMs - 6 * HOUR, until: est.toMillis(), deferrable: false,
        payload: {
          title: `${name} delayed to ${est.toFormat('HH:mm')}`,
          body:  [`Was ${dep.toFormat('HH:mm')}${to}`, 'Bag drop and the gate can still close on the original times'].join('\n'),
          url:   sheetUrl(tripId, 'transport', i),
          tag:   `flight-${i}`,
        },
        ref: { collection: 'transport', index: i, phase: 'status' },
      });
    }

    // Landing: when it really touches down once that's known, the latest
    // estimate before then, the timetable without live data. Keys stay on the
    // booked time, so a late landing moves the notification rather than adding one.
    if (!leg.arr) continue;
    const arrMs  = leg.arr.toMillis();
    const downMs = landedMs(fs);
    const etaMs  = downMs ?? (fs && phase !== 'cancelled' ? liveArrival(fs)?.toMillis() : null) ?? arrMs;
    const next   = connectingLeg(legs, leg);

    if (next) {
      const nt       = next.t;
      const nfs      = flights.get(next.index);
      const nextDocs = linkedFiles(files, ['transport'], next.index, [nt.details?.flightNumber, nt.details?.operator]);
      const nextProof = missingProofs(expenses, 'transport', next.index, next.type);
      const gap      = Math.max(0, Math.round((next.dep.toMillis() - etaMs) / MIN));
      const lines    = [`${legName(next)}${next.arrCity ? ` to ${next.arrCity}` : ''} departs ${next.dep.toFormat('HH:mm')}${delayNote(nfs ?? null)} · ${duration(gap)} to make it`];
      if (nfs?.dep.gate) lines.push([`Gate ${nfs.dep.gate}`, nfs.dep.terminal && `terminal ${nfs.dep.terminal}`].filter(Boolean).join(' · '));
      const docLine  = docsLine(nextDocs);
      if (docLine) lines.push(docLine);
      if (nextProof) lines.push(`Keep your ${nextProof.slots[0].label.toLowerCase()} for expenses`);
      add({
        key: `transport-${i}${at$(leg.arr)}`, type: 'connection', category: 'travel',
        at: etaMs + 10 * MIN, until: next.dep.toMillis(), deferrable: false, zone: leg.arr.zoneName ?? undefined,
        payload: {
          title: `Connecting in ${leg.arrCity || 'transit'}`,
          body:  lines.join('\n'),
          url:   sheetUrl(tripId, 'transport', next.index),
          tag:   `leg-${next.index}`,
          actions: passAction(tripId, files, next.index, nt, nextDocs),
        },
        ref: { collection: 'transport', index: i, phase: 'arrival' },
      });
      continue;
    }

    // The baggage belt: in the landing notification when it's known by then,
    // otherwise on its own as soon as it shows (and always landing back home,
    // where there's no landing notification).
    const at = downMs ? downMs + 10 * MIN : etaMs + (leg.type === 'flight' ? 15 : 5) * MIN;
    if (fs?.arr.belt && fs.beltSince && (leg.arrivesHome || Date.parse(fs.beltSince) > at)) {
      const down = downMs ?? etaMs;
      add({
        key: `transport-${i}-belt-${fs.arr.belt}${at$(leg.arr)}`, type: 'flight_belt', category: 'landed',
        at: Math.max(Date.parse(fs.beltSince), down), until: down + 90 * MIN, deferrable: false, zone: leg.arr.zoneName ?? undefined,
        payload: {
          title: `Bags: belt ${fs.arr.belt}`,
          body:  `${name}${downMs ? ` · landed ${DateTime.fromMillis(downMs, { zone: leg.arr.zoneName ?? 'UTC' }).toFormat('HH:mm')}` : ''}`,
          url:   sheetUrl(tripId, leg.arrivesHome ? 'transport' : 'arrival', i),
          tag:   `belt-${i}`,
        },
        ref: { collection: 'transport', index: i, phase: 'belt' },
      });
    }
    if (leg.arrivesHome) continue;

    const date = leg.arr.toISODate()!;
    const stay = stayOn(accommodation, date)
      ?? (leg.arr.hour < 6 ? stayOn(accommodation, leg.arr.minus({ days: 1 }).toISODate()!) : null);
    const zone  = leg.arr.zoneName ?? zoneFor(date);
    const city  = leg.arrCity || cityOn(trip, date) || 'your destination';
    const hint  = gettingThereHint(trip, leg, mainArrival);
    mainArrival = false;
    if (stay && r.prefs.categories.landed) arrivalAt.set(stay.index, at);

    const lines = [`It's ${DateTime.fromMillis(at, { zone }).toFormat('HH:mm')} here${offsetNote(DateTime.fromMillis(at, { zone }), r.home.zone)}`];
    if (fs?.arr.belt) lines.push(`Bags: belt ${fs.arr.belt}`);
    if (stay) lines.push([stay.a.name, hint].filter(Boolean).join(' · '));
    else if (hint) lines.push(hint);
    lines.push('Tap for getting there, money and plugs');

    const stayNav = stay
      ? navUrl({ name: stay.a.name, address: stay.a.address, coords: coords(stay.a.coordinates) }, 'driving', r.navApps.driving)
      : null;
    add({
      key: `transport-${i}${at$(leg.arr)}`, type: leg.type === 'flight' ? 'landed' : 'arrived', category: 'landed',
      at, until: Math.max(arrMs, etaMs) + 4 * HOUR, deferrable: false, zone,
      payload: {
        title: leg.type === 'flight' ? `You've landed in ${city}` : `You've arrived in ${city}`,
        body:  lines.join('\n'),
        url:   sheetUrl(tripId, 'arrival', i),
        tag:   `arrive-${i}`,
        actions: stayNav ? [{ action: 'directions', title: `To ${stay!.a.name || 'your stay'}`, url: stayNav }] : [],
      },
      ref: { collection: 'transport', index: i, phase: 'arrival' },
    });
  }

  // ── Local transport: car hire, taxis, transfers ────────────────────────────
  transportation.forEach((t: any, i: number) => {
    const type = t?.type;
    if (!type || JOURNEY_TYPES.has(type) || !t.departureTime) return;
    const dep = wallClock(t.departureTime, placeZone(trip, zoneFor, t.departureLocation, ymd(t.departureTime)));
    if (!dep) return;
    const depMs = dep.toMillis();
    const ref   = t.confirmationNumber ? ` · Ref ${t.confirmationNumber}` : '';
    const lead  = LEAD_MIN[type];

    if (lead) {
      const docs  = linkedFiles(files, ['transport'], i, [t.details?.operator, t.details?.rentalCompany]);
      const where = type === 'car_hire' ? (t.details?.pickupLocation || t.departureLocation) : t.departureLocation;
      const point = {
        name:   where,
        coords: coords(type === 'car_hire' ? (t.details?.pickupCoordinates ?? t.departureCoordinates) : t.departureCoordinates),
      };
      const nav   = navUrl(point, 'driving', r.navApps.driving);
      const lines = [`${where ? `${where} · ` : ''}${dep.toFormat('HH:mm')}${ref}`];
      const docLine = docsLine(docs);
      if (docLine) lines.push(docLine);
      add({
        key: `transport-${i}${at$(dep)}`, type: `${type}_departure`, category: 'travel',
        at: depMs - lead * MIN, until: depMs, deferrable: false,
        payload: {
          title: type === 'car_hire' ? `Car hire pick-up ${startsIn(depMs, nowMs)}` : `${KIND[type]} ${startsIn(depMs, nowMs)}`,
          body:  lines.join('\n'),
          url:   sheetUrl(tripId, 'transport', i),
          tag:   `leg-${i}`,
          actions: [...(nav ? [{ action: 'directions', title: 'Directions', url: nav }] : []), ...passAction(tripId, files, i, t, docs)],
        },
        ref: { collection: 'transport', index: i, phase: 'departure' },
      });
    }

    // Car hire's final invoice only exists after drop-off
    const after = PROOF_AFTER_MIN[type];
    const proof = after !== undefined ? missingProofs(expenses, 'transport', i, type) : null;
    const back  = proof && t.arrivalTime ? wallClock(t.arrivalTime, zoneFor(ymd(t.arrivalTime))) : null;
    if (proof && back) {
      for (const slot of proof.slots) {
        const at = back.toMillis() + after! * MIN;
        add({
          key: `transport-proof-${i}-${slot.key}`, type: `${type}_proof_${slot.key}`, category: 'expenses',
          at, until: at + LATE_LIMIT_MS, deferrable: true,
          payload: {
            title: `Don't forget: ${slot.label}`,
            body:  `${transportLabel(t)}\nDue back ${back.toFormat('HH:mm')} — upload it before you lose it`,
            url:   proofUrl(tripId, proof.expense, slot),
            tag:   `transport-proof-${i}-${slot.key}`,
          },
        });
      }
    }
  });

  // ── Accommodation ──────────────────────────────────────────────────────────
  accommodation.forEach((a: any, i: number) => {
    const name = a.name || 'your accommodation';
    const ref  = a.confirmationNumber ? `Ref ${a.confirmationNumber}` : null;
    const docs = linkedFiles(files, ['accommodation'], i, [a.name]);
    const nav  = navUrl({ name: a.name, address: a.address, coords: coords(a.coordinates) }, 'driving', r.navApps.driving);
    const directions: PushAction[] = nav ? [{ action: 'directions', title: 'Directions', url: nav }] : [];

    if (a.checkIn) {
      const date  = ymd(a.checkIn);
      const zone  = zoneFor(date);
      const event = checkInStopTime(itinerary, i, zone) ?? atTime(date, resolveCheckIn({
        checkInDate:         date,
        propertyCheckInTime: a.checkInTime,
        arrivals:            transportation.map((t: any) => t.arrivalTime ?? null),
      }).time, zone);
      if (event) {
        const at      = event.toMillis() - LEAD_MIN.hotel * MIN;
        const landed  = arrivalAt.get(i);
        // Just landed and heading there anyway — the arrival notification covers it.
        const covered = landed !== undefined && Math.abs(at - landed) < 2 * HOUR;
        if (!covered) {
          add({
            key: `accom-${i}${at$(event)}`, type: 'accom_checkin', category: 'travel',
            at, until: Math.max(event.toMillis(), at + AT_EVENT_GRACE_MS), deferrable: false,
            payload: {
              title: `Check in at ${name} · ${event.toFormat('HH:mm')}`,
              body:  [a.address, docsLine(docs), ref].filter(Boolean).join('\n'),
              url:   sheetUrl(tripId, 'accommodation', i),
              tag:   `accom-${i}`,
              actions: [...directions, ...docAction(tripId, docs)],
            },
            ref: { collection: 'accommodation', index: i, phase: 'checkin' },
          });
        }
      }
    }

    if (a.checkOut) {
      const date  = ymd(a.checkOut);
      const event = atTime(date, normaliseTime(a.checkOutTime) ?? '11:00', zoneFor(date));
      if (event) {
        add({
          key: `accom-checkout-${i}${at$(event)}`, type: 'accom_checkout', category: 'travel',
          at: event.toMillis() - HOUR, until: event.toMillis(), deferrable: false,
          payload: {
            title: `Check out of ${name} by ${event.toFormat('HH:mm')}`,
            body:  [ref, docsLine(docs)].filter(Boolean).join('\n') || 'Pack up and check out',
            url:   sheetUrl(tripId, 'accommodation', i),
            tag:   `accom-${i}`,
          },
          ref: { collection: 'accommodation', index: i, phase: 'checkout' },
        });

        const after = PROOF_AFTER_MIN[a.type];
        const proof = after !== undefined ? missingProofs(expenses, 'accommodation', i, a.type) : null;
        for (const slot of proof?.slots ?? []) {
          const at = event.toMillis() + after! * MIN;
          add({
            key: `accom-proof-${i}-${slot.key}`, type: `${a.type}_proof_${slot.key}`, category: 'expenses',
            at, until: at + LATE_LIMIT_MS, deferrable: true,
            payload: {
              title: `Don't forget: ${slot.label}`,
              body:  `${a.name || 'Accommodation'} — upload it before you lose it`,
              url:   proofUrl(tripId, proof!.expense, slot),
              tag:   `accom-proof-${i}-${slot.key}`,
            },
          });
        }
      }
    }
  });

  // ── Venues ─────────────────────────────────────────────────────────────────
  venues.forEach((v: any, i: number) => {
    const time = normaliseTime(v.time);
    if (!v.date || !time) return;
    const date  = ymd(v.date);
    const event = atTime(date, time, zoneFor(date));
    if (!event) return;
    const lead = LEAD_MIN[v.type] ?? LEAD_MIN.event;
    const docs = linkedFiles(files, ['venue'], i, [v.name]);
    const nav  = (v.address || v.coordinates)
      ? navUrl({ name: v.name, address: v.address, coords: coords(v.coordinates) }, 'driving', r.navApps.driving)
      : null;
    const extra: PushAction[] = docs[0]
      ? docAction(tripId, docs)
      : v.website ? [{ action: 'website', title: 'Website', url: v.website }] : [];
    add({
      key: `venue-${i}${at$(event)}`, type: `${v.type || 'event'}_reminder`, category: 'itinerary',
      at: event.toMillis() - lead * MIN, until: event.toMillis(), deferrable: false,
      payload: {
        title: `${KIND[v.type] ?? 'Event'}: ${v.name} ${startsIn(event.toMillis(), nowMs)}`,
        body:  [`${v.address ? `${v.address} · ` : ''}${event.toFormat('HH:mm')}`, docsLine(docs)].filter(Boolean).join('\n'),
        url:   sheetUrl(tripId, 'venue', i),
        tag:   `venue-${i}`,
        actions: [...(nav ? [{ action: 'directions', title: 'Directions', url: nav }] : []), ...extra],
      },
      ref: { collection: 'venue', index: i },
    });
  });

  // ── Itinerary stops ────────────────────────────────────────────────────────
  for (const [dayIdx, day] of days.entries()) {
    if (!day.date) continue;
    const zone  = zoneFor(ymd(day.date));
    const dayNo = day.dayNumber ?? dayIdx + 1;
    for (const stop of day.stops ?? []) {
      // Copies of bookings are reminded about through the booking itself.
      if (stop.source === 'logistics') continue;
      // "Not going" on the itinerary.
      if (stop.skipped) continue;
      // "Off" in the stop editor. Missing (stops from imports/AI) means the default.
      if (stop.notificationLeadMins === null) continue;
      const event = localStopTime(day.date, stop);
      if (!event) continue;
      const lead = typeof stop.notificationLeadMins === 'number'
        ? stop.notificationLeadMins
        : LEAD_MIN[stop.type] ?? DEFAULT_LEAD_MIN;
      if (lead <= 0) continue;

      const stopId = stop._id ? String(stop._id) : null;
      const docs   = linkedFiles(files, ['itinerary', 'itinerary_stop'], stopId, [stop.name]);
      const nav    = (stop.address || stop.coordinates)
        ? navUrl({ name: stop.name, address: stop.address, coords: coords(stop.coordinates) }, 'driving', r.navApps.driving)
        : null;
      const when   = startsIn(event.toMillis(), nowMs);
      add({
        key: `${stopId ?? `${ymd(day.date)}-${stop.name}`}${at$(event)}`, type: `${stop.type}_reminder`, category: 'itinerary',
        at: event.toMillis() - lead * MIN, until: event.toMillis(), deferrable: false,
        payload: {
          title: stop.reference && stop.type === 'transport'
            ? `${stop.reference} · ${stop.name} ${when}`
            : `${KIND[stop.type] ?? 'Event'}: ${stop.name} ${when}`,
          body:  [stop.reference && stop.type !== 'transport' ? stop.reference : null,
                  `${stop.address ? `${stop.address} · ` : ''}${event.toFormat('HH:mm')}`,
                  docsLine(docs)].filter(Boolean).join('\n'),
          url:   stopId
            ? `/trips/${tripId}?tab=itinerary&day=${dayNo}&stop=${stopId}`
            : dayUrl(tripId, dayNo),
          tag:   `stop-${stopId ?? ymd(day.date)}`,
          actions: [...(nav ? [{ action: 'directions', title: 'Directions', url: nav }] : []), ...docAction(tripId, docs)],
        },
        ref: stopId ? { stopId } : undefined,
      });
    }
  }

  // ── Briefings ──────────────────────────────────────────────────────────────
  if (trip.startDate && trip.endDate) {
    const first   = ymd(trip.startDate);
    const lastDay = ymd(trip.endDate);
    const { morning, evening } = r.prefs.briefingTimes;
    const packingLeft = !!packing && packing.total > 0 && packing.packed < packing.total;

    // Morning of each trip day with something on
    for (let d = DateTime.fromISO(first); d.toISODate()! <= lastDay; d = d.plus({ days: 1 })) {
      const date  = d.toISODate()!;
      const probe = atTime(date, morning, zoneFor(date));
      if (!probe) continue;
      const zone  = zoneAt(probe.toMillis());
      const at    = atTime(date, morning, zone)!;
      const ahead = timedStops(days, date, localStopTime).filter(s => s.dt.toMillis() >= at.toMillis());
      if (!ahead.length) continue;
      add({
        key: `brief-${date}`, type: 'morning_briefing', category: 'briefings',
        at: at.toMillis(), until: at.toMillis() + BRIEFING_FOR_MS, deferrable: false, zone,
        payload: {
          title: isHomeAt(at.toMillis()) ? `Today: ${trip.name}` : `Today in ${cityOn(trip, date) || trip.name}`,
          body:  [weatherLine(trip, date), itemsLine(ahead)].filter(Boolean).join('\n'),
          url:   dayUrl(tripId, dayNumberOf(days, date, first)),
          tag:   `brief-${date}`,
        },
        ref: { day: date },
      });
    }

    // Evening before the first day, and before each day you set off somewhere
    const setOffs = new Map<string, Leg>();
    for (const leg of legs) {
      const date = leg.dep.toISODate()!;
      if (!leg.isConnection && !setOffs.has(date)) setOffs.set(date, leg);
    }
    const evenings = new Set<string>([first, ...setOffs.keys()]);
    for (const date of evenings) {
      const prev  = DateTime.fromISO(date).minus({ days: 1 }).toISODate()!;
      const probe = atTime(prev, evening, zoneFor(prev));
      if (!probe) continue;
      const zone  = zoneAt(probe.toMillis());
      const at    = atTime(prev, evening, zone)!;
      const leg   = setOffs.get(date);
      const lines: string[] = [];
      let title: string;
      if (leg) {
        const leave = leaveBy.get(leg.index);
        const atAirport = leg.type === 'flight' ? leg.dep.minus({ minutes: r.airportBufferMins }) : null;
        const when = leave
          ? ` · leave by ${leave.toFormat('HH:mm')}`
          : atAirport ? ` · at the airport by ${atAirport.toFormat('HH:mm')}` : '';
        title = `Tomorrow: ${leg.type === 'flight' ? 'flight' : KIND[leg.type].toLowerCase()} to ${leg.arrCity || cityOn(trip, date) || 'your next stop'}`;
        const fs = leg.type === 'flight' ? flights.get(leg.index) ?? null : null;
        lines.push(fs && flightPhase(fs) === 'cancelled'
          ? `${legName(leg)} is showing as cancelled`
          : `${legName(leg)} departs ${leg.dep.toFormat('HH:mm')}${delayNote(fs)}${when}`);
        const airport = leg.type === 'flight' ? airportLine(leg.t, fs) : null;
        if (airport) lines.push(airport);
      } else {
        const firstUp = timedStops(days, date, localStopTime)[0];
        title = `Tomorrow: ${trip.name} begins`;
        if (firstUp) lines.push(`First up: ${firstUp.dt.toFormat('HH:mm')} ${firstUp.name}`);
      }
      const isFirst = date === first;
      if (isFirst && packingLeft) lines.push(`Packed ${packing!.packed} of ${packing!.total}`);
      const weather = weatherLine(trip, date);
      if (weather) lines.push(`${cityOn(trip, date)}: ${weather}`);

      const tomorrow = dayUrl(tripId, dayNumberOf(days, date, first));
      const packingUrl = `/trips/${tripId}?tab=packing`;
      add({
        key: `eve-${date}`, type: 'evening_briefing', category: 'briefings',
        at: at.toMillis(), until: at.toMillis() + BRIEFING_FOR_MS, deferrable: false, zone,
        payload: {
          title,
          body:  lines.join('\n') || 'Tap to see the day',
          url:   isFirst && packingLeft ? packingUrl : tomorrow,
          tag:   `eve-${date}`,
          actions: isFirst && packingLeft
            ? [{ action: 'packing', title: 'Packing list', url: packingUrl }, { action: 'day', title: 'Tomorrow', url: tomorrow }]
            : [],
        },
        ref: { day: date },
      });
    }
  }

  return out;
}

// ---- Sending rules ------------------------------------------------------------

function localMinutes(ms: number, zone: string): number {
  const dt = DateTime.fromMillis(ms, { zone });
  return dt.hour * 60 + dt.minute;
}

// The next time of day `hhmm` at or after `ms`, in `zone`.
function nextAt(ms: number, zone: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const from   = DateTime.fromMillis(ms, { zone });
  let next     = from.set({ hour: h, minute: m, second: 0, millisecond: 0 });
  if (next < from) next = next.plus({ days: 1 });
  return next.toMillis();
}

/** Whether a planned notification should go out now under the traveller's settings. */
export function isDueNow(p: Pick<Planned, 'at' | 'until' | 'deferrable' | 'zone' | 'category' | 'latest'>, prefs: NotificationPrefs, nowMs: number): boolean {
  if (!prefs.categories[p.category] || nowMs < p.at) return false;
  let until = p.until;
  if (!QUIET_EXEMPT.has(p.category) && prefs.quietHours.enabled && prefs.quietHours.start !== prefs.quietHours.end) {
    if (inQuietHours(prefs, localMinutes(nowMs, p.zone))) return false;
    // Quiet hours start before it would expire (or it fell due inside them):
    // still worth sending once they end — up to any hard stop.
    if (p.deferrable) {
      const quietFrom = inQuietHours(prefs, localMinutes(p.at, p.zone)) ? p.at : nextAt(p.at, p.zone, prefs.quietHours.start);
      if (quietFrom < until) until = Math.max(until, nextAt(quietFrom, p.zone, prefs.quietHours.end) + 2 * HOUR);
    }
  }
  if (p.latest !== undefined) until = Math.min(until, p.latest);
  return nowMs < until;
}
