import { DAY_START_HOUR, DAY_END_HOUR, SNAP_MINS } from './Itinerary.config';
import type { Day, Stop } from './Itinerary.config';
import { clockMinutes, stopDuration, eveningEnd, carriesOn, nightPages, DAY_MINS } from '@/lib/itinerary/nights';

export { stopDuration };

// Minutes after the viewed day's midnight — a stop shown after midnight on the
// day before's page runs on past 24:00 (00:30 → 24:30).
export function stopStartMinutes(stop: Stop): number | null {
  const m = clockMinutes(stop);
  return m !== null && stop.afterMidnight ? m + DAY_MINS : m;
}

// What each day's page shows: its own stops, then the night's after-midnight
// ones (as afterMidnight copies); movedBack = its stops shown the night before.
export function dayPages(days: Day[]): Array<{ stops: Stop[]; movedBack: Stop[] }> {
  return nightPages(days).map(p => ({
    stops:     p.stops.map(s => (p.late.has(s) ? { ...s, afterMidnight: true } : s)),
    movedBack: p.movedBack,
  }));
}

// Default for an early-hours time on a page: after midnight when it would carry
// on the evening those stops make up
export function carriesOnPage(pageStops: Stop[], startMin: number): boolean {
  return carriesOn(eveningEnd(pageStops, s => stopStartMinutes(s as Stop)), startMin);
}

// Offset from startHour in pixels (defaults to DAY_START_HOUR)
export function minutesToPx(minutes: number, pxPerMin: number, startHour = DAY_START_HOUR): number {
  return (minutes - startHour * 60) * pxPerMin;
}

// Zero-padded HH:MM on the clock — 24:30 on a page reads 00:30
export function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Returns free slots ≥15min between placed stops and end of day
export function freeSlots(stops: Stop[]): { start: number; end: number; mins: number }[] {
  const placed = stops
    .map(s => ({ start: stopStartMinutes(s), dur: stopDuration(s) }))
    .filter(s => s.start !== null)
    .map(s => ({ start: s.start!, end: s.start! + s.dur }))
    .sort((a, b) => a.start - b.start);

  const slots: { start: number; end: number; mins: number }[] = [];
  let cursor = DAY_START_HOUR * 60;

  for (const block of placed) {
    if (block.start > cursor + 15) {
      slots.push({ start: cursor, end: block.start, mins: block.start - cursor });
    }
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < DAY_END_HOUR * 60 - 15) {
    slots.push({ start: cursor, end: DAY_END_HOUR * 60, mins: DAY_END_HOUR * 60 - cursor });
  }
  return slots;
}

export function totalFreeMinutes(stops: Stop[]): number {
  return freeSlots(stops).reduce((s, f) => s + f.mins, 0);
}

// Human-readable free time label: "2h 30m free" or "45m free"
export function freeLabelText(stops: Stop[]): string {
  const free  = totalFreeMinutes(stops);
  const freeH = Math.floor(free / 60);
  const freeM = free % 60;
  return freeH > 0 ? `${freeH}h${freeM > 0 ? ` ${freeM}m` : ''} free` : `${freeM}m free`;
}

// Column layout for overlapping stops (calendar-style).
// Stops that transitively overlap form a cluster; every stop in a cluster shares
// the same column count, so neighbours never disagree about widths and cover
// each other. Each stop then widens rightwards across columns that are free for
// its whole duration (`span`). `minMins` is the visual minimum height in minutes
// — short blocks render taller than their duration and must reserve that space.
export function computeStopColumns(
  stops: Stop[],
  minMins = 0,
): Array<{ col: number; totalCols: number; span: number }> {
  const n = stops.length;
  const intervals = stops.map(stop => {
    const start = stopStartMinutes(stop) ?? 0;
    return { start, end: start + Math.max(stopDuration(stop), minMins, 1) };
  });
  const overlaps = (a: number, b: number) =>
    intervals[a].start < intervals[b].end && intervals[b].start < intervals[a].end;

  // Earlier first; on ties the longer stop takes the left column
  const order = [...Array(n).keys()].sort((a, b) =>
    intervals[a].start - intervals[b].start || intervals[b].end - intervals[a].end,
  );

  const result = new Array<{ col: number; totalCols: number; span: number }>(n);
  let cluster: number[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const totalCols = colEnds.length;
    for (const i of cluster) {
      let span = 1;
      for (let c = result[i].col + 1; c < totalCols; c++) {
        if (cluster.some(j => result[j].col === c && overlaps(i, j))) break;
        span++;
      }
      result[i].totalCols = totalCols;
      result[i].span      = span;
    }
    cluster = []; colEnds = [];
  };

  for (const i of order) {
    if (intervals[i].start >= clusterEnd) flush();
    const freeCol = colEnds.findIndex(end => end <= intervals[i].start);
    const col     = freeCol >= 0 ? freeCol : colEnds.length;
    colEnds[col]  = intervals[i].end;
    result[i]     = { col, totalCols: 1, span: 1 };
    cluster.push(i);
    clusterEnd = cluster.length === 1 ? intervals[i].end : Math.max(clusterEnd, intervals[i].end);
  }
  flush();
  return result;
}

