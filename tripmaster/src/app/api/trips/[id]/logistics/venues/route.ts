import { NextResponse } from 'next/server';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import { syncLogisticsToItinerary } from '@/lib/itinerary/syncLogistics';
import { withItemId } from '@/lib/logistics/itemId';
import { ownedTrip } from '@/lib/auth/ownedTrip';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await ownedTrip(id);
  if (error) return error;
  const body = await req.json();
  let logistics = await TripLogistics.findOne({ tripId: id });
  if (!logistics) logistics = await TripLogistics.create({ tripId: id, transportation: [], accommodation: [], venues: [] });
  if (!Array.isArray(logistics.venues)) logistics.venues = [];
  logistics.venues.push(withItemId(body));
  await logistics.save();
  await syncLogisticsToItinerary(id, logistics);
  return NextResponse.json({ logistics });
}
