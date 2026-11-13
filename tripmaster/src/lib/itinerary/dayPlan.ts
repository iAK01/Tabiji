// A day's route: an itinerary page's stops in the order you move between them,
// and each leg from one place to the next. Pure, so the itinerary, its map, the
// trip map and the routes route all build the same thing — the server to know
// which legs to look up, the phone to draw them (offline too).
//
//   • Stops that overlap in time are one group, exactly as the List view groups
//     them. A group at one place is a visit; at several it's a choice made on the
//     day, so those places get pins and no line between them.
//   • A leg runs from where one group ends to where the next begins, when each of
//     those is one place. The day starts at the stay you woke up in (home, on the
//     trip's first day) and ends at tonight's stay (home, on the last).
//   • A flight, a booked train / bus / ferry, or a transport stop of your own is
//     the journey itself, timed by its stop. Every other leg is a walk or a drive,
//     looked up from Google (lib/geo/routes.ts) — never estimated.

import { clockMinutes, stopDuration, nightPages, DAY_MINS, type NightStop } from './nights';
import { haversineKm } from '@/lib/geo/geocode';

export type LatLng = { lat: number; lng: number };

export interface PlacePoint { name?: string; address?: string; coordinates?: LatLng | null }

export interface PlanStop extends NightStop {
  _id?:           string;
  name:           string;
  type:           string;
  address?:       string;
  locationName?:  string;
  coordinates?:   LatLng | null;
  skipped?:       boolean;
  afterMidnight?: boolean;
  metadata?:      Record<string, any>;
  /** Where a transport stop of your own takes you */
  to?:            PlacePoint | null;
}

export interface Stay { name: string; address?: string; coordinates?: LatLng | null; checkIn: string; checkOut: string }
export interface Home { name: string; coordinates: LatLng }
/** A place the trip knows by name — a booked venue — so a pin there is called that */
export interface NamedPlace { name: string; address?: string; coordinates: LatLng }

export interface Place {
  key:         string;
  name:        string;
  address?:    string;
  coordinates: LatLng;
  kind:        'stop' | 'stay' | 'home';
}

export interface Group<S> {
  /** Its number on the map, in the order you get there; 0 = nothing in it has a pin */
  n:      number;
  start:  number;   // page minutes — past 24:00 after midnight
  end:    number;
  stops:  S[];
  places: Place[];
}

export type LegKind = 'move' | 'flight' | 'ride';

export interface Leg<S> {
  id:         string;
  kind:       LegKind;
  from:       Place;
  to:         Place;
  fromStop:   S | null;        // null: setting off from where you slept
  toStop:     S | null;        // null: back to where you sleep, or off a ride
  /** The flight, booking or transport stop that is this journey */
  ride:       S | null;
  leaveAfter: number | null;   // page minutes
  arriveBy:   number | null;
  /** To an airport, station or departure, or on from an arrival — you need a way there */
  transfer:   boolean;
  anchor:     'start' | 'end' | null;
  /** Route lookup key: the same two points share it, whatever the day */
  pair:       string;
}

export type Step<S> =
  | { kind: 'anchor'; at: 'start' | 'end'; place: Place }
  | { kind: 'leg';    leg: Leg<S> }
  | { kind: 'group';  group: Group<S> };

export interface DayPlan<S> {
  date:    string;
  /** Everything in order: where you start, legs and groups, where you end */
  steps:   Step<S>[];
  groups:  Group<S>[];
  legs:    Leg<S>[];
  untimed: S[];
  startAt: Place | null;
  endAt:   Place | null;
}

/** Closer than this, two pins are one place — a venue's rooms, a hotel's own stops */
export const SAME_PLACE_KM = 0.06;
/** Home further than this from the trip's first or last place wasn't driven to */
const HOME_REACH_KM = 300;
/** A booked taxi or car is pinned where it drops you */
const ROAD_BOOKINGS = new Set(['car', 'taxi', 'private_transfer', 'bicycle']);
const JOURNEY_TYPES = new Set(['flight', 'transport', 'transfer', 'checkin']);
const AIRPORT = /airport|a[eé]roport|aeropuerto|aeroporto|flughafen|\([A-Z]{3}\)/i;
const PICTOGRAPHS = /[\p{Extended_Pictographic}️‍]/gu;

export const isPinned = (c?: LatLng | null): c is LatLng =>
  !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
