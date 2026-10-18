import { NextResponse }     from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB            from '@/lib/mongodb/connection';
import Trip                 from '@/lib/mongodb/models/Trip';
import User                 from '@/lib/mongodb/models/User';
import { guideForTrip, stayForTrip } from '@/lib/guide/load';
import type { TripGuide }   from '@/lib/guide/types';

// The Wikivoyage guide for the trip's destination, plus where the traveller is staying.
// Warmed for offline use (TRIP_DATA in src/lib/offline/warm.ts).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const guide = await guideForTrip(trip);
    const near  = guide?.coordinates ?? (trip.destination?.coordinates?.lat != null ? trip.destination.coordinates : undefined);
    const stay  = guide ? await stayForTrip(id, near) : null;
    return NextResponse.json({ guide, stay } satisfies TripGuide);
  } catch (err) {
    console.error('Guide error:', err);
    return NextResponse.json({ error: 'Couldn’t reach Wikivoyage — try again shortly' }, { status: 502 });
  }
}
