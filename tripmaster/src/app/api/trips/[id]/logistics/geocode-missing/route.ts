import { NextResponse }      from 'next/server';
import { getServerSession }  from 'next-auth';
import connectDB             from '@/lib/mongodb/connection';
import Trip                  from '@/lib/mongodb/models/Trip';
import User                  from '@/lib/mongodb/models/User';
import TripLogistics         from '@/lib/mongodb/models/TripLogistics';
import { syncLogisticsToItinerary } from '@/lib/itinerary/syncLogistics';
import { geocodeNear }       from '@/lib/geo/geocode';

// POST /api/trips/[id]/logistics/geocode-missing
// Backfills real address + coordinates for venues / accommodation that were
// saved without a verified location (e.g. imported before geocoding existed).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user?._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const dest = trip.destination?.coordinates;
  if (!dest?.lat || !dest?.lng) {
    return NextResponse.json({ error: 'Trip destination has no coordinates — save the trip first.' }, { status: 400 });
  }

  const logistics = await TripLogistics.findOne({ tripId: id });
  if (!logistics) return NextResponse.json({ fixed: 0, stillMissing: 0, checked: 0 });

  const proximity    = { lat: dest.lat, lng: dest.lng };
  const fallbackCity = [trip.destination?.city, trip.destination?.country].filter(Boolean).join(', ');

  let fixed = 0, stillMissing = 0, checked = 0, changed = false;

  // Sequential on purpose — this is a one-off repair, not a hot path.
  const repair = async (item: any) => {
    if (!item?.name || item.coordinates?.lat) return;   // named + not already located
    checked++;
    const query = (item.searchQuery || `${item.name}, ${fallbackCity}`).trim();
    const hit = await geocodeNear(query, proximity, 40);
    if (hit) {
      item.address     = hit.address;
      item.coordinates = { lat: hit.lat, lng: hit.lng };
      delete item.addressUnverified;
      fixed++;
      changed = true;
    } else {
      item.addressUnverified = true;
      // A bare "City" / "City, Country" address navigates to the city centre —
      // worse than nothing. Drop it so the map and navigate button stay hidden.
      const a = String(item.address ?? '').trim().toLowerCase();
      if (a && (a === fallbackCity.toLowerCase() || fallbackCity.toLowerCase().includes(a))) {
        item.address = '';
        changed = true;
      }
      stillMissing++;
    }
  };

  for (const v of logistics.venues        ?? []) await repair(v);
  for (const a of logistics.accommodation ?? []) await repair(a);

  if (changed) {
    logistics.markModified('venues');
    logistics.markModified('accommodation');
    await logistics.save();
    await syncLogisticsToItinerary(id, logistics);   // push new coords into the mirrored itinerary stops
  }

  return NextResponse.json({ fixed, stillMissing, checked });
}
