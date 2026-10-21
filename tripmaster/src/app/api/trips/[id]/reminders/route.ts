import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { DateTime } from 'luxon';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import PushNotificationLog from '@/lib/mongodb/models/PushNotificationLog';
import { planTrip } from '@/lib/push/plan';
import { driveTimes, loadTripData, recipientOf } from '@/lib/push/context';
import { LOGISTICS_FIELD, type BookingCollection } from '@/lib/push/leads';

// ─── GET /api/trips/[id]/reminders ────────────────────────────────────────────
// When each itinerary stop and booking will notify, from the same planner the
// sender uses — so the bell on a stop shows the real time. Respects the
// traveller's settings: all notifications off or the trip muted → no
// reminders. `bookingsOff` lists the bookings whose reminders were switched
// off from their stop, so the stop can offer to switch them back on.
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

  const enabled = recipient.prefs.enabled;
  const muted   = recipient.prefs.mutedTrips.includes(id);
  if (!enabled || muted) return NextResponse.json({ enabled, muted, reminders: [], bookingsOff });

  const nowMs   = Date.now();
  const planned = planTrip(data, recipient, await driveTimes(data, recipient, nowMs), nowMs)
    .filter(p => recipient.prefs.categories[p.category] && (p.ref?.stopId || p.ref?.collection));

  const sentLogs = await PushNotificationLog.find({ userId: user._id, tripId: id }, 'key notificationType').lean() as any[];
  const sent     = new Set(sentLogs.map(l => `${l.key}|${l.notificationType}`));

  return NextResponse.json({
    enabled,
    muted,
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
