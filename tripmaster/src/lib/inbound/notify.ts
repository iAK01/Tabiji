import PushNotificationLog from '@/lib/mongodb/models/PushNotificationLog';
import { sendPush, dropInvalid, inboxFilter } from '@/lib/push/send';
import type { InboundItem } from './types';

// One notice per forwarded email: what was filed and what needs you. It goes in
// the in-app inbox whether or not a push reaches a device — there's no later
// run to retry it, so unlike the reminders it isn't released on a failed push.

export function needsYou(item: InboundItem): boolean {
  return item.state === 'pending' || (item.state === 'applied' && item.changes.length > 0);
}

export function describe(items: InboundItem[], subject: string, failed?: string): { title: string; body: string } {
  if (failed) return { title: 'Couldn’t read a forwarded email', body: subject ? `“${subject}” — ${failed}` : failed };

  const shown   = items.filter(i => i.state !== 'dismissed');
  const applied = shown.filter(i => i.state === 'applied');
  const review  = shown.filter(needsYou);

  if (!shown.length) return { title: subject || 'Forwarded email', body: 'Nothing in it for your trips.' };
  if (shown.length === 1) {
    const i = shown[0];
    const tail = i.state === 'pending' ? (i.note ? ` ${i.note}.` : ' Needs your OK.') : review.length ? ' Something differs from what’s saved — check it.' : '';
    return { title: i.title, body: `${i.why}${tail}`.trim() };
  }
  const parts = [
    applied.length && `${applied.length} filed`,
    review.length && `${review.length} to check`,
  ].filter(Boolean);
  return { title: subject || 'Forwarded email', body: parts.join(' · ') };
}

export async function notifyEmail(opts: {
  emailId: string; user: any; tripId?: string | null; title: string; body: string;
}): Promise<void> {
  const url = `/emails/${opts.emailId}`;
  const tag = `email-${opts.emailId}`;
  // One inbox row per email: a retry or a later result replaces it, unread again.
  await PushNotificationLog.updateOne(
    { userId: opts.user._id, key: tag, notificationType: 'inbound_email' },
    {
      $set: {
        category: 'itinerary', title: opts.title, body: opts.body, url, tag,
        sentAt: new Date(), readAt: null, dismissedAt: null,
        ...(opts.tripId ? { tripId: opts.tripId } : {}),
      },
      ...(opts.tripId ? {} : { $unset: { tripId: '' } }),
    },
    { upsert: true },
  );
  const badgeCount = await PushNotificationLog.countDocuments(inboxFilter(opts.user._id, { readAt: null }));
  const invalid: string[] = [];
  await sendPush(opts.user.pushSubscriptions ?? [], { title: opts.title, body: opts.body, url, tag, badgeCount }, invalid);
  await dropInvalid(String(opts.user._id), invalid);
}
