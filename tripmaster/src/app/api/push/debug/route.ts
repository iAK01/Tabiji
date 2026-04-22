import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import Trip from '@/lib/mongodb/models/Trip';
import PushNotificationLog from '@/lib/mongodb/models/PushNotificationLog';

// ─── GET /api/push/debug ──────────────────────────────────────────────────────
// Returns diagnostic info: push subscriptions, trip statuses, recent notification logs.
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const userId = user._id.toString();

  const [trips, recentLogs] = await Promise.all([
    Trip.find({ userId: user._id, deleted: false })
      .select('title status startDate endDate destination.timezone')
      .sort({ startDate: -1 })
      .limit(10)
      .lean(),
    PushNotificationLog.find({ userId })
      .sort({ sentAt: -1 })
      .limit(20)
      .lean(),
  ]);

  const subscriptionCount = user.pushSubscriptions?.length ?? 0;
  // Show just the first 40 chars of each endpoint so you can identify push service
  const subscriptionEndpoints = (user.pushSubscriptions ?? []).map((s: any) =>
    typeof s?.endpoint === 'string' ? s.endpoint.slice(0, 60) + '…' : '(unknown)'
  );

  return NextResponse.json({
    subscriptionCount,
    subscriptionEndpoints,
    trips: trips.map((t: any) => ({
      id: t._id,
      title: t.title,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      timezone: t.destination?.timezone,
    })),
    recentLogs: recentLogs.map((l: any) => ({
      tripId: l.tripId,
      key: l.key,
      notificationType: l.notificationType,
      sentAt: l.sentAt,
    })),
  });
}

// ─── DELETE /api/push/debug?tripId=xxx ────────────────────────────────────────
// Clears the notification log for a trip so past-missed events can re-fire
// if they are still within their lead-time window.
export async function DELETE(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get('tripId');
  if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const result = await PushNotificationLog.deleteMany({
    userId: user._id,
    tripId,
  });

  return NextResponse.json({ deleted: result.deletedCount });
}
