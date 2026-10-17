import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { DateTime } from 'luxon';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import Trip from '@/lib/mongodb/models/Trip';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import TripFile from '@/lib/mongodb/models/TripFile';
import TripExpense from '@/lib/mongodb/models/TripExpense';
import PushNotificationLog from '@/lib/mongodb/models/PushNotificationLog';
import { getProofSlots } from '@/lib/logistics/expenseProofs';
import { resolveCheckIn, normaliseTime } from '@/lib/itinerary/checkInTiming';
import { departureZone, placeTz, tripZones, ymd } from '@/lib/push/timezones';

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// ---- Lead times (ms) --------------------------------------------------------

const NAV_LEAD: Record<string, number> = {
  flight:           3 * 60 * 60 * 1000,
  train:            60 * 60 * 1000,
  ferry:            2 * 60 * 60 * 1000,
  bus:              45 * 60 * 1000,
  car_hire:         30 * 60 * 1000,
  taxi:             20 * 60 * 1000,
  private_transfer: 20 * 60 * 1000,
  car:              0,
  bicycle:          0,
  hotel:            60 * 60 * 1000,
  activity:         45 * 60 * 1000,
  sightseeing:      45 * 60 * 1000,
  meal:             30 * 60 * 1000,
  breakfast:        30 * 60 * 1000,
  meeting:          45 * 60 * 1000,
  work:             45 * 60 * 1000,
  other:            30 * 60 * 1000,
  concert:          60 * 60 * 1000,
  conference:       60 * 60 * 1000,
  restaurant:       30 * 60 * 1000,
  event:            45 * 60 * 1000,
  sport:            60 * 60 * 1000,
};

const DOC_LEAD: Record<string, number> = {
  flight:           2.5 * 60 * 60 * 1000,
  train:            20 * 60 * 1000,
  ferry:            30 * 60 * 1000,
  bus:              20 * 60 * 1000,
  car_hire:         0,
  concert:          30 * 60 * 1000,
  conference:       30 * 60 * 1000,
  event:            30 * 60 * 1000,
  sport:            30 * 60 * 1000,
  hotel:            0,
  restaurant:       15 * 60 * 1000,
  meeting:          15 * 60 * 1000,
};

// A reminder stays due from its trigger time until the event starts, so a run
// that lands late still sends it rather than skipping it for good. Reminders
// timed at the event itself (lead 0) get a short grace period instead.
const AT_EVENT_GRACE_MS = 20 * 60 * 1000;

// Reminders that fire after something ends (proofs), and to-dos, have no event
// to expire against — they stay due this long, then are dropped as stale.
const LATE_LIMIT_MS = 6 * 60 * 60 * 1000;

// How long before departure a planning/confirmed trip is checked, and how long
// after its end date (post-checkout proof reminders still need it).
const ELIGIBLE_BEFORE_MS = 2 * 24 * 60 * 60 * 1000;
const ELIGIBLE_AFTER_MS  = 2 * 24 * 60 * 60 * 1000;

// ---- Reimbursable-expense proof reminders ------------------------------------
// A boarding pass/train ticket doesn't exist until check-in, so these fire
// *before* departure — right around when someone's sitting at the gate with
// nothing else to do. Timed against the actual linked transport leg, not a
// generic "sometime during your trip" nudge.
const PROOF_LEAD_BEFORE_DEPARTURE: Record<string, number> = {
  flight: 90 * 60 * 1000,
  train:  30 * 60 * 1000,
  bus:    30 * 60 * 1000,
  ferry:  45 * 60 * 1000,
};

// A final hotel folio or rental invoice doesn't exist until checkout/drop-off,
// so these fire *after* the relevant time instead — a "you should have this by
// now, go grab it" nudge rather than a pre-departure one.
const PROOF_LEAD_AFTER_END: Record<string, number> = {
  car_hire: 2 * 60 * 60 * 1000,
  hotel:    2 * 60 * 60 * 1000,
  airbnb:   2 * 60 * 60 * 1000,
  hostel:   2 * 60 * 60 * 1000,
};

const TYPE_EMOJI: Record<string, string> = {
  flight: 'Flight', train: 'Train', ferry: 'Ferry', bus: 'Bus',
  car_hire: 'Car hire', taxi: 'Taxi', private_transfer: 'Transfer',
  car: 'Drive', bicycle: 'Cycle',
  hotel: 'Hotel', activity: 'Activity', sightseeing: 'Sightseeing',
  meal: 'Meal', breakfast: 'Breakfast', meeting: 'Meeting',
  work: 'Work', other: 'Event',
  concert: 'Concert', conference: 'Conference', restaurant: 'Restaurant',
  event: 'Event', sport: 'Event',
};

