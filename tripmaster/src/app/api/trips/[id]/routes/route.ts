import { NextResponse } from 'next/server';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import { buildTripPlans, routePairs, staysFrom, namedFrom, isPinned, type Home } from '@/lib/itinerary/dayPlan';
import { lookUpRoutes } from '@/lib/geo/routes';

// GET /api/trips/[id]/routes → { routes: { [pair]: { walk, drive } }, home }
// The walk and drive for every leg of the itinerary, with the line to draw —
// looked up here (lib/geo/routes.ts) and kept, so the itinerary's legs fill in
// on their own and work offline once fetched. `home` is where the trip starts
// and ends from, so the phone plans the same legs this did.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, error } = await ownedTrip(id);
  if (error) return error;

  const [itinerary, logistics] = await Promise.all([
    TripItinerary.findOne({ tripId: id }).lean() as Promise<any>,
    TripLogistics.findOne({ tripId: id }).lean() as Promise<any>,
  ]);

  const h = user.homeLocation;
  const home: Home | null = isPinned(h?.coordinates)
    ? { name: 'Home', coordinates: { lat: h.coordinates.lat, lng: h.coordinates.lng } }
    : null;

  const plans  = buildTripPlans(itinerary?.days ?? [], staysFrom(logistics?.accommodation), home, namedFrom(logistics?.venues));
  const routes = await lookUpRoutes(routePairs(plans));
  return NextResponse.json({ routes, home });
}
