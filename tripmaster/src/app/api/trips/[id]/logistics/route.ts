// src/app/api/trips/[id]/logistics/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import { syncLogisticsToItinerary } from '@/lib/itinerary/syncLogistics';

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
    logistics = await TripLogistics.create({ tripId: id, transportation: [], accommodation: [], venues: [] });
  }

  // ⚠️ sync removed from GET — syncing on read was overwriting manual itinerary changes
  // Sync only fires on PUT (when logistics data is actually saved)

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

  const body      = await req.json();
  const logistics = await TripLogistics.findOneAndUpdate(
    { tripId: id },
    { $set: body },
    { new: true, upsert: true, returnDocument: 'after' }
  );

  await syncLogisticsToItinerary(id, logistics);

  return NextResponse.json({ logistics });
}