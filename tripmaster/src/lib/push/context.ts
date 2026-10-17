// Loads what the notification planner needs for one trip and one traveller.
// Server only — used by api/push/notify and api/trips/[id]/reminders.

import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import TripFile from '@/lib/mongodb/models/TripFile';
import TripExpense from '@/lib/mongodb/models/TripExpense';
import TripPacking from '@/lib/mongodb/models/TripPacking';
import { drivingTime, estimateDrive } from '@/lib/geo/drive';
import { buildLegs, coords, departurePoint, setOffPoint } from '@/lib/push/journey';
import { placeTz, tripZones } from '@/lib/push/timezones';
import { resolvePrefs } from '@/lib/push/prefs';
import type { DriveTimes, NavApp, Recipient, TripData } from '@/lib/push/plan';

const DEFAULT_AIRPORT_BUFFER_MIN = 120;
// Ask Mapbox only about flights this close; further out an estimate is plenty.
const LIVE_DRIVE_WITHIN_MS = 24 * 60 * 60 * 1000;

export async function loadTripData(trip: any): Promise<TripData> {
  const tripId = trip._id;
  const [itinerary, logistics, files, expenses, packing] = await Promise.all([
    TripItinerary.findOne({ tripId }).lean(),
    TripLogistics.findOne({ tripId }).lean(),
    TripFile.find({ tripId }).lean(),
    TripExpense.find({ tripId }).lean(),
    TripPacking.findOne({ tripId }).select('items.packed').lean(),
  ]);
  const items = ((packing as any)?.items ?? []) as any[];
  return {
    trip,
    logistics,
    itinerary,
    files:    (files ?? []) as any[],
    expenses: (expenses ?? []) as any[],
    packing:  items.length ? { packed: items.filter(i => i?.packed).length, total: items.length } : null,
  };
}

export function recipientOf(user: any, trip: any): Recipient {
  const buffer = user.preferences?.airportBufferMins;
  const nav    = user.preferences?.navigationApps ?? {};
  return {
    userId:            String(user._id),
    prefs:             resolvePrefs(user.notificationPrefs),
    airportBufferMins: typeof buffer === 'number' && buffer >= 30 && buffer <= 300 ? buffer : DEFAULT_AIRPORT_BUFFER_MIN,
    navApps:           { driving: (nav.driving ?? 'google_maps') as NavApp, transit: (nav.transit ?? 'google_maps') as NavApp },
    home: {
      zone:        placeTz(user.homeLocation) ?? placeTz(trip.origin) ?? tripZones(trip)(),
      countryCode: user.homeLocation?.countryCode ?? trip.origin?.countryCode ?? null,
      coords:      coords(user.homeLocation?.coordinates),
    },
  };
}

/** Time to drive to the airport for each journey-start flight we know a starting point for. */
export async function driveTimes(data: TripData, r: Recipient, nowMs: number): Promise<DriveTimes> {
  const out  = new Map() as DriveTimes;
  const legs = buildLegs(data.trip, data.logistics?.transportation ?? [], r.home);
  const accommodation = data.logistics?.accommodation ?? [];

  await Promise.all(legs
    .filter(l => l.type === 'flight' && !l.isConnection)
    .map(async (leg) => {
      const from = setOffPoint(leg, accommodation, r.home);
      const to   = departurePoint(leg);
      if (!from?.coords || !to.coords) return;
      const ahead = leg.dep.toMillis() - nowMs;
      const time  = ahead > 0 && ahead <= LIVE_DRIVE_WITHIN_MS
        ? await drivingTime(from.coords, to.coords)
        : estimateDrive(from.coords, to.coords);
      out.set(leg.index, { ...time, from: from.name });
    }));

  return out;
}
