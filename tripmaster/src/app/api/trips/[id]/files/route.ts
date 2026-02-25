import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import TripFile from '@/lib/mongodb/models/TripFile';
import { uploadFile } from '@/lib/utils/storage';

// ─── GET /api/trips/[id]/files ────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const files = await TripFile.find({ tripId: id }).sort({ createdAt: -1 });
  return NextResponse.json({ files });
}

// ─── POST /api/trips/[id]/files ───────────────────────────────────────────────
// For files: multipart/form-data with file binary + metadata fields
// For links: multipart/form-data with resourceType=link, linkUrl, name, type, notes
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const formData     = await req.formData();
  const resourceType = (formData.get('resourceType') as string) || 'file';
  const name         = formData.get('name') as string | null;
  const type         = (formData.get('type') as string) || 'other';
  const notes        = (formData.get('notes') as string) || '';
  const linkedToRaw  = formData.get('linkedTo') as string | null;

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  let linkedTo: object | undefined;
  if (linkedToRaw) {
    try { linkedTo = JSON.parse(linkedToRaw); } catch { /* ignore */ }
  }

  // ── Link path ───────────────────────────────────────────────────────────────
  if (resourceType === 'link') {
    const linkUrl = formData.get('linkUrl') as string | null;
    if (!linkUrl) return NextResponse.json({ error: 'linkUrl is required for links' }, { status: 400 });

    const doc = await TripFile.create({
      tripId: id, userId: user._id,
      resourceType: 'link',
      name, type, notes: notes || undefined,
      linkUrl,
      linkedTo: linkedTo || undefined,
    });
    return NextResponse.json({ file: doc }, { status: 201 });
  }

  // ── File path ───────────────────────────────────────────────────────────────
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF and image files are accepted' }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 20MB limit' }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const gcsPath  = `${user._id}/${id}/${Date.now()}-${safeName}`;
  const buffer   = Buffer.from(await file.arrayBuffer());
  const gcsUrl   = await uploadFile(buffer, gcsPath, file.type);

  const doc = await TripFile.create({
    tripId: id, userId: user._id,
    resourceType: 'file',
    name, type, notes: notes || undefined,
    gcsPath, gcsUrl,
    mimeType: file.type,
    size: file.size,
    linkedTo: linkedTo || undefined,
  });

  return NextResponse.json({ file: doc }, { status: 201 });
}