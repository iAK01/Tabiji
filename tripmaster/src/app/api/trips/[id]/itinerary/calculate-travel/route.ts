import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';

async function getMapboxRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }, mode: string) {
  const profile = mode === 'walk' ? 'walking' : mode === 'car' ? 'driving' : 'driving';
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.routes?.length) return null;
  return {
    duration: Math.round(data.routes[0].duration / 60),
    distance: Math.round(data.routes[0].distance),
  };
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();

  const itinerary = await TripItinerary.findOne({ tripId: id });
  if (!itinerary) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  for (const day of itinerary.days) {
    for (let i = 0; i < day.stops.length - 1; i++) {
      const current = day.stops[i];
      const next = day.stops[i + 1];

      if (!current.coordinates || !next.coordinates) continue;

      const distance = Math.sqrt(
        Math.pow((next.coordinates.lat - current.coordinates.lat) * 111000, 2) +
        Math.pow((next.coordinates.lng - current.coordinates.lng) * 85000, 2)
      );

      // Pick mode based on distance
      const mode = distance < 800 ? 'walk' : distance < 5000 ? 'taxi' : 'taxi';
      const routeMode = distance < 800 ? 'walk' : 'car';

      const route = await getMapboxRoute(current.coordinates, next.coordinates, routeMode);
      if (!route) continue;

      // Time available between end of current stop and start of next
      const currentEnd = new Date(current.scheduledStart).getTime() + (current.duration * 60000);
      const nextStart = new Date(next.scheduledStart).getTime();
      const timeAvailable = Math.round((nextStart - currentEnd) / 60000);
      const buffer = timeAvailable - route.duration;

      current.travelToNext = {
        duration: route.duration,
        distance: route.distance,
        mode,
        isTight: buffer >= 0 && buffer <= 15,
        isImpossible: buffer < 0,
      };
    }
  }

  itinerary.markModified('days');
  await itinerary.save();
  return NextResponse.json({ days: itinerary.days });
}