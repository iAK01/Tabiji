// src/app/api/trips/[id]/logistics/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';

// ─── Itinerary sync ───────────────────────────────────────────────────────────
//
// Rebuilds all logistics-sourced itinerary stops from current logistics state.
// Strips any existing stops tagged source:'logistics', then recreates them.
// Handles all transport modes — not just flights.

function transportStopLabel(t: any): string {
  const type = t.type ?? 'flight';

  switch (type) {
    case 'flight': {
      const flight = t.details?.flightNumber ?? t.flightNumber ?? '';
      const from   = t.departureLocation ?? t.departureAirport ?? '';
      const to     = t.arrivalLocation   ?? t.arrivalAirport   ?? '';
      return [flight, from && to ? `${from} → ${to}` : (from || to)].filter(Boolean).join(' · ');
    }
    case 'train': {
      const op    = t.details?.operator ?? '';
      const from  = t.departureLocation ?? '';
      const to    = t.arrivalLocation   ?? '';
      const route = from && to ? `${from} → ${to}` : (from || to);
      return op ? `${route} · ${op}` : route;
    }
    case 'bus': {
      const op    = t.details?.operator ?? '';
      const from  = t.departureLocation ?? '';
      const to    = t.arrivalLocation   ?? '';
      const route = from && to ? `${from} → ${to}` : (from || to);
      return ['Bus', op, route].filter(Boolean).join(' · ');
    }
    case 'ferry': {
      const op    = t.details?.operator ?? '';
      const from  = t.departureLocation ?? '';
      const to    = t.arrivalLocation   ?? '';
      const route = from && to ? `${from} → ${to}` : (from || to);
      return ['Ferry', op, route].filter(Boolean).join(' · ');
    }
    case 'car': {
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return from && to ? `Drive: ${from} → ${to}` : 'Drive';
    }
    case 'car_hire': {
      const co = t.details?.rentalCompany ?? '';
      const pu = t.details?.pickupLocation ?? t.departureLocation ?? '';
      return ['Car hire', co, pu ? `Pickup: ${pu}` : ''].filter(Boolean).join(' · ');
    }
    case 'taxi': {
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return from && to ? `Taxi: ${from} → ${to}` : 'Taxi';
    }
    case 'private_transfer': {
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return from && to ? `Transfer: ${from} → ${to}` : 'Private transfer';
    }
    case 'bicycle': {
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return from && to ? `Cycle: ${from} → ${to}` : 'Bicycle';
    }
    default: {
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return from && to ? `${from} → ${to}` : 'Transport';
    }
  }
}

