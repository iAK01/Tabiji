import { NextResponse } from 'next/server';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import SavedPlace from '@/lib/mongodb/models/SavedPlace';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/trips/[id]/saved — "Saved by you" in Discover: what was clipped for
// this trip, plus anything clipped for its cities before there was a trip.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, user, error } = await ownedTrip(id);
  if (error) return error;

  const cities = [trip.destination, ...(trip.additionalDestinations ?? [])]
    .map((p: any) => p?.city).filter(Boolean) as string[];
  const places = await SavedPlace.find({
    userId: user._id,
    $or: [
      { tripId: trip._id },
      ...(cities.length ? [{ tripId: null, city: { $in: cities.map(c => new RegExp(`^${escapeRe(c)}$`, 'i')) } }] : []),
    ],
  }).sort({ createdAt: -1 }).lean() as any[];

  return NextResponse.json({
    places: places.map(p => ({
      id:          String(p._id),
      kind:        p.kind,
      category:    p.category,
      name:        p.name,
      summary:     p.summary ?? '',
      tip:         p.tip ?? '',
      address:     p.address ?? '',
      coordinates: Number.isFinite(p.coordinates?.lat) ? p.coordinates : null,
      website:     p.website ?? '',
      city:        p.city ?? '',
      forCity:     !p.tripId,
      sources:     (p.sources ?? []).map((s: any) => ({ url: s.url, title: s.title, site: s.site })),
    })),
  });
}
