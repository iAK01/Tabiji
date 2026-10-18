// Live flight status (gate, terminal, delays, landing, baggage belt) as the app
// reads it, plus the airline's own closing times. Pure — shared by the server
// (lookups, notifications) and every screen that shows a flight.
//
// Provider times are stored as UTC and shown in the airport's own zone; booked
// times stay wall-clock (lib/push/timezones), as everywhere else.

import { DateTime } from 'luxon';
import { wallClock, ymd } from '@/lib/push/timezones';

export const FLIGHT_DATA_SOURCE = 'AeroDataBox';

// AeroDataBox's flight status values.
export type ProviderStatus =
  | 'Unknown' | 'Expected' | 'EnRoute' | 'CheckIn' | 'Boarding' | 'GateClosed' | 'Departed'
  | 'Delayed' | 'Approaching' | 'Arrived' | 'Canceled' | 'Diverted' | 'CanceledUncertain';

export interface FlightEnd {
  iata:      string | null;
  zone:      string | null;   // the airport's IANA zone
  terminal:  string | null;
  gate:      string | null;
  desk:      string | null;   // check-in desks (departures)
  belt:      string | null;   // baggage belt (arrivals)
  scheduled: string | null;   // ISO, UTC
  revised:   string | null;   // latest estimate, or actual once it's happened
  runway:    string | null;   // take-off / touchdown
  predicted: string | null;   // the provider's own guess from history
  live:      boolean;         // fed by the airport or airline, not just the timetable
}

export interface FlightStatus {
  number:    string;          // "FR 94"
  date:      string;          // local departure date
  status:    ProviderStatus;
  dep:       FlightEnd;
  arr:       FlightEnd;
  checkedAt: string;          // when we last asked
  gates:     string[];        // every departure gate shown so far — more than one is a gate change
  gateSince: string | null;   // when the current gate first showed
  beltSince: string | null;   // when the current belt first showed
}

// ── Which flight a booking is ─────────────────────────────────────────────────

const FLIGHT_NO = /^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/;

/** "FR 94" / "fr94" → "FR94", or null when it isn't a flight number. */
export function normaliseFlightNumber(raw: unknown): string | null {
  const s = String(raw ?? '').replace(/\s+/g, '').toUpperCase();
  return FLIGHT_NO.test(s) ? s : null;
}

/** The flight a booking is for: number + local departure date. One lookup serves every trip on it. */
export function flightRef(t: any): { number: string; date: string; key: string } | null {
  if ((t?.type || 'flight') !== 'flight' || !t?.departureTime) return null;
  const number = normaliseFlightNumber(t.details?.flightNumber ?? t.flightNumber);
  if (!number) return null;
  const date = ymd(String(t.departureTime));
  return { number, date, key: `${number}|${date}` };
}

// ── The airline's own deadlines ───────────────────────────────────────────────

// Minutes before scheduled departure. Only airlines whose published rules we're
// sure of; anything else shows no closing times rather than a guess.
const AIRLINE_RULES: Record<string, { bagDrop: number; gate: number }> = {
  FR: { bagDrop: 40, gate: 30 },   // Ryanair
  RK: { bagDrop: 40, gate: 30 },   // Ryanair UK
  U2: { bagDrop: 40, gate: 30 },   // easyJet
  EC: { bagDrop: 40, gate: 30 },   // easyJet Europe
  DS: { bagDrop: 40, gate: 30 },   // easyJet Switzerland
};

function airlineCode(t: any): string | null {
  const iata = String(t?.details?.airlineIata ?? '').trim().toUpperCase();
  if (iata.length === 2) return iata;
  const number = normaliseFlightNumber(t?.details?.flightNumber ?? t?.flightNumber);
  return number ? number.slice(0, 2) : null;
}

/** When bag drop and the gate close, from the booked departure — the airline's rules don't move for a delay. */
export function closingTimes(t: any): { bagDrop: DateTime; gate: DateTime } | null {
  const code  = airlineCode(t);
  const rules = code ? AIRLINE_RULES[code] : undefined;
  const dep   = wallClock(t?.departureTime, 'UTC');
  if (!rules || !dep) return null;
  return { bagDrop: dep.minus({ minutes: rules.bagDrop }), gate: dep.minus({ minutes: rules.gate }) };
}

// ── Reading a status ──────────────────────────────────────────────────────────

export type FlightPhase = 'scheduled' | 'boarding' | 'gate_closed' | 'airborne' | 'landed' | 'cancelled' | 'diverted';

export function flightPhase(fs: FlightStatus): FlightPhase {
  switch (fs.status) {
    case 'Canceled':
    case 'CanceledUncertain': return 'cancelled';
    case 'Diverted':          return 'diverted';
    case 'Arrived':           return 'landed';
    case 'Departed':
    case 'EnRoute':
    case 'Approaching':       return 'airborne';
    case 'GateClosed':        return 'gate_closed';
    case 'Boarding':          return 'boarding';
    default:                  return 'scheduled';
  }
}

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

