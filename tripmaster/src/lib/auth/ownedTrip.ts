import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';

type Owned = { trip: any; user: any; error?: undefined } | { error: NextResponse; trip?: undefined; user?: undefined };

// A /api/trips/[id] route answers only the trip's owner. Anyone else — or a
// deleted trip — gets the same 404 as a trip that doesn't exist.
export async function ownedTrip(tripId: string): Promise<Owned> {
  const session = await getServerSession();
  if (!session?.user?.email) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  const trip = mongoose.isValidObjectId(tripId)
    ? await Trip.findOne({ _id: tripId, userId: user._id, deleted: false })
    : null;
  if (!trip) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { trip, user };
}

/** A booking's position from the URL, only if there's a booking there. */
export function itemIndex(raw: string, items: unknown[] | undefined): number | null {
  const i = Number(raw);
  return Number.isInteger(i) && i >= 0 && i < (items?.length ?? 0) ? i : null;
}
