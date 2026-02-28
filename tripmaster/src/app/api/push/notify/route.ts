import { NextResponse } from 'next/server';
import webpush from 'web-push';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import Trip from '@/lib/mongodb/models/Trip';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import TripFile from '@/lib/mongodb/models/TripFile';
import PushNotificationLog from '@/lib/mongodb/models/PushNotificationLog';

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// ─── Lead times (milliseconds) ────────────────────────────────────────────────
const LEAD = {
  flight:           3 * 60 * 60 * 1000,   // 3 hours
  train:            45 * 60 * 1000,        // 45 minutes
  bus:              45 * 60 * 1000,        // 45 minutes
  ferry:            3 * 60 * 60 * 1000,    // 3 hours
  private_transfer: 45 * 60 * 1000,        // 45 minutes
  taxi:             30 * 60 * 1000,        // 30 minutes
  car_hire:         45 * 60 * 1000,        // 45 minutes
  car:              30 * 60 * 1000,        // 30 minutes
  bicycle:          15 * 60 * 1000,        // 15 minutes
  hotel:            45 * 60 * 1000,        // 45 minutes before itinerary check-in stop
};

// ─── Cron window ──────────────────────────────────────────────────────────────
// A notification should fire if its trigger time (eventTime - lead) falls within
// the past WINDOW_MS. Set to 10 minutes to cover a 5-minute cron with overlap.
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for testing


// ─── Helpers ──────────────────────────────────────────────────────────────────

function stopToDatetime(dayDate: string, stop: any): Date | null {
  const timeStr = stop.scheduledStart
    ? stop.scheduledStart.includes('T')
      ? stop.scheduledStart  // already ISO
      : `${dayDate.split('T')[0]}T${stop.scheduledStart}:00`
    : stop.time
      ? `${dayDate.split('T')[0]}T${stop.time}:00`
      : null;
  if (!timeStr) return null;
  const d = new Date(timeStr);
  return isNaN(d.getTime()) ? null : d;
}

function isInWindow(eventTime: Date, leadMs: number, now: Date): boolean {
  const triggerTime = new Date(eventTime.getTime() - leadMs);
  const diff = now.getTime() - triggerTime.getTime();
  return diff >= 0 && diff <= WINDOW_MS;
}

function transportLabel(t: any): string {
  switch (t.type) {
    case 'flight': {
      const fn   = t.details?.flightNumber ?? '';
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      const al   = t.details?.airline   ?? '';
      return [al, fn, from && to ? `${from} → ${to}` : (from || to)].filter(Boolean).join(' · ');
    }
    case 'train':
    case 'bus':
    case 'ferry': {
      const op   = t.details?.operator ?? '';
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return [op, from && to ? `${from} → ${to}` : (from || to)].filter(Boolean).join(' · ');
    }
    case 'car_hire':
      return [t.details?.rentalCompany, t.details?.pickupLocation ? `Pickup: ${t.details.pickupLocation}` : ''].filter(Boolean).join(' · ');
    case 'taxi':
    case 'private_transfer': {
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return from && to ? `${from} → ${to}` : (from || to || 'Transfer');
    }
    default:
      return t.departureLocation ?? t.type ?? 'Transport';
  }
}

function transportEmoji(type: string): string {
  const map: Record<string, string> = {
    flight: '✈', train: '🚂', bus: '🚌', ferry: '⛴',
    car_hire: '🚗', car: '🚗', taxi: '🚕', private_transfer: '🚐', bicycle: '🚲',
  };
  return map[type] ?? '🚌';
}

function leadLabel(type: string): string {
  const ms = LEAD[type as keyof typeof LEAD] ?? LEAD.train;
  const mins = ms / 60000;
  return mins >= 60 ? `${mins / 60} hour${mins / 60 !== 1 ? 's' : ''}` : `${mins} minutes`;
}

