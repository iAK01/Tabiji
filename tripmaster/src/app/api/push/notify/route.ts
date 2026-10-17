import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import Trip from '@/lib/mongodb/models/Trip';
import TripFile from '@/lib/mongodb/models/TripFile';
import { deliver, dropInvalid } from '@/lib/push/send';
import { isDueNow, LATE_LIMIT_MS, planTrip } from '@/lib/push/plan';
import { driveTimes, loadTripData, recipientOf } from '@/lib/push/context';
import { tripZones } from '@/lib/push/timezones';

// ---- POST /api/push/notify --------------------------------------------------
//
// Runs every 5 minutes (iAK01/tabiji-cron, x-cron-secret). Plans every
// notification for trips under way or about to start (lib/push/plan.ts) and
// sends the ones due now under each traveller's settings. Each one is logged
// once (lib/push/send.ts), so a run that overlaps or repeats can't resend.

// How long before departure a planning/confirmed trip is checked, and how long
// after its end date (post-checkout proof reminders still need it).
const ELIGIBLE_BEFORE_MS = 2 * 24 * 60 * 60 * 1000;
const ELIGIBLE_AFTER_MS  = 2 * 24 * 60 * 60 * 1000;

async function notifyTrip(trip: any, nowMs: number): Promise<number> {
  const tripId = String(trip._id);
  const user   = await User.findById(trip.userId).lean() as any;
  if (!user?.pushSubscriptions?.length) return 0;

  const recipient = recipientOf(user, trip);
  if (recipient.prefs.mutedTrips.includes(tripId)) return 0;

  const data    = await loadTripData(trip);
  const drive   = await driveTimes(data, recipient, nowMs);
  const planned = planTrip(data, recipient, drive, nowMs);

  const invalid: string[] = [];
  let sent = 0;
  for (const p of planned) {
    if (!isDueNow(p, recipient.prefs, nowMs)) continue;
    const ok = await deliver({
      userId:           recipient.userId,
      tripId,
      key:              p.key,
      notificationType: p.type,
      category:         p.category,
      subscriptions:    user.pushSubscriptions,
      payload:          p.payload,
    }, invalid);
    if (ok) sent++;
  }
  await dropInvalid(recipient.userId, invalid);
  return sent;
}

// To-dos with a due time, on trips that are going ahead — including ones that
// haven't reached the 2-day window (a packing advisory "7 days before").
async function notifyTodos(tripId: string, todos: any[], nowMs: number): Promise<number> {
  const trip = await Trip.findOne({
    _id:     tripId,
    status:  { $in: ['planning', 'confirmed', 'active'] },
    deleted: false,
  }).lean() as any;
  if (!trip) return 0;

  const user = await User.findById(trip.userId).lean() as any;
  if (!user?.pushSubscriptions?.length) return 0;
  const recipient = recipientOf(user, trip);
  if (recipient.prefs.mutedTrips.includes(tripId)) return 0;

  // Home before the trip starts, the destination once it has.
  const started = !!trip.startDate && nowMs >= new Date(trip.startDate).getTime();
  const zone    = started ? tripZones(trip)(new Date(nowMs)) : recipient.home.zone;

  const invalid: string[] = [];
  let sent = 0;
  for (const todo of todos) {
    const fileId = String(todo._id);
    const dueMs  = new Date(todo.dueAt).getTime();
    const timing = { at: dueMs, until: dueMs + LATE_LIMIT_MS, deferrable: true, zone, category: 'todos' as const };
    if (!isDueNow(timing, recipient.prefs, nowMs)) continue;

    const isPacking = todo.source === 'packing_advisory' || todo.type === 'packing_advisory';
    const lines: string[] = [];
    if (todo.body) lines.push(todo.body);
    else if (isPacking && todo.packingItemRef) lines.push(todo.packingItemRef);
    lines.push(`Due at ${DateTime.fromMillis(dueMs, { zone }).toFormat('HH:mm')}`);

    const ok = await deliver({
      userId:           recipient.userId,
      tripId,
      key:              `todo-${fileId}@${Math.round(dueMs / 60000)}`,   // a new due time gets a new reminder
      notificationType: 'todo_reminder',
      category:         'todos',
      subscriptions:    user.pushSubscriptions,
      payload: {
        title:   isPacking ? `⚡ Pre-trip: ${todo.name}` : `✅ To-do: ${todo.name}`,
        body:    lines.join('\n'),
        url:     `/trips/${tripId}?tab=resources&todo=${fileId}`,
        tag:     `todo-${fileId}`,
        actions: [{ action: 'done', title: 'Done', complete: `/api/trips/${tripId}/files/${fileId}` }],
      },
    }, invalid);
    if (ok) sent++;
  }
  await dropInvalid(recipient.userId, invalid);
  return sent;
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    console.log(`[notify] 403 — x-cron-secret ${secret ? 'does not match CRON_SECRET' : 'header missing'}`);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  // nowMs is UTC epoch milliseconds — timezone-agnostic reference point
  const nowMs = Date.now();

  // Safety net: activate any confirmed trips whose window has arrived,
  // in case the trip-status cron is misconfigured or delayed.
  const activationThreshold = new Date(nowMs + 2 * 24 * 60 * 60 * 1000);
  await Trip.updateMany(
    { status: 'confirmed', deleted: false, startDate: { $lte: activationThreshold }, endDate: { $gte: new Date(nowMs) } },
    { $set: { status: 'active' } }
  );

  // Trips under way or about to start. By date as well as status: new trips
  // start as 'planning' and often stay that way, and only 'confirmed' ones are
  // ever flipped to 'active'.
  const trips = await Trip.find({
    deleted: false,
    $or: [
      { status: 'active' },
      {
        status:    { $in: ['planning', 'confirmed'] },
        startDate: { $lte: new Date(nowMs + ELIGIBLE_BEFORE_MS) },
        endDate:   { $gte: new Date(nowMs - ELIGIBLE_AFTER_MS) },
      },
    ],
  }).lean();
  console.log(`[notify] Checking ${trips.length} trip(s)`);

  let totalSent = 0;

  for (const trip of trips) {
    // One broken trip mustn't stop everyone else's notifications.
    try {
      totalSent += await notifyTrip(trip, nowMs);
    } catch (err) {
      console.error(`[notify] Trip ${(trip as any)._id} failed:`, err);
    }
  }

  // The index on { dueAt, notification.enabled } makes this efficient.
  const dueTodos = await TripFile.find({
    resourceType:           'todo',
    'notification.enabled': true,
    completed:              false,
    // Back far enough to cover quiet hours holding one over
    dueAt:                  { $gte: new Date(nowMs - LATE_LIMIT_MS - 12 * 60 * 60 * 1000), $lte: new Date(nowMs) },
  }).lean();

  const todosByTrip = new Map<string, any[]>();
  for (const todo of dueTodos as any[]) {
    const key = String(todo.tripId);
    if (!todosByTrip.has(key)) todosByTrip.set(key, []);
    todosByTrip.get(key)!.push(todo);
  }

  for (const [tripId, todos] of todosByTrip) {
    try {
      totalSent += await notifyTodos(tripId, todos, nowMs);
    } catch (err) {
      console.error(`[notify] To-dos for trip ${tripId} failed:`, err);
    }
  }

  console.log(`[notify] Done — sent ${totalSent} notification(s)`);
  return NextResponse.json({ sent: totalSent, checkedAt: new Date().toISOString() });
}
