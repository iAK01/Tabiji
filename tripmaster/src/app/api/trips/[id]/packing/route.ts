import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripPacking from '@/lib/mongodb/models/TripPacking';
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

  const packing = await TripPacking.findOne({ tripId: id });
  return NextResponse.json({ packing });
}

// Toggle a single item packed status
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const { itemIndex, packed } = await req.json();

  const packing = await TripPacking.findOne({ tripId: id });
  if (!packing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  packing.items[itemIndex].packed = packed;
  packing.items[itemIndex].packedAt = packed ? new Date() : null;

  const packedCount = packing.items.filter((i: { packed: boolean }) => i.packed).length;
  packing.packedItems = packedCount;
  packing.packingProgress = Math.round((packedCount / packing.items.length) * 100);

  await packing.save();
  return NextResponse.json({ packing });
}

// Add a manual item
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const body = await req.json();

  const packing = await TripPacking.findOne({ tripId: id });
  if (!packing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  packing.items.push({
    name: body.name,
    category: body.category || 'Other',
    quantity: body.quantity || 1,
    quantityType: 'fixed',
    essential: false,
    packed: false,
    packedAt: null,
    preTravelAction: false,
    preTravelNote: '',
    advisoryNote: body.advisoryNote || '',
    source: 'manual',
  });

  packing.totalItems = packing.items.length;
  await packing.save();
  return NextResponse.json({ packing });
}