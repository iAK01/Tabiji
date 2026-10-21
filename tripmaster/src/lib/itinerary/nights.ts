// A festival's Thursday line-up that runs to 02:30 is Thursday night to the
// people going, not the start of Friday. Stops stay stored on their real calendar
// date (reminders, exports and the on-trip screens all read that); this decides
// which day's page an early-hours stop is shown on.
//
// A stop starting before NIGHT_ENDS_MIN belongs to the night before when the
// traveller put it there (`lateNight: true`), or — left to the default — when it
// carries on that evening: it starts within NIGHT_GAP_MIN of the evening's last
// stop ending. `lateNight: false` keeps it on its own date's morning. Booking
// stops (source 'logistics') keep their own date unless marked: a ticket's date
// is the one that has to be right, and a check-in mustn't split from its flight.

export const DAY_MINS       = 24 * 60;
export const NIGHT_ENDS_MIN = 6 * 60;
export const NIGHT_GAP_MIN  = 4 * 60;

export interface NightStop {
  scheduledStart?: string;
  scheduledEnd?:   string;
  time?:           string;
  duration?:       number;
  source?:         string;
  lateNight?:      boolean | null;
}

// Minutes after the stop's own midnight. Handles both ISO timestamp (with T) and
// bare HH:MM, plus fallback stop.time. Malformed values (e.g. "2026-10-22T:00"
// from an empty venue time) → null, not midnight.
export function clockMinutes(stop: NightStop): number | null {
  const timeStr = stop.scheduledStart
    ? stop.scheduledStart.includes('T')
      ? stop.scheduledStart.split('T')[1]
      : stop.scheduledStart
    : stop.time;
  const m = timeStr?.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Prefer explicit duration, then derive from scheduledEnd - scheduledStart, fallback 60
export function stopDuration(stop: NightStop): number {
  if (typeof stop.duration === 'number' && stop.duration > 0) return stop.duration;
  if (stop.scheduledEnd && stop.scheduledStart) {
    const parse = (s: string) => {
      const t = s.includes('T') ? s.split('T')[1]?.slice(0, 5) : s;
      if (!t) return null;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const start = parse(stop.scheduledStart);
    const end   = parse(stop.scheduledEnd);
    if (start !== null && end !== null && end > start) return end - start;
  }
  // Explicit 0 = instant marker (arrival stop), not a missing value
  if (stop.duration === 0) return 0;
  return 60;
}

const ymd = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);

// Whole calendar days from one YYYY-MM-DD to another
export function daysBetween(from: string, to: string): number {
  const utc = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((utc(ymd(to)) - utc(ymd(from))) / 86_400_000);
}

// When the last of these stops finishes, in minutes after the day's midnight
// (past DAY_MINS when it runs on beyond it)
export function eveningEnd(stops: NightStop[], startOf: (s: NightStop) => number | null = clockMinutes): number {
  let end = -Infinity;
  for (const s of stops) {
    const m = startOf(s);
    if (m !== null) end = Math.max(end, m + stopDuration(s));
  }
  return end;
}

// Would a stop starting `startMin` after midnight carry on a night ending at `end`?
export function carriesOn(end: number, startMin: number): boolean {
  return startMin < NIGHT_ENDS_MIN && DAY_MINS + startMin - end <= NIGHT_GAP_MIN;
}

// Into a day's stops in time order (untimed ones stay where they are)
export function insertByTime<S extends { scheduledStart?: string }>(stops: S[], stop: S): S[] {
  const at = stop.scheduledStart
    ? stops.findIndex(s => typeof s.scheduledStart === 'string' && s.scheduledStart > stop.scheduledStart!)
    : -1;
  return at === -1 ? [...stops, stop] : [...stops.slice(0, at), stop, ...stops.slice(at)];
}

export interface NightPage<S> {
  stops:     S[];      // the page: the date's own stops, then the night's after-midnight ones
  late:      Set<S>;   // which of `stops` are from after midnight (the next date)
  movedBack: S[];      // this date's early-hours stops, shown with the night before
}

// One page per itinerary day. Days are stored in date order, one per date.
export function nightPages<S extends NightStop>(days: Array<{ date: string; stops: S[] }>): NightPage<S>[] {
  const back = days.map(() => new Set<S>());
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i - 1].date, days[i].date) !== 1) continue;
    let end = eveningEnd((days[i - 1].stops ?? []).filter(s => !back[i - 1].has(s)));
    const early = (days[i].stops ?? [])
      .map(s => ({ s, m: clockMinutes(s) }))
      .filter((x): x is { s: S; m: number } => x.m !== null && x.m < NIGHT_ENDS_MIN)
      .sort((a, b) => a.m - b.m);
    for (const { s, m } of early) {
      if (!(s.lateNight ?? (s.source !== 'logistics' && carriesOn(end, m)))) continue;
      back[i].add(s);
      end = Math.max(end, DAY_MINS + m + stopDuration(s));
    }
  }
  return days.map((d, i) => {
    const late = new Set((days[i + 1]?.stops ?? []).filter(s => back[i + 1].has(s)));
    return {
      stops:     [...(d.stops ?? []).filter(s => !back[i].has(s)), ...late],
      late,
      movedBack: (d.stops ?? []).filter(s => back[i].has(s)),
    };
  });
}