export const distanceKm = (a: LatLng, b: LatLng) => haversineKm(a.lat, a.lng, b.lat, b.lng);
export const pointKey = (c: LatLng) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;
export const pairKey  = (a: LatLng, b: LatLng) => `${pointKey(a)}>${pointKey(b)}`;

const ymd = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);
const clean = (s?: string) => (s ?? '').replace(PICTOGRAPHS, '').replace(/\s+/g, ' ').trim();

/** Minutes after the page's midnight — an after-midnight stop runs on past 24:00 */
export function pageStart(s: PlanStop): number | null {
  const m = clockMinutes(s);
  return m === null ? null : m + (s.afterMidnight ? DAY_MINS : 0);
}
const pageEnd = (s: PlanStop) => (pageStart(s) ?? 0) + stopDuration(s);

/** Timed stops in runs that overlap each other (transitively), in time order */
export function clusterByTime<S extends NightStop>(stops: S[], startOf: (s: S) => number | null): S[][] {
  const timed = stops
    .map(s => ({ s, start: startOf(s) }))
    .filter((x): x is { s: S; start: number } => x.start !== null)
    .sort((a, b) => a.start - b.start || stopDuration(b.s) - stopDuration(a.s));
  const clusters: S[][] = [];
  let end = -Infinity;
  for (const { s, start } of timed) {
    const until = start + Math.max(stopDuration(s), 1);
    if (start >= end || !clusters.length) { clusters.push([s]); end = until; }
    else { clusters[clusters.length - 1].push(s); end = Math.max(end, until); }
  }
  return clusters;
}

/** The trip's venues, by name, from a logistics record */
export function namedFrom(venues: any[] | undefined | null): NamedPlace[] {
  return (venues ?? [])
    .filter((v: any) => v?.name && isPinned(v.coordinates))
    .map((v: any) => ({ name: clean(v.name), address: v.address, coordinates: { lat: v.coordinates.lat, lng: v.coordinates.lng } }));
}

/** Stays from a logistics record's accommodation */
export function staysFrom(accommodation: any[] | undefined | null): Stay[] {
  return (accommodation ?? [])
    .filter((a: any) => a?.name && a.checkIn)
    .map((a: any) => ({
      name:        a.name,
      address:     a.address,
      coordinates: isPinned(a.coordinates) ? { lat: a.coordinates.lat, lng: a.coordinates.lng } : null,
      checkIn:     ymd(a.checkIn),
      checkOut:    ymd(a.checkOut || a.checkIn),
    }));
}

// ─── What a stop is, for getting about ────────────────────────────────────────
const phaseOf = (s: PlanStop) => s.metadata?.phase as string | undefined;
const modeOf  = (s: PlanStop) => (s.metadata?.transportType as string | undefined) ?? '';
const isOwn   = (s: PlanStop) => s.source !== 'logistics';

/** Leaving this stop is a journey: a flight, another booked journey, or a transport stop of your own */
function journeyFrom(s: PlanStop): 'flight' | 'ride' | null {
  if (s.type === 'flight') {
    return phaseOf(s) === 'departure' || (isOwn(s) && phaseOf(s) !== 'arrival' && stopDuration(s) > 0) ? 'flight' : null;
  }
  if (!isOwn(s)) {
    return s.type === 'transport' && phaseOf(s) === 'departure' && !ROAD_BOOKINGS.has(modeOf(s)) && modeOf(s) !== 'parking'
      ? 'ride' : null;
  }
  return s.type === 'transport' || s.type === 'transfer' ? 'ride' : null;
}

/** A booked taxi or car, pinned where it drops you: getting to its pin is the ride */
const ridesInto = (s: PlanStop) => !isOwn(s) && phaseOf(s) === 'departure' && ROAD_BOOKINGS.has(modeOf(s));

/** Somewhere you have to reach in time to leave from */
const departurePoint = (s: PlanStop | null) => !!s && phaseOf(s) !== 'arrival' && modeOf(s) !== 'parking' && (
  s.type === 'checkin' || s.type === 'flight' || s.type === 'transport' || s.type === 'transfer');

/** Where a booked journey drops you */
const arrivalPoint = (s: PlanStop | null) => !!s && phaseOf(s) === 'arrival' && modeOf(s) !== 'parking';

