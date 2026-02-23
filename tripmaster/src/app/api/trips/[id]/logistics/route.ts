import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const logistics = await TripLogistics.findOneAndUpdate(
    { tripId: id },
    { $setOnInsert: { tripId: id, transportation: [], accommodation: [] } },
    { upsert: true, new: true }
  );
  // Sync on every load so existing logistics appear in itinerary without needing a save
  await syncLogisticsToItinerary(id, logistics, trip);

  return NextResponse.json({ logistics });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const logistics = await TripLogistics.findOneAndUpdate(
    { tripId: id },
    { $set: body },
    { new: true, upsert: true }
  );

  await syncLogisticsToItinerary(id, logistics, trip);

  return NextResponse.json({ logistics });
}

// ─── Sync helper ─────────────────────────────────────────────────────────────
// Rebuilds all logistics-sourced stops in the itinerary whenever logistics change.
// Stops tagged source:'logistics' are fully managed here — user manual stops are untouched.

async function syncLogisticsToItinerary(tripId: string, logistics: any, trip: any) {
  const itinerary = await TripItinerary.findOne({ tripId });
  if (!itinerary?.days?.length) return;

  // Build a lookup: ISO date string → day index
  const dayIndex: Record<string, number> = {};
  itinerary.days.forEach((day: any, i: number) => {
    const key = new Date(day.date).toISOString().split('T')[0];
    dayIndex[key] = i;
  });

  // Strip all existing logistics-sourced stops from every day
  itinerary.days.forEach((day: any) => {
    day.stops = (day.stops ?? []).filter((s: any) => s.source !== 'logistics');
  });

  // ── Flights ──────────────────────────────────────────────────────────────
  for (const t of logistics.transportation ?? []) {
    if (t.type !== 'flight' || !t.departureTime) continue;

    const depDate = t.departureTime.split('T')[0];
    const arrDate = t.arrivalTime ? t.arrivalTime.split('T')[0] : depDate;
    const depTime = t.departureTime.split('T')[1]?.slice(0, 5) ?? '';
    const arrTime = t.arrivalTime ? t.arrivalTime.split('T')[1]?.slice(0, 5) : null;

    const depDayIdx = dayIndex[depDate];
    const arrDayIdx = dayIndex[arrDate];

    // Departure stop
    if (depDayIdx !== undefined) {
      itinerary.days[depDayIdx].stops.push({
        source: 'logistics',
        type: 'transport',
        icon: '✈️',
        name: `Flight ${t.flightNumber ?? ''} — ${t.departureAirport} → ${t.arrivalAirport}`,
        time: depTime,
        notes: [
          t.airline,
          t.seat ? `Seat ${t.seat}` : null,
          t.confirmationNumber ? `Ref: ${t.confirmationNumber}` : null,
          t.status === 'confirmed' ? '✅ Confirmed' : '⏳ Not booked',
        ].filter(Boolean).join(' · '),
        sortOrder: depTime ? parseInt(depTime.replace(':', '')) : 9999,
      });
    }

    // Arrival stop — only add if it lands on a different day (overnight flight)
    if (arrDayIdx !== undefined && arrDayIdx !== depDayIdx && arrTime) {
      itinerary.days[arrDayIdx].stops.push({
        source: 'logistics',
        type: 'transport',
        icon: '🛬',
        name: `Arrive ${t.arrivalAirport} (${t.flightNumber ?? ''})`,
        time: arrTime,
        notes: `Arriving from ${t.departureAirport}`,
        sortOrder: arrTime ? parseInt(arrTime.replace(':', '')) : 0,
      });
    }
  }

  // ── Accommodation ─────────────────────────────────────────────────────────
  for (const a of logistics.accommodation ?? []) {
    if (!a.name) continue;

    const checkInDate = a.checkIn ? new Date(a.checkIn).toISOString().split('T')[0] : null;
    const checkOutDate = a.checkOut ? new Date(a.checkOut).toISOString().split('T')[0] : null;

    if (checkInDate && dayIndex[checkInDate] !== undefined) {
      itinerary.days[dayIndex[checkInDate]].stops.push({
        source: 'logistics',
        type: 'accommodation',
        icon: '🏨',
        name: `Check in — ${a.name}`,
        time: a.checkInTime ?? '14:00',
        notes: [
          a.address,
          a.confirmationNumber ? `Ref: ${a.confirmationNumber}` : null,
          a.status === 'confirmed' ? '✅ Confirmed' : '⏳ Not booked',
        ].filter(Boolean).join(' · '),
        sortOrder: a.checkInTime ? parseInt(a.checkInTime.replace(':', '')) : 1400,
      });
    }

    if (checkOutDate && dayIndex[checkOutDate] !== undefined) {
      itinerary.days[dayIndex[checkOutDate]].stops.push({
        source: 'logistics',
        type: 'accommodation',
        icon: '🧳',
        name: `Check out — ${a.name}`,
        time: a.checkOutTime ?? '11:00',
        notes: a.address ?? '',
        sortOrder: a.checkOutTime ? parseInt(a.checkOutTime.replace(':', '')) : 1100,
      });
    }
  }

  // Sort stops within each day by sortOrder
  itinerary.days.forEach((day: any) => {
    day.stops.sort((a: any, b: any) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
  });

 await itinerary.constructor.findOneAndUpdate(
  { _id: itinerary._id },
  { $set: { days: itinerary.days } },
  { returnDocument: 'after' }
);
}