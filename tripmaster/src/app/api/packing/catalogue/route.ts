import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import MasterPackingItem from '@/lib/mongodb/models/MasterPackingItem';

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
  await MasterPackingItem.create(body);
  const items = await MasterPackingItem.find().sort({ category: 1, name: 1 });
  return NextResponse.json({ items });
}