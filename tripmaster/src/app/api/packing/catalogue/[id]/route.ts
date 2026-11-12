import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import MasterPackingItem from '@/lib/mongodb/models/MasterPackingItem';
import { deleteFile } from '@/lib/utils/storage';
import { sameName } from '@/lib/packing/search';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const item = await MasterPackingItem.findById(id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const item = await MasterPackingItem.findById(id);
  if (item?.photoUrl) {
    const path = item.photoUrl.split(`${process.env.GOOGLE_CLOUD_BUCKET_NAME}/`)[1];
    if (path) await deleteFile(path);
  }
  await MasterPackingItem.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const body = await req.json();
  if (typeof body.name === 'string') {
    body.name = body.name.trim();
    if (!body.name) return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    const clash = sameName(body.name, await MasterPackingItem.find({ _id: { $ne: id } }, 'name').lean());
    if (clash) return NextResponse.json({ error: `“${clash.name}” is already in the catalogue` }, { status: 409 });
  }
  const item = await MasterPackingItem.findByIdAndUpdate(id, body, { new: true });
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ item });
}