import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import { resolvePrefs, type NotificationPrefs } from '@/lib/push/prefs';

// ─── GET /api/user/notification-preferences ───────────────────────────────────
// The traveller's notification settings, with defaults filled in.
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email }, 'notificationPrefs').lean() as any;
  return NextResponse.json({ prefs: resolvePrefs(user?.notificationPrefs) });
}

// ─── PATCH /api/user/notification-preferences ─────────────────────────────────
// Body: any of { categories, quietHours, briefingTimes } (partial is fine),
// and/or { mute: { tripId, muted } } to mute or unmute one trip.
// Merged onto the stored settings, then validated as a whole.
export async function PATCH(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  await connectDB();
  const body = await req.json();
  const user = await User.findOne({ email: session.user.email }, 'notificationPrefs').lean() as any;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const current = resolvePrefs(user.notificationPrefs);
  const next: NotificationPrefs = resolvePrefs({
    categories:    { ...current.categories,    ...(body.categories    ?? {}) },
    quietHours:    { ...current.quietHours,    ...(body.quietHours    ?? {}) },
    briefingTimes: { ...current.briefingTimes, ...(body.briefingTimes ?? {}) },
    mutedTrips:    current.mutedTrips,
  });

  const tripId = typeof body.mute?.tripId === 'string' ? body.mute.tripId : null;
  if (tripId) {
    next.mutedTrips = body.mute.muted
      ? [...new Set([...next.mutedTrips, tripId])]
      : next.mutedTrips.filter(id => id !== tripId);
  }

  await User.updateOne({ _id: user._id }, { $set: { notificationPrefs: next } });
  return NextResponse.json({ prefs: next });
}