function inZone(iso: string | null | undefined, zone: string | null): DateTime | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: zone ?? 'UTC' });
  return dt.isValid ? dt : null;
}

/** Best departure time: actual once gone, else the latest estimate, else the timetable. */
export function departureAt(fs: FlightStatus): DateTime | null {
  return inZone(fs.dep.revised ?? fs.dep.scheduled, fs.dep.zone);
}

/** Best arrival time: touchdown once landed, else the latest estimate. */
export function arrivalAt(fs: FlightStatus): DateTime | null {
  const landed = flightPhase(fs) === 'landed';
  return inZone((landed ? fs.arr.runway ?? fs.arr.revised : fs.arr.revised ?? fs.arr.predicted) ?? fs.arr.scheduled, fs.arr.zone);
}

/** When it touched down, if it has (epoch ms). */
export function landedMs(fs: FlightStatus | null | undefined): number | null {
  if (!fs || flightPhase(fs) !== 'landed') return null;
  const t = ms(fs.arr.runway ?? fs.arr.revised ?? fs.arr.scheduled);
  return Number.isFinite(t) ? t : null;
}

/** Minutes behind the timetable at departure (0 when on time or unknown). */
export function delayMins(fs: FlightStatus): number {
  const sched = ms(fs.dep.scheduled);
  const now   = ms(fs.dep.revised);
  if (!Number.isFinite(sched) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.round((now - sched) / 60_000));
}

// Under this, a later estimate is noise (pushback, taxiing), not a delay.
export const DELAY_MIN = 15;

export type Tone = 'ok' | 'warn' | 'bad';

/** One line on where the flight's at: "On time", "Delayed · now 06:50", "Landed 10:21". */
export function statusLine(fs: FlightStatus): { text: string; tone: Tone } {
  const hm = (dt: DateTime | null) => dt?.toFormat('HH:mm') ?? '';
  switch (flightPhase(fs)) {
    case 'cancelled':   return { text: fs.status === 'CanceledUncertain' ? 'May be cancelled' : 'Cancelled', tone: 'bad' };
    case 'diverted':    return { text: 'Diverted', tone: 'bad' };
    case 'landed':      return { text: `Landed ${hm(arrivalAt(fs))}`.trim(), tone: 'ok' };
    case 'airborne':    return { text: `In the air · lands ${hm(arrivalAt(fs))}`.trim(), tone: 'ok' };
    case 'gate_closed': return { text: 'Gate closed', tone: 'warn' };
    case 'boarding':    return { text: 'Boarding', tone: 'ok' };
  }
  const late = delayMins(fs);
  if (late >= DELAY_MIN) return { text: `Delayed · now ${hm(departureAt(fs))}`, tone: 'warn' };
  return { text: fs.dep.live ? 'On time' : 'Scheduled', tone: 'ok' };
}

/** The gate it showed before the current one, when it's changed. */
export function previousGate(fs: FlightStatus): string | null {
  return fs.gates.length > 1 ? fs.gates[fs.gates.length - 2] : null;
}

/** "Updated 3 min ago" */
export function checkedAgo(fs: FlightStatus, nowMs = Date.now()): string {
  const mins = Math.max(0, Math.round((nowMs - ms(fs.checkedAt)) / 60_000));
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `Updated ${h}h ago` : `Updated ${Math.round(h / 24)} days ago`;
}

/**
 * A few words for an itinerary stop mirroring this flight: the gate on the
 * departure, the landing on the arrival, desks on the airport stop.
 */
export function stopNote(fs: FlightStatus, phase: string | undefined): { text: string; tone: Tone } | null {
  const p    = flightPhase(fs);
  const line = statusLine(fs);
  if (p === 'cancelled' || p === 'diverted') return line;
  if (phase === 'arrival') {
    if (p === 'landed') return { text: [line.text, fs.arr.belt && `belt ${fs.arr.belt}`].filter(Boolean).join(' · '), tone: 'ok' };
    const eta = arrivalAt(fs);
    return eta ? { text: `${p === 'airborne' ? 'Lands' : 'Due'} ${eta.toFormat('HH:mm')}`, tone: 'ok' } : null;
  }
  if (phase === 'airport_checkin') {
    const bits = [fs.dep.terminal && `T${fs.dep.terminal}`, fs.dep.desk && `check-in ${fs.dep.desk}`].filter(Boolean);
    return bits.length ? { text: bits.join(' · '), tone: 'ok' } : null;
  }
  if (p === 'airborne' || p === 'landed') return line;
  const gate = fs.dep.gate ? `Gate ${fs.dep.gate}` : null;
  if (line.tone !== 'ok' || p !== 'scheduled') return { text: [gate, line.text].filter(Boolean).join(' · '), tone: line.tone };
  return gate ? { text: gate, tone: 'ok' } : { text: line.text, tone: 'ok' };
}
