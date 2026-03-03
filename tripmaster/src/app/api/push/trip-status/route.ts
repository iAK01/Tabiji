import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import { fetchTripWeather } from '@/lib/weather';

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
    // Skip if cache is still fresh
    if (trip.weather?.fetchedAt) {
      const age = Date.now() - new Date(trip.weather.fetchedAt).getTime();
      if (age < WEATHER_TTL_MS) {
        weatherSkipped++;
        continue;
      }
    }

    try {
      const user = await User.findById(trip.userId).select('homeLocation');
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
    `at=${now.toISO()}`
  );

  return NextResponse.json({
    activated,
    completed,
    weatherRefreshed,
    weatherSkipped,
    checkedAt: now.toISO(),
  });
}