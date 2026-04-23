import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import TripFile from '@/lib/mongodb/models/TripFile';
import { uploadFile, deleteFile } from '@/lib/utils/storage';

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

  if (doc.resourceType === 'file' && doc.gcsPath) {
    await deleteFile(doc.gcsPath);
  }

  for (const att of (doc.attachments ?? [])) {
    if (att.gcsPath) await deleteFile(att.gcsPath);
  }

  await TripFile.findByIdAndDelete(fileId);
  return NextResponse.json({ success: true });
}

// ─── PUT /api/trips/[id]/files/[fileId] ───────────────────────────────────────
// Full metadata update — used for editing files, links, contacts, notes, and todos
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

  if (doc.resourceType === 'todo') {
    const body         = fd.get('body') as string | null;
    const dueAtRaw     = fd.get('dueAt') as string | null;
    const notifEnabled = fd.get('notification.enabled');

    if (body !== null) updates.body = body.trim();

    if (dueAtRaw !== null) {
      const parsed = new Date(dueAtRaw);
      if (!isNaN(parsed.getTime())) {
        updates.dueAt = parsed;
        // Re-derive surfaceAt whenever dueAt changes
        const willNotify = notifEnabled !== null
          ? notifEnabled === 'true'
          : doc.notification?.enabled;
        updates.surfaceAt = willNotify ? parsed : null;
      } else {
        updates.dueAt     = null;
        updates.surfaceAt = null;
      }
    }

    if (notifEnabled !== null) {
      updates['notification.enabled'] = notifEnabled === 'true';
      // If toggling notification off, clear surfaceAt; if on and dueAt exists, set it
      const effectiveDueAt = updates.dueAt ?? doc.dueAt;
      updates.surfaceAt = (notifEnabled === 'true' && effectiveDueAt) ? effectiveDueAt : null;
    }

  } else if (doc.resourceType === 'note') {
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

  // ── Attachments — for note, contact, todo only ────────────────────────────
  if (['note', 'contact', 'todo'].includes(doc.resourceType)) {
    const removedPathsRaw = fd.get('removedAttachmentPaths') as string | null;
    const removedPaths: string[] = removedPathsRaw ? JSON.parse(removedPathsRaw) : [];

    for (const path of removedPaths) {
      await deleteFile(path);
    }

    const newAttachments = await processAttachments(fd, user._id.toString(), id);
    const kept = (doc.attachments ?? []).filter((a: any) => !removedPaths.includes(a.gcsPath));
    updates.attachments = [...kept, ...newAttachments];
  }

  const file = await TripFile.findByIdAndUpdate(fileId, updates, { new: true });
  return NextResponse.json({ file });
}

// ─── PATCH /api/trips/[id]/files/[fileId] ─────────────────────────────────────
// Lightweight toggle for todo completion — does not require a full form payload.
// Body: { completed: boolean }
export async function PATCH(
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

  if (doc.resourceType !== 'todo') {
    return NextResponse.json({ error: 'PATCH is only supported for todos' }, { status: 400 });
  }

  const body = await req.json();
  const completed = typeof body.completed === 'boolean' ? body.completed : !doc.completed;

  const updates: Record<string, any> = {
    completed,
    completedAt: completed ? new Date() : null,
  };

  const file = await TripFile.findByIdAndUpdate(fileId, updates, { new: true });
  return NextResponse.json({ file });
}