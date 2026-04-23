import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import TripFile from '@/lib/mongodb/models/TripFile';
import { uploadFile } from '@/lib/utils/storage';

const ATTACHMENT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

async function processAttachments(
  formData: FormData, userId: string, tripId: string
): Promise<Array<{ gcsPath: string; gcsUrl: string; mimeType: string; size: number; originalName: string }>> {
  const results = [];
  for (let i = 0; ; i++) {
    const f = formData.get(`attachment_${i}`) as File | null;
    if (!f || !f.size) break;
    if (!ATTACHMENT_MIME.has(f.type) || f.size > 20 * 1024 * 1024) continue;
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const gcsPath  = `${userId}/${tripId}/attachments/${Date.now()}-${i}-${safeName}`;
    const buffer   = Buffer.from(await f.arrayBuffer());
    const gcsUrl   = await uploadFile(buffer, gcsPath, f.type);
    results.push({ gcsPath, gcsUrl, mimeType: f.type, size: f.size, originalName: f.name });
  }
  return results;
}

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
// For files:    multipart/form-data with file binary + metadata fields
// For links:    multipart/form-data with resourceType=link, linkUrl, name, type, notes
// For contacts: multipart/form-data with resourceType=contact, name, type, phone, email, notes
// For notes:    multipart/form-data with resourceType=note, name (optional), type, body
// For todos:    multipart/form-data with resourceType=todo, name, body (optional), dueAt (optional),
//               notification.enabled (optional), source (optional), packingItemRef (optional)
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

  let linkedTo: object | undefined;
  if (linkedToRaw) {
    try { linkedTo = JSON.parse(linkedToRaw); } catch { /* ignore */ }
  }

  // ── Todo path ─────────────────────────────────────────────────────────────────
  if (resourceType === 'todo') {
    if (!name?.trim()) return NextResponse.json({ error: 'name is required for todos' }, { status: 400 });

    const body            = (formData.get('body') as string | null) || '';
    const dueAtRaw        = formData.get('dueAt') as string | null;
    const notifEnabled    = formData.get('notification.enabled') === 'true';
    const source          = (formData.get('source') as string) || 'manual';
    const packingItemRef  = (formData.get('packingItemRef') as string | null) || undefined;

    let dueAt: Date | undefined;
    if (dueAtRaw) {
      const parsed = new Date(dueAtRaw);
      if (!isNaN(parsed.getTime())) dueAt = parsed;
    }

    const surfaceAt  = notifEnabled && dueAt ? dueAt : undefined;
    const attachments = await processAttachments(formData, user._id.toString(), id);

    const doc = await TripFile.create({
      tripId:   id,
      userId:   user._id,
      resourceType: 'todo',
      name:     name.trim(),
      type:     source === 'packing_advisory' ? 'packing_advisory' : 'task',
      body:     body.trim() || undefined,
      dueAt:    dueAt     || undefined,
      surfaceAt: surfaceAt || undefined,
      completed:  false,
      source,
      packingItemRef: packingItemRef || undefined,
      notification: {
        enabled:    notifEnabled,
      },
      attachments: attachments.length ? attachments : undefined,
    });

    return NextResponse.json({ file: doc }, { status: 201 });
  }

  // ── Note path ─────────────────────────────────────────────────────────────────
  if (resourceType === 'note') {
    const body = formData.get('body') as string | null;
    if (!body?.trim()) return NextResponse.json({ error: 'body is required for notes' }, { status: 400 });

    const attachments = await processAttachments(formData, user._id.toString(), id);

    const doc = await TripFile.create({
      tripId: id, userId: user._id,
      resourceType: 'note',
      name: name || '',
      type,
      body: body.trim(),
      linkedTo: linkedTo || undefined,
      attachments: attachments.length ? attachments : undefined,
    });
    return NextResponse.json({ file: doc }, { status: 201 });
  }

  // ── Contact path ─────────────────────────────────────────────────────────────
  if (resourceType === 'contact') {
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    const phone = (formData.get('phone') as string) || '';
    const email = (formData.get('email') as string) || '';

    if (!phone && !email) {
      return NextResponse.json({ error: 'At least one of phone or email is required' }, { status: 400 });
    }

    const attachments = await processAttachments(formData, user._id.toString(), id);

    const doc = await TripFile.create({
      tripId: id, userId: user._id,
      resourceType: 'contact',
      name, type, notes: notes || undefined,
      phone: phone || undefined,
      email: email || undefined,
      linkedTo: linkedTo || undefined,
      attachments: attachments.length ? attachments : undefined,
    });
    return NextResponse.json({ file: doc }, { status: 201 });
  }

  // ── Link path ─────────────────────────────────────────────────────────────────
  if (resourceType === 'link') {
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
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

  // ── File path ─────────────────────────────────────────────────────────────────
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

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