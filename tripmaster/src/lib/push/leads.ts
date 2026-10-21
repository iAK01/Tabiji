// How long before something its reminder arrives (minutes), and how booking
// reminders group for switching them off. Shared by the planner
// (lib/push/plan.ts) and the itinerary, which shows and changes them per stop.

export const LEAD_MIN: Record<string, number> = {
  train: 60, ferry: 120, bus: 45,
  car_hire: 30, taxi: 20, private_transfer: 20,
  hotel: 60, activity: 45, sightseeing: 45, meal: 30, breakfast: 30,
  meeting: 45, work: 45, other: 30, concert: 60, conference: 60,
  restaurant: 30, event: 45, sport: 60, sports: 60, attraction: 45, business: 45,
};
export const DEFAULT_LEAD_MIN = 30;

/** The built-in lead for a kind of stop. */
export function defaultLeadMins(type: string | undefined): number {
  return (type && LEAD_MIN[type]) || DEFAULT_LEAD_MIN;
}

/** The lead times on offer (minutes). */
export const LEAD_CHOICES = [5, 15, 30, 45, 60, 120];

/** A trip's setting for every stop on it: a lead, or 'off'. Unset → your overall default. */
export type TripLead = number | 'off';

export function parseTripLead(v: unknown): TripLead | null {
  if (v === 'off') return 'off';
  return typeof v === 'number' && LEAD_CHOICES.includes(v) ? v : null;
}

/**
 * What a stop (or an event booking) gets when it has no reminder of its own:
 * the trip's setting, then your overall default, then the built-in one for
 * its kind. null = no reminder.
 */
export function inheritedLead(type: string | undefined, trip?: TripLead | null, user?: number | null): number | null {
  if (trip === 'off') return null;
  if (typeof trip === 'number') return trip;
  if (typeof user === 'number') return user;
  return defaultLeadMins(type);
}

/**
 * A manual stop's effective lead: its own setting (`null` is "Off", a number is
 * what was picked), else what it inherits.
 */
export function stopLeadMins(
  stop: { type?: string; notificationLeadMins?: number | null },
  trip?: TripLead | null,
  user?: number | null,
): number | null {
  if (stop.notificationLeadMins === null) return null;
  if (typeof stop.notificationLeadMins === 'number') return stop.notificationLeadMins;
  return inheritedLead(stop.type, trip, user);
}

/** Whether a stop has a reminder setting of its own (rather than following the trip / your default). */
export function hasOwnLead(stop: { notificationLeadMins?: number | null }): boolean {
  return stop.notificationLeadMins !== undefined;
}

export type BookingCollection = 'transport' | 'accommodation' | 'venue';

/**
 * Booking reminders switch off in groups, one per itinerary stop that shows
 * them: a flight's departure side (check-in opening, leave-by, boarding pass,
 * gate, delays) and its arrival side (landing, connection, baggage belt); a
 * stay's check-in and check-out; an event. Stored on the logistics entry as
 * `remindersOff: string[]`.
 */
export function reminderGroup(collection: BookingCollection, phase?: string | null): string | null {
  if (collection === 'venue') return 'event';
  if (collection === 'accommodation') return phase === 'checkin' || phase === 'checkout' ? phase : null;
  if (phase === 'arrival' || phase === 'belt') return 'arrival';
  if (phase === 'transfer' || phase === 'breakfast') return null;
  return 'departure';   // departure, airport_checkin, checkin (opening), pass, gate, status
}

/** The logistics array a booking collection lives in. */
export const LOGISTICS_FIELD: Record<BookingCollection, 'transportation' | 'accommodation' | 'venues'> = {
  transport:     'transportation',
  accommodation: 'accommodation',
  venue:         'venues',
};

/** The reminder choices offered for a stop, in the stop sheet and the stop editor. */
export const REMINDER_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'Off', value: null },
  { label: '5m',  value: 5    },
  { label: '15m', value: 15   },
  { label: '30m', value: 30   },
  { label: '45m', value: 45   },
  { label: '1h',  value: 60   },
  { label: '2h',  value: 120  },
];