// ---- Timezone-aware datetime parsing ----------------------------------------

// Parse a datetime string that may or may not have a timezone suffix,
// anchoring it to the given timezone so "18:00" in Bucharest
// means 18:00 EET, not 18:00 UTC.
function parseInZone(datetimeStr: string, tz: string): DateTime | null {
  if (!datetimeStr) return null;
  // Strip any trailing Z or UTC offset so the wall-clock time is always
  // interpreted as local time. Stops are entered in local time;
  // the Z is just JavaScript/MongoDB's default serialisation, not intent.
  const naive = datetimeStr.replace(/Z$/, '').replace(/[+-]\d{2}:?\d{2}$/, '');
  const dt = DateTime.fromISO(naive, { zone: tz });
  return dt.isValid ? dt : null;
}

// Build a datetime from separate date string (YYYY-MM-DD) and time string (HH:MM)
// anchored to the given timezone
function buildInZone(dateStr: string, timeStr: string, tz: string): DateTime | null {
  if (!dateStr || !timeStr) return null;
  const isoDate = dateStr.split('T')[0];
  const isoTime = timeStr.length === 5 ? timeStr : timeStr.slice(0, 5);
  const dt = DateTime.fromISO(`${isoDate}T${isoTime}:00`, { zone: tz });
  return dt.isValid ? dt : null;
}

function stopToLuxon(dayDate: string, stop: any, tz: string): DateTime | null {
  if (stop.scheduledStart) {
    return parseInZone(stop.scheduledStart.includes('T') ? stop.scheduledStart : `${dayDate.split('T')[0]}T${stop.scheduledStart}`, tz);
  }
  if (stop.time) {
    return buildInZone(dayDate, stop.time, tz);
  }
  return null;
}

function venueToLuxon(venue: any, tz: string): DateTime | null {
  return buildInZone(venue.date, venue.time, tz);
}

// ---- Due check --------------------------------------------------------------
// All comparisons done in milliseconds (UTC epoch) so timezone doesn't matter here

function isDue(eventDt: DateTime, leadMs: number, nowMs: number): boolean {
  const eventMs   = eventDt.toMillis();
  const triggerMs = eventMs - leadMs;
  return nowMs >= triggerMs && nowMs < Math.max(eventMs, triggerMs + AT_EVENT_GRACE_MS);
}

// Mirror of isDue, but the trigger is *after* the event (checkout, drop-off)
// rather than before it — for proofs that only exist once something has ended.
function isDueAfter(eventDt: DateTime, leadMs: number, nowMs: number): boolean {
  const triggerMs = eventDt.toMillis() + leadMs;
  return nowMs >= triggerMs && nowMs < triggerMs + LATE_LIMIT_MS;
}

// For todos: dueAt IS the trigger — no lead time offset needed.
function isTodoDue(dueAt: Date, nowMs: number): boolean {
  const dueMs = dueAt.getTime();
  return nowMs >= dueMs && nowMs < dueMs + LATE_LIMIT_MS;
}

// ---- Navigation -------------------------------------------------------------