// What to call the place a stop is at, when no stay or venue there names it
function placeName(s: PlanStop): string {
  if (s.type === 'flight' || s.type === 'checkin') {
    const where = clean(s.address) || clean(s.locationName);
    if (where) return AIRPORT.test(where) ? where : `${where} airport`;
  }
  if (JOURNEY_TYPES.has(s.type)) return clean(s.address) || clean(s.locationName) || clean(s.name) || 'Unnamed place';
  return clean(s.locationName) || clean(s.name) || clean(s.address) || 'Unnamed place';
}

// ─── One page ─────────────────────────────────────────────────────────────────
export function buildDayPlan<S extends PlanStop>(pageStops: S[], opts: {
  date:      string;
  stays:     Stay[];
  home?:     Home | null;
  /** Booked venues — a pin at one is called by its name */
  named?:    NamedPlace[];
  firstDay?: boolean;
  lastDay?:  boolean;
}): DayPlan<S> {
  const { date, stays, home = null, named = [], firstDay = false, lastDay = false } = opts;
  const attended = pageStops.filter(s => !s.skipped);
  const timed    = attended.filter(s => pageStart(s) !== null);
  const untimed  = attended.filter(s => pageStart(s) === null);

  const places: Place[] = [];
  const placeAt = (c: LatLng, name: string, address?: string): Place => {
    const near = places.find(p => distanceKm(p.coordinates, c) <= SAME_PLACE_KM);
    if (near) return near;
    const stay  = stays.find(st => isPinned(st.coordinates) && distanceKm(st.coordinates, c) <= SAME_PLACE_KM);
    const venue = stay ? null : named.find(v => distanceKm(v.coordinates, c) <= SAME_PLACE_KM);
    const p: Place = stay
      ? { key: pointKey(stay.coordinates!), name: stay.name, address: stay.address, coordinates: stay.coordinates!, kind: 'stay' }
      : { key: pointKey(c), name: venue?.name || name, address: venue?.address ?? address, coordinates: c, kind: 'stop' };
    places.push(p);
    return p;
  };
  const homeAt = (h: Home): Place => {
    const p = placeAt(h.coordinates, h.name);
    p.kind = 'home';
    p.name = h.name;
    return p;
  };
  const stopPlace = (s: S) => (isPinned(s.coordinates) ? placeAt(s.coordinates, placeName(s), s.address) : null);

  // Home counts only when it's within driving reach of where the day starts or ends
  const firstPin = [...timed].sort((a, b) => pageStart(a)! - pageStart(b)!).find(s => isPinned(s.coordinates))?.coordinates ?? null;
  const reach = (c: LatLng | null | undefined) => (home && c && distanceKm(home.coordinates, c) <= HOME_REACH_KM ? home : null);

  // Where you woke up: last night's stay, else home on the trip's first day
  const slept = stays.find(st => isPinned(st.coordinates) && st.checkIn < date && date <= st.checkOut);
  const startHome = !slept && firstDay ? reach(firstPin) : null;
  const startAt = slept ? placeAt(slept.coordinates!, slept.name, slept.address) : startHome ? homeAt(startHome) : null;

  let n = 0;
  const groups: Group<S>[] = clusterByTime(timed, pageStart).map(stops => {
    const ps: Place[] = [];
    for (const s of stops) {
      const p = stopPlace(s);
      if (p && !ps.includes(p)) ps.push(p);
    }
    return {
      n:      ps.length ? ++n : 0,
      start:  Math.min(...stops.map(s => pageStart(s)!)),
      end:    Math.max(...stops.map(pageEnd)),
      stops,
      places: ps,
    };
  });

  // Where a group is entered or left — null when several places start (or finish) together
  const edge = (g: Group<S>, which: 'enter' | 'exit') => {
    const pinned = g.stops.filter(s => isPinned(s.coordinates));
    if (!pinned.length) return null;
    const timeOf = (s: S) => (which === 'enter' ? pageStart(s)! : pageEnd(s));
    const at     = which === 'enter' ? Math.min(...pinned.map(timeOf)) : Math.max(...pinned.map(timeOf));
    const there  = pinned.filter(s => timeOf(s) === at);
    const ps     = new Set(there.map(s => stopPlace(s)!));
    if (ps.size !== 1) return null;
    return { place: [...ps][0], stop: which === 'enter' ? there[0] : there[there.length - 1] };
  };

  type Cursor = { place: Place; stop: S | null; end: number | null; off: boolean };   // off: just got off a ride of your own
  const steps: Step<S>[] = [];
  const legs:  Leg<S>[]  = [];

  const addLeg = (c: Cursor, to: Place, toStop: S | null, anchor: Leg<S>['anchor']) => {
    const journey = c.stop && !c.off ? journeyFrom(c.stop) : null;
    const ride    = journey ? c.stop : toStop && ridesInto(toStop) ? toStop : null;
    const kind: LegKind = journey ?? (ride ? 'ride' : 'move');
    const homeLeg = c.place.kind === 'home' || to.kind === 'home';
    const leg: Leg<S> = {
      id: '', kind, from: c.place, to, fromStop: c.stop, toStop, ride,
      leaveAfter: ride ? pageStart(ride) : c.end,
      arriveBy:   ride ? pageEnd(ride) : toStop ? pageStart(toStop) : null,
      transfer:   kind === 'move' && !homeLeg && (departurePoint(toStop) || c.off || arrivalPoint(c.stop)),
      anchor,
      pair:       pairKey(c.place.coordinates, to.coordinates),
    };
    leg.id = `${leg.pair}@${leg.leaveAfter ?? leg.arriveBy ?? ''}`;
    legs.push(leg);
    steps.push({ kind: 'leg', leg });
  };

  if (startAt) steps.push({ kind: 'anchor', at: 'start', place: startAt });
  let cursor: Cursor | null = startAt ? { place: startAt, stop: null, end: null, off: false } : null;

  for (const g of groups) {
    if (!g.places.length) { steps.push({ kind: 'group', group: g }); continue; }
    const enter = edge(g, 'enter');
    if (cursor && enter && enter.place !== cursor.place) {
      addLeg(cursor, enter.place, enter.stop, cursor.stop ? null : 'start');
    }
    steps.push({ kind: 'group', group: g });

    const exit = edge(g, 'exit');
    cursor = exit ? { place: exit.place, stop: exit.stop, end: pageEnd(exit.stop), off: false } : null;
    // A transport stop of your own that says where it goes: the ride, then on from there
    const dest = exit && isOwn(exit.stop) && journeyFrom(exit.stop) === 'ride' ? exit.stop.to : null;
    if (cursor && exit && dest && isPinned(dest.coordinates)) {
      const there = placeAt(dest.coordinates, clean(dest.name) || clean(dest.address) || 'Destination', dest.address);
      if (there !== exit.place) addLeg(cursor, there, null, null);
      cursor = { place: there, stop: exit.stop, end: pageEnd(exit.stop), off: true };
    }
  }

  // Where you sleep: tonight's stay, else home on the trip's last day. Not after
  // setting off on a booked journey that lands somewhere else.
  const sleeps  = stays.find(st => isPinned(st.coordinates) && st.checkIn <= date && date < st.checkOut);
  const endHome = !sleeps && lastDay ? reach(cursor?.place.coordinates) : null;
  const endAt   = sleeps ? placeAt(sleeps.coordinates!, sleeps.name, sleeps.address) : endHome ? homeAt(endHome) : null;
  const awayOn  = !!cursor?.stop && !cursor.off && (journeyFrom(cursor.stop) === 'flight' || (!isOwn(cursor.stop) && journeyFrom(cursor.stop) === 'ride'));
  if (cursor && endAt && cursor.place !== endAt && !awayOn) {
    addLeg(cursor, endAt, null, 'end');
    steps.push({ kind: 'anchor', at: 'end', place: endAt });
  }

  // A start you never leave from (the day's first place is your stay) isn't a step
  const leavesStart = legs.some(l => l.anchor === 'start');
  return {
    date,
    steps:   leavesStart ? steps : steps.filter(s => !(s.kind === 'anchor' && s.at === 'start')),
    groups,
    legs,
    untimed,
    startAt: leavesStart ? startAt : null,
    endAt:   legs.some(l => l.anchor === 'end') ? endAt : null,
  };
}

