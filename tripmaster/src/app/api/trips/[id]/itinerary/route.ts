import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';

function generateDays(startDate: string, endDate: string) {
  const days = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let current = new Date(start);
  let dayNumber = 1;
  while (current <= end) {
    days.push({ date: current.toISOString(), dayNumber, stops: [] });
    current.setDate(current.getDate() + 1);
    dayNumber++;
  }
  return days;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let itinerary = await TripItinerary.findOne({ tripId: id });
  if (!itinerary) {
    const days = generateDays(trip.startDate, trip.endDate);
    itinerary = await TripItinerary.create({ tripId: id, days });
  }
  return NextResponse.json({ days: itinerary.days });
}