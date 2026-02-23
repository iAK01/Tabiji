import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const logistics = await TripLogistics.findOne({ tripId: id });
  if (!logistics) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  logistics.transportation.splice(Number(index), 1);
  await logistics.save();
  return NextResponse.json({ logistics });
}