// ─── The whole trip ───────────────────────────────────────────────────────────
/** Each day's page (a night keeps its after-midnight stops), planned */
export function buildTripPlans<S extends PlanStop>(
  days:  Array<{ date: string; stops: S[] }>,
  stays: Stay[],
  home:  Home | null,
  named: NamedPlace[] = [],
): DayPlan<S>[] {
  const pages = nightPages(days.map(d => ({ ...d, stops: d.stops ?? [] })));
  return days.map((d, i) => buildDayPlan(
    pages[i].stops.map(s => (pages[i].late.has(s) ? { ...s, afterMidnight: true } : s)),
    { date: ymd(d.date), stays, home, named, firstDay: i === 0, lastDay: i === days.length - 1 },
  ));
}

/** The walks and drives these plans need looked up, each pair of points once */
export function routePairs(plans: DayPlan<unknown>[]): Array<{ key: string; from: LatLng; to: LatLng }> {
  const pairs = new Map<string, { key: string; from: LatLng; to: LatLng }>();
  for (const p of plans) {
    for (const l of p.legs) {
      if (l.kind === 'move' && !pairs.has(l.pair)) pairs.set(l.pair, { key: l.pair, from: l.from.coordinates, to: l.to.coordinates });
    }
  }
  return [...pairs.values()];
}

