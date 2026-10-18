// Notification settings — shared by the sender (api/push/notify) and the
// settings UI. Stored on User.preferences.notifications; anything missing or
// malformed falls back to the defaults here.

export type NotificationCategory =
  | 'travel'      // departures, gates, delays, hotel check-in/out
  | 'checkin'     // online check-in opening
  | 'landed'      // arrival into a new city, baggage belt
  | 'briefings'   // evening-before / morning-of
  | 'itinerary'   // itinerary stops and events
  | 'todos'
  | 'expenses';   // proof reminders, end-of-trip nudge

export interface NotificationPrefs {
  categories:    Record<NotificationCategory, boolean>;
  // Local to wherever the traveller is at the time. Holds back what can wait;
  // anything time-critical ignores it (QUIET_EXEMPT).
  quietHours:    { enabled: boolean; start: string; end: string };
  briefingTimes: { morning: string; evening: string };
  mutedTrips:    string[];
}

export const CATEGORY_OPTIONS: Array<{ key: NotificationCategory; label: string }> = [
  { key: 'travel',    label: 'Departures, gates, delays and hotel check-in' },
  { key: 'checkin',   label: 'Online check-in opening' },
  { key: 'landed',    label: 'Arrivals and baggage belts' },
  { key: 'briefings', label: 'Morning and evening briefings' },
  { key: 'itinerary', label: 'Itinerary and events' },
  { key: 'todos',     label: 'To-dos' },
  { key: 'expenses',  label: 'Expense reminders' },
];

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  categories: {
    travel: true, checkin: true, landed: true, briefings: true,
    itinerary: true, todos: true, expenses: true,
  },
  quietHours:    { enabled: true, start: '22:00', end: '07:00' },
  briefingTimes: { morning: '07:30', evening: '19:00' },
  mutedTrips:    [],
};

// These come through during quiet hours: you're on the move, something you
// scheduled is about to start, or it's a briefing at the time you chose. The
// rest (check-in opening, to-dos, expenses) wait until quiet hours end.
export const QUIET_EXEMPT: ReadonlySet<NotificationCategory> = new Set(['travel', 'landed', 'itinerary', 'briefings']);

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function time(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && HHMM.test(raw) ? raw : fallback;
}

export function resolvePrefs(raw: any): NotificationPrefs {
  const d = DEFAULT_NOTIFICATION_PREFS;
  const categories = { ...d.categories };
  for (const { key } of CATEGORY_OPTIONS) {
    if (typeof raw?.categories?.[key] === 'boolean') categories[key] = raw.categories[key];
  }
  return {
    categories,
    quietHours: {
      enabled: typeof raw?.quietHours?.enabled === 'boolean' ? raw.quietHours.enabled : d.quietHours.enabled,
      start:   time(raw?.quietHours?.start, d.quietHours.start),
      end:     time(raw?.quietHours?.end, d.quietHours.end),
    },
    briefingTimes: {
      morning: time(raw?.briefingTimes?.morning, d.briefingTimes.morning),
      evening: time(raw?.briefingTimes?.evening, d.briefingTimes.evening),
    },
    mutedTrips:  Array.isArray(raw?.mutedTrips) ? raw.mutedTrips.map(String) : [],
  };
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Whether a local time of day (minutes since midnight) falls in quiet hours. */
export function inQuietHours(prefs: NotificationPrefs, localMinutes: number): boolean {
  if (!prefs.quietHours.enabled) return false;
  const start = minutesOf(prefs.quietHours.start);
  const end   = minutesOf(prefs.quietHours.end);
  if (start === end) return false;
  return start < end
    ? localMinutes >= start && localMinutes < end
    : localMinutes >= start || localMinutes < end;   // runs past midnight
}
