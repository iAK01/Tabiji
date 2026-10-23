import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import { insertByTime } from '@/lib/itinerary/nights';

const MAX_NOTE = 20_000;

const ymd = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);

// Only the trip's owner can change its stops.
async function ownsTrip(email: string, tripId: string): Promise<boolean> {
  const user = await User.findOne({ email }, '_id').lean() as any;
  if (!user) return false;
  return !!(await Trip.exists({ _id: tripId, userId: user._id, deleted: false }));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; stopId: string }> }) {
  const { id, stopId } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  if (!(await ownsTrip(session.user.email, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const itinerary = await TripItinerary.findOne({ tripId: id });
  if (!itinerary) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  for (const day of itinerary.days) {
    const index = day.stops.findIndex((s: any) => s._id?.toString() === stopId);
    if (index !== -1) {
      day.stops.splice(index, 1);
      break;
    }
  }

  itinerary.markModified('days');
  await itinerary.save();
  return NextResponse.json({ days: itinerary.days });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; stopId: string }> }) {
  const { id, stopId } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  if (!(await ownsTrip(session.user.email, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { scheduledStart, duration, name, type, notes, address, locationName, coordinates, notificationLeadMins, reference, skipped, lateNight, myNotes } = body;
  // A skip/unskip, a reminder change or your note alone needs no time — all-day items don't have one
  if (!scheduledStart && skipped === undefined && notificationLeadMins === undefined && myNotes === undefined) {
    return NextResponse.json({ error: 'scheduledStart required' }, { status: 400 });
  }
  if (myNotes !== undefined && (typeof myNotes !== 'string' || myNotes.length > MAX_NOTE)) {
    return NextResponse.json({ error: 'Note too long' }, { status: 400 });
  }
  if (notificationLeadMins !== undefined && notificationLeadMins !== null
    && !(Number.isInteger(notificationLeadMins) && notificationLeadMins >= 0 && notificationLeadMins <= 24 * 60)) {
    return NextResponse.json({ error: 'Invalid reminder time' }, { status: 400 });
  }

  const itinerary = await TripItinerary.findOne({ tripId: id });
  if (!itinerary) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let found = false;
  for (const day of itinerary.days) {
    const stop = day.stops.find((s: any) => s._id?.toString() === stopId);
    if (stop) {
      if (scheduledStart) stop.scheduledStart = scheduledStart;
      // Which night an early-hours stop belongs to; null = back to the default
      if (lateNight === null) delete stop.lateNight;
      else if (lateNight !== undefined) stop.lateNight = !!lateNight;
      if (skipped !== undefined) stop.skipped = !!skipped;
      // Your own note — booking stops keep it across logistics syncs by the booking's id
      if (myNotes !== undefined) {
        if (myNotes.trim()) stop.myNotes = myNotes;
        else delete stop.myNotes;
      }
      if (duration             !== undefined) stop.duration             = duration;
      if (name                 !== undefined) stop.name                 = name;
      if (type                 !== undefined) stop.type                 = type;
      if (notes                !== undefined) stop.notes                = notes;
      if (address              !== undefined) stop.address              = address;
      if (locationName         !== undefined) stop.locationName         = locationName;
      if (coordinates          !== undefined) stop.coordinates          = coordinates;
      if (notificationLeadMins !== undefined) stop.notificationLeadMins = notificationLeadMins;
      if (reference            !== undefined) stop.reference            = reference;

      // A logistics-mirrored stop is regenerated on every logistics sync. Record
      // the traveller's change as an override so syncLogistics can re-apply it
      // instead of clobbering it. Facts (locked:true) only ever send `skipped` —
      // the UI gives them no other edit affordance.
      if (stop.source === 'logistics') {
        stop.userOverride = {
          ...(stop.userOverride || {}),
          ...(scheduledStart     ? { scheduledStart }     : {}),
          ...(skipped !== undefined ? { skipped: !!skipped } : {}),
          ...(duration !== undefined ? { duration } : {}),
          ...(name     !== undefined ? { name }     : {}),
          ...(notes    !== undefined ? { notes }    : {}),
        };
      }

      // A new time on another date (an after-midnight stop) lives on that date's day
      const target = scheduledStart && ymd(scheduledStart) !== ymd(day.date)
        ? itinerary.days.find((d: any) => ymd(d.date) === ymd(scheduledStart))
        : null;
      if (target) {
        day.stops = day.stops.filter((s: any) => s !== stop);
        target.stops = insertByTime(target.stops ?? [], stop);
      }
      found = true;
      break;
    }
  }

  if (!found) return NextResponse.json({ error: 'Stop not found' }, { status: 404 });

  itinerary.markModified('days');
  await itinerary.save();
  return NextResponse.json({ days: itinerary.days });
}