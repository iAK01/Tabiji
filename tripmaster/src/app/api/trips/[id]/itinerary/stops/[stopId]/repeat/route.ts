import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import { repeatStop } from '@/lib/itinerary/repeat';

// A copy of the stop on each day `offsets` away (in days). Days that already have it
// are left alone, so a queued repeat sent twice adds nothing the second time.
export async function POST(req: Request, { params }: { params: Promise<{ id: string; stopId: string }> }) {
  const { id, stopId } = await params;
  const { error } = await ownedTrip(id);
  if (error) return error;

  const { offsets } = await req.json().catch(() => ({}));
  if (!Array.isArray(offsets) || !offsets.length || offsets.length > 400
    || !offsets.every((n: unknown) => Number.isInteger(n) && n !== 0 && Math.abs(n as number) <= 400)) {
    return NextResponse.json({ error: 'Invalid days' }, { status: 400 });
  }

  const itinerary = await TripItinerary.findOne({ tripId: id });
  if (!itinerary) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const source = itinerary.days.flatMap((d: any) => d.stops ?? []).find((s: any) => s?._id?.toString() === stopId);
  if (!source) return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
  if (source.source === 'logistics') return NextResponse.json({ error: 'Booking stops can’t be repeated' }, { status: 400 });

  const { days, added } = repeatStop(itinerary.days, stopId, offsets, () => new mongoose.Types.ObjectId());
  if (added) {
    itinerary.days = days;
    itinerary.markModified('days');
    await itinerary.save();
  }
  return NextResponse.json({ days: itinerary.days, added });
}
