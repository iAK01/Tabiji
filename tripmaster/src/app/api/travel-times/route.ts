import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { travelTimes } from '@/lib/geo/travelTimes';

// GET /api/travel-times?from=lat,lng&to=lat,lng → { walking, driving, transit } in minutes.
// Signed-in only: the transit lookups spend the Google allowance.

function point(v: string | null): { lat: number; lng: number } | null {
  const [lat, lng] = (v ?? '').split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = point(searchParams.get('from'));
  const to   = point(searchParams.get('to'));
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to must be lat,lng' }, { status: 400 });
  }

  return NextResponse.json(await travelTimes(from, to));
}
