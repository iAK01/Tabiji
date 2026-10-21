import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import { nightPages } from '@/lib/itinerary/nights';

type LatLng = { lat: number; lng: number };
type Leg = { duration: number; distance: number } | null;

async function getMapboxRoute(
  from: LatLng, to: LatLng, mode: 'walk' | 'car',
  cache: Map<string, Leg>,
): Promise<Leg> {
  const key = `${mode}:${from.lng.toFixed(5)},${from.lat.toFixed(5)};${to.lng.toFixed(5)},${to.lat.toFixed(5)}`;
  if (cache.has(key)) return cache.get(key)!;

  const profile = mode === 'walk' ? 'walking' : 'driving';
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;
  let result: Leg = null;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes?.length) {
      result = {
        duration: Math.round(data.routes[0].duration / 60),
        distance: Math.round(data.routes[0].distance),
      };
    }
  } catch { /* leave result null */ }
  cache.set(key, result);
  return result;
}

// Rough straight-line metres — only used to pick walk vs drive before the API call.
function crowFlies(a: LatLng, b: LatLng): number {
  return Math.sqrt(
    Math.pow((b.lat - a.lat) * 111000, 2) +
    Math.pow((b.lng - a.lng) * 85000, 2),
  );
}

function ymd(v: any): string {
  return v ? String(v).split('T')[0] : '';
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const cache = new Map<string, Leg>();

  const itinerary = await TripItinerary.findOne({ tripId: id });
  if (!itinerary) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const logistics = await TripLogistics.findOne({ tripId: id });
  const accoms = (logistics?.accommodation ?? [])
    .filter((a: any) => a.name && a.coordinates && a.checkIn)
    .map((a: any) => ({
      name: a.name as string,
      coordinates: a.coordinates as LatLng,
      checkIn: ymd(a.checkIn),
      checkOut: ymd(a.checkOut || a.checkIn),
    }));

  // Recomputed from scratch — drop any stale legs first (a stop that lost its
  // coordinates, or is no longer the last of the day).
  for (const day of itinerary.days) {
    for (const s of day.stops ?? []) s.travelToNext = undefined;
  }

  // Legs follow each day's page as it's read: a night's after-midnight stops
  // (stored on the next date) carry on its evening, and the way back to the
  // hotel comes after them, not at midnight.
  const pages = nightPages(itinerary.days);
  for (let d = 0; d < itinerary.days.length; d++) {
    const day   = itinerary.days[d];
    const stops = pages[d].stops as any[];
    const dayYmd = ymd(day.date);
    const hotel = accoms.find((a: any) => a.checkIn <= dayYmd && dayYmd <= a.checkOut) ?? null;

    // Stop → stop legs
    for (let i = 0; i < stops.length - 1; i++) {
      const current = stops[i];
      const next = stops[i + 1];
      if (!current.coordinates || !next.coordinates) continue;
      if (!current.scheduledStart || !next.scheduledStart) continue;
      if (current.skipped || next.skipped) continue;

      const metres = crowFlies(current.coordinates, next.coordinates);
      const mode: 'walk' | 'taxi' = metres < 800 ? 'walk' : 'taxi';
      const routeMode: 'walk' | 'car' = metres < 800 ? 'walk' : 'car';

      const route = await getMapboxRoute(current.coordinates, next.coordinates, routeMode, cache);
      if (!route) continue;

      const currentEnd = new Date(current.scheduledStart).getTime() + (current.duration * 60000);
      const nextStart = new Date(next.scheduledStart).getTime();
      const buffer = Math.round((nextStart - currentEnd) / 60000) - route.duration;

      current.travelToNext = {
        duration: route.duration,
        distance: route.distance,
        mode,
        isTight: buffer >= 0 && buffer <= 15,
        isImpossible: buffer < 0,
      };
    }

    // End-of-day leg back to the hotel — the "how do I get back" a business
    // traveller wants. Only when the last stop has coords and isn't the hotel itself.
    const last = stops[stops.length - 1];
    if (hotel && last?.coordinates && last.source !== 'logistics') {
      const metres = crowFlies(last.coordinates, hotel.coordinates);
      if (metres > 120) {
        const routeMode: 'walk' | 'car' = metres < 800 ? 'walk' : 'car';
        const route = await getMapboxRoute(last.coordinates, hotel.coordinates, routeMode, cache);
        if (route) {
          last.travelToNext = {
            duration: route.duration,
            distance: route.distance,
            mode: metres < 800 ? 'walk' : 'taxi',
            isTight: false,
            isImpossible: false,
            toName: hotel.name,
          };
        }
      }
    }
  }

  itinerary.markModified('days');
  await itinerary.save();
  return NextResponse.json({ days: itinerary.days });
}
