import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import TripFile from '@/lib/mongodb/models/TripFile';
import { deleteFile } from '@/lib/utils/storage';

// ─── DELETE /api/trips/[id]/files/[fileId] ────────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Verify ownership — file must belong to this user and this trip
  const doc = await TripFile.findOne({ _id: fileId, tripId: id, userId: user._id });
  if (!doc) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  // Remove from GCS first, then MongoDB
  // deleteFile in storage.ts silently ignores missing files so this is safe
  await deleteFile(doc.gcsPath);
  await TripFile.findByIdAndDelete(fileId);

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const fd      = await req.formData();
  const updates: Record<string, any> = {
    name:  fd.get('name'),
    type:  fd.get('type'),
    notes: fd.get('notes') ?? '',
  };
  if (fd.get('linkUrl')) updates.linkUrl = fd.get('linkUrl');
  if (fd.get('phone'))   updates.phone   = fd.get('phone');
  if (fd.get('email'))   updates.email   = fd.get('email');
  const TripFile = (await import('@/lib/mongodb/models/TripFile')).default;
  const file = await TripFile.findByIdAndUpdate(fileId, updates, { new: true });
  return NextResponse.json({ file });
}