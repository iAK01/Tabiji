import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import webpush from 'web-push';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import TripExpense from '@/lib/mongodb/models/TripExpense';
import PushNotificationLog from '@/lib/mongodb/models/PushNotificationLog';
import { fetchTripWeather } from '@/lib/weather';

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

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

  // Fetched before updating (not a blind updateMany) so the trips that just
  // completed are on hand for the expense-reconciliation nudge below — this is
  // the same active→completed transition that already exists; the only change
  // here is knowing *which* trips it applied to, for a reason to check on them.
  const justCompletedTrips = await Trip.find({
    status:  'active',
    deleted: false,
    endDate: { $lt: completeThreshold },
  });

  const completeResult = await Trip.updateMany(
    {
      status:  'active',
      deleted: false,
      endDate: { $lt: completeThreshold },
    },
    { $set: { status: 'completed' } }
  );

  // ── 2b. Expense reconciliation nudge ──────────────────────────────────────
  // Work/mixed trips only, and only if there's actually something outstanding
  // (anything not yet 'paid') — one-shot per trip via PushNotificationLog, same
  // dedup pattern push/notify already uses for every other reminder type.
  let expenseNudgesSent = 0;
  for (const trip of justCompletedTrips) {
    const isWork = trip.tripType === 'work' || trip.tripType === 'mixed';
    if (!isWork) continue;

    const outstanding = await TripExpense.countDocuments({
      tripId: trip._id, status: { $ne: 'paid' },
    });
    if (outstanding === 0) continue;

    const user = await User.findById(trip.userId).select('pushSubscriptions');
    if (!user?.pushSubscriptions?.length) continue;

    const key  = 'expense-reconciliation';
    const type = 'expense_reconciliation';
    const tripId = trip._id.toString();
    const userId = trip.userId.toString();

    const alreadySent = await PushNotificationLog.findOne({ userId, tripId, key, notificationType: type });
    if (alreadySent) continue;

    const payload = {
      title: `${trip.name}: expenses to sort`,
      body:  `${outstanding} expense${outstanding === 1 ? '' : 's'} still need${outstanding === 1 ? 's' : ''} reviewing and submitting.`,
      url:   `/trips/${tripId}`,
    };
    const str = JSON.stringify(payload);
    const invalidEndpoints: string[] = [];
    let sent = 0;
    for (const sub of user.pushSubscriptions) {
      try {
        await webpush.sendNotification(sub, str);
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) invalidEndpoints.push(sub.endpoint);
      }
    }
    if (invalidEndpoints.length) {
      await User.findByIdAndUpdate(trip.userId, { $pull: { pushSubscriptions: { endpoint: { $in: invalidEndpoints } } } });
    }
    if (sent > 0) {
      await PushNotificationLog.create({ userId, tripId, key, notificationType: type });
      expenseNudgesSent++;
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