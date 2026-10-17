import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import Trip from '@/lib/mongodb/models/Trip';
import PushNotificationLog from '@/lib/mongodb/models/PushNotificationLog';

const INBOX_SIZE = 60;

// ─── GET /api/user/notifications ──────────────────────────────────────────────
// The notification inbox: what was sent, newest first, plus the unread count.
// Entries from before the inbox existed have no title and are left out.
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email }, '_id').lean() as any;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const filter = { userId: user._id, title: { $exists: true } };
  const [logs, unread] = await Promise.all([
    PushNotificationLog.find(filter).sort({ sentAt: -1 }).limit(INBOX_SIZE).lean(),
    PushNotificationLog.countDocuments({ ...filter, readAt: null }),
  ]);

  const tripIds = [...new Set((logs as any[]).map(l => String(l.tripId)))];
  const trips   = await Trip.find({ _id: { $in: tripIds } }, 'name').lean() as any[];
  const names   = new Map(trips.map(t => [String(t._id), t.name]));

  return NextResponse.json({
    unread,
    notifications: (logs as any[]).map(l => ({
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
// Body: { action: 'read' } — marks everything read (opening the inbox).
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action !== 'read') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email }, '_id').lean() as any;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await PushNotificationLog.updateMany({ userId: user._id, readAt: null }, { $set: { readAt: new Date() } });
  return NextResponse.json({ unread: 0 });
}