// A stop with no usable start time (e.g. a venue known only by its date) lives
// in the all-day strip above the timeline rather than as a block on it.
export function isUntimed(stop: Stop): boolean {
  return stopStartMinutes(stop) === null;
}

// Snapped drag preview position, kept within where the stop may start
export function snappedPreviewMinutes(
  startMin: number,
  transformY: number,
  pxPerMin: number,
  bounds: { min: number; max: number },
): number {
  return Math.max(
    bounds.min,
    Math.min(
      bounds.max,
      startMin + Math.round((transformY / pxPerMin) / SNAP_MINS) * SNAP_MINS,
    ),
  );
}
// "1h 30m" / "45m"
export function fmtDuration(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

// "11:00–12:45", or just "11:00" for an instant marker
export function timeRangeLabel(stop: Stop): string {
  const start = stopStartMinutes(stop);
  if (start === null) return 'All day';
  const dur = stopDuration(stop);
  return dur > 0 ? `${formatTime(start)}–${formatTime(start + dur)}` : formatTime(start);
}

// Timed stops grouped into runs that overlap each other (transitively), in time
// order — "3 things at once" reads as one group in the list view.
export function overlapClusters(stops: Stop[]): Stop[][] {
  const timed = stops
    .map(s => ({ s, start: stopStartMinutes(s) }))
    .filter((x): x is { s: Stop; start: number } => x.start !== null)
    .sort((a, b) => a.start - b.start || stopDuration(b.s) - stopDuration(a.s));
  const clusters: Stop[][] = [];
  let end = -Infinity;
  for (const { s, start } of timed) {
    if (start >= end || !clusters.length) { clusters.push([s]); end = start + Math.max(stopDuration(s), 1); }
    else { clusters[clusters.length - 1].push(s); end = Math.max(end, start + Math.max(stopDuration(s), 1)); }
  }
  return clusters;
}

// Other timed stops that overlap this one
export function concurrentWith(stop: Stop, stops: Stop[]): Stop[] {
  const start = stopStartMinutes(stop);
  if (start === null) return [];
  const end = start + Math.max(stopDuration(stop), 1);
  return stops.filter(o => {
    if (o === stop || (o._id && o._id === stop._id)) return false;
    const os = stopStartMinutes(o);
    if (os === null) return false;
    return os < end && start < os + Math.max(stopDuration(o), 1);
  }).sort((a, b) => (stopStartMinutes(a) ?? 0) - (stopStartMinutes(b) ?? 0));
}

// Where a note can be kept: any saved stop, and a booking's stops when the sync
// can match them back to the booking (a layover between flights can't be)
export function canNote(stop: Stop): boolean {
  if (!stop._id) return false;
  return stop.source !== 'logistics' || (!!stop.logisticsRef && !!stop.metadata?.phase);
}

// Before a stop starts, "Not going"; after, "Didn't go" — the same flag
export function skipLabel(stop: Stop, started: boolean): string {
  return started ? (stop.skipped ? 'I went' : 'Didn’t go') : (stop.skipped ? 'Going after all' : 'Not going');
}

// What "Not going" can apply to: anything except travel and hotel bookings
export function canSkip(stop: Stop): boolean {
  if (stop.source !== 'logistics') return !!stop._id;
  return !['flight', 'transport', 'transfer', 'checkin', 'hotel'].includes(stop.type);
}
