import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';

// ─── POST /api/push/subscribe ─────────────────────────────────────────────────
// Body: { subscription: PushSubscription, oldEndpoint?: string }
// Saves the subscription to the user's pushSubscriptions array.
// Deduplicates by endpoint so re-subscribing the same device is idempotent; the
// app re-sends its subscription on every open, so this is also how a dropped
// one gets restored. oldEndpoint is the subscription this one replaces.
// Returns how many devices the user now has registered.
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { subscription, oldEndpoint } = await req.json();
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  await connectDB();

  // Remove any existing entry with this endpoint first (handles key rotation),
  // then push the fresh subscription
  const stale = [subscription.endpoint, oldEndpoint].filter(e => typeof e === 'string');
  await User.findOneAndUpdate(
    { email: session.user.email },
    {
      $pull: { pushSubscriptions: { endpoint: { $in: stale } } },
    }
  );

  const user = await User.findOneAndUpdate(
    { email: session.user.email },
    {
      $push: { pushSubscriptions: subscription },
    },
    { new: true, select: 'pushSubscriptions' }
  );

  return NextResponse.json({ success: true, devices: user?.pushSubscriptions?.length ?? 0 });
}

// ─── DELETE /api/push/subscribe ───────────────────────────────────────────────
// Body: { endpoint: string }
// Removes the subscription so no further notifications are sent to this device.
export async function DELETE(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { endpoint } = await req.json();
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
  }

  await connectDB();

  await User.findOneAndUpdate(
    { email: session.user.email },
    { $pull: { pushSubscriptions: { endpoint } } }
  );

  return NextResponse.json({ success: true });
}