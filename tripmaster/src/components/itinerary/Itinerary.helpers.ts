import { DAY_START_HOUR, DAY_END_HOUR, SNAP_MINS } from './Itinerary.config';
import type { Stop } from './Itinerary.config';

// Handles both ISO timestamp (with T) and bare HH:MM, plus fallback stop.time
export function stopStartMinutes(stop: Stop): number | null {
  const timeStr = stop.scheduledStart
    ? stop.scheduledStart.includes('T')
      ? stop.scheduledStart.split('T')[1]?.slice(0, 5)
      : stop.scheduledStart
    : stop.time;
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Prefer explicit duration, then derive from scheduledEnd - scheduledStart, fallback 60
export function stopDuration(stop: Stop): number {
  if (stop.duration && stop.duration > 0) return stop.duration;
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
  return 60;
}

// Offset from DAY_START_HOUR in pixels
export function minutesToPx(minutes: number, pxPerMin: number): number {
  return (minutes - DAY_START_HOUR * 60) * pxPerMin;
}

// Zero-padded HH:MM
export function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
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

// Column layout for overlapping stops
// Returns per-stop { col, totalCols } so the timeline can render them side-by-side.
export function computeStopColumns(stops: Stop[]): Array<{ col: number; totalCols: number }> {
  const n = stops.length;
  const intervals = stops.map(stop => {
    const start = stopStartMinutes(stop) ?? 0;
    return { start, end: start + Math.max(stopDuration(stop), 1) };
  });

  // Greedy column assignment: each stop takes the first column whose last occupant has ended
  const cols = new Array<number>(n).fill(0);
  const colEnds: number[] = [];
  const byStart = [...Array(n).keys()].sort((a, b) => intervals[a].start - intervals[b].start);

  for (const i of byStart) {
    const freeCol = colEnds.findIndex(end => end <= intervals[i].start);
    const col     = freeCol >= 0 ? freeCol : colEnds.length;
    cols[i] = col;
    if (freeCol >= 0) colEnds[freeCol] = intervals[i].end;
    else colEnds.push(intervals[i].end);
  }

  // totalCols for each stop = 1 + max column index among all stops that overlap with it
  return intervals.map((iv, i) => {
    let maxCol = 0;
    for (let j = 0; j < n; j++) {
      if (intervals[j].start < iv.end && intervals[j].end > iv.start) {
        maxCol = Math.max(maxCol, cols[j]);
      }
    }
    return { col: cols[i], totalCols: maxCol + 1 };
  });
}

// Snapped drag preview position
export function snappedPreviewMinutes(
  startMin: number,
  duration: number,
  transformY: number,
  pxPerMin: number,
): number {
  return Math.max(
    DAY_START_HOUR * 60,
    Math.min(
      DAY_END_HOUR * 60 - duration,
      startMin + Math.round((transformY / pxPerMin) / SNAP_MINS) * SNAP_MINS,
    ),
  );
}