function buildNavUrl(
  arrivalLocation: string,
  arrivalCoordinates: any,
  transportType: string,
  navApp: string
): string | null {
  const isCoords   = arrivalCoordinates?.lat;
  const dest       = isCoords
    ? `${arrivalCoordinates.lat},${arrivalCoordinates.lng}`
    : arrivalLocation;
  if (!dest) return null;

  const destEncoded = encodeURIComponent(dest);
  const travelMode  = ['train', 'bus', 'ferry'].includes(transportType) ? 'transit' : 'driving';

  switch (navApp) {
    case 'apple_maps':
      return isCoords
        ? `https://maps.apple.com/?daddr=${dest}&dirflg=${travelMode === 'transit' ? 'r' : 'd'}`
        : `https://maps.apple.com/?daddr=${destEncoded}&dirflg=${travelMode === 'transit' ? 'r' : 'd'}`;
    case 'waze':
      return isCoords
        ? `https://waze.com/ul?ll=${dest}&navigate=yes`
        : `https://waze.com/ul?q=${destEncoded}&navigate=yes`;
    case 'google_maps':
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${destEncoded}&travelmode=${travelMode}`;
  }
}

function transportLabel(t: any): string {
  const from  = t.departureLocation ?? '';
  const to    = t.arrivalLocation   ?? '';
  const route = from && to ? `${from} to ${to}` : (from || to);
  switch (t.type) {
    case 'flight':
      return [t.details?.airline, t.details?.flightNumber, route].filter(Boolean).join(' - ');
    case 'train':
    case 'bus':
    case 'ferry':
      return [t.details?.operator, route].filter(Boolean).join(' - ');
    case 'car_hire':
      return [t.details?.rentalCompany, t.details?.pickupLocation ? `Pickup: ${t.details.pickupLocation}` : ''].filter(Boolean).join(' - ');
    case 'taxi':
    case 'private_transfer':
      return route || 'Transfer';
    default:
      return route || t.type;
  }
}

// From the actual time left, not the nominal lead — a reminder sent by a late
// run shouldn't claim "in 3 hours" when it's 2h 40m.
function startsIn(eventDt: DateTime, nowMs: number): string {
  const mins = Math.round((eventDt.toMillis() - nowMs) / 60000 / 5) * 5;
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins} minutes`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h} hour${h !== 1 ? 's' : ''}`;
}

// ---- File matching ----------------------------------------------------------

function findLinkedFiles(files: any[], searchTerms: string[]): any[] {
  const terms = searchTerms.filter(Boolean).map(s => s.toLowerCase());
  return files.filter(f => {
    if (!f.linkedTo?.label) return false;
    const label = f.linkedTo.label.toLowerCase();
    return terms.some(t => label.includes(t) || t.includes(label));
  });
}

function summariseFiles(linked: any[]): string | null {
  if (!linked.length) return null;
  return linked.map(f => {
    switch (f.type) {
      case 'boarding_pass':        return 'Boarding pass';
      case 'train_ticket':         return 'Train ticket';
      case 'booking_confirmation': return 'Booking confirmation';
      case 'visa':                 return 'Visa';
      case 'insurance':            return 'Insurance';
      case 'link':                 return f.name ?? 'Link';
      case 'note':                 return f.name ?? 'Note';
      case 'contact':              return f.name ?? 'Contact';
      default:                     return f.name ?? 'Document';
    }
  }).join(', ');
}

// The itinerary's check-in stop for an accommodation booking. Its time is the
// same estimate resolveCheckIn makes, or the traveller's own if they've moved it.
function checkInStopTime(itinerary: any, accomIndex: number, tz: string): DateTime | null {
  for (const day of itinerary?.days ?? []) {
    for (const stop of day.stops ?? []) {
      if (stop.source === 'logistics'
        && stop.logisticsRef?.collection === 'accommodation'
        && stop.logisticsRef?.index === accomIndex
        && stop.metadata?.phase === 'checkin') {
        return stopToLuxon(day.date, stop, tz);
      }
    }
  }
  return null;
}

// ---- Push -------------------------------------------------------------------

async function sendPush(subscriptions: any[], payload: object, invalidEndpoints: string[]): Promise<number> {
  const str = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, str);
        return true;
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          invalidEndpoints.push(sub.endpoint);
        } else {
          console.error(`[notify] push to ${hostOf(sub.endpoint)} failed: ${err?.statusCode ?? ''} ${err?.body ?? err?.message ?? err}`);
        }
        return false;
      }
    })
  );
  return results.filter(r => r.status === 'fulfilled' && r.value === true).length;
}

function hostOf(endpoint: string): string {
  try { return new URL(endpoint).host; } catch { return 'unknown endpoint'; }
}

async function logAndSend(
  userId: string, tripId: string, key: string, type: string,
  subscriptions: any[], payload: object, invalidEndpoints: string[]
): Promise<boolean> {
  const entry = { userId, tripId, key, notificationType: type };
  // Claim before sending: the unique index lets exactly one run own a reminder,
  // so overlapping runs can't send it twice (or crash on the duplicate insert).
  try {
    await PushNotificationLog.create(entry);
  } catch (err: any) {
    if (err?.code === 11000) return false;
    throw err;
  }
  const sent = await sendPush(subscriptions, payload, invalidEndpoints);
  // Nothing delivered (stale subscriptions, push service down) — release the
  // claim so the next run retries while the reminder is still due.
  if (sent === 0) {
    await PushNotificationLog.deleteOne(entry);
    return false;
  }
  return true;
}

// ---- One trip: itinerary / logistics / doc / venue reminders -----------------

async function notifyTrip(trip: any, nowMs: number): Promise<number> {
  const tripId = trip._id.toString();
  const userId = trip.userId.toString();

  const user = await User.findById(userId);
  if (!user?.pushSubscriptions?.length) {
    console.log(`[notify] Trip ${tripId}: user ${userId} has no push subscriptions — skipping`);
    return 0;
  }
  console.log(`[notify] Trip ${tripId}: user ${userId} has ${user.pushSubscriptions.length} subscription(s)`);

  // Times are local to wherever each thing happens — see lib/push/timezones.ts
  const zoneFor = tripZones(trip);

  const subs             = user.pushSubscriptions;
  const invalidEndpoints: string[] = [];
  const drivingNavApp    = user.preferences?.navigationApps?.driving  ?? 'google_maps';
  const transitNavApp    = user.preferences?.navigationApps?.transit  ?? 'google_maps';
  let sentCount = 0;

  const [itinerary, logistics, files, tripExpenses] = await Promise.all([
    TripItinerary.findOne({ tripId }),
    TripLogistics.findOne({ tripId }),
    TripFile.find({ tripId }),
    TripExpense.find({ tripId }),
  ]);

  const allFiles: any[] = files ?? [];

  // =========================================================================
  // 1. LOGISTICS TRANSPORT
  // =========================================================================

  for (let i = 0; i < (logistics?.transportation ?? []).length; i++) {
    const t = logistics.transportation[i];
    if (!t.departureTime) continue;

    // Departure time as printed on the booking — local to where it leaves from,
    // which for the flight out is home, not the destination.
    const eventDt = parseInZone(t.departureTime, departureZone(trip, zoneFor, t.departureLocation, ymd(t.departureTime)));
    if (!eventDt) continue;

    const navLead = NAV_LEAD[t.type] ?? 0;
    const docLead = DOC_LEAD[t.type] ?? null;
    const label   = transportLabel(t);
    const kind    = TYPE_EMOJI[t.type] ?? 'Transport';
    const depTime = eventDt.toFormat('HH:mm');
    const ref     = t.confirmationNumber ? ` - Ref: ${t.confirmationNumber}` : '';
    const tripUrl = `/trips/${tripId}?tab=logistics`;

    // ── NAV ─────────────────────────────────────────────────────────────
    if (navLead > 0 && isDue(eventDt, navLead, nowMs)) {
      const navApp = ['train', 'bus', 'ferry'].includes(t.type) ? transitNavApp : drivingNavApp;
      const navUrl = t.arrivalLocation
        ? buildNavUrl(t.arrivalLocation, t.arrivalCoordinates, t.type, navApp)
        : null;

      const sent = await logAndSend(userId, tripId, `transport-${i}`, `${t.type}_nav`, subs, {
        title:              `${kind}: ${label} ${startsIn(eventDt, nowMs)}`,
        body:               [`Departs ${depTime}${ref}`, 'Tap for navigation'].join('\n'),
        url:                navUrl ?? tripUrl,
        tag:                `transport-nav-${i}`,
        requireInteraction: t.type === 'flight',
      }, invalidEndpoints);
      if (sent) sentCount++;
    }

    // ── DOC ─────────────────────────────────────────────────────────────
    if (docLead !== null && isDue(eventDt, docLead, nowMs)) {
      const linked      = findLinkedFiles(allFiles, [t.details?.flightNumber, t.details?.operator, `${t.departureLocation} to ${t.arrivalLocation}`, t.arrivalLocation]);
      const fileSummary = summariseFiles(linked);
      const docUrl      = linked[0]?.gcsUrl ?? linked[0]?.linkUrl ?? tripUrl;

      const sent = await logAndSend(userId, tripId, `transport-${i}`, `${t.type}_doc`, subs, {
        title:              `${kind}: ${label} - Your documents`,
        body:               fileSummary
          ? `${fileSummary} - tap to open\nDeparts ${depTime}${ref}`
          : `Check your Resources for this trip\nDeparts ${depTime}${ref}`,
        url:                fileSummary ? docUrl : `/trips/${tripId}?tab=resources`,
        tag:                `transport-doc-${i}`,
        requireInteraction: t.type === 'flight',
      }, invalidEndpoints);
      if (sent) sentCount++;
    }

    // ── REIMBURSABLE PROOF REMINDER ──────────────────────────────────────
    // Only fires if this leg is actually linked to a reimbursable expense
    // (created via the "Reimbursable?" toggle) and the relevant proof isn't
    // already uploaded — no point nagging about something already done.
    const linkedExpense = tripExpenses.find(
      (e: any) => e.linkedTo?.collection === 'transport' && e.linkedTo?.entryId === String(i),
    );
    if (linkedExpense) {
      const afterSlots = getProofSlots(t.type).filter(s => s.phase === 'after' && s.required);
      for (const slot of afterSlots) {
        const already = (linkedExpense.proofs ?? []).some((p: any) => p.key === slot.key);
        if (already) continue;

        // flight/train/bus/ferry: proof only exists once you're checking in,
        // so remind before departure. car_hire's final invoice only exists at
        // drop-off, so that one's timed off arrivalTime and fires after.
        const beforeLead = PROOF_LEAD_BEFORE_DEPARTURE[t.type];
        const afterLead  = PROOF_LEAD_AFTER_END[t.type];

        let due = false;
        let anchorDt = eventDt;
        if (beforeLead !== undefined) {
          due = isDue(eventDt, beforeLead, nowMs);
        } else if (afterLead !== undefined && t.arrivalTime) {
          const dropOffDt = parseInZone(t.arrivalTime, zoneFor(ymd(t.arrivalTime)));
          if (dropOffDt) { anchorDt = dropOffDt; due = isDueAfter(dropOffDt, afterLead, nowMs); }
        }
        if (!due) continue;

        const sent = await logAndSend(userId, tripId, `transport-proof-${i}-${slot.key}`, `${t.type}_proof_${slot.key}`, subs, {
          title: `Don't forget: ${slot.label}`,
          body:  `${label}\n${beforeLead !== undefined ? `Departs ${depTime}` : `Due back ${anchorDt.toFormat('HH:mm')}`} — upload it before you lose it`,
          url:   `/trips/${tripId}?tab=expenses`,
          tag:   `transport-proof-${i}-${slot.key}`,
        }, invalidEndpoints);
        if (sent) sentCount++;
      }
    }
  }

  // =========================================================================
  // 2. LOGISTICS ACCOMMODATION
  // =========================================================================

  for (let i = 0; i < (logistics?.accommodation ?? []).length; i++) {
    const a = logistics.accommodation[i];

    // ── REIMBURSABLE PROOF REMINDER (final invoice, at checkout) ─────────
    // checkIn/checkOut are date-only fields, so this anchors to the property's
    // checkout time (or a reasonable default) rather than midnight.
    const afterLead = PROOF_LEAD_AFTER_END[a.type];
    if (a.checkOut && afterLead !== undefined) {
      const checkOutDate = ymd(a.checkOut);
      const checkoutDt   = buildInZone(checkOutDate, normaliseTime(a.checkOutTime) ?? '11:00', zoneFor(checkOutDate));
      if (checkoutDt) {
        const linkedExpense = tripExpenses.find(
          (e: any) => e.linkedTo?.collection === 'accommodation' && e.linkedTo?.entryId === String(i),
        );
        if (linkedExpense) {
          const afterSlots = getProofSlots(a.type).filter(s => s.phase === 'after' && s.required);
          for (const slot of afterSlots) {
            const already = (linkedExpense.proofs ?? []).some((p: any) => p.key === slot.key);
            if (already) continue;
            if (!isDueAfter(checkoutDt, afterLead, nowMs)) continue;

            const sent = await logAndSend(userId, tripId, `accom-proof-${i}-${slot.key}`, `${a.type}_proof_${slot.key}`, subs, {
              title: `Don't forget: ${slot.label}`,
              body:  `${a.name || 'Accommodation'} — upload it before you lose it`,
              url:   `/trips/${tripId}?tab=expenses`,
              tag:   `accom-proof-${i}-${slot.key}`,
            }, invalidEndpoints);
            if (sent) sentCount++;
          }
        }
      }
    }

    if (!a.checkIn) continue;

    // No check-in time is booked, so use the time the itinerary shows for it
    // (property window / after landing, or wherever the traveller moved it).
    const checkInDate = ymd(a.checkIn);
    const zone        = zoneFor(checkInDate);
    const eventDt     = checkInStopTime(itinerary, i, zone) ?? buildInZone(checkInDate, resolveCheckIn({
      checkInDate,
      propertyCheckInTime: a.checkInTime,
      arrivals: (logistics?.transportation ?? []).map((t: any) => t.arrivalTime ?? null),
    }).time, zone);
    if (!eventDt) continue;

    const timeStr = eventDt.toFormat('HH:mm');
    const ref     = a.confirmationNumber ? ` - Ref: ${a.confirmationNumber}` : '';
    const tripUrl = `/trips/${tripId}?tab=logistics`;

    // ── NAV ─────────────────────────────────────────────────────────────
    if (isDue(eventDt, NAV_LEAD.hotel, nowMs)) {
      const navUrl = a.address ? buildNavUrl(a.address, null, 'car', drivingNavApp) : null;
      const sent = await logAndSend(userId, tripId, `accom-${i}`, 'accom_nav', subs, {
        title: `Hotel: Check-in ${startsIn(eventDt, nowMs)}`,
        body:  [`${a.name}${a.address ? ' - ' + a.address : ''} - ${timeStr}`, 'Tap for navigation'].join('\n'),
        url:   navUrl ?? tripUrl,
        tag:   `accom-nav-${i}`,
      }, invalidEndpoints);
      if (sent) sentCount++;
    }

    // ── DOC ─────────────────────────────────────────────────────────────
    if (isDue(eventDt, DOC_LEAD.hotel, nowMs)) {
      const linked      = findLinkedFiles(allFiles, [a.name, a.address]);
      const fileSummary = summariseFiles(linked);
      const docUrl      = linked[0]?.gcsUrl ?? linked[0]?.linkUrl ?? tripUrl;

      const sent = await logAndSend(userId, tripId, `accom-${i}`, 'accom_doc', subs, {
        title: `Hotel: ${a.name} - Check-in now`,
        body:  fileSummary
          ? `${fileSummary} - tap to open${ref}`
          : `Check your Resources for booking details${ref}`,
        url:   fileSummary ? docUrl : `/trips/${tripId}?tab=resources`,
        tag:   `accom-doc-${i}`,
      }, invalidEndpoints);
      if (sent) sentCount++;
    }
  }

  // =========================================================================
  // 3. ITINERARY STOPS
  // =========================================================================

  for (const day of (itinerary?.days ?? [])) {
    const zone = zoneFor(day.date);

    for (const stop of (day.stops ?? [])) {
      // Stops mirrored from Logistics are covered by the transport, check-in and
      // venue reminders; their copies here (plus transfers, airport check-in and
      // daily hotel breakfast) would only duplicate or nag. Check-out has no
      // reminder anywhere else, so it stays.
      const isCheckout = stop.source === 'logistics' && stop.metadata?.phase === 'checkout';
      if (stop.source === 'logistics' && !isCheckout) continue;

      const eventDt = stopToLuxon(day.date, stop, zone);
      if (!eventDt) continue;

      const hasCustomLead = stop.notificationLeadMins != null;
      const navLead = hasCustomLead
        ? (stop.notificationLeadMins as number) * 60 * 1000
        : NAV_LEAD[stop.type] ?? 30 * 60 * 1000;
      const docLead = hasCustomLead ? null : (DOC_LEAD[stop.type] ?? null);
      const kind    = TYPE_EMOJI[stop.type] ?? 'Event';
      const timeStr = eventDt.toFormat('HH:mm');
      // Mirrored stops get a fresh _id on every Logistics sync — key check-out by
      // its booking so a re-sync can't resend it.
      const key     = isCheckout && stop.logisticsRef
        ? `accom-checkout-${stop.logisticsRef.index}`
        : stop._id?.toString() ?? `${day.date}-${stop.name}`;
      const tripUrl = `/trips/${tripId}?tab=itinerary`;

      // ── NAV / REMINDER ───────────────────────────────────────────────
      if (navLead > 0 && isDue(eventDt, navLead, nowMs)) {
        const notifType = hasCustomLead ? `${stop.type}_reminder` : `${stop.type}_nav`;
        const navUrl = stop.address
          ? buildNavUrl(stop.address, stop.coordinates, stop.type, drivingNavApp)
          : null;

        // Reference (platform, seat, booking code) leads the body when present
        const refLine  = stop.reference ? stop.reference : null;
        const bodyLines: string[] = [];
        if (stop.address) bodyLines.push(`${stop.address} - ${timeStr}`);
        else              bodyLines.push(timeStr);
        if (navUrl)       bodyLines.push('Tap for navigation');
        const body = bodyLines.join('\n');

        // For transport with a reference, surface it in the title so it's
        // the first thing visible in the lock-screen / banner notification.
        const title = refLine && stop.type === 'transport'
          ? `${refLine} · ${stop.name} ${startsIn(eventDt, nowMs)}`
          : `${kind}: ${stop.name} ${startsIn(eventDt, nowMs)}`;

        const sent = await logAndSend(userId, tripId, key, notifType, subs, {
          title,
          body,
          url:   navUrl ?? tripUrl,
          tag:   `stop-nav-${key}`,
        }, invalidEndpoints);
        if (sent) sentCount++;
      }

      // ── DOC ─────────────────────────────────────────────────────────
      if (docLead !== null && isDue(eventDt, docLead, nowMs)) {
        const linked      = findLinkedFiles(allFiles, [stop.name, stop.address]);
        const fileSummary = summariseFiles(linked);
        const docUrl      = linked[0]?.gcsUrl ?? linked[0]?.linkUrl ?? tripUrl;
        const refLine     = stop.reference ? `${stop.reference} · ` : '';

        const sent = await logAndSend(userId, tripId, key, `${stop.type}_doc`, subs, {
          title: `${kind}: ${stop.name} - Your documents`,
          body:  fileSummary
            ? `${refLine}${fileSummary} - tap to open\n${timeStr}`
            : `${refLine}Check your Resources for this trip\n${timeStr}`,
          url:   fileSummary ? docUrl : `/trips/${tripId}?tab=resources`,
          tag:   `stop-doc-${key}`,
        }, invalidEndpoints);
        if (sent) sentCount++;
      }
    }
  }

  // =========================================================================
  // 4. VENUES
  // =========================================================================

  for (let i = 0; i < (logistics?.venues ?? []).length; i++) {
    const v = logistics.venues[i];

    const eventDt = venueToLuxon(v, zoneFor(v.date));
    if (!eventDt) continue;

    const navLead = NAV_LEAD[v.type] ?? NAV_LEAD.event;
    const docLead = DOC_LEAD[v.type] ?? DOC_LEAD.event;
    const kind    = TYPE_EMOJI[v.type] ?? 'Event';
    const timeStr = eventDt.toFormat('HH:mm');
    const key     = `venue-${i}`;
    const tripUrl = `/trips/${tripId}?tab=logistics`;

    // ── NAV ─────────────────────────────────────────────────────────────
    if (navLead > 0 && isDue(eventDt, navLead, nowMs) && v.address) {
      const navUrl = buildNavUrl(v.address, v.coordinates, 'car', drivingNavApp);
      const sent = await logAndSend(userId, tripId, key, `${v.type}_nav`, subs, {
        title: `${kind}: ${v.name} ${startsIn(eventDt, nowMs)}`,
        body:  [`${v.address} - ${timeStr}`, 'Tap for navigation'].join('\n'),
        url:   navUrl ?? tripUrl,
        tag:   `venue-nav-${i}`,
      }, invalidEndpoints);
      if (sent) sentCount++;
    }

    // ── DOC ─────────────────────────────────────────────────────────────
    if (docLead !== null && isDue(eventDt, docLead, nowMs)) {
      const linked      = findLinkedFiles(allFiles, [v.name, v.address, v.website]);
      const fileSummary = summariseFiles(linked);
      const docUrl      = linked[0]?.gcsUrl ?? linked[0]?.linkUrl ?? v.website ?? tripUrl;
      const hint        = fileSummary
        ? `${fileSummary} - tap to open`
        : v.website
          ? 'Tap to open venue website'
          : 'Check your Resources for this event';

      const sent = await logAndSend(userId, tripId, key, `${v.type}_doc`, subs, {
        title: `${kind}: ${v.name} - Starting soon`,
        body:  [hint, timeStr].join('\n'),
        url:   docUrl,
        tag:   `venue-doc-${i}`,
      }, invalidEndpoints);
      if (sent) sentCount++;
    }
  }

  // Clean up expired subscriptions for this user
  if (invalidEndpoints.length) {
    await User.findByIdAndUpdate(userId, {
      $pull: { pushSubscriptions: { endpoint: { $in: invalidEndpoints } } },
    });
  }

  return sentCount;
}

