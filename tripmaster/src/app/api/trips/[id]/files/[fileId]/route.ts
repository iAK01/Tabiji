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
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const doc = await TripFile.findOne({ _id: fileId, tripId: id, userId: user._id });
  if (!doc) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  // Only attempt GCS deletion for actual uploaded files — links, contacts and notes have no GCS object
  if (doc.resourceType === 'file' && doc.gcsPath) {
    await deleteFile(doc.gcsPath);
  }

  await TripFile.findByIdAndDelete(fileId);
  return NextResponse.json({ success: true });
}

// ─── PUT /api/trips/[id]/files/[fileId] ───────────────────────────────────────
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const doc = await TripFile.findOne({ _id: fileId, tripId: id, userId: user._id });
  if (!doc) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const fd = await req.formData();

  const updates: Record<string, any> = {
    type: fd.get('type') ?? doc.type,
  };

  // name — optional for notes, required for everything else (keep existing if not provided)
  const name = fd.get('name') as string | null;
  if (name !== null) updates.name = name;

  if (doc.resourceType === 'note') {
    const body = fd.get('body') as string | null;
    if (body !== null) updates.body = body.trim();
  } else if (doc.resourceType === 'link') {
    updates.notes = fd.get('notes') ?? '';
    const linkUrl = fd.get('linkUrl') as string | null;
    if (linkUrl) updates.linkUrl = linkUrl;
  } else if (doc.resourceType === 'contact') {
    updates.notes = fd.get('notes') ?? '';
    const phone = fd.get('phone') as string | null;
    const email = fd.get('email') as string | null;
    if (phone !== null) updates.phone = phone;
    if (email !== null) updates.email = email;
  } else {
    // file — metadata only, no re-upload
    updates.notes = fd.get('notes') ?? '';
  }
    // ── linkedTo — persist whether set or cleared ─────────────────────────────
  const linkedToRaw = fd.get('linkedTo') as string | null;
  if (linkedToRaw) {
    try { updates.linkedTo = JSON.parse(linkedToRaw); } catch { }
  } else {
    updates.linkedTo = null; // user cleared the link
  }

  const file = await TripFile.findByIdAndUpdate(fileId, updates, { new: true });
  return NextResponse.json({ file });
}