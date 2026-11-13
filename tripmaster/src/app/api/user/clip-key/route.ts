import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import Clip from '@/lib/mongodb/models/Clip';
import { newClipKey } from '@/lib/clip/auth';

async function me() {
  const session = await getServerSession();
  if (!session?.user?.email) return null;
  await connectDB();
  return User.findOne({ email: session.user.email });
}

// GET — whether there's a key (never the key itself), and recent clips.
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const clips = await Clip.find({ userId: user._id }, 'title url status error summary savedIds createdAt')
    .sort({ createdAt: -1 }).limit(10).lean() as any[];
  return NextResponse.json({
    key: user.clipKey?.hash ? { last4: user.clipKey.last4, createdAt: user.clipKey.createdAt } : null,
    clips: clips.map(c => ({
      id: String(c._id), title: c.title || c.url || 'Clip', status: c.status,
      summary: c.summary ?? '', error: c.error ?? null, count: c.savedIds?.length ?? 0, createdAt: c.createdAt,
    })),
  });
}

// POST — a new key, shown this once. Replaces any old one.
export async function POST() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { key, hash, last4 } = newClipKey();
  await User.updateOne({ _id: user._id }, { $set: { clipKey: { hash, last4, createdAt: new Date() } } });
  return NextResponse.json({ key, last4 });
}

// DELETE — the clipper stops working until a new key is made.
export async function DELETE() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await User.updateOne({ _id: user._id }, { $unset: { clipKey: '' } });
  return NextResponse.json({ key: null });
}
