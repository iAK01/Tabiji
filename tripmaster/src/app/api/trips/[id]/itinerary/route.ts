import { NextResponse } from 'next/server';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import TripTask from '@/lib/mongodb/models/TripTask';
import { ensureItinerary } from '@/lib/itinerary/stops';
import { sortTasks, taskOut } from '@/lib/itinerary/tasks';

// The days and their stops, plus each day's tasks (their own collection, sent here
// so every reader of the itinerary — and its offline copy — has them too)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, error } = await ownedTrip(id);
  if (error) return error;

  const [itinerary, tasks] = await Promise.all([
    ensureItinerary(trip),
    TripTask.find({ tripId: trip._id }).lean(),
  ]);
  return NextResponse.json({
    days:          itinerary.days,
    dismissedGaps: itinerary.dismissedGaps ?? [],
    tasks:         sortTasks((tasks as any[]).map(taskOut)),
  });
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
