// The trip-status / notify crons flip a confirmed trip to status 'active' 2 days
// before it starts, so push reminders (documents, early departures) have lead
// time. That's a notification window, not "you're on the trip" — UI that means
// the latter should ask this instead of checking status === 'active'.

type TripDates = { status?: string; startDate?: string | Date | null };

function ymd(d: string | Date): string {
  return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

function localTodayYmd(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function isOnTrip(trip: TripDates): boolean {
  if (trip.status !== 'active') return false;
  if (!trip.startDate) return true;
  return localTodayYmd() >= ymd(trip.startDate);
}

// What the status pill should say: an 'active' trip that hasn't started yet is,
// to the traveller, still just confirmed.
export function displayStatus(trip: TripDates): string | undefined {
  return trip.status === 'active' && !isOnTrip(trip) ? 'confirmed' : trip.status;
}
