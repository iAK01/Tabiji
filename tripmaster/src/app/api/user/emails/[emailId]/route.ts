import { NextResponse, after } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import Trip from '@/lib/mongodb/models/Trip';
import InboundEmail from '@/lib/mongodb/models/InboundEmail';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import { findStop } from '@/lib/itinerary/stops';
import { attachFiles, loadBundle, markCancelled, placeItem, undoItem, writeFields } from '@/lib/inbound/apply';
import { processInboundEmail } from '@/lib/inbound/process';
import type { InboundItem, StoredFile } from '@/lib/inbound/types';

export const maxDuration = 300;

async function load(emailId: string) {
  const session = await getServerSession();
  if (!session?.user?.email) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  const doc = mongoose.isValidObjectId(emailId) ? await InboundEmail.findOne({ _id: emailId, userId: user._id }) : null;
  if (!doc) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { user, doc };
}

async function view(doc: any, userId: any) {
  const trips = await Trip.find({ userId, deleted: false, status: { $ne: 'cancelled' } }, 'name startDate endDate')
    .sort({ startDate: -1 }).limit(30).lean() as any[];
  const names = new Map(trips.map(t => [String(t._id), t.name]));
  const missing = [...new Set((doc.items ?? []).map((i: InboundItem) => i.tripId).filter((id: any) => id && !names.has(id)))];
  if (missing.length) {
    for (const t of await Trip.find({ _id: { $in: missing } }, 'name').lean() as any[]) names.set(String(t._id), t.name);
  }
  const files: StoredFile[] = doc.files ?? [];

  // Where each filed item lives in the app.
  const stopTrips = [...new Set((doc.items ?? []).filter((i: InboundItem) => i.tripId && i.target?.kind === 'stop').map((i: InboundItem) => i.tripId!))];
  const itineraries = new Map((await TripItinerary.find({ tripId: { $in: stopTrips } }, 'tripId days').lean() as any[]).map(it => [String(it.tripId), it]));
  const SECTION = { transport: 'transport', accommodation: 'accommodation', venue: 'venues' } as const;
  const hrefFor = (i: InboundItem): string | null => {
    if (!i.tripId || i.state === 'undone' || i.state === 'dismissed') return null;
    const base = `/trips/${i.tripId}`;
    if (!i.target) return i.state === 'applied' ? `${base}?tab=resources` : null;
    if (i.target.kind === 'stop') {
      const found = findStop(itineraries.get(i.tripId), i.target.stopId!);
      return found ? `${base}?tab=itinerary&day=${found.day.dayNumber}&stop=${i.target.stopId}` : `${base}?tab=itinerary`;
    }
    return `${base}?tab=logistics&section=${SECTION[i.target.kind]}`;
  };

  return {
    id:         String(doc._id),
    subject:    doc.subject ?? '',
    from:       doc.from ?? '',
    receivedAt: doc.receivedAt ?? doc.createdAt,
    status:     doc.status,
    error:      doc.error ?? null,
    summary:    doc.summary ?? '',
    tripId:     doc.tripId ? String(doc.tripId) : null,
    items: (doc.items ?? []).map((i: InboundItem) => ({
      ...i,
      tripName: i.tripId ? names.get(i.tripId) ?? null : null,
      href:     hrefFor(i),
      files: i.attachments.map(n => files.find(f => f.index === n)).filter(Boolean)
        .map(f => ({ name: f!.name, url: f!.gcsUrl, mimeType: f!.mimeType, hasBarcode: !!f!.barcode })),
    })),
    trips: trips.map(t => ({ id: String(t._id), name: t.name, startDate: t.startDate, endDate: t.endDate })),
  };
}

// ─── GET /api/user/emails/[emailId] ───────────────────────────────────────────
export async function GET(_req: Request, { params }: { params: Promise<{ emailId: string }> }) {
  const { emailId } = await params;
  const res = await load(emailId);
  if (res.error) return res.error;
  return NextResponse.json({ email: await view(res.doc, res.user._id) });
}

