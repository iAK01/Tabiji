import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; stopId: string }> }) {
  const { id, stopId } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();

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