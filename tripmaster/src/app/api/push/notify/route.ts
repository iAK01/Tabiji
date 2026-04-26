import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { DateTime } from 'luxon';
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

const WINDOW_MS = 10 * 60 * 1000;

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
// anchoring it to the destination timezone so "18:00" in Bucharest
// means 18:00 EET, not 18:00 UTC.
function parseInZone(datetimeStr: string, tz: string): DateTime | null {
  if (!datetimeStr) return null;
  // Strip any trailing Z or UTC offset so the wall-clock time is always
  // interpreted as local destination time. Stops are entered in local time;
  // the Z is just JavaScript/MongoDB's default serialisation, not intent.
  const naive = datetimeStr.replace(/Z$/, '').replace(/[+-]\d{2}:?\d{2}$/, '');
  const dt = DateTime.fromISO(naive, { zone: tz });
  return dt.isValid ? dt : null;
}

// Build a datetime from separate date string (YYYY-MM-DD) and time string (HH:MM)
// anchored to the destination timezone
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

// ---- Window check -----------------------------------------------------------
// All comparisons done in milliseconds (UTC epoch) so timezone doesn't matter here

function isInWindow(eventDt: DateTime, leadMs: number, nowMs: number): boolean {
  const triggerMs = eventDt.toMillis() - leadMs;
  const diff      = nowMs - triggerMs;
  return diff >= 0 && diff <= WINDOW_MS;
}

// For todos: dueAt IS the trigger — no lead time offset needed.
// Returns true if nowMs is within the WINDOW_MS after dueAt.
function isTodoInWindow(dueAt: Date, nowMs: number): boolean {
  const dueMs = dueAt.getTime();
  const diff  = nowMs - dueMs;
  return diff >= 0 && diff <= WINDOW_MS;
}

// "Today" check in destination timezone — avoids UTC midnight flipping
function isTodayInZone(eventDt: DateTime, nowDt: DateTime): boolean {
  return eventDt.toISODate() === nowDt.toISODate();
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

function leadLabel(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins === 0) return 'now';
  return mins >= 60 ? `${Math.round(mins / 60)} hour${Math.round(mins / 60) !== 1 ? 's' : ''}` : `${mins} minutes`;
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
        }
        return false;
      }
    })
  );
  return results.filter(r => r.status === 'fulfilled' && r.value === true).length;
}

async function logAndSend(
  userId: string, tripId: string, key: string, type: string,
  subscriptions: any[], payload: object, invalidEndpoints: string[]
): Promise<boolean> {
  const found = await PushNotificationLog.findOne({ userId, tripId, key, notificationType: type });
  if (found) return false;
  const sent = await sendPush(subscriptions, payload, invalidEndpoints);
  // Only mark as sent if at least one subscription successfully received it.
  // If all subscriptions were stale (410/404), don't log — let the next cron
  // retry once the user has re-subscribed with a valid endpoint.
  if (sent === 0) return false;
  await PushNotificationLog.create({ userId, tripId, key, notificationType: type });
  return true;
}