// ---- One trip's due to-dos ----------------------------------------------------

async function notifyTodos(tripId: string, todos: any[], nowMs: number): Promise<number> {
  // Only fire for trips that are going ahead — not ideas, completed or cancelled
  const trip = await Trip.findOne({
    _id:     tripId,
    status:  { $in: ['planning', 'confirmed', 'active'] },
    deleted: false,
  });
  if (!trip) return 0;

  const userId = trip.userId.toString();
  const user   = await User.findById(userId);
  if (!user?.pushSubscriptions?.length) return 0;

  const subs             = user.pushSubscriptions;
  const invalidEndpoints: string[] = [];
  let sentCount = 0;

  // The due time is shown in the zone the traveller is in when it fires: home
  // before the trip starts, the destination once it has.
  const started = !!trip.startDate && nowMs >= new Date(trip.startDate).getTime();
  const zone    = (!started && placeTz(user.homeLocation)) || tripZones(trip)(new Date(nowMs));

  for (const todo of todos) {
    const fileId = todo._id.toString();
    const key    = `todo-${fileId}`;

    // Double-check in JS (the DB query already filtered on the same range)
    if (!isTodoDue(todo.dueAt as Date, nowMs)) continue;

    const dueTime = DateTime.fromJSDate(todo.dueAt as Date).setZone(zone).toFormat('HH:mm');

    // Build notification body — include packing items if this is an advisory
    const isPacking = todo.type === 'packing_advisory';
    const bodyLines: string[] = [];

    if (todo.body) {
      bodyLines.push(todo.body);
    } else if (isPacking && todo.packingItemRef) {
      bodyLines.push(todo.packingItemRef);
    }

    bodyLines.push(`Due at ${dueTime}`);

    const sent = await logAndSend(userId, tripId, key, 'todo_reminder', subs, {
      title: isPacking
        ? `⚡ Pre-trip: ${todo.name}`
        : `✅ To-do: ${todo.name}`,
      body:  bodyLines.join('\n'),
      url:   `/trips/${tripId}?tab=resources`,
      tag:   `todo-${fileId}`,
    }, invalidEndpoints);

    if (sent) sentCount++;
  }

  // Clean up expired subscriptions encountered in this pass
  if (invalidEndpoints.length) {
    await User.findByIdAndUpdate(userId, {
      $pull: { pushSubscriptions: { endpoint: { $in: invalidEndpoints } } },
    });
  }

  return sentCount;
}