async function sendToUser(
  userId: string,
  subscriptions: any[],
  payload: object,
  invalidEndpoints: string[]
) {
  const str = JSON.stringify(payload);
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, str);
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          invalidEndpoints.push(sub.endpoint);
        }
      }
    })
  );
}

// ─── POST /api/push/notify ────────────────────────────────────────────────────
// Called by the cron scheduler every 5 minutes.
// Checks all active trips for upcoming itinerary stops and logistics events,
// sends push notifications at the appropriate lead time, and logs each send
// to prevent duplicates.
export async function POST(req: Request) {

  // Validate cron secret — prevents anyone from triggering this publicly
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  const now = new Date();

  // ── 1. Find all active trips ──────────────────────────────────────────────
  const activeTrips = await Trip.find({ status: 'active', deleted: false });
  if (!activeTrips.length) return NextResponse.json({ sent: 0 });

  let totalSent = 0;

  for (const trip of activeTrips) {
    const tripId   = trip._id.toString();
    const userId   = trip.userId.toString();

    // ── 2. Load user + subscriptions ───────────────────────────────────────
    const user = await User.findById(userId);
    if (!user?.pushSubscriptions?.length) continue;

    const invalidEndpoints: string[] = [];

    // ── 3. Load itinerary, logistics, files ────────────────────────────────
    const [itinerary, logistics, files] = await Promise.all([
      TripItinerary.findOne({ tripId }),
      TripLogistics.findOne({ tripId }),
      TripFile.find({ tripId }),
    ]);

    // ── 4. Build a lookup: transport type → boarding pass / ticket file ────
    // Files linked to a transport entry via linkedTo.collection = 'transport'
    const boardingPassByLabel: Record<string, any> = {};
    for (const file of files) {
      if (
        file.resourceType === 'file' &&
        ['boarding_pass', 'train_ticket'].includes(file.type) &&
        file.linkedTo?.label
      ) {
        boardingPassByLabel[file.linkedTo.label.toLowerCase()] = file;
      }
    }

    // ── 5. Check itinerary stops ────────────────────────────────────────────
    const days: any[] = itinerary?.days ?? [];

    for (const day of days) {
      const stops: any[] = day.stops ?? [];

      for (const stop of stops) {
        // Only care about stops with a scheduled time
        const eventTime = stopToDatetime(day.date, stop);
        if (!eventTime) continue;

        // Only hotel check-in stops get a lead-time notification from itinerary
        // Everything else (flights etc.) comes from logistics transport entries
        if (stop.type !== 'hotel') continue;

        const lead   = LEAD.hotel;
        if (!isInWindow(eventTime, lead, now)) continue;

        const key  = stop._id?.toString() ?? `${day.date}-${stop.name}`;
        const type = 'hotel_45m';

        // De-duplicate
        const alreadySent = await PushNotificationLog.findOne({ userId, tripId, key, notificationType: type });
        if (alreadySent) continue;

        const timeStr = eventTime.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
        const payload = {
          title: `🏨 Check-in in ${leadLabel('hotel')}`,
          body:  `${stop.name}${stop.address ? ` · ${stop.address}` : ''} · Scheduled ${timeStr}`,
          url:   `/trips/${tripId}?tab=1`,  // Logistics tab
          tag:   `hotel-${key}`,
        };

        await sendToUser(userId, user.pushSubscriptions, payload, invalidEndpoints);
        await PushNotificationLog.create({ userId, tripId, key, notificationType: type });
        totalSent++;
      }
    }

    // ── 6. Check logistics transport ──────────────────────────────────────
    const transportation: any[] = logistics?.transportation ?? [];

    for (let i = 0; i < transportation.length; i++) {
      const t = transportation[i];
      if (!t.departureTime) continue;

      const eventTime = new Date(t.departureTime);
      if (isNaN(eventTime.getTime())) continue;

      const lead = LEAD[t.type as keyof typeof LEAD] ?? LEAD.train;
      if (!isInWindow(eventTime, lead, now)) continue;

      const key  = `transport-${i}`;
      const type = `${t.type}_notify`;

      // De-duplicate
      const alreadySent = await PushNotificationLog.findOne({ userId, tripId, key, notificationType: type });
      if (alreadySent) continue;

      const emoji     = transportEmoji(t.type);
      const label     = transportLabel(t);
      const depTime   = eventTime.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
      const ref       = t.confirmationNumber ? ` · Ref: ${t.confirmationNumber}` : '';

      // Look for a boarding pass / ticket in files
      // Match by flight number, route label, or operator
      let boardingPassUrl: string | null = null;
      const searchTerms = [
        t.details?.flightNumber,
        t.details?.operator,
        `${t.departureLocation} → ${t.arrivalLocation}`,
      ].filter(Boolean).map((s: string) => s.toLowerCase());

      for (const [bpLabel, bpFile] of Object.entries(boardingPassByLabel)) {
        if (searchTerms.some(term => bpLabel.includes(term) || term.includes(bpLabel))) {
          boardingPassUrl = bpFile.gcsUrl ?? null;
          break;
        }
      }

      const body = [
        `${label} · Departs ${depTime}${ref}`,
        boardingPassUrl ? '📄 Boarding pass attached — tap to open' : null,
      ].filter(Boolean).join('\n');

      const payload = {
        title:              `${emoji} ${t.type === 'flight' ? 'Flight' : transportLabel(t).split(' · ')[0]} in ${leadLabel(t.type)}`,
        body,
        url:                boardingPassUrl ? `/trips/${tripId}?tab=7` : `/trips/${tripId}?tab=1`,
        tag:                `transport-${key}`,
        requireInteraction: t.type === 'flight',   // Flight notifications stay until dismissed
      };

      await sendToUser(userId, user.pushSubscriptions, payload, invalidEndpoints);
      await PushNotificationLog.create({ userId, tripId, key, notificationType: type });
      totalSent++;
    }

    // ── 7. Check accommodation check-in (from logistics) ──────────────────
    // This catches accommodation with explicit checkIn datetimes in logistics,
    // complementing the itinerary-based hotel stop check above.
    const accommodation: any[] = logistics?.accommodation ?? [];

    for (let i = 0; i < accommodation.length; i++) {
      const a = accommodation[i];
      if (!a.checkIn) continue;

      const eventTime = new Date(a.checkIn);
      if (isNaN(eventTime.getTime())) continue;

      // Only fire if checkIn is today and within window
      const todayStr    = now.toISOString().split('T')[0];
      const checkInDate = eventTime.toISOString().split('T')[0];
      if (checkInDate !== todayStr) continue;

      if (!isInWindow(eventTime, LEAD.hotel, now)) continue;

      const key  = `accom-${i}`;
      const type = 'accom_checkin_45m';

      const alreadySent = await PushNotificationLog.findOne({ userId, tripId, key, notificationType: type });
      if (alreadySent) continue;

      const timeStr = eventTime.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
      const ref     = a.confirmationNumber ? ` · Ref: ${a.confirmationNumber}` : '';

      const payload = {
        title: `🏨 Check-in in 45 minutes`,
        body:  `${a.name}${a.address ? ` · ${a.address}` : ''} · Check-in ${timeStr}${ref}`,
        url:   `/trips/${tripId}?tab=1`,
        tag:   `accom-${key}`,
        requireInteraction: false,
      };

      await sendToUser(userId, user.pushSubscriptions, payload, invalidEndpoints);
      await PushNotificationLog.create({ userId, tripId, key, notificationType: type });
      totalSent++;
    }

    // ── 8. Clean up expired subscriptions ─────────────────────────────────
    if (invalidEndpoints.length) {
      await User.findByIdAndUpdate(userId, {
        $pull: { pushSubscriptions: { endpoint: { $in: invalidEndpoints } } },
      });
    }
  }

  return NextResponse.json({ sent: totalSent, checkedAt: now.toISOString() });
}