// ---- POST /api/push/notify --------------------------------------------------

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    console.log('[notify] 403 — CRON_SECRET mismatch. Received:', secret?.slice(0, 8), 'Expected starts with:', process.env.CRON_SECRET?.slice(0, 8));
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
  // PASS 1: Active trips — full itinerary / logistics / doc / venue processing
  // =========================================================================

  const activeTrips = await Trip.find({ status: 'active', deleted: false });
  console.log(`[notify] Found ${activeTrips.length} active trip(s)`);

  let totalSent = 0;

  for (const trip of activeTrips) {
    const tripId = trip._id.toString();
    const userId = trip.userId.toString();

    // Destination timezone — prefer explicit field, then country code lookup, then UTC
    const COUNTRY_TZ: Record<string, string> = {
      DE: 'Europe/Berlin',   FR: 'Europe/Paris',    IT: 'Europe/Rome',
      ES: 'Europe/Madrid',   PT: 'Europe/Lisbon',   NL: 'Europe/Amsterdam',
      BE: 'Europe/Brussels', AT: 'Europe/Vienna',   CH: 'Europe/Zurich',
      PL: 'Europe/Warsaw',   CZ: 'Europe/Prague',   HU: 'Europe/Budapest',
      RO: 'Europe/Bucharest',GR: 'Europe/Athens',   SE: 'Europe/Stockholm',
      NO: 'Europe/Oslo',     DK: 'Europe/Copenhagen',FI:'Europe/Helsinki',
      IE: 'Europe/Dublin',   GB: 'Europe/London',   TR: 'Europe/Istanbul',
      JP: 'Asia/Tokyo',      CN: 'Asia/Shanghai',   SG: 'Asia/Singapore',
      TH: 'Asia/Bangkok',    IN: 'Asia/Kolkata',    AE: 'Asia/Dubai',
      AU: 'Australia/Sydney',NZ: 'Pacific/Auckland', ZA: 'Africa/Johannesburg',
      BR: 'America/Sao_Paulo',MX: 'America/Mexico_City',CA: 'America/Toronto',
      US: 'America/New_York',
    };
    const tz = trip.destination?.timezone
      ?? COUNTRY_TZ[trip.destination?.countryCode ?? '']
      ?? 'UTC';

    // "Now" expressed in the destination timezone for date comparisons
    const nowDt = DateTime.now().setZone(tz);

    const user = await User.findById(userId);
    if (!user?.pushSubscriptions?.length) {
      console.log(`[notify] Trip ${tripId}: user ${userId} has no push subscriptions — skipping`);
      continue;
    }
    console.log(`[notify] Trip ${tripId}: user ${userId} has ${user.pushSubscriptions.length} subscription(s), tz=${tz}, destination=${JSON.stringify(trip.destination)}`);

    const subs             = user.pushSubscriptions;
    const invalidEndpoints: string[] = [];
    const drivingNavApp    = user.preferences?.navigationApps?.driving  ?? 'google_maps';
    const transitNavApp    = user.preferences?.navigationApps?.transit  ?? 'google_maps';

    const [itinerary, logistics, files] = await Promise.all([
      TripItinerary.findOne({ tripId }),
      TripLogistics.findOne({ tripId }),
      TripFile.find({ tripId }),
    ]);

    const allFiles: any[] = files ?? [];

    // =========================================================================
    // 1. LOGISTICS TRANSPORT
    // =========================================================================

    for (let i = 0; i < (logistics?.transportation ?? []).length; i++) {
      const t = logistics.transportation[i];
      if (!t.departureTime) continue;

      // Parse departure time in destination timezone
      const eventDt = parseInZone(t.departureTime, tz);
      if (!eventDt) continue;

      const navLead = NAV_LEAD[t.type] ?? 0;
      const docLead = DOC_LEAD[t.type] ?? null;
      const label   = transportLabel(t);
      const kind    = TYPE_EMOJI[t.type] ?? 'Transport';
      const depTime = eventDt.toFormat('HH:mm');
      const ref     = t.confirmationNumber ? ` - Ref: ${t.confirmationNumber}` : '';
      const tripUrl = `/trips/${tripId}?tab=1`;

      // ── NAV ─────────────────────────────────────────────────────────────
      if (navLead > 0 && isInWindow(eventDt, navLead, nowMs)) {
        const navApp = ['train', 'bus', 'ferry'].includes(t.type) ? transitNavApp : drivingNavApp;
        const navUrl = t.arrivalLocation
          ? buildNavUrl(t.arrivalLocation, t.arrivalCoordinates, t.type, navApp)
          : null;

        const sent = await logAndSend(userId, tripId, `transport-${i}`, `${t.type}_nav`, subs, {
          title:              `${kind}: ${label} in ${leadLabel(navLead)}`,
          body:               [`Departs ${depTime}${ref}`, 'Tap for navigation'].join('\n'),
          url:                navUrl ?? tripUrl,
          tag:                `transport-nav-${i}`,
          requireInteraction: t.type === 'flight',
        }, invalidEndpoints);
        if (sent) totalSent++;
      }

      // ── DOC ─────────────────────────────────────────────────────────────
      if (docLead !== null && isInWindow(eventDt, docLead, nowMs)) {
        const linked      = findLinkedFiles(allFiles, [t.details?.flightNumber, t.details?.operator, `${t.departureLocation} to ${t.arrivalLocation}`, t.arrivalLocation]);
        const fileSummary = summariseFiles(linked);
        const docUrl      = linked[0]?.gcsUrl ?? linked[0]?.linkUrl ?? tripUrl;

        const sent = await logAndSend(userId, tripId, `transport-${i}`, `${t.type}_doc`, subs, {
          title:              `${kind}: ${label} - Your documents`,
          body:               fileSummary
            ? `${fileSummary} - tap to open\nDeparts ${depTime}${ref}`
            : `Check your Resources for this trip\nDeparts ${depTime}${ref}`,
          url:                fileSummary ? docUrl : `/trips/${tripId}?tab=7`,
          tag:                `transport-doc-${i}`,
          requireInteraction: t.type === 'flight',
        }, invalidEndpoints);
        if (sent) totalSent++;
      }
    }

    // =========================================================================
    // 2. LOGISTICS ACCOMMODATION
    // =========================================================================

    for (let i = 0; i < (logistics?.accommodation ?? []).length; i++) {
      const a = logistics.accommodation[i];
      if (!a.checkIn) continue;

      const eventDt = parseInZone(a.checkIn, tz);
      if (!eventDt) continue;

      // Only fire on the actual check-in day — compared in destination timezone
      if (!isTodayInZone(eventDt, nowDt)) continue;

      const timeStr = eventDt.toFormat('HH:mm');
      const ref     = a.confirmationNumber ? ` - Ref: ${a.confirmationNumber}` : '';
      const tripUrl = `/trips/${tripId}?tab=1`;

      // ── NAV ─────────────────────────────────────────────────────────────
      if (isInWindow(eventDt, NAV_LEAD.hotel, nowMs)) {
        const navUrl = a.address ? buildNavUrl(a.address, null, 'car', drivingNavApp) : null;
        const sent = await logAndSend(userId, tripId, `accom-${i}`, 'accom_nav', subs, {
          title: `Hotel: Check-in in ${leadLabel(NAV_LEAD.hotel)}`,
          body:  [`${a.name}${a.address ? ' - ' + a.address : ''} - ${timeStr}`, 'Tap for navigation'].join('\n'),
          url:   navUrl ?? tripUrl,
          tag:   `accom-nav-${i}`,
        }, invalidEndpoints);
        if (sent) totalSent++;
      }

      // ── DOC ─────────────────────────────────────────────────────────────
      if (isInWindow(eventDt, DOC_LEAD.hotel, nowMs)) {
        const linked      = findLinkedFiles(allFiles, [a.name, a.address]);
        const fileSummary = summariseFiles(linked);
        const docUrl      = linked[0]?.gcsUrl ?? linked[0]?.linkUrl ?? tripUrl;

        const sent = await logAndSend(userId, tripId, `accom-${i}`, 'accom_doc', subs, {
          title: `Hotel: ${a.name} - Check-in now`,
          body:  fileSummary
            ? `${fileSummary} - tap to open${ref}`
            : `Check your Resources for booking details${ref}`,
          url:   fileSummary ? docUrl : `/trips/${tripId}?tab=7`,
          tag:   `accom-doc-${i}`,
        }, invalidEndpoints);
        if (sent) totalSent++;
      }
    }

    // =========================================================================
    // 3. ITINERARY STOPS
    // =========================================================================

    for (const day of (itinerary?.days ?? [])) {
      for (const stop of (day.stops ?? [])) {
        if (stop.source === 'logistics' && stop.type === 'transport') continue;

        const eventDt = stopToLuxon(day.date, stop, tz);
        console.log(`[notify] stop RAW: "${stop.name}" scheduledStart=${JSON.stringify(stop.scheduledStart)} dayDate=${day.date}`);
        if (!eventDt) {
          console.log(`[notify] stop SKIP (no time): "${stop.name}" type=${stop.type} scheduledStart=${stop.scheduledStart} date=${day.date}`);
          continue;
        }

        const hasCustomLead = stop.notificationLeadMins != null;
        const navLead = hasCustomLead
          ? (stop.notificationLeadMins as number) * 60 * 1000
          : NAV_LEAD[stop.type] ?? 30 * 60 * 1000;
        const docLead = hasCustomLead ? null : (DOC_LEAD[stop.type] ?? null);
        const kind    = TYPE_EMOJI[stop.type] ?? 'Event';
        const timeStr = eventDt.toFormat('HH:mm');
        const key     = stop._id?.toString() ?? `${day.date}-${stop.name}`;
        const tripUrl = `/trips/${tripId}?tab=2`;

        const triggerMs = eventDt.toMillis() - navLead;
        const windowDiff = nowMs - triggerMs;
        console.log(`[notify] stop "${stop.name}" type=${stop.type} eventUTC=${eventDt.toUTC().toISO()} navLead=${navLead/60000}m triggerMs=${triggerMs} nowMs=${nowMs} diff=${windowDiff}ms inWindow=${windowDiff >= 0 && windowDiff <= WINDOW_MS}`);

        // ── NAV / REMINDER ───────────────────────────────────────────────
        if (navLead > 0 && isInWindow(eventDt, navLead, nowMs)) {
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
            ? `${refLine} · ${stop.name} in ${leadLabel(navLead)}`
            : `${kind}: ${stop.name} in ${leadLabel(navLead)}`;

          const alreadyLogged = await PushNotificationLog.findOne({ userId, tripId, key, notificationType: notifType });
          console.log(`[notify] stop "${stop.name}" IN WINDOW — alreadyLogged=${!!alreadyLogged} key=${key} type=${notifType}`);

          const sent = await logAndSend(userId, tripId, key, notifType, subs, {
            title,
            body,
            url:   navUrl ?? tripUrl,
            tag:   `stop-nav-${key}`,
          }, invalidEndpoints);
          console.log(`[notify] stop "${stop.name}" logAndSend result=${sent}`);
          if (sent) totalSent++;
        }

        // ── DOC ─────────────────────────────────────────────────────────
        if (docLead !== null && isInWindow(eventDt, docLead, nowMs)) {
          const linked      = findLinkedFiles(allFiles, [stop.name, stop.address]);
          const fileSummary = summariseFiles(linked);
          const docUrl      = linked[0]?.gcsUrl ?? linked[0]?.linkUrl ?? tripUrl;
          const refLine     = stop.reference ? `${stop.reference} · ` : '';

          const sent = await logAndSend(userId, tripId, key, `${stop.type}_doc`, subs, {
            title: `${kind}: ${stop.name} - Your documents`,
            body:  fileSummary
              ? `${refLine}${fileSummary} - tap to open\n${timeStr}`
              : `${refLine}Check your Resources for this trip\n${timeStr}`,
            url:   fileSummary ? docUrl : `/trips/${tripId}?tab=7`,
            tag:   `stop-doc-${key}`,
          }, invalidEndpoints);
          if (sent) totalSent++;
        }
      }
    }

    // =========================================================================
    // 4. VENUES
    // =========================================================================

    for (let i = 0; i < (logistics?.venues ?? []).length; i++) {
      const v = logistics.venues[i];

      const eventDt = venueToLuxon(v, tz);
      if (!eventDt) continue;

      const navLead = NAV_LEAD[v.type] ?? NAV_LEAD.event;
      const docLead = DOC_LEAD[v.type] ?? DOC_LEAD.event;
      const kind    = TYPE_EMOJI[v.type] ?? 'Event';
      const timeStr = eventDt.toFormat('HH:mm');
      const key     = `venue-${i}`;
      const tripUrl = `/trips/${tripId}?tab=1`;

      // ── NAV ─────────────────────────────────────────────────────────────
      if (navLead > 0 && isInWindow(eventDt, navLead, nowMs) && v.address) {
        const navUrl = buildNavUrl(v.address, v.coordinates, 'car', drivingNavApp);
        const sent = await logAndSend(userId, tripId, key, `${v.type}_nav`, subs, {
          title: `${kind}: ${v.name} in ${leadLabel(navLead)}`,
          body:  [`${v.address} - ${timeStr}`, 'Tap for navigation'].join('\n'),
          url:   navUrl ?? tripUrl,
          tag:   `venue-nav-${i}`,
        }, invalidEndpoints);
        if (sent) totalSent++;
      }

      // ── DOC ─────────────────────────────────────────────────────────────
      if (docLead !== null && isInWindow(eventDt, docLead, nowMs)) {
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
        if (sent) totalSent++;
      }
    }

    // Clean up expired subscriptions for this user
    if (invalidEndpoints.length) {
      await User.findByIdAndUpdate(userId, {
        $pull: { pushSubscriptions: { endpoint: { $in: invalidEndpoints } } },
      });
    }
  }

  // =========================================================================
  // PASS 2: Todo reminders — confirmed AND active trips
  //
  // This pass is intentionally separate from Pass 1 so that:
  //   - Confirmed trips (not yet active) can still fire pre-trip todo reminders
  //   - The logic is clean and not entangled with itinerary/logistics processing
  //   - A packing advisory set for "7 days before departure" fires reliably
  //     regardless of the trip activation window (currently 2 days)
  //
  // Key differences from Pass 1:
  //   - Scope: status confirmed OR active (not just active)
  //   - Only processes resourceType === 'todo' files
  //   - No lead time — dueAt IS the trigger moment
  //   - One-shot: PushNotificationLog prevents re-fire (key: todo-{fileId})
  //   - Skips completed todos — no point reminding about done tasks
  // =========================================================================

  // Fetch all confirmed+active trips that have at least one enabled todo
  // whose dueAt falls within the next WINDOW_MS from now.
  // The index on { dueAt, notification.enabled } makes this efficient.
