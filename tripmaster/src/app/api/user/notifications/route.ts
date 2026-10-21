import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import Trip from '@/lib/mongodb/models/Trip';
import PushNotificationLog from '@/lib/mongodb/models/PushNotificationLog';
import { inboxFilter } from '@/lib/push/send';

const INBOX_SIZE = 60;
// Read this many to find INBOX_SIZE once updates to the same thing are folded together
const SCAN_SIZE  = 300;

// The newest notification per thing: a newer one with the same tag (on the same
// trip) replaces the older — as it does on the lock screen.
function latestPerTag(logs: any[]): any[] {
  const seen = new Set<string>();
  return logs.filter(l => {
    if (!l.tag) return true;
    const k = `${l.tripId}|${l.tag}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function userId(email: string) {
  const user = await User.findOne({ email }, '_id').lean() as any;
  return user?._id ?? null;
}

// ─── GET /api/user/notifications ──────────────────────────────────────────────
// The notification inbox: the last two weeks of what was sent, newest first,
// one entry per thing, without what's been cleared. Plus the unread count.
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  await connectDB();
  const uid = await userId(session.user.email);
  if (!uid) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const scanned = await PushNotificationLog.find(inboxFilter(uid)).sort({ sentAt: -1 }).limit(SCAN_SIZE).lean() as any[];
  const logs    = latestPerTag(scanned).slice(0, INBOX_SIZE);

  const tripIds = [...new Set(logs.map(l => String(l.tripId)))];
  const trips   = await Trip.find({ _id: { $in: tripIds } }, 'name').lean() as any[];
  const names   = new Map(trips.map(t => [String(t._id), t.name]));

  return NextResponse.json({
    unread: logs.filter(l => !l.readAt).length,
    notifications: logs.map(l => ({
      id:       String(l._id),
      tripId:   String(l.tripId),
      tripName: names.get(String(l.tripId)) ?? null,
      category: l.category ?? null,
      title:    l.title,
      body:     l.body ?? '',
      url:      l.url ?? `/trips/${l.tripId}`,
      sentAt:   l.sentAt,
      read:     !!l.readAt,
    })),
  });
}

// ─── POST /api/user/notifications ─────────────────────────────────────────────
// Body, one of:
//   { action: 'read' }                     everything read (opening the inbox)
//   { action: 'dismiss', ids, stamp }      clear these (and the earlier versions they replaced)
//   { action: 'clear', stamp }             clear the whole inbox
//   { action: 'restore', stamp }           undo a dismiss/clear made with that stamp
// `stamp` is an ISO time the app picks, so an undo works even if both were queued offline.
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const body   = await req.json().catch(() => ({}));
  const action = body.action;
  if (!['read', 'dismiss', 'clear', 'restore'].includes(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  await connectDB();
  const uid = await userId(session.user.email);
  if (!uid) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (action === 'read') {
    await PushNotificationLog.updateMany({ userId: uid, readAt: null }, { $set: { readAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  const stamp = new Date(body.stamp);
  if (Number.isNaN(stamp.getTime())) return NextResponse.json({ error: 'stamp required' }, { status: 400 });

  if (action === 'restore') {
    await PushNotificationLog.updateMany({ userId: uid, dismissedAt: stamp }, { $unset: { dismissedAt: 1 } });
    return NextResponse.json({ ok: true });
  }

  const cleared = { $set: { dismissedAt: stamp, readAt: stamp } };

  if (action === 'clear') {
    await PushNotificationLog.updateMany({ userId: uid, dismissedAt: null }, cleared);
    return NextResponse.json({ ok: true });
  }

  // dismiss
  const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string' && mongoose.isValidObjectId(x)) : [];
  if (!ids.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
  const rows = await PushNotificationLog.find({ userId: uid, _id: { $in: ids } }, 'tripId tag sentAt').lean() as any[];
  for (const row of rows) {
    // With its tag, the earlier versions it replaced go too — or clearing it would bring them back
    await PushNotificationLog.updateMany(
      row.tag
        ? { userId: uid, tripId: row.tripId, tag: row.tag, sentAt: { $lte: row.sentAt }, dismissedAt: null }
        : { _id: row._id },
      cleared,
    );
  }
  return NextResponse.json({ ok: true });
}
