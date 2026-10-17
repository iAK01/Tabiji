// src/app/api/trips/[id]/weather/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import { getTripWeather } from '@/lib/weather';

// GET serves the cached result while it's still valid for the trip as it is now;
// POST (manual refresh) always refetches.
async function handle(id: string, force: boolean) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!trip.destination?.city) return NextResponse.json({ error: 'No destination city on trip' }, { status: 400 });

  try {
    const { weather, cached } = await getTripWeather(trip, user, { force });
    return NextResponse.json({ weather, cached });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Weather fetch failed' }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(id, false);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(id, true);
}
