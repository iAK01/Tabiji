import { NextResponse } from 'next/server';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import { tripAreas } from '@/lib/geo/tripAreas';
import { pinPlace, searchArea } from '@/lib/geo/pinPlace';

// POST /api/trips/[id]/locate  { name, address, near? } → { pin: { lat, lng, label, source } | null }
// Navigate asks here before opening a map app for a place with no pin: map apps
// given loose text guess, so they only ever get a point this finds for certain.
// `near` (where you'll set off from) picks which of the trip's towns to search.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, error } = await ownedTrip(id);
  if (error) return error;

  const body    = await req.json().catch(() => ({}));
  const name    = typeof body.name    === 'string' ? body.name.slice(0, 300)    : '';
  const address = typeof body.address === 'string' ? body.address.slice(0, 500) : '';
  if (!name.trim() && !address.trim()) return NextResponse.json({ error: 'name or address required' }, { status: 400 });
  const near = Number.isFinite(body.near?.lat) && Number.isFinite(body.near?.lng) ? { lat: body.near.lat, lng: body.near.lng } : null;

  const areas = tripAreas(trip);
  const area  = searchArea(areas, near, trip.destination?.country);
  if (!area) return NextResponse.json({ pin: null });

  const pin = await pinPlace({ name, address }, area, areas);
  return NextResponse.json({ pin: pin && { lat: pin.lat, lng: pin.lng, label: pin.address, source: pin.source } });
}
