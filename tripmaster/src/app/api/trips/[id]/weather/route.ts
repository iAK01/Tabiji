// src/app/api/trips/[id]/weather/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import { fetchTripWeather } from '@/lib/weather';

const FORECAST_TTL_MS   = 6 * 60 * 60 * 1000;       // 6 hours
const HISTORICAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days

// Resolve home coordinates — uses stored coords if present, otherwise
// geocodes the city name via Open-Meteo. This handles profiles saved before
// coordinates were being stored.
async function resolveHomeCoords(
  homeLocation: { city?: string; coordinates?: { lat: number; lng: number } } | undefined
): Promise<{ lat: number; lon: number } | null> {
  if (!homeLocation?.city) return null;

  if (homeLocation.coordinates?.lat) {
    return { lat: homeLocation.coordinates.lat, lon: homeLocation.coordinates.lng };
  }

  try {
    const res  = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(homeLocation.city)}&count=1&language=en&format=json`
    );
    const data = await res.json();
    if (!data.results?.length) return null;
    return { lat: data.results[0].latitude, lon: data.results[0].longitude };
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Check cache
  const cached = trip.weather;
  if (cached?.fetchedAt) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    const ttl = cached.mode === 'historical' ? HISTORICAL_TTL_MS : FORECAST_TTL_MS;
    if (age < ttl) return NextResponse.json({ weather: cached, cached: true });
  }

  const city = trip.destination?.city;
  if (!city) return NextResponse.json({ error: 'No destination city on trip' }, { status: 400 });

  try {
    const homeCoords = await resolveHomeCoords(user.homeLocation);

    const weather = await fetchTripWeather(
      city,
      trip.startDate.toISOString().split('T')[0],
      trip.endDate.toISOString().split('T')[0],
      user.homeLocation?.city ?? undefined,
      homeCoords,
    );

    await Trip.findByIdAndUpdate(id, { weather });
    return NextResponse.json({ weather, cached: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Weather fetch failed' }, { status: 500 });
  }
}

// Manual refresh — bypasses cache TTL
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
    const homeCoords = await resolveHomeCoords(user.homeLocation);

    const weather = await fetchTripWeather(
      city,
      trip.startDate.toISOString().split('T')[0],
      trip.endDate.toISOString().split('T')[0],
      user.homeLocation?.city ?? undefined,
      homeCoords,
    );

    await Trip.findByIdAndUpdate(id, { weather });
    return NextResponse.json({ weather, cached: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Weather fetch failed' }, { status: 500 });
  }
}