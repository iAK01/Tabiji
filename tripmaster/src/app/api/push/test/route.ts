import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import webpush from 'web-push';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// ─── POST /api/push/test ──────────────────────────────────────────────────────
// Sends a test push notification to every subscription stored for the current user.
export async function POST() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email });

  if (!user?.pushSubscriptions?.length) {
    return NextResponse.json({ error: 'No subscriptions found — enable notifications first' }, { status: 400 });
  }

  const payload = JSON.stringify({
    title: '✈ Tabiji',
    body:  'Push notifications are working! You\'ll be notified before flights, check-ins, and more.',
    url:   '/dashboard',
    tag:   'tabiji-test',
  });

  const results = await Promise.allSettled(
    user.pushSubscriptions.map((sub: any) =>
      webpush.sendNotification(sub, payload)
    )
  );

  // Remove any subscriptions that are no longer valid (device unsubscribed)
  const invalid: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as any;
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        invalid.push(user.pushSubscriptions[i].endpoint);
      }
    }
  });

  if (invalid.length) {
    await User.findOneAndUpdate(
      { email: session.user.email },
      { $pull: { pushSubscriptions: { endpoint: { $in: invalid } } } }
    );
  }

  const sent    = results.filter(r => r.status === 'fulfilled').length;
  const failed  = results.filter(r => r.status === 'rejected').length;

  return NextResponse.json({ sent, failed });
}