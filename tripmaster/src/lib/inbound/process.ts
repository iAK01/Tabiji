import connectDB from '@/lib/mongodb/connection';
import InboundEmail from '@/lib/mongodb/models/InboundEmail';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import { describeExisting } from '@/lib/extract/existingMatch';
import { uploadFile } from '@/lib/utils/storage';
import { drawTicket, scanTicket, SCANNABLE_MIME } from '@/lib/passes/scan';
import { placeTz } from '@/lib/push/timezones';
import { addressOf, fetchAttachments, fetchEmail } from './resend';
import { prepareEmail, type PreparedAttachment } from './prepare';
import { readEmail, type TripContext } from './read';
import { fitsTrip, itemDate, loadBundle, placeItem, type TripBundle } from './apply';
import { describe, notifyEmail } from './notify';
import type { InboundItem, StoredFile } from './types';

// The whole run for one forwarded email, after the webhook has said it arrived:
// who sent it → fetch it → read it → store what's kept → file each part → tell them.

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The account an address belongs to: its sign-in email or one it has added. */
async function userFor(address: string) {
  if (!address) return null;
  return User.findOne({
    $or: [{ email: new RegExp(`^${escapeRe(address)}$`, 'i') }, { forwardFrom: address }],
  });
}

function header(headers: Record<string, string>, name: string): string {
  const key = Object.keys(headers).find(k => k.toLowerCase() === name);
  return key ? String(headers[key] ?? '') : '';
}

/**
 * Whose email this is. Forwarded by hand, the sender is them. Forwarded by a
 * mail rule (Gmail's auto-forwarding), the sender stays the original one and
 * the mailbox it came through is in X-Forwarded-For.
 */
async function ownerOf(email: { from: string; headers: Record<string, string> }): Promise<{ user: any; byRule: boolean } | null> {
  const byHand = await userFor(addressOf(email.from));
  if (byHand) return { user: byHand, byRule: false };
  const via = header(email.headers, 'x-forwarded-for').toLowerCase().match(/[^\s<>,;]+@[^\s<>,;]+/g) ?? [];
  for (const a of via) {
    const user = await userFor(a);
    if (user) return { user, byRule: true };
  }
  return null;
}

/** Trips an email could be for: not cancelled, not long over. */
async function candidateTrips(userId: any): Promise<Array<{ ref: string; bundle: TripBundle; ctx: TripContext }>> {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const trips = await Trip.find({
    userId, deleted: false,
    status: { $nin: ['cancelled', 'completed'] },
    $or: [{ endDate: { $gte: since } }, { endDate: null }],
  }).sort({ startDate: 1 }).limit(8);

  return Promise.all(trips.map(async (trip: any, i: number) => {
    const bundle = await loadBundle(trip);
    const places = [trip.destination, ...(trip.additionalDestinations ?? [])]
      .map((p: any) => [p?.city, p?.country].filter(Boolean).join(', '))
      .filter(Boolean).join(' · ');
    const day = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '?');
    const ref = `T${i + 1}`;
    return {
      ref, bundle,
      ctx: {
        ref,
        name:     trip.name,
        places:   places || 'unknown',
        dates:    `${day(trip.startDate)} to ${day(trip.endDate)}`,
        tz:       placeTz(trip.destination) ?? 'UTC',
        existing: describeExisting(bundle.index, 150),
      },
    };
  }));
}

async function storeFile(a: PreparedAttachment, userId: string, emailId: string): Promise<StoredFile> {
  const safe    = a.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'attachment';
  const gcsPath = `${userId}/email/${emailId}/${a.index}-${safe}`;
  const gcsUrl  = await uploadFile(a.buffer, gcsPath, a.mimeType);
  const barcode = a.pass
    ? await drawTicket(a.pass.text, a.pass.format)
    : SCANNABLE_MIME.has(a.mimeType) ? await scanTicket(new Uint8Array(a.buffer)) : null;
  return { index: a.index, name: a.name, mimeType: a.mimeType, size: a.buffer.length, gcsPath, gcsUrl, barcode };
}

function emptyItem(n: number): InboundItem {
  return {
    n, action: 'ignore', kind: 'document', tripId: null, title: '', why: '', documentType: 'other',
    details: null, attachments: [], links: [], target: null, created: false, state: 'pending',
    filled: [], changes: [], accepted: [], cancelled: [], fileIds: [],
  };
}

export async function processInboundEmail(docId: string): Promise<void> {
  await connectDB();
  const doc = await InboundEmail.findById(docId);
  if (!doc || doc.status !== 'processing') return;

  let user: any = null;
  try {
    const email = await fetchEmail(doc.resendId);
    doc.from    = email.from;
    doc.subject = email.subject;

    const owner = await ownerOf(email);
    user = owner?.user ?? null;
    // Mail that says it's from them but fails their own domain's checks isn't theirs.
    // (Auto-forwarded mail is judged on the mailbox it came through, not on this.)
    const spoofed = !!owner && !owner.byRule && /\bdmarc=fail\b/i.test(header(email.headers, 'authentication-results'));
    if (!user || spoofed) {
      doc.status = 'rejected';
      doc.error  = spoofed ? 'Failed the sender check' : `Not from an address on any account (${addressOf(email.from)})`;
      user = null;
      await doc.save();
      return;
    }
    doc.userId = user._id;
    await doc.save();

    const received = await fetchAttachments(email.id);
    const prepared = await prepareEmail(email, received);
    const trips    = await candidateTrips(user._id);
    const result   = await readEmail(prepared, {
      today:    new Date().toISOString().slice(0, 10),
      received: email.date,
      trips:    trips.map(t => t.ctx),
    });

    // Keep only what the reading tied to something — not logos and banners.
    const wanted = new Set(result.items.flatMap(i => i.attachments));
    const files: StoredFile[] = [];
    for (const a of prepared.attachments) {
      if (!wanted.has(a.index) || !a.buffer.length) continue;
      files.push(await storeFile(a, String(user._id), String(doc._id)));
    }
    doc.files = files;

    const byRef = new Map(trips.map(t => [t.ref, t.bundle]));
    const items: InboundItem[] = [];
    for (const [n, r] of result.items.entries()) {
      const item: InboundItem = {
        ...emptyItem(n),
        action: r.action, kind: r.kind, title: r.title, why: r.why, documentType: r.documentType,
        details: r.kind === 'document' ? null : r.details,
        attachments: r.attachments.filter(i => files.some(f => f.index === i)),
        links: r.links,
      };
      items.push(item);

      if (r.action === 'ignore') { item.state = 'dismissed'; continue; }

      const bundle = r.trip ? byRef.get(r.trip) : undefined;
      if (!bundle) { item.note = trips.length ? 'Doesn’t match any of your trips' : 'You have no upcoming trips'; continue; }
      const date = itemDate(item);
      if (date && !fitsTrip(date, bundle.trip)) { item.note = `${date} is outside ${bundle.trip.name}`; continue; }

      try {
        await placeItem(item, bundle, r.existingId, {
          emailId: String(doc._id), files, userId: String(user._id), addNew: false,
        });
        // What it just added counts as saved for the next part of the same email.
        Object.assign(bundle, await loadBundle(bundle.trip));
      } catch (err: any) {
        console.error(`[inbound] filing item ${n} of ${doc._id}`, err);
        item.state = 'pending';
        item.note  = 'Couldn’t file this — try again from here';
      }
    }

    doc.items   = items;
    doc.summary = result.summary;
    const counts = new Map<string, number>();
    for (const i of items) if (i.tripId && i.state === 'applied') counts.set(i.tripId, (counts.get(i.tripId) ?? 0) + 1);
    const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (main) doc.tripId = main;
    doc.status = 'done';
    doc.markModified('items');
    doc.markModified('files');
    await doc.save();

    const { title, body } = describe(items, email.subject);
    await notifyEmail({ emailId: String(doc._id), user, tripId: main ?? null, title, body });
  } catch (err: any) {
    console.error(`[inbound] email ${doc._id} failed`, err);
    doc.status = 'failed';
    doc.error  = String(err?.message ?? err).slice(0, 500);
    await doc.save().catch(() => {});
    if (user) {
      const { title, body } = describe([], doc.subject ?? '', 'open it to try again.');
      await notifyEmail({ emailId: String(doc._id), user, title, body }).catch(e => console.error('[inbound] notify failed', e));
    }
  }
}
