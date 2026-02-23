import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ trip });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const body = await req.json();

  const existingTrip = await Trip.findOne({ _id: id, userId: user._id });
  if (!existingTrip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const trip = await Trip.findOneAndUpdate(
    { _id: id, userId: user._id },
    { ...body },
    { new: true }
  );

  // If dates changed, regenerate itinerary days
  const datesChanged =
    existingTrip.startDate?.toISOString().split('T')[0] !== body.startDate ||
    existingTrip.endDate?.toISOString().split('T')[0] !== body.endDate;

  if (datesChanged && body.startDate && body.endDate) {
    const TripItinerary = (await import('@/lib/mongodb/models/TripItinerary')).default;
    const days = generateDays(body.startDate, body.endDate);
    await TripItinerary.findOneAndUpdate(
      { tripId: id },
      { days },
      { upsert: true }
    );
  }

  return NextResponse.json({ trip });
}

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