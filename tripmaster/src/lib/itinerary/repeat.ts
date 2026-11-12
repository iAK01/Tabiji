// Repeating a stop on other days: an independent copy on each, same time of day.
// Shared by the itinerary (shown at once) and the server (saved), so both agree.

/** What a repeat takes with it: what it is, where and when — not your note on it,
 *  whether you went, or anything tying it to a booking or an import. */
const KEEP = [
  'name', 'type', 'address', 'locationName', 'coordinates', 'duration', 'notes',
  'icon', 'notificationLeadMins', 'lateNight', 'highlight', 'time',
] as const;

const ymd = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);

function shiftYmd(date: string, n: number): string {
  return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n)).toISOString().slice(0, 10);
}

// "2026-11-16T10:40:00" moved n days, same clock time; anything else as it was
const shiftStamp = (s: unknown, n: number) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(s) ? shiftYmd(s, n) + s.slice(10) : s;

const sameName = (a: any, b: any) =>
  String(a?.name ?? '').trim().toLowerCase() === String(b?.name ?? '').trim().toLowerCase();

interface DayLike { date: string | Date; stops?: any[] }

/** Where the stop is stored, or null. */
function locate(days: DayLike[], stopId: string): { dayIdx: number; stop: any } | null {
  for (let i = 0; i < days.length; i++) {
    const stop = (days[i].stops ?? []).find((s: any) => String(s?._id ?? '') === stopId);
    if (stop) return { dayIdx: i, stop };
  }
  return null;
}

export type RepeatStatus = 'this' | 'there' | 'none' | 'free';

/** For each day `offset` days from the stop's: is it the stop's own day, already has it,
 *  isn't in the trip, or can take a copy. */
export function repeatStatus(days: DayLike[], stopId: string, offset: number): RepeatStatus {
  if (offset === 0) return 'this';
  const at = locate(days, stopId);
  if (!at) return 'none';
  const target = shiftYmd(ymd(days[at.dayIdx].date), offset);
  const day    = days.find(d => ymd(d.date) === target);
  if (!day) return 'none';
  const start  = shiftStamp(at.stop.scheduledStart, offset);
  const there  = (day.stops ?? []).some((s: any) => sameName(s, at.stop) && (s.scheduledStart ?? null) === (start ?? null));
  return there ? 'there' : 'free';
}

/** The days with a copy of the stop on each day `offsets` away that doesn't have one yet. */
export function repeatStop<D extends DayLike>(
  days:    D[],
  stopId:  string,
  offsets: number[],
  newId:   () => unknown,
): { days: D[]; added: number } {
  const at = locate(days, stopId);
  if (!at) return { days, added: 0 };
  const from = ymd(days[at.dayIdx].date);

  const out = days.map(d => ({ ...d, stops: [...(d.stops ?? [])] }));
  let added = 0;
  for (const n of new Set(offsets)) {
    if (repeatStatus(out, stopId, n) !== 'free') continue;
    const target = shiftYmd(from, n);
    const day    = out.find(d => ymd(d.date) === target)!;

    const copy: any = {};
    for (const k of KEEP) if (at.stop[k] !== undefined) copy[k] = at.stop[k];
    const id = newId();
    if (id !== undefined) copy._id = id;
    copy.completed = false;
    if (at.stop.scheduledStart) copy.scheduledStart = shiftStamp(at.stop.scheduledStart, n);
    if (at.stop.scheduledEnd)   copy.scheduledEnd   = shiftStamp(at.stop.scheduledEnd, n);

    // In time order; untimed ones go at the end
    const i = copy.scheduledStart
      ? day.stops.findIndex((s: any) => typeof s.scheduledStart === 'string' && s.scheduledStart > copy.scheduledStart)
      : -1;
    if (i === -1) day.stops.push(copy); else day.stops.splice(i, 0, copy);
    added++;
  }
  return { days: out as D[], added };
}