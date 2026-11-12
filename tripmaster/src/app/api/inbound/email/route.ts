import { NextResponse, after } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import InboundEmail from '@/lib/mongodb/models/InboundEmail';
import { resend } from '@/lib/inbound/resend';
import { processInboundEmail } from '@/lib/inbound/process';

// Resend calls this when an email arrives at the forwarding address. It's
// answered straight away; reading and filing the email carries on after.
// Resend retries a webhook that fails — the unique resendId makes a repeat a no-op.

export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[inbound] RESEND_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const payload = await req.text();
  let event: any;
  try {
    event = resend().webhooks.verify({
      payload,
      headers: {
        id:        req.headers.get('svix-id') ?? req.headers.get('webhook-id') ?? '',
        timestamp: req.headers.get('svix-timestamp') ?? req.headers.get('webhook-timestamp') ?? '',
        signature: req.headers.get('svix-signature') ?? req.headers.get('webhook-signature') ?? '',
      },
      webhookSecret: secret,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (event?.type !== 'email.received' || !event.data?.email_id) {
    return NextResponse.json({ ignored: true });
  }

  await connectDB();
  let doc: any;
  try {
    doc = await InboundEmail.create({
      resendId:   event.data.email_id,
      from:       event.data.from,
      subject:    event.data.subject,
      receivedAt: event.data.created_at ? new Date(event.data.created_at) : new Date(),
    });
  } catch (err: any) {
    if (err?.code === 11000) return NextResponse.json({ duplicate: true });
    throw err;
  }

  const id = String(doc._id);
  after(() => processInboundEmail(id).catch(err => console.error(`[inbound] ${id}`, err)));
  return NextResponse.json({ received: true });
}
