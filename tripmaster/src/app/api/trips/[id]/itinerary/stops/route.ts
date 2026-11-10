import { NextResponse } from 'next/server';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import mongoose from 'mongoose';
import { pinIfFound } from '@/lib/geo/pinAddress';
import { tripAreas } from '@/lib/geo/tripAreas';

const hasPin = (c: any) => Number.isFinite(c?.lat) && Number.isFinite(c?.lng);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, error } = await ownedTrip(id);
  if (error) return error;

  const { dayDate, stop } = await req.json();

  // An address with no pin yet (saved before the form's lookup answered, or queued offline)
  if (stop && !hasPin(stop.coordinates)) {
    delete stop.coordinates;
    const pin = typeof stop.address === 'string' && stop.address.trim()
      ? await pinIfFound(stop.address, tripAreas(trip))
      : null;
    if (pin) stop.coordinates = pin;
  }

  const itinerary = await TripItinerary.findOne({ tripId: id });
  if (!itinerary) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const day = itinerary.days.find((d: any) =>
    new Date(d.date).toDateString() === new Date(dayDate).toDateString()
  );
  if (!day) return NextResponse.json({ error: 'Day not found' }, { status: 404 });

  day.stops.push({ ...stop, _id: new mongoose.Types.ObjectId(), completed: false });
  day.stops.sort((a: any, b: any) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  itinerary.markModified('days');
  await itinerary.save();
  return NextResponse.json({ days: itinerary.days });
}