/** A leg that gets you between places rather than around one: journeys, transfers, home, over 25 km */
export function isJourney(leg: Leg<unknown>): boolean {
  return leg.kind !== 'move' || leg.transfer || leg.from.kind === 'home' || leg.to.kind === 'home'
    || distanceKm(leg.from.coordinates, leg.to.coordinates) > 25;
}

/** What "I've sorted this" is remembered by: the day and the two places */
export const gapKey = (date: string, leg: Leg<unknown>) => `${date}|${leg.pair}`;

// ─── Times ────────────────────────────────────────────────────────────────────
export interface RouteInfo { minutes: number; metres: number; line: string | null }
/** null: no route that way, or not asked (too far to walk, too near to drive) */
export interface LegRoutes { walk: RouteInfo | null; drive: RouteInfo | null }

/** A walk this long or less is how you'd go */
export const WALKABLE_MIN = 25;

export interface Travel {
  mode:      'walk' | 'drive' | 'flight' | 'ride' | null;   // null: not known yet
  minutes:   number | null;
  alt:       { mode: 'walk' | 'drive'; minutes: number } | null;
  line:      string | null;
  /** Looked up — false offline or before the answer comes */
  known:     boolean;
  /** A transfer you can't walk */
  needsPlan: boolean;
  /** Minutes short of the time between the two stops */
  late:      number | null;
  tight:     boolean;
  /** When to set off to arrive on time (page minutes) */
  leaveBy:   number | null;
}

export function legTravel(leg: Leg<PlanStop>, routes: Record<string, LegRoutes> | null): Travel {
  if (leg.kind !== 'move') {
    const mins = leg.ride ? stopDuration(leg.ride) : 0;
    return {
      mode: leg.kind, minutes: mins > 0 ? mins : null, alt: null, line: null, known: true,
      needsPlan: false, late: null, tight: false, leaveBy: leg.ride ? pageStart(leg.ride) : null,
    };
  }
  const r = routes?.[leg.pair];
  if (!r) {
    return { mode: null, minutes: null, alt: null, line: null, known: false, needsPlan: false, late: null, tight: false, leaveBy: null };
  }
  const { walk, drive } = r;
  const walkable = !!walk && walk.minutes <= WALKABLE_MIN;
  const primary  = walkable ? walk : drive ?? walk;
  const mode     = !primary ? null : primary === walk ? 'walk' : 'drive';
  const alt: Travel['alt'] =
      mode === 'walk'  && drive && walk!.minutes >= 12 ? { mode: 'drive', minutes: drive.minutes }
    : mode === 'drive' && walk  && walk.minutes  <= 45 ? { mode: 'walk',  minutes: walk.minutes }
    : null;
  const minutes = primary?.minutes ?? null;
  const spare   = minutes !== null && leg.leaveAfter !== null && leg.arriveBy !== null
    ? leg.arriveBy - leg.leaveAfter - minutes
    : null;
  return {
    mode, minutes, alt, line: primary?.line ?? null, known: true,
    needsPlan: leg.transfer && !walkable,
    late:      spare !== null && spare < 0 ? -spare : null,
    tight:     spare !== null && spare >= 0 && spare <= 10,
    leaveBy:   minutes !== null && leg.arriveBy !== null ? leg.arriveBy - minutes : null,
  };
}