const windowStart = new Date(nowMs - WINDOW_MS);
const windowEnd   = new Date(nowMs);

  const dueTodos = await TripFile.find({
    resourceType:           'todo',
    'notification.enabled': true,
    completed:              false,
    dueAt:                  { $gte: windowStart, $lte: windowEnd },
  }).lean();

  if (dueTodos.length > 0) {
    // Group todos by tripId to batch user + trip lookups
    const todosByTrip = new Map<string, typeof dueTodos>();
    for (const todo of dueTodos) {
      const key = todo.tripId.toString();
      if (!todosByTrip.has(key)) todosByTrip.set(key, []);
      todosByTrip.get(key)!.push(todo);
    }

    for (const [tripId, todos] of todosByTrip) {
      // Only fire for confirmed or active trips — not completed/cancelled
      const trip = await Trip.findOne({
        _id:     tripId,
        status:  { $in: ['confirmed', 'active'] },
        deleted: false,
      });
      if (!trip) continue;

      const userId = trip.userId.toString();
      const user   = await User.findById(userId);
      if (!user?.pushSubscriptions?.length) continue;

      const subs             = user.pushSubscriptions;
      const invalidEndpoints: string[] = [];

      for (const todo of todos) {
        const fileId = todo._id.toString();
        const key    = `todo-${fileId}`;

        // Double-check the window in JS (the DB query already filtered, but
        // isTodoInWindow gives us the same ±WINDOW_MS precision as Pass 1)
        if (!isTodoInWindow(todo.dueAt as Date, nowMs)) continue;

        // Format dueAt for the notification body — show time in UTC
        // (user set the time knowing their local context; we show what they set)
        const dueTime = DateTime.fromJSDate(todo.dueAt as Date)
          .toUTC()
          .toFormat('HH:mm');

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
          url:   `/trips/${tripId}?tab=7`,   // Files tab
          tag:   `todo-${fileId}`,
        }, invalidEndpoints);

        if (sent) totalSent++;
      }

      // Clean up expired subscriptions encountered in this pass
      if (invalidEndpoints.length) {
        await User.findByIdAndUpdate(userId, {
          $pull: { pushSubscriptions: { endpoint: { $in: invalidEndpoints } } },
        });
      }
    }
  }

  console.log(`[notify] Done — sent ${totalSent} notification(s)`);
  return NextResponse.json({ sent: totalSent, checkedAt: new Date().toISOString() });
}