import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import { fetchTripWeather } from '@/lib/weather';

const FORECAST_TTL_MS  = 6 * 60 * 60 * 1000;  // 6 hours — real forecast data
const HISTORICAL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — historical averages don't change

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const cached = trip.weather;
  if (cached?.fetchedAt) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    const ttl = cached.mode === 'historical' ? HISTORICAL_TTL_MS : FORECAST_TTL_MS;
    if (age < ttl) {
      return NextResponse.json({ weather: cached, cached: true });
    }
  }

  // Need fresh data — fetch it
  const city = trip.destination?.city;
  if (!city) return NextResponse.json({ error: 'No destination city on trip' }, { status: 400 });

  try {
    const weather = await fetchTripWeather(city, trip.startDate.toISOString().split('T')[0], trip.endDate.toISOString().split('T')[0]);

    // Persist to trip document
    await Trip.findByIdAndUpdate(id, { weather });

    return NextResponse.json({ weather, cached: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Weather fetch failed' }, { status: 500 });
  }
}

// Manual refresh — ignores cache TTL
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const city = trip.destination?.city;
  if (!city) return NextResponse.json({ error: 'No destination city on trip' }, { status: 400 });

  try {
    const weather = await fetchTripWeather(city, trip.startDate.toISOString().split('T')[0], trip.endDate.toISOString().split('T')[0]);
    await Trip.findByIdAndUpdate(id, { weather });
    return NextResponse.json({ weather, cached: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Weather fetch failed' }, { status: 500 });
  }
}