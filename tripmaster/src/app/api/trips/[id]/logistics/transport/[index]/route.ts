import { NextResponse } from 'next/server';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import { syncLogisticsToItinerary } from '@/lib/itinerary/syncLogistics';
import { withItemId } from '@/lib/logistics/itemId';
import { relinkAfterRemoval } from '@/lib/logistics/relink';
import { ownedTrip, itemIndex } from '@/lib/auth/ownedTrip';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const { error } = await ownedTrip(id);
  if (error) return error;
  const logistics = await TripLogistics.findOne({ tripId: id });
  const i = itemIndex(index, logistics?.transportation);
  if (!logistics || i === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  logistics.transportation.splice(i, 1);
  await logistics.save();
  // Resources and expenses linked to the bookings after it move up with them
  await relinkAfterRemoval(id, 'transport', i);
  await syncLogisticsToItinerary(id, logistics);
  return NextResponse.json({ logistics });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const { error } = await ownedTrip(id);
  if (error) return error;
  const body = await req.json();
  const logistics = await TripLogistics.findOne({ tripId: id });
  const i = itemIndex(index, logistics?.transportation);
  if (!logistics || i === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  logistics.transportation[i] = withItemId(body, logistics.transportation[i]);
  logistics.markModified('transportation');
  await logistics.save();
  await syncLogisticsToItinerary(id, logistics);
  return NextResponse.json({ logistics });
}
