import { NextResponse } from 'next/server';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import mongoose from 'mongoose';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await ownedTrip(id);
  if (error) return error;

  const { dayDate, stop } = await req.json();
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