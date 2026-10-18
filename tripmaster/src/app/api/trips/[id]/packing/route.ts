import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import TripPacking from '@/lib/mongodb/models/TripPacking';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import { packingCounts } from '@/lib/packing/counts';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  if (!await ownedTrip(id, session.user.email)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const packing = await TripPacking.findOne({ tripId: id });
  return NextResponse.json({ packing });
}

// Both writes below are single atomic updates rather than load-modify-save of the whole
// items array: with load-modify-save, an add and a toggle landing together each write
// back their own copy of the list and one silently wipes the other.

async function ownedTrip(id: string, email: string) {
  const user = await User.findOne({ email });
  return user ? Trip.findOne({ _id: id, userId: user._id }) : null;
}

// Re-derive the counters from the list as it now stands in the database.
async function syncCounts(packing: any) {
  const items = packing.items ?? [];
  const c     = packingCounts(items);
  const counts = {
    totalItems:      items.length,
    packedItems:     c.packed,
    skippedItems:    c.skipped,
    packingProgress: c.progress,
  };
  await TripPacking.updateOne({ _id: packing._id }, { $set: counts });
  Object.assign(packing, counts);
  return packing;
}

// Set one item's status: { packed } and/or { skipped } ("not bringing"). The two are
// exclusive — packing an item un-skips it and vice versa.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  if (!await ownedTrip(id, session.user.email)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { itemIndex, name, packed, skipped } = await req.json();
  if (!Number.isInteger(itemIndex) || itemIndex < 0) {
    return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
  }
  if ((typeof packed !== 'boolean' && typeof skipped !== 'boolean') || (packed === true && skipped === true)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const at  = `items.${itemIndex}`;
  const set: Record<string, unknown> = {};
  if (typeof packed === 'boolean') {
    set[`${at}.packed`]   = packed;
    set[`${at}.packedAt`] = packed ? new Date() : null;
    if (packed) set[`${at}.skipped`] = false;
  }
  if (typeof skipped === 'boolean') {
    set[`${at}.skipped`] = skipped;
    if (skipped) { set[`${at}.packed`] = false; set[`${at}.packedAt`] = null; }
  }

  // With a name, only change the item if it's still the one at that index — a list
  // regenerated elsewhere would otherwise get the wrong item ticked.
  const packing = await TripPacking.findOneAndUpdate(
    { tripId: id, ...(typeof name === 'string' ? { [`${at}.name`]: name } : { [at]: { $exists: true } }) },
    { $set: set },
    { new: true },
  );
  if (!packing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ packing: await syncCounts(packing) });
}

// Add a manual item
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  if (!await ownedTrip(id, session.user.email)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Item name is required' }, { status: 400 });

  const packing = await TripPacking.findOneAndUpdate(
    { tripId: id },
    { $push: { items: {
      name,
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
    } } },
    { new: true },
  );
  if (!packing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ packing: await syncCounts(packing) });
}
