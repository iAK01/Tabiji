import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import { syncLogisticsToItinerary } from '@/lib/itinerary/syncLogistics';
import User from '@/lib/mongodb/models/User';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const logistics = await TripLogistics.findOne({ tripId: id });
  if (!logistics) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  logistics.accommodation.splice(Number(index), 1);
  await logistics.save();
  await syncLogisticsToItinerary(id, logistics);
  return NextResponse.json({ logistics });
}
export async function PUT(req: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const body = await req.json();
  const user = await User.findOne({ email: session.user.email });
  const logistics = await TripLogistics.findOne({ tripId: id });
  if (!logistics) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  logistics.accommodation[Number(index)] = body;
  logistics.markModified('accommodation');
  await logistics.save();
  await syncLogisticsToItinerary(id, logistics);
  return NextResponse.json({ logistics });
}