// ---- POST /api/push/notify --------------------------------------------------

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    console.log(`[notify] 403 — x-cron-secret ${secret ? 'does not match CRON_SECRET' : 'header missing'}`);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  // nowMs is UTC epoch milliseconds — timezone-agnostic reference point
  const nowMs = Date.now();

  // Safety net: activate any confirmed trips whose window has arrived,
  // in case the trip-status cron is misconfigured or delayed.
  const activationThreshold = new Date(nowMs + 2 * 24 * 60 * 60 * 1000);
  await Trip.updateMany(
    { status: 'confirmed', deleted: false, startDate: { $lte: activationThreshold }, endDate: { $gte: new Date(nowMs) } },
    { $set: { status: 'active' } }
  );

  // =========================================================================
  // PASS 1: Trips under way or about to start
  //
  // By date as well as status: new trips start as 'planning' and often stay
  // that way, and only 'confirmed' ones are ever flipped to 'active'.
  // =========================================================================

  const trips = await Trip.find({
    deleted: false,
    $or: [
      { status: 'active' },
      {
        status:    { $in: ['planning', 'confirmed'] },
        startDate: { $lte: new Date(nowMs + ELIGIBLE_BEFORE_MS) },
        endDate:   { $gte: new Date(nowMs - ELIGIBLE_AFTER_MS) },
      },
    ],
  });
  console.log(`[notify] Checking ${trips.length} trip(s)`);

  let totalSent = 0;

  for (const trip of trips) {
    // One broken trip mustn't stop everyone else's reminders.
    try {
      totalSent += await notifyTrip(trip, nowMs);
    } catch (err) {
      console.error(`[notify] Trip ${trip._id} failed:`, err);
    }
  }

  // =========================================================================
  // PASS 2: Todo reminders — planning, confirmed AND active trips
  //
  // Separate from Pass 1 so that pre-trip reminders (a packing advisory set for
  // "7 days before departure") fire regardless of the 2-day trip window.
  //   - No lead time — dueAt IS the trigger moment
  //   - One-shot: PushNotificationLog prevents re-fire (key: todo-{fileId})
  //   - Skips completed todos — no point reminding about done tasks
  // =========================================================================

  // The index on { dueAt, notification.enabled } makes this efficient.
  const dueTodos = await TripFile.find({
    resourceType:           'todo',
    'notification.enabled': true,
    completed:              false,
    dueAt:                  { $gte: new Date(nowMs - LATE_LIMIT_MS), $lte: new Date(nowMs) },
  }).lean();

  // Group todos by tripId to batch user + trip lookups
  const todosByTrip = new Map<string, any[]>();
  for (const todo of dueTodos as any[]) {
    const key = todo.tripId.toString();
    if (!todosByTrip.has(key)) todosByTrip.set(key, []);
    todosByTrip.get(key)!.push(todo);
  }

  for (const [tripId, todos] of todosByTrip) {
    try {
      totalSent += await notifyTodos(tripId, todos, nowMs);
    } catch (err) {
      console.error(`[notify] To-dos for trip ${tripId} failed:`, err);
    }
  }

  console.log(`[notify] Done — sent ${totalSent} notification(s)`);
  return NextResponse.json({ sent: totalSent, checkedAt: new Date().toISOString() });
}
