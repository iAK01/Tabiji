import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).select('preferences.myApps').lean();
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ myApps: (user as any).preferences?.myApps ?? [] });
}

export async function PUT(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!Array.isArray(body.myApps)) {
    return NextResponse.json({ error: 'myApps must be an array' }, { status: 400 });
  }

  await connectDB();
  await User.updateOne(
    { email: session.user.email },
    { $set: { 'preferences.myApps': body.myApps } },
  );

  return NextResponse.json({ ok: true });
}