function toTimeString(dt: string | Date | undefined): string {
  if (!dt) return '09:00';
  const d = new Date(dt);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function toDateString(dt: string | Date | undefined): string {
  if (!dt) return '';
  return new Date(dt).toISOString().split('T')[0];
}

// Determine stop colour by transport type
function stopColor(type: string): string {
  switch (type) {
    case 'flight':           return '#c9521b'; // terracotta
    case 'train':            return '#7b52ab'; // purple
    case 'bus':              return '#1565c0'; // blue
    case 'ferry':            return '#00838f'; // teal
    case 'car':
    case 'car_hire':         return '#2e7d32'; // green
    case 'taxi':
    case 'private_transfer': return '#f57f17'; // amber
    case 'bicycle':          return '#558b2f'; // light green
    default:                 return '#455a64'; // grey
  }
}

async function syncLogisticsToItinerary(tripId: string, logistics: any) {
  try {
    const itinerary = await TripItinerary.findOne({ tripId });
    if (!itinerary) return;

    // Strip all existing logistics-sourced stops from every day
    for (const day of itinerary.days) {
      day.stops = (day.stops ?? []).filter((s: any) => s.source !== 'logistics');
    }

    const newStops: any[] = [];

    // ── Transport stops ──────────────────────────────────────────────────────
    for (const t of logistics.transportation ?? []) {
      const depTime  = t.departureTime;
      const arrTime  = t.arrivalTime;
      const label    = transportStopLabel(t);
      const color    = stopColor(t.type ?? 'flight');
      const type     = t.type === 'flight' ? 'flight' : 'transport';

      if (depTime) {
        const depDate = toDateString(depTime);
        newStops.push({
          date:      depDate,
          time:      toTimeString(depTime),
          label:     label,
          type,
          color,
          locked:    true,
          source:    'logistics',
          metadata:  { transportType: t.type, phase: 'departure' },
        });
      }

      // Arrival stop — only add if it's a different date or the mode warrants it
      if (arrTime) {
        const arrDate = toDateString(arrTime);
        const depDate = depTime ? toDateString(depTime) : null;

        // For flights and long-haul modes, always create arrival stop
        // For short modes (taxi, car, bicycle), only if different date
        const shortMode = ['taxi', 'car', 'bicycle'].includes(t.type ?? '');
        if (!shortMode || arrDate !== depDate) {
          newStops.push({
            date:     arrDate,
            time:     toTimeString(arrTime),
            label:    `Arrive: ${t.arrivalLocation ?? t.arrivalAirport ?? label}`,
            type,
            color,
            locked:   true,
            source:   'logistics',
            metadata: { transportType: t.type, phase: 'arrival' },
          });
        }
      }
    }

    // ── Accommodation stops ──────────────────────────────────────────────────
    for (const a of logistics.accommodation ?? []) {
      if (a.checkIn) {
        newStops.push({
          date:     toDateString(a.checkIn),
          time:     '15:00', // standard check-in time
          label:    `Check in: ${a.name ?? 'Accommodation'}`,
          type:     'accommodation',
          color:    '#1a3a5c', // deep navy
          locked:   true,
          source:   'logistics',
          metadata: { accommodationType: a.type, phase: 'checkin' },
        });
      }
      if (a.checkOut) {
        newStops.push({
          date:     toDateString(a.checkOut),
          time:     '11:00', // standard check-out time
          label:    `Check out: ${a.name ?? 'Accommodation'}`,
          type:     'accommodation',
          color:    '#1a3a5c',
          locked:   true,
          source:   'logistics',
          metadata: { accommodationType: a.type, phase: 'checkout' },
        });
      }
    }

    // ── Assign stops to the correct day ──────────────────────────────────────
    for (const stop of newStops) {
      let day = itinerary.days.find((d: any) => d.date === stop.date);
      if (!day) {
        // Day doesn't exist yet — create it
        itinerary.days.push({ date: stop.date, stops: [] });
        day = itinerary.days[itinerary.days.length - 1];
      }
      const { date, ...stopWithoutDate } = stop;
      day.stops.push(stopWithoutDate);
    }

    // Sort days and stops chronologically
    itinerary.days.sort((a: any, b: any) => a.date.localeCompare(b.date));
    for (const day of itinerary.days) {
      day.stops.sort((a: any, b: any) => a.time.localeCompare(b.time));
    }

    await TripItinerary.findOneAndUpdate(
      { _id: itinerary._id },
      { $set: { days: itinerary.days } },
      { returnDocument: 'after' }
    );
  } catch (err) {
    console.error('syncLogisticsToItinerary failed:', err);
    // Non-fatal — logistics still saves correctly
  }
}

// ─── GET /api/trips/[id]/logistics ───────────────────────────────────────────
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let logistics = await TripLogistics.findOne({ tripId: id });
  if (!logistics) {
    logistics = await TripLogistics.create({ tripId: id, transportation: [], accommodation: [] });
  }

  await syncLogisticsToItinerary(id, logistics);

  return NextResponse.json({ logistics });
}

// ─── PUT /api/trips/[id]/logistics ───────────────────────────────────────────
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body     = await req.json();
  const logistics = await TripLogistics.findOneAndUpdate(
    { tripId: id },
    { $set: body },
    { new: true, upsert: true, returnDocument: 'after' }
  );

  await syncLogisticsToItinerary(id, logistics);

  return NextResponse.json({ logistics });
}