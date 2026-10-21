// Server-side delivery: one notification to all of a user's devices, logged
// for dedup and the in-app inbox. Payload shape is what public/sw.js reads.

import webpush from 'web-push';
import PushNotificationLog from '@/lib/mongodb/models/PushNotificationLog';
import User from '@/lib/mongodb/models/User';
import type { NotificationCategory } from '@/lib/push/prefs';

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushAction {
  action:    string;   // id the worker gets back in notificationclick
  title:     string;
  url?:      string;   // where the button goes
  complete?: string;   // API path the worker PATCHes with { completed: true } instead (to-do "Done")
}

export interface PushPayload {
  title:               string;
  body:                string;
  url:                 string;    // where tapping the notification goes
  tag?:                string;    // same tag replaces an earlier notification instead of stacking
  requireInteraction?: boolean;
  actions?:            PushAction[];  // Android/desktop only — iPhone shows none
  badgeCount?:         number;
}

function hostOf(endpoint: string): string {
  try { return new URL(endpoint).host; } catch { return 'unknown endpoint'; }
}

export async function sendPush(subscriptions: any[], payload: PushPayload, invalidEndpoints: string[]): Promise<number> {
  const str = JSON.stringify(payload);
  // One send per device, even if a race stored its subscription twice
  const unique = [...new Map(subscriptions.filter(s => s?.endpoint).map(s => [s.endpoint, s])).values()];
  const results = await Promise.allSettled(
    unique.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, str);
        return true;
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          invalidEndpoints.push(sub.endpoint);
        } else {
          console.error(`[push] to ${hostOf(sub.endpoint)} failed: ${err?.statusCode ?? ''} ${err?.body ?? err?.message ?? err}`);
        }
        return false;
      }
    })
  );
  return results.filter(r => r.status === 'fulfilled' && r.value === true).length;
}

export interface Delivery {
  userId:           string;
  tripId:           string;
  key:              string;
  notificationType: string;
  category:         NotificationCategory;
  subscriptions:    any[];
  payload:          PushPayload;
}

// How far back the inbox (and the app badge) looks
export const INBOX_DAYS = 14;

/** Inbox rows for a user: titled (sent since the inbox existed), not cleared, recent. */
export function inboxFilter(userId: any, extra: Record<string, unknown> = {}) {
  return {
    userId,
    title:       { $exists: true },
    dismissedAt: null,
    sentAt:      { $gte: new Date(Date.now() - INBOX_DAYS * 24 * 60 * 60 * 1000) },
    ...extra,
  };
}

/**
 * Sends one notification unless it has already gone out. Claims the log entry
 * first: the unique index lets exactly one run own a notification, so
 * overlapping runs can't send it twice (or crash on the duplicate insert).
 */
export async function deliver(d: Delivery, invalidEndpoints: string[]): Promise<boolean> {
  const id = { userId: d.userId, tripId: d.tripId, key: d.key, notificationType: d.notificationType };
  try {
    await PushNotificationLog.create({
      ...id,
      category: d.category,
      title:    d.payload.title,
      body:     d.payload.body,
      url:      d.payload.url,
      tag:      d.payload.tag,
    });
  } catch (err: any) {
    if (err?.code === 11000) return false;
    throw err;
  }

  // An update to the same thing (same tag) replaces the older one in the inbox,
  // so the older one stops counting as unread.
  if (d.payload.tag) {
    await PushNotificationLog.updateMany(
      { userId: d.userId, tripId: d.tripId, tag: d.payload.tag, readAt: null, $nor: [id] },
      { $set: { readAt: new Date() } },
    );
  }
  const badgeCount = await PushNotificationLog.countDocuments(inboxFilter(d.userId, { readAt: null }));
  const sent = await sendPush(d.subscriptions, { ...d.payload, badgeCount }, invalidEndpoints);
  // Nothing delivered (stale subscriptions, push service down) — release the
  // claim so the next run retries while the notification is still due.
  if (sent === 0) {
    await PushNotificationLog.deleteOne(id);
    return false;
  }
  return true;
}

export async function dropInvalid(userId: string, invalidEndpoints: string[]): Promise<void> {
  if (!invalidEndpoints.length) return;
  await User.findByIdAndUpdate(userId, {
    $pull: { pushSubscriptions: { endpoint: { $in: invalidEndpoints } } },
  });
}
