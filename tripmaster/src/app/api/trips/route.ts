import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';

// ─── Geocode a city/country string once at save time ─────────────────────────
async function geocodeLocation(city: string, country: string): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || !city) return null;
  try {
    const query = encodeURIComponent(`${city}, ${country}`);
    const res   = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?limit=1&access_token=${token}`);
    const data  = await res.json();
    const [lng, lat] = data?.features?.[0]?.center ?? [];
    if (lng == null || lat == null) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ trips: [] });
  const trips = await Trip.find({ userId: user._id, deleted: false }).sort({ startDate: 1 });
  return NextResponse.json({ trips });
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();

  // ── Geocode origin if coordinates missing ─────────────────────────────────
  if (body.origin && !body.origin.coordinates?.lat) {
    const coords = await geocodeLocation(body.origin.city, body.origin.country);
    if (coords) body.origin.coordinates = coords;
  }

  // ── Geocode destination if coordinates missing ────────────────────────────
  if (body.destination && !body.destination.coordinates?.lat) {
    const coords = await geocodeLocation(body.destination.city, body.destination.country);
    if (coords) body.destination.coordinates = coords;
  }

  // ── Geocode any additional destinations ───────────────────────────────────
  if (Array.isArray(body.additionalDestinations)) {
    for (const dest of body.additionalDestinations) {
      if (dest && !dest.coordinates?.lat) {
        const coords = await geocodeLocation(dest.city, dest.country);
        if (coords) dest.coordinates = coords;
      }
    }
  }

  const trip = await Trip.create({ ...body, userId: user._id });
  return NextResponse.json({ trip }, { status: 201 });
}