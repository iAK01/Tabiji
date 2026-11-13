import { NextResponse } from 'next/server';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import { ensureItinerary } from '@/lib/itinerary/stops';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, error } = await ownedTrip(id);
  if (error) return error;

  const itinerary = await ensureItinerary(trip);
  return NextResponse.json({ days: itinerary.days, dismissedGaps: itinerary.dismissedGaps ?? [] });
}

// PATCH { gap, dismissed } — "I've sorted this" on a journey the map asked about
// (dismissed: true), or asking again (false). gap: gapKey in lib/itinerary/dayPlan.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, error } = await ownedTrip(id);
  if (error) return error;

  const { gap, dismissed } = await req.json().catch(() => ({}));
  if (typeof gap !== 'string' || !gap.trim() || gap.length > 200 || typeof dismissed !== 'boolean') {
    return NextResponse.json({ error: 'gap and dismissed required' }, { status: 400 });
  }

  const itinerary = await TripItinerary.findOneAndUpdate(
    { tripId: trip._id },
    dismissed ? { $addToSet: { dismissedGaps: gap } } : { $pull: { dismissedGaps: gap } },
    { new: true },
  );
  if (!itinerary) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ dismissedGaps: itinerary.dismissedGaps ?? [] });
}