// ─── POST /api/user/emails/[emailId] ──────────────────────────────────────────
// Body: { action, item?, tripId?, fields? }
//   add      — file a waiting item (into `tripId` when it has no trip yet)
//   accept   — write the offered values for `fields` (all when omitted)
//   cancel   — mark the saved entry cancelled
//   dismiss  — drop a waiting item, or the values it offered
//   undo     — reverse everything the item did
//   retry    — read a failed email again
export async function POST(req: Request, { params }: { params: Promise<{ emailId: string }> }) {
  const { emailId } = await params;
  const res = await load(emailId);
  if (res.error) return res.error;
  const { user, doc } = res;

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? '');

  if (action === 'retry') {
    if (doc.status !== 'failed') return NextResponse.json({ error: 'Only an email that failed can be read again' }, { status: 400 });
    doc.status = 'processing';
    doc.error  = undefined;
    await doc.save();
    after(() => processInboundEmail(String(doc._id)).catch(err => console.error(`[inbound] retry ${doc._id}`, err)));
    return NextResponse.json({ email: await view(doc, user._id) });
  }

  const items: InboundItem[] = doc.items ?? [];
  const item = items.find(i => i.n === Number(body?.item));
  if (!item) return NextResponse.json({ error: 'No such item' }, { status: 404 });

  let message: string | null = null;

  switch (action) {
    case 'add': {
      if (item.state !== 'pending' && item.state !== 'undone') return NextResponse.json({ error: 'Already filed' }, { status: 409 });
      if (item.action === 'cancel') return NextResponse.json({ error: 'Nothing to add — the email cancels something' }, { status: 400 });
      const tripId = item.tripId ?? (typeof body.tripId === 'string' ? body.tripId : null);
      const trip = tripId && mongoose.isValidObjectId(tripId)
        ? await Trip.findOne({ _id: tripId, userId: user._id, deleted: false })
        : null;
      if (!trip) return NextResponse.json({ error: 'Pick a trip for it' }, { status: 400 });
      // "Couldn't find it" / "optional" / undone: add it as new unless it's in the trip by now.
      if (item.kind !== 'document' && item.action !== 'reference') item.action = 'create';
      item.note = undefined;
      item.state = 'pending';
      await placeItem(item, await loadBundle(trip), null, {
        emailId: String(doc._id), files: doc.files ?? [], userId: String(user._id), addNew: true,
      });
      if (item.state === 'pending' && item.note) message = item.note;
      break;
    }
    case 'accept': {
      if (!item.tripId || !item.target) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
      const wanted = Array.isArray(body.fields) ? new Set(body.fields.map(String)) : null;
      // An address and its map pin go together.
      if (wanted?.has('address')) wanted.add('coordinates');
      const list = item.changes.filter(c => !wanted || wanted.has(c.field));
      const out = await writeFields(item.tripId, item.target, list);
      if (!out.ok) return NextResponse.json({ error: 'That entry isn’t in the trip any more, or the new date isn’t one of its days' }, { status: 409 });
      item.accepted = [...item.accepted, ...list];
      item.changes  = item.changes.filter(c => !list.includes(c));
      break;
    }
    case 'cancel': {
      if (item.action !== 'cancel' || item.state !== 'pending') return NextResponse.json({ error: 'Nothing to cancel' }, { status: 400 });
      if (!(await markCancelled(item))) return NextResponse.json({ error: 'That entry isn’t in the trip any more' }, { status: 409 });
      await attachFiles(item, String(doc._id), doc.files ?? [], item.tripId!, String(user._id));
      item.state = 'applied';
      item.note  = undefined;
      break;
    }
    case 'dismiss': {
      if (item.state === 'pending') item.state = 'dismissed';
      else item.changes = [];
      break;
    }
    case 'undo': {
      if (item.state !== 'applied') return NextResponse.json({ error: 'Nothing to undo' }, { status: 400 });
      const left = await undoItem(item);
      if (left.length) message = `Left as they are: ${left.join(', ')}`;
      break;
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  doc.items = items;
  doc.markModified('items');
  await doc.save();
  return NextResponse.json({ email: await view(doc, user._id), message });
}
