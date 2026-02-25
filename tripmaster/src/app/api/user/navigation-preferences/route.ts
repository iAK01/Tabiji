import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  await connectDB();
  const user = await User.findOne(
    { email: session.user.email },
    'preferences.navigationApps',
  );

  return NextResponse.json({
    preferences: user?.preferences?.navigationApps ?? null,
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  await connectDB();
  const body = await req.json();

  // Only allow the four expected fields to be written
  const { walking, driving, transit, setupComplete } = body;
  const safeUpdate = {
    ...(walking       !== undefined && { 'preferences.navigationApps.walking':       walking }),
    ...(driving       !== undefined && { 'preferences.navigationApps.driving':       driving }),
    ...(transit       !== undefined && { 'preferences.navigationApps.transit':       transit }),
    ...(setupComplete !== undefined && { 'preferences.navigationApps.setupComplete': setupComplete }),
  };

  const user = await User.findOneAndUpdate(
    { email: session.user.email },
    { $set: safeUpdate },
    { new: true, select: 'preferences.navigationApps' },
  );

  return NextResponse.json({
    preferences: user?.preferences?.navigationApps ?? null,
  });
}