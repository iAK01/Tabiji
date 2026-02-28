import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';

// ─── POST /api/push/subscribe ─────────────────────────────────────────────────
// Body: { subscription: PushSubscription }
// Saves the subscription to the user's pushSubscriptions array.
// Deduplicates by endpoint so re-subscribing the same device is idempotent.
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { subscription } = await req.json();
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  await connectDB();

  // Remove any existing entry with this endpoint first (handles key rotation),
  // then push the fresh subscription
  await User.findOneAndUpdate(
    { email: session.user.email },
    {
      $pull: { pushSubscriptions: { endpoint: subscription.endpoint } },
    }
  );

  await User.findOneAndUpdate(
    { email: session.user.email },
    {
      $push: { pushSubscriptions: subscription },
    }
  );

  return NextResponse.json({ success: true });
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