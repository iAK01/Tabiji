import { NextResponse } from 'next/server';
import { addBooking } from '@/lib/logistics/bookings';
import { ownedTrip } from '@/lib/auth/ownedTrip';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await ownedTrip(id);
  if (error) return error;
  const body = await req.json();
  const { logistics } = await addBooking(id, 'venue', body);
  return NextResponse.json({ logistics });
}
