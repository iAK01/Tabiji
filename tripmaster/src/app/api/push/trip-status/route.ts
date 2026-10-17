import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import TripExpense from '@/lib/mongodb/models/TripExpense';
import { fetchTripWeather } from '@/lib/weather';
import { deliver, dropInvalid } from '@/lib/push/send';
import { isDueNow } from '@/lib/push/plan';
import { recipientOf } from '@/lib/push/context';

// ---- POST /api/push/trip-status ---------------------------------------------
//
// 1. Transitions trips between statuses based on startDate / endDate:
//      confirmed  →  active     (startDate <= now + 2 days)
//      active     →  completed  (endDate < now)
//
// 2. Pre-warms weather cache for confirmed/active trips starting within 3 days.
//    This ensures packing recommendations have accurate live forecast data
//    before the user opens their packing list the evening before departure.
//    Weather is only re-fetched when the cached data is older than 6 hours.
//
// Scheduled on Railway via a cron job hitting this endpoint every hour.
// Protected by the x-cron-secret header.

const WEATHER_TTL_MS  = 6 * 60 * 60 * 1000;   // 6 hours — matches GET route TTL
const WEATHER_WINDOW  = 3;                      // days before departure

async function resolveHomeCoords(
  homeLocation: { city?: string; coordinates?: { lat: number; lng: number } } | undefined
): Promise<{ lat: number; lon: number } | null> {
  if (!homeLocation?.city) return null;
  if (homeLocation.coordinates?.lat) {
    return { lat: homeLocation.coordinates.lat, lon: homeLocation.coordinates.lng };
  }
  try {
    const res  = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(homeLocation.city)}&count=1&language=en&format=json`
    );
    const data = await res.json();
    if (!data.results?.length) return null;
    return { lat: data.results[0].latitude, lon: data.results[0].longitude };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  const now     = DateTime.utc();
  const nowDate = now.toJSDate();

  // ── 1. Activate: confirmed trips 2 days before startDate ─────────────────
  const activationThreshold = now.plus({ days: 2 }).startOf('day').toJSDate();

  const activateResult = await Trip.updateMany(
    {
      status:    'confirmed',
      deleted:   false,
      startDate: { $lte: activationThreshold },
      endDate:   { $gte: nowDate },           // don't activate already-ended trips
    },
    { $set: { status: 'active' } }
  );

  // ── 2. Complete: active trips 48 hours after endDate ─────────────────────
  // Keeping trips active for 48h after end gives cron jobs (weather, packing)
  // time to run their post-trip passes, and stops the dashboard flipping to
  // completed mid-trip on short same-day journeys.
  const completeThreshold = now.minus({ hours: 48 }).toJSDate();

  const completeResult = await Trip.updateMany(
    {
      status:  'active',
      deleted: false,
      endDate: { $lt: completeThreshold },
    },
    { $set: { status: 'completed' } }
  );

  // ── 2b. Expense reconciliation nudge ──────────────────────────────────────
  // Work/mixed trips that finished (48h+ ago, within the last week) with
  // anything not yet 'paid'. Checked every run rather than only at the moment a
  // trip completes, so quiet hours can hold it over without losing it — and
  // trips left at 'planning' (never completed) still get it. Once only, via the
  // notification log.
  let expenseNudgesSent = 0;
  const finished = await Trip.find({
    deleted:  false,
    tripType: { $in: ['work', 'mixed'] },
    status:   { $nin: ['idea', 'cancelled'] },
    endDate:  { $lt: completeThreshold, $gte: now.minus({ days: 7 }).toJSDate() },
  }).lean() as any[];

  for (const trip of finished) {
    try {
      const outstanding = await TripExpense.countDocuments({
        tripId: trip._id, status: { $ne: 'paid' },
      });
      if (outstanding === 0) continue;

      const user = await User.findById(trip.userId).lean() as any;
      if (!user?.pushSubscriptions?.length) continue;
      const recipient = recipientOf(user, trip);
      const tripId    = String(trip._id);
      if (recipient.prefs.mutedTrips.includes(tripId)) continue;

      const at = new Date(trip.endDate).getTime() + 48 * 60 * 60 * 1000;
      const timing = { at, until: at + 7 * 24 * 60 * 60 * 1000, deferrable: true, zone: recipient.home.zone, category: 'expenses' as const };
      if (!isDueNow(timing, recipient.prefs, now.toMillis())) continue;

      const invalid: string[] = [];
      const ok = await deliver({
        userId:           recipient.userId,
        tripId,
        key:              'expense-reconciliation',
        notificationType: 'expense_reconciliation',
        category:         'expenses',
        subscriptions:    user.pushSubscriptions,
        payload: {
          title: `${trip.name}: expenses to sort`,
          body:  `${outstanding} expense${outstanding === 1 ? '' : 's'} still need${outstanding === 1 ? 's' : ''} reviewing and submitting.`,
          url:   `/trips/${tripId}?tab=expenses`,
          tag:   `expenses-${tripId}`,
        },
      }, invalid);
      await dropInvalid(recipient.userId, invalid);
      if (ok) expenseNudgesSent++;
    } catch (err) {
      console.error(`[trip-status] Expense nudge for trip ${trip._id} failed:`, err);
    }
  }

  const activated = activateResult.modifiedCount;
  const completed = completeResult.modifiedCount;

  // ── 3. Weather pre-warm ───────────────────────────────────────────────────
  // Find confirmed/active trips departing within WEATHER_WINDOW days.
  // Skip any trip whose weather cache is still fresh.
  const weatherWindowEnd = now.plus({ days: WEATHER_WINDOW }).endOf('day').toJSDate();

  const nearTrips = await Trip.find({
    status:    { $in: ['confirmed', 'active'] },
    deleted:   false,
    startDate: { $lte: weatherWindowEnd },
    endDate:   { $gte: nowDate },
    'destination.city': { $exists: true, $ne: '' },
  });

  let weatherRefreshed = 0;
  let weatherSkipped   = 0;

  for (const trip of nearTrips) {
    const user = await User.findById(trip.userId).select('homeLocation');

    // Skip if cache is still fresh — unless it predates the user having a
    // home location set, in which case it's missing the home comparison and
    // needs recomputing regardless of age.
    const staleMissingHomeComparison = !!user?.homeLocation?.city && !trip.weather?.homeComparison;
    if (trip.weather?.fetchedAt && !staleMissingHomeComparison) {
      const age = Date.now() - new Date(trip.weather.fetchedAt).getTime();
      if (age < WEATHER_TTL_MS) {
        weatherSkipped++;
        continue;
      }
    }

    try {
      const homeCoords = await resolveHomeCoords(user?.homeLocation);

      const weather = await fetchTripWeather(
        trip.destination.city,
        trip.startDate.toISOString().split('T')[0],
        trip.endDate.toISOString().split('T')[0],
        user?.homeLocation?.city ?? undefined,
        homeCoords,
      );

      await Trip.findByIdAndUpdate(trip._id, { weather });
      weatherRefreshed++;
    } catch (err: any) {
      // Non-fatal — log and continue. A failed weather fetch shouldn't
      // block status transitions or other trip processing.
      console.error(`[trip-status] weather fetch failed for trip ${trip._id}: ${err.message}`);
    }
  }

  console.log(
    `[trip-status] activated=${activated} completed=${completed} ` +
    `weather_refreshed=${weatherRefreshed} weather_skipped=${weatherSkipped} ` +
    `expense_nudges_sent=${expenseNudgesSent} at=${now.toISO()}`
  );

  return NextResponse.json({
    activated,
    completed,
    weatherRefreshed,
    weatherSkipped,
    expenseNudgesSent,
    checkedAt: now.toISO(),
  });
}