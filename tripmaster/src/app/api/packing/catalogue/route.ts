import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import MasterPackingItem from '@/lib/mongodb/models/MasterPackingItem';
import { sameName } from '@/lib/packing/search';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const items = await MasterPackingItem.find().sort({ category: 1, name: 1 });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Item name is required' }, { status: 400 });

  // One item per name — case, spacing and punctuation ignored.
  const clash = sameName(name, await MasterPackingItem.find({}, 'name').lean());
  if (clash) return NextResponse.json({ error: `“${clash.name}” is already in the catalogue` }, { status: 409 });

  await MasterPackingItem.create({ ...body, name });
  const items = await MasterPackingItem.find().sort({ category: 1, name: 1 });
  return NextResponse.json({ items });
}
