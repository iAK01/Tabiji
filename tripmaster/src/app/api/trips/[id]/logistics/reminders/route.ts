import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import { LOGISTICS_FIELD, type BookingCollection } from '@/lib/push/leads';

// Which groups each kind of booking has — see reminderGroup in lib/push/leads.ts
const GROUPS: Record<BookingCollection, string[]> = {
  transport:     ['departure', 'arrival'],
  accommodation: ['checkin', 'checkout'],
  venue:         ['event'],
};

// ─── PATCH /api/trips/[id]/logistics/reminders ────────────────────────────────
// Body: { collection: 'transport'|'accommodation'|'venue', index, group, off }
// Switches one booking's reminders off (or back on) from its itinerary stop.
// Stored on the logistics entry as remindersOff, so it travels with the booking.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { collection, index, group, off } = await req.json();
  if (!(collection in GROUPS) || !Number.isInteger(index) || index < 0
    || !GROUPS[collection as BookingCollection].includes(group) || typeof off !== 'boolean') {
    return NextResponse.json({ error: 'Invalid reminder setting' }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email }, '_id').lean() as any;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false }, '_id').lean();
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const entry = `${LOGISTICS_FIELD[collection as BookingCollection]}.${index}`;
  const path  = `${entry}.remindersOff`;
  const res = await TripLogistics.updateOne(
    { tripId: id, [entry]: { $exists: true } },
    off ? { $addToSet: { [path]: group } } : { $pull: { [path]: group } },
  );
  if (!res.matchedCount) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const logistics = await TripLogistics.findOne({ tripId: id }).lean() as any;
  const updated   = logistics?.[LOGISTICS_FIELD[collection as BookingCollection]]?.[index];
  return NextResponse.json({ remindersOff: Array.isArray(updated?.remindersOff) ? updated.remindersOff : [] });
}
