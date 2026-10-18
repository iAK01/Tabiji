import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import { buildLegs } from '@/lib/push/journey';
import { recipientOf } from '@/lib/push/context';
import { syncFlights } from '@/lib/flights/live';
import { FLIGHT_DATA_SOURCE } from '@/lib/flights/status';

// ─── GET /api/trips/[id]/flights ──────────────────────────────────────────────
// Live status for each of the trip's flights, keyed by transport index. Asks
// the provider about any that are due a check (lib/flights/live.ts) — the same
// schedule the notification cron keeps, so opening the app costs nothing extra.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).lean() as any;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false }).lean() as any;
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const logistics = await TripLogistics.findOne({ tripId: trip._id }).lean() as any;
  const legs      = buildLegs(trip, logistics?.transportation ?? [], recipientOf(user, trip).home);
  const flights   = await syncFlights(legs, Date.now());

  return NextResponse.json({ flights: Object.fromEntries(flights), source: FLIGHT_DATA_SOURCE });
}
