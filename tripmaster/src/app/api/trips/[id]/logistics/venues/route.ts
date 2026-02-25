// app/api/trips/[id]/venues/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  await connectDB();

  const body = await req.json();

  let logistics = await TripLogistics.findOne({ tripId: id });
  if (!logistics) {
    logistics = await TripLogistics.create({
      tripId: id,
      transportation: [],
      accommodation: [],
      venues: [],
    });
  }

  if (!Array.isArray(logistics.venues)) logistics.venues = [];
  logistics.venues.push(body);

  await logistics.save();

  return NextResponse.json({ logistics });
}