import { getServerSession } from 'next-auth';
import connectDB            from '@/lib/mongodb/connection';
import Trip                 from '@/lib/mongodb/models/Trip';
import User                 from '@/lib/mongodb/models/User';
import TripItinerary        from '@/lib/mongodb/models/TripItinerary';
import TripLogistics        from '@/lib/mongodb/models/TripLogistics';
import { buildTripIcs, type CalendarCategory } from '@/lib/calendar/buildTripIcs';

const ALL: CalendarCategory[] = ['itinerary', 'transport', 'accommodation', 'venues'];

// GET /api/trips/[id]/calendar?include=itinerary,transport,accommodation,venues&alarms=1
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return new Response('Unauthorised', { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user?._id, deleted: false });
  if (!trip) return new Response('Not found', { status: 404 });

  const url     = new URL(req.url);
  const raw     = url.searchParams.get('include');
  const include = raw
    ? (raw.split(',').map(s => s.trim()).filter(s => ALL.includes(s as CalendarCategory)) as CalendarCategory[])
    : ALL;
  const alarms  = url.searchParams.get('alarms') === '1';

  const [itinerary, logistics] = await Promise.all([
    TripItinerary.findOne({ tripId: id }).lean(),
    TripLogistics.findOne({ tripId: id }).lean(),
  ]);

  const ics = buildTripIcs(trip.toObject(), itinerary as any, logistics as any, { include, alarms });

  const slug = (trip.name || 'trip')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'trip';

  return new Response(ics, {
    headers: {
      'Content-Type':        'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
      'Cache-Control':       'no-store',
    },
  });
}
