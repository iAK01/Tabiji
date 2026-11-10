import { NextResponse } from 'next/server';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import { pinAddress } from '@/lib/geo/pinAddress';
import { tripAreas } from '@/lib/geo/tripAreas';

// POST /api/trips/[id]/geocode  { address } → { pin: { lat, lng, label } | null }
// The map pin for an address typed into one of the trip's forms (AddressSearch).
// 502 when Google couldn't be asked, as opposed to a null pin for no exact match.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, error } = await ownedTrip(id);
  if (error) return error;

  const { address } = await req.json().catch(() => ({}));
  if (typeof address !== 'string' || address.length > 500) {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }
  try {
    return NextResponse.json({ pin: await pinAddress(address, tripAreas(trip)) });
  } catch (err) {
    console.error('[geocode]', err);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 502 });
  }
}
