// Shared "when do I actually check in" logic — used both by the itinerary sync
// (which writes the real stop) and by Smart Extract (which previews it).
//
// Rule: you can't check in before the property opens, and you can't check in
// before you've landed. So: start from the property's stated earliest check-in
// (or 15:00), then push to ~90 min after any flight/train that arrives that day.

export const AFTER_LANDING_BUFFER_MIN = 90;

export interface CheckInResolution {
  time:         string;   // "HH:MM"
  source:       'arrival' | 'property' | 'default';
  arrivalTime?: string;   // "HH:MM" of the inbound trip, when source === 'arrival'
}

// "15:00" / "15:00:00" / "from 3:00 PM" / "Check-in: 15:00" → "15:00"; junk → null
export function normaliseTime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/^((from|after|check[\s-]?in|check[\s-]?out)[:\s-]*)+/i, '');
  const m = cleaned.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3]?.toLowerCase();
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// Parse a floating timestamp string ("2026-09-23T20:25" / "...T20:25:00") without
// any timezone conversion — the value is already destination-local wall-clock.
function parseFloating(s: unknown): { date: string; minutes: number } | null {
  const m = String(s ?? '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { date: m[1], minutes: parseInt(m[2], 10) * 60 + parseInt(m[3], 10) };
}

const fmt = (mins: number) =>
  `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export function resolveCheckIn(opts: {
  checkInDate:          string;                       // "YYYY-MM-DD"
  propertyCheckInTime?: string | null;               // from the booking ("from 15:00")
  arrivals?:            Array<string | Date | null>;  // transport arrivalTime values
}): CheckInResolution {
  const floor = normaliseTime(opts.propertyCheckInTime) ?? '15:00';
  let time: string = floor;
  let source: CheckInResolution['source'] = normaliseTime(opts.propertyCheckInTime) ? 'property' : 'default';
  let arrivalTime: string | undefined;

  const sameDay = (opts.arrivals ?? [])
    .map(a => (a instanceof Date ? { date: a.toISOString().split('T')[0], minutes: a.getHours() * 60 + a.getMinutes() } : parseFloating(a)))
    .filter((p): p is { date: string; minutes: number } => !!p && p.date === opts.checkInDate)
    .sort((x, y) => y.minutes - x.minutes)[0];

  if (sameDay) {
    const afterLanding = sameDay.minutes + AFTER_LANDING_BUFFER_MIN;
    const candidate = afterLanding >= 24 * 60 ? sameDay.minutes : afterLanding; // very late arrival: check in on arrival
    const hhmm = fmt(candidate);
    if (hhmm > time) {
      time = hhmm;
      source = 'arrival';
      arrivalTime = fmt(sameDay.minutes);
    }
  }

  return { time, source, arrivalTime };
}

export function checkInHint(res: CheckInResolution): string {
  if (res.source === 'arrival') return `check-in ≈ ${res.time} · after your ${res.arrivalTime} arrival`;
  if (res.source === 'property') return `check-in from ${res.time}`;
  return `check-in ≈ ${res.time}`;
}
