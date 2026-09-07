// facts.ts
// Pure, framework-agnostic logistics-readiness logic — no React, no MUI. Safe to import
// from client components (the trip Overview) and server API routes (the dashboard's
// trip list) alike. This is the single source of truth for "what does this trip still
// need" so the two surfaces can't disagree with each other.

// ─── IATA / direction helpers ──────────────────────────────────────────────────

// Extract the IATA code from a stored location string, e.g. "DUB — Dublin" → "DUB"
export function extractIata(location: string): string {
  return (location ?? '').split('—')[0].trim().split(' ')[0].trim().toUpperCase();
}

interface TripAnchors {
  origin?:      { iataCode?: string; city?: string };
  destination?: { iataCode?: string; city?: string };
}

// Has any transport item actually arrived at the trip's destination?
export function destinationReachedBy(allTransport: any[], trip: TripAnchors): any | null {
  const destIata = (trip.destination?.iataCode ?? '').toUpperCase();
  const destCity = (trip.destination?.city ?? '').toLowerCase();
  for (const t of allTransport) {
    const arr = (t.arrivalLocation ?? '').toString();
    if (t.type === 'flight') {
      if (destIata && extractIata(arr) === destIata) return t;
    } else if (destCity && arr.toLowerCase().includes(destCity)) {
      return t;
    }
  }
  return null;
}

// Has any transport item actually arrived back at the trip's origin? Mirror of
// destinationReachedBy — same anchors, opposite direction.
export function originReachedBy(allTransport: any[], trip: TripAnchors): any | null {
  const originIata = (trip.origin?.iataCode ?? '').toUpperCase();
  const originCity = (trip.origin?.city ?? '').toLowerCase();
  for (const t of allTransport) {
    const arr = (t.arrivalLocation ?? '').toString();
    if (t.type === 'flight') {
      if (originIata && extractIata(arr) === originIata) return t;
    } else if (originCity && arr.toLowerCase().includes(originCity)) {
      return t;
    }
  }
  return null;
}

// Direction classifier — 'there' for outbound, 'back' for return. Flights matched by
// IATA code; everything else falls back to a date split at the trip midpoint.
export function classifyDirection(
  t: any,
  trip: { startDate: string; endDate: string } & TripAnchors,
): 'there' | 'back' {
  const originIata = (trip.origin?.iataCode ?? '').toUpperCase();
  const destIata    = (trip.destination?.iataCode ?? '').toUpperCase();

  if (t.type === 'flight') {
    const depLoc = (t.departureLocation ?? '').toUpperCase();
    if (originIata && depLoc.includes(originIata)) return 'there';
    if (destIata   && depLoc.includes(destIata))   return 'back';
  }

  if (t.departureTime) {
    const dateOnly = (s: string) => (s ? s.split('T')[0] : '');
    const start = new Date(dateOnly(trip.startDate) + 'T00:00:00').getTime();
    const end   = new Date(dateOnly(trip.endDate)   + 'T23:59:59').getTime();
    const mid   = (start + end) / 2;
    const dep   = new Date(t.departureTime).getTime();
    return dep <= mid ? 'there' : 'back';
  }

  return 'there';
}

// ─── Accommodation coverage ─────────────────────────────────────────────────────

function nightsBetween(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  const dateOnly = (s: string) => s.split('T')[0];
  const inMs  = new Date(dateOnly(checkIn)  + 'T00:00:00').getTime();
  const outMs = new Date(dateOnly(checkOut) + 'T00:00:00').getTime();
  const diff  = Math.round((outMs - inMs) / 86400000);
  return diff > 0 ? diff : 0;
}

// ─── Ground-transport gap labelling ─────────────────────────────────────────────

interface GroundTransportLeg {
  status:       'sorted' | 'gap' | 'no_data' | 'not_applicable';
  firstStop?:   { name: string };
  steps?:       { label: string; searchTerms?: string | null; estimatedDuration?: string | null }[];
  isMultiCity?: boolean;
}

function parseDurMins(dur: string | null | undefined): number {
  if (!dur) return 0;
  const h = parseInt(dur.match(/(\d+)\s*h/)?.[1] ?? '0');
  const m = parseInt(dur.match(/(\d+)\s*m/)?.[1] ?? '0');
  return h * 60 + m;
}

function groundGapLabel(leg: GroundTransportLeg | undefined | null, fallback: string): string | null {
  if (!leg || leg.status !== 'gap') return null;
  const bookable = (leg.steps ?? []).filter(s => s.searchTerms);
  if (!bookable.length) return leg.firstStop?.name ? `Get to ${leg.firstStop.name}` : fallback;
  if (leg.isMultiCity && bookable.length > 1) {
    const sorted = [...bookable].sort((a, b) => parseDurMins(b.estimatedDuration) - parseDurMins(a.estimatedDuration));
    return sorted[0].label;
  }
  return bookable[0].label;
}

// ─── The shared facts ────────────────────────────────────────────────────────

export interface LogisticsFacts {
  transport: {
    count:        number;
    hasOutbound:  boolean;
    hasReturn:    boolean;
    allConfirmed: boolean;
    anyConfirmed: boolean;
    unconfirmed:  any[];
  };
  accommodation: {
    count:         number;
    nightsNeeded:  number;
    nightsCovered: number;
    nightsMissing: number;
    allConfirmed:  boolean;
    unconfirmed:   any[];
  };
  venues: {
    count:       number;
    unconfirmed: any[];
  };
  groundGaps: string[];
}

const CONFIRMED = ['confirmed', 'booked'];
const isConfirmed = (item: any) => CONFIRMED.includes(item.status);

export function getLogisticsFacts(
  logistics: { transportation?: any[]; accommodation?: any[]; venues?: any[] } | null | undefined,
  trip: {
    nights?: number;
    startDate?: string;
    endDate?: string;
    origin?:      { iataCode?: string; city?: string };
    destination?: { iataCode?: string; city?: string };
    groundTransport?: {
      preDeparture?: GroundTransportLeg;
      arrivalLeg?:   GroundTransportLeg;
      returnLeg?:    GroundTransportLeg;
      homeCloseout?: GroundTransportLeg;
    } | null;
  },
  dismissed: string[] = [],
): LogisticsFacts {
  const transportation = logistics?.transportation ?? [];
  const accommodation  = logistics?.accommodation  ?? [];
  const venues         = logistics?.venues         ?? [];

  const transportDismissed = dismissed.includes('flights');
  const hotelDismissed     = dismissed.includes('hotel');
  const venuesDismissed    = dismissed.includes('venues');

  // ── Transport: existence (outbound + return) first, confirmation second ──
  const hasOutbound = transportDismissed || !!destinationReachedBy(transportation, trip);
  const hasReturn   = transportDismissed || !!originReachedBy(transportation, trip);
  const transport = {
    count:        transportation.length,
    hasOutbound,
    hasReturn,
    allConfirmed: transportDismissed || (hasOutbound && hasReturn && transportation.every(isConfirmed)),
    anyConfirmed: transportation.some(isConfirmed),
    unconfirmed:  transportDismissed ? [] : transportation.filter((t: any) => !isConfirmed(t)),
  };

  // ── Accommodation: coverage against trip.nights first, confirmation second ──
  const nightsNeeded  = trip.nights ?? 0;
  const nightsCovered = accommodation.reduce((sum: number, a: any) => sum + nightsBetween(a.checkIn, a.checkOut), 0);
  const nightsMissing = hotelDismissed ? 0 : Math.max(0, nightsNeeded - nightsCovered);
  const nightsOk       = hotelDismissed || nightsNeeded === 0 || nightsMissing === 0;
  const accommodationFacts = {
    count: accommodation.length,
    nightsNeeded,
    nightsCovered,
    nightsMissing,
    allConfirmed: nightsOk && (accommodation.length === 0 || accommodation.every(isConfirmed)),
    unconfirmed:  hotelDismissed ? [] : accommodation.filter((a: any) => !isConfirmed(a)),
  };

  // ── Venues: confirmation only — there's no required minimum ──
  const venuesFacts = {
    count:       venues.length,
    unconfirmed: venuesDismissed ? [] : venues.filter((v: any) => !isConfirmed(v)),
  };

  // ── Ground transport gaps ──
  const groundGaps = transportDismissed ? [] : [
    groundGapLabel(trip.groundTransport?.preDeparture, 'Transfer to departure airport'),
    groundGapLabel(trip.groundTransport?.arrivalLeg,   'Transfer from arrival airport'),
    groundGapLabel(trip.groundTransport?.returnLeg,    'Return journey transport'),
    groundGapLabel(trip.groundTransport?.homeCloseout, 'Transfer home from airport'),
  ].filter((x): x is string => x !== null);

  return { transport, accommodation: accommodationFacts, venues: venuesFacts, groundGaps };
}
