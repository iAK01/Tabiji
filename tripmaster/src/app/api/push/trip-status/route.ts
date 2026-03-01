import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';

// ---- POST /api/cron/trip-status ---------------------------------------------
//
// Transitions trips between statuses based on startDate / endDate:
//   planning | confirmed  →  active     (startDate <= now <= endDate)
//   active               →  completed  (endDate < now)
//
// Scheduled on Railway via a cron job hitting this endpoint every hour.
// Protected by the same x-cron-secret header used by /api/push/notify.

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  const now = DateTime.utc();
  const nowDate = now.toJSDate();

  // ── Activate: confirmed trips from midnight of the day before startDate ──────
  // Activating a day early ensures push notifications fire for early
  // departure flights and other pre-trip morning logistics.
  const activationThreshold = now.plus({ days: 1 }).startOf('day').toJSDate();

  const activateResult = await Trip.updateMany(
    {
      status:    'confirmed',
      deleted:   false,
      startDate: { $lte: activationThreshold },
      endDate:   { $gte: nowDate },
    },
    { $set: { status: 'active' } }
  );

  // ── Complete: active trips whose endDate has passed ──────────────────────
  const completeResult = await Trip.updateMany(
    {
      status:  'active',
      deleted: false,
      endDate: { $lt: nowDate },
    },
    { $set: { status: 'completed' } }
  );

  const activated  = activateResult.modifiedCount;
  const completed  = completeResult.modifiedCount;

  console.log(`[trip-status] activated=${activated} completed=${completed} at=${now.toISO()}`);

  return NextResponse.json({
    activated,
    completed,
    checkedAt: now.toISO(),
  });
}