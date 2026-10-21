import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { DateTime } from 'luxon';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import PushNotificationLog from '@/lib/mongodb/models/PushNotificationLog';
import { planTrip } from '@/lib/push/plan';
import { driveTimes, loadTripData, recipientOf } from '@/lib/push/context';
import { hasOwnLead, LOGISTICS_FIELD, parseTripLead, type BookingCollection } from '@/lib/push/leads';

// Your own stops with a reminder setting of their own
function ownLeadCount(days: any[] | undefined): number {
  return (days ?? []).reduce((n, d) => n + (d.stops ?? []).filter((s: any) => s.source !== 'logistics' && hasOwnLead(s)).length, 0);
}

// ─── GET /api/trips/[id]/reminders ────────────────────────────────────────────
// When each itinerary stop and booking will notify, from the same planner the
// sender uses — so the bell on a stop shows the real time. Respects the
// traveller's settings: all notifications off or the trip muted → no
// reminders. `bookingsOff` lists the bookings whose reminders were switched
// off from their stop, so the stop can offer to switch them back on. `leads`
// is the trip's own reminder-before-each-stop setting, your overall default,
// and how many stops have a time of their own.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).lean() as any;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false }).lean() as any;
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const recipient = recipientOf(user, trip);
  const data      = await loadTripData(trip);

  const bookingsOff: Array<{ collection: BookingCollection; index: number; group: string }> = [];
  for (const collection of Object.keys(LOGISTICS_FIELD) as BookingCollection[]) {
    ((data.logistics as any)?.[LOGISTICS_FIELD[collection]] ?? []).forEach((entry: any, index: number) => {
      for (const group of Array.isArray(entry?.remindersOff) ? entry.remindersOff : []) {
        bookingsOff.push({ collection, index, group: String(group) });
      }
    });
  }

  const leads = {
    trip:     parseTripLead(trip.reminderLeadMins),
    user:     recipient.prefs.stopLeadMins,
    ownStops: ownLeadCount((data.itinerary as any)?.days),
  };

  const enabled = recipient.prefs.enabled;
  const muted   = recipient.prefs.mutedTrips.includes(id);
  if (!enabled || muted) return NextResponse.json({ enabled, muted, leads, reminders: [], bookingsOff });

  const nowMs   = Date.now();
  const planned = planTrip(data, recipient, await driveTimes(data, recipient, nowMs), nowMs)
    .filter(p => recipient.prefs.categories[p.category] && (p.ref?.stopId || p.ref?.collection));

  const sentLogs = await PushNotificationLog.find({ userId: user._id, tripId: id }, 'key notificationType').lean() as any[];
  const sent     = new Set(sentLogs.map(l => `${l.key}|${l.notificationType}`));

  return NextResponse.json({
    enabled,
    muted,
    leads,
    bookingsOff,
    reminders: planned.map(p => ({
      at:       new Date(p.at).toISOString(),
      local:    DateTime.fromMillis(p.at, { zone: p.zone }).toFormat('HH:mm'),
      category: p.category,
      type:     p.type,
      ref:      p.ref,
      sent:     sent.has(`${p.key}|${p.type}`),
    })),
  });
}

// ─── POST /api/trips/[id]/reminders ───────────────────────────────────────────
// Trip-wide reminder changes from the notification centre:
//   { action: 'setTripLead', leadMins: <minutes> | 'off' | null, replaceStops: boolean }
//       Reminder before each stop on this trip (null = back to your default).
//       replaceStops also clears the times set on individual stops, so they
//       follow it too.
//   { action: 'reset' }
//       Start again: the trip and every stop back to your defaults, booking
//       reminders switched off from a stop back on, and the trip unmuted.
// Returns the new `leads` and, when stops changed, the itinerary `days`.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body   = await req.json().catch(() => ({}));
  const reset  = body.action === 'reset';
  if (!reset && body.action !== 'setTripLead') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const lead = reset ? null : parseTripLead(body.leadMins);
  if (!reset && body.leadMins !== null && lead === null) {
    return NextResponse.json({ error: 'Invalid reminder time' }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email }, '_id notificationPrefs').lean() as any;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false }, '_id').lean();
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Stops' own times: cleared on reset, or when replacing them
  let days: any[] | null = null;
  if (reset || body.replaceStops === true) {
    const itinerary = await TripItinerary.findOne({ tripId: id });
    if (itinerary) {
      let changed = false;
      for (const day of itinerary.days ?? []) {
        for (const stop of day.stops ?? []) {
          if (stop.source !== 'logistics' && hasOwnLead(stop)) {
            delete stop.notificationLeadMins;
            changed = true;
          }
        }
      }
      if (changed) {
        itinerary.markModified('days');
        await itinerary.save();
      }
      days = itinerary.days;
    }
  }

  await Trip.updateOne({ _id: id }, lead === null ? { $unset: { reminderLeadMins: 1 } } : { $set: { reminderLeadMins: lead } });

  if (reset) {
    // Booking reminders switched off from their stops come back on
    const logistics = await TripLogistics.findOne({ tripId: id }).lean() as any;
    const unset: Record<string, 1> = {};
    for (const field of Object.values(LOGISTICS_FIELD)) {
      (logistics?.[field] ?? []).forEach((entry: any, index: number) => {
        if (entry?.remindersOff !== undefined) unset[`${field}.${index}.remindersOff`] = 1;
      });
    }
    if (Object.keys(unset).length) await TripLogistics.updateOne({ tripId: id }, { $unset: unset });
    // …and the trip isn't muted any more
    if (Array.isArray(user.notificationPrefs?.mutedTrips)) {
      await User.updateOne({ _id: user._id }, { $pull: { 'notificationPrefs.mutedTrips': id } });
    }
  }

  return NextResponse.json({
    leads: {
      trip:     lead,
      ownStops: days ? ownLeadCount(days) : undefined,
    },
    days,
  });
}
