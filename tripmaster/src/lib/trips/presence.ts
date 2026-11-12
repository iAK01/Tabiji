// When you're actually at the destination, as opposed to the trip's dates.
//
// Trip dates cover everything — the evening drive to Dublin and a night in the
// van before an early flight, the trip home after landing. The days at the
// destination run from the day the journey out arrives to the day the journey
// home leaves. With no journeys booked, from the first night at a stay there to
// its check-out. Nothing booked yet: the whole trip. The traveller can set it.
// The days either side are travel days.
//
// Shared by the server (weather) and the app (header, itinerary).

export interface Presence {
  arrive:       string;     // YYYY-MM-DD — first day at the destination
  leave:        string;     // YYYY-MM-DD — the day you leave it
  nights:       number;     // nights there
  travelBefore: string[];   // trip days before arriving
  travelAfter:  string[];   // trip days after leaving
  source:       'set' | 'journeys' | 'stays' | 'dates';
  auto:         { arrive: string; leave: string };   // what the bookings say, whatever's set
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function ymd(v: unknown): string {
  if (typeof v === 'string') return v.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return '';
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

function datesFrom(from: string, toExclusive: string): string[] {
  const out: string[] = [];
  for (let d = from; d < toExclusive; d = addDays(d, 1)) out.push(d);
  return out;
}

// Wall-clock times in each place's own zone — compared as written, which is
// what a connection is ("lands 07:10, next leg 09:30").
const clock = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? Date.parse(`${v.slice(0, 16)}:00Z`) : NaN);

// A connection, not a day out: the next leg leaves within this long of landing.
const CONNECTION_MS = 12 * 60 * 60 * 1000;

// Bookings that span the trip rather than make a journey.
const NOT_A_JOURNEY = new Set(['parking', 'car_hire']);

interface Leg { dep: number; arr: number; depDate: string; arrDate: string }

function journeyLegs(transportation: any[] | undefined): Leg[] {
  return (transportation ?? [])
    .filter(t => t && t.status !== 'cancelled' && !NOT_A_JOURNEY.has(t.type))
    .map(t => {
      const dep = clock(t.departureTime);
      const arr = clock(t.arrivalTime);
      return { dep, arr: Number.isFinite(arr) ? arr : dep, depDate: ymd(t.departureTime), arrDate: ymd(t.arrivalTime) || ymd(t.departureTime) };
    })
    .filter(l => Number.isFinite(l.dep) && l.depDate)
    .sort((a, b) => a.dep - b.dep);
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const pin = (c: any) => (Number.isFinite(c?.lat) && Number.isFinite(c?.lng) ? { lat: c.lat, lng: c.lng } : null);

/** From the bookings alone: journeys first, then stays. */
function fromBookings(start: string, end: string, logistics: any, nearHome: Array<{ lat: number; lng: number }>): { arrive: string; leave: string; source: Presence['source'] } {
  const legs = journeyLegs(logistics?.transportation);
  if (legs.length) {
    // The journey out: the first leg and every connection after it.
    let out = 0;
    while (out + 1 < legs.length && legs[out + 1].dep - legs[out].arr <= CONNECTION_MS) out++;
    // The journey home: the last leg and every connection before it.
    let back = legs.length - 1;
    while (back - 1 >= 0 && legs[back].dep - legs[back - 1].arr <= CONNECTION_MS) back--;

    if (out < back) return { arrive: legs[out].arrDate, leave: legs[back].depDate, source: 'journeys' };
    // One journey only: out if it's in the first half of the trip, home if in the second.
    const mid = Date.parse(`${start}T00:00:00Z`) + (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 2;
    return legs[0].dep <= mid
      ? { arrive: legs[legs.length - 1].arrDate, leave: end, source: 'journeys' }
      : { arrive: start, leave: legs[0].depDate, source: 'journeys' };
  }

  // A stay near home or the departure point (the night before an early flight) isn't "there".
  const stays = (logistics?.accommodation ?? [])
    .filter((a: any) => a && a.status !== 'cancelled' && ymd(a.checkIn) && ymd(a.checkOut))
    .filter((a: any) => {
      const p = pin(a.coordinates);
      return !p || !nearHome.some(h => km(h, p) <= 30);
    });
  if (stays.length) {
    const arrive = stays.map((a: any) => ymd(a.checkIn)).sort()[0];
    const leave  = stays.map((a: any) => ymd(a.checkOut)).sort().slice(-1)[0];
    return { arrive, leave, source: 'stays' };
  }
  return { arrive: start, leave: end, source: 'dates' };
}

export function tripPresence(
  trip: { startDate: unknown; endDate: unknown; thereFrom?: unknown; thereTo?: unknown; origin?: any },
  logistics: { transportation?: any[]; accommodation?: any[] } | null | undefined,
  home?: { coordinates?: any } | null,
): Presence | null {
  const start = ymd(trip.startDate);
  const end   = ymd(trip.endDate);
  if (!start || !end || end < start) return null;

  const clamp = (d: string) => (d < start ? start : d > end ? end : d);
  const nearHome = [pin(trip.origin?.coordinates), pin(home?.coordinates)].filter(Boolean) as Array<{ lat: number; lng: number }>;

  let auto = fromBookings(start, end, logistics, nearHome);
  auto = { ...auto, arrive: clamp(auto.arrive), leave: clamp(auto.leave) };
  if (auto.arrive > auto.leave) auto = { arrive: start, leave: end, source: 'dates' };

  const setFrom = ymd(trip.thereFrom);
  const setTo   = ymd(trip.thereTo);
  let arrive = auto.arrive, leave = auto.leave, source = auto.source;
  if (setFrom || setTo) {
    arrive = clamp(setFrom || auto.arrive);
    leave  = clamp(setTo || auto.leave);
    source = 'set';
    if (arrive > leave) { arrive = auto.arrive; leave = auto.leave; source = auto.source; }
  }

  return {
    arrive, leave,
    nights:       daysBetween(arrive, leave),
    travelBefore: datesFrom(start, arrive),
    travelAfter:  datesFrom(addDays(leave, 1), addDays(end, 1)),
    source,
    auto:         { arrive: auto.arrive, leave: auto.leave },
  };
}

export function isTravelDay(p: Presence | null | undefined, date: string): boolean {
  if (!p) return false;
  const d = ymd(date);
  return d < p.arrive || d > p.leave;
}

/** "Sat 14" */
export function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "travel day Sat 14" · "travel days Sat 14, Mon 23" — null when there are none. */
export function travelDaysLabel(p: Presence | null | undefined): string | null {
  const days = p ? [...p.travelBefore, ...p.travelAfter].map(shortDate) : [];
  if (!days.length) return null;
  return days.length === 1 ? `travel day ${days[0]}` : `travel days ${days.join(', ')}`;
}
