import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import InboundEmail from '@/lib/mongodb/models/InboundEmail';
import { needsYou } from '@/lib/inbound/notify';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function me() {
  const session = await getServerSession();
  if (!session?.user?.email) return null;
  await connectDB();
  return User.findOne({ email: session.user.email });
}

// ─── GET /api/user/forwarding ─────────────────────────────────────────────────
// The address to forward to, the addresses accepted as you, and recent emails.
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const emails = await InboundEmail.find({ userId: user._id }).sort({ createdAt: -1 }).limit(15).lean() as any[];
  return NextResponse.json({
    address:     process.env.INBOUND_EMAIL_ADDRESS ?? null,
    signInEmail: user.email,
    forwardFrom: user.forwardFrom ?? [],
    emails: emails.map(e => ({
      id:        String(e._id),
      subject:   e.subject ?? '',
      status:    e.status,
      summary:   e.summary ?? '',
      createdAt: e.createdAt,
      toCheck:   (e.items ?? []).filter(needsYou).length,
    })),
  });
}

// ─── PUT /api/user/forwarding ─────────────────────────────────────────────────
// Body: { forwardFrom: string[] } — other addresses you forward from.
export async function PUT(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.forwardFrom)) return NextResponse.json({ error: 'forwardFrom must be a list' }, { status: 400 });
  const list = [...new Set(body.forwardFrom.map((s: unknown) => String(s ?? '').trim().toLowerCase()))]
    .filter((s): s is string => !!s && s !== String(user.email).toLowerCase());
  const bad = list.find(s => !EMAIL.test(s));
  if (bad) return NextResponse.json({ error: `“${bad}” isn’t an email address` }, { status: 400 });
  if (list.length > 10) return NextResponse.json({ error: 'Up to 10 addresses' }, { status: 400 });

  // Each address can belong to one account only, or its mail would go to whichever matched first.
  const taken = await User.findOne({ _id: { $ne: user._id }, $or: [{ forwardFrom: { $in: list } }, { email: { $in: list } }] }, '_id').lean();
  if (taken) return NextResponse.json({ error: 'One of those addresses is already used by another account' }, { status: 409 });

  await User.updateOne({ _id: user._id }, { $set: { forwardFrom: list } });
  return NextResponse.json({ forwardFrom: list });
}
