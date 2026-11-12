import { NextResponse } from 'next/server';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import { addStop } from '@/lib/itinerary/stops';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, error } = await ownedTrip(id);
  if (error) return error;

  const { dayDate, stop } = await req.json();
  const result = await addStop(trip, dayDate, stop);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ days: result.itinerary.days });
}
