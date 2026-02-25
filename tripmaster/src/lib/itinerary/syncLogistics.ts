// src/lib/itinerary/syncLogistics.ts
//
// Shared utility — imported by the logistics route AND the venues sub-routes
// so that any change to transport, accommodation, or venues triggers a full
// itinerary rebuild.

import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';

function transportStopLabel(t: any): string {
  const type = t.type ?? 'flight';
  switch (type) {
    case 'flight': {
      const flight = t.details?.flightNumber ?? t.flightNumber ?? '';
      const from   = t.departureLocation ?? t.departureAirport ?? '';
      const to     = t.arrivalLocation   ?? t.arrivalAirport   ?? '';
      return [flight, from && to ? `${from} → ${to}` : (from || to)].filter(Boolean).join(' · ');
    }
    case 'train': {
      const op    = t.details?.operator ?? '';
      const from  = t.departureLocation ?? '';
      const to    = t.arrivalLocation   ?? '';
      const route = from && to ? `${from} → ${to}` : (from || to);
      return op ? `${route} · ${op}` : route;
    }
    case 'bus': {
      const op    = t.details?.operator ?? '';
      const from  = t.departureLocation ?? '';
      const to    = t.arrivalLocation   ?? '';
      const route = from && to ? `${from} → ${to}` : (from || to);
      return ['Bus', op, route].filter(Boolean).join(' · ');
    }
    case 'ferry': {
      const op    = t.details?.operator ?? '';
      const from  = t.departureLocation ?? '';
      const to    = t.arrivalLocation   ?? '';
      const route = from && to ? `${from} → ${to}` : (from || to);
      return ['Ferry', op, route].filter(Boolean).join(' · ');
    }
    case 'car': {
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return from && to ? `Drive: ${from} → ${to}` : 'Drive';
    }
    case 'car_hire': {
      const co = t.details?.rentalCompany ?? '';
      const pu = t.details?.pickupLocation ?? t.departureLocation ?? '';
      return ['Car hire', co, pu ? `Pickup: ${pu}` : ''].filter(Boolean).join(' · ');
    }
    case 'taxi': {
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return from && to ? `Taxi: ${from} → ${to}` : 'Taxi';
    }
    case 'private_transfer': {
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return from && to ? `Transfer: ${from} → ${to}` : 'Private transfer';
    }
    case 'bicycle': {
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return from && to ? `Cycle: ${from} → ${to}` : 'Bicycle';
    }
    default: {
      const from = t.departureLocation ?? '';
      const to   = t.arrivalLocation   ?? '';
      return from && to ? `${from} → ${to}` : 'Transport';
    }
  }
}

function toTimeString(dt: string | Date | undefined): string {
  if (!dt) return '09:00';
  const d = new Date(dt);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toDateString(dt: string | Date | undefined): string {
  if (!dt) return '';
  return new Date(dt).toISOString().split('T')[0];
}

function stopColor(type: string): string {
  switch (type) {
    case 'flight':           return '#c9521b';
    case 'train':            return '#7b52ab';
    case 'bus':              return '#1565c0';
    case 'ferry':            return '#00838f';
    case 'car':
    case 'car_hire':         return '#2e7d32';
    case 'taxi':
    case 'private_transfer': return '#f57f17';
    case 'bicycle':          return '#558b2f';
    default:                 return '#455a64';
  }
}

export async function syncLogisticsToItinerary(tripId: string, logistics?: any) {
  try {
    // If logistics not passed in, fetch it
    const log = logistics ?? await TripLogistics.findOne({ tripId });
    if (!log) return;

    const itinerary = await TripItinerary.findOne({ tripId });
    if (!itinerary) return;

    // Strip all existing logistics-sourced stops
    for (const day of itinerary.days) {
      day.stops = (day.stops ?? []).filter((s: any) => s.source !== 'logistics');
    }

    const newStops: any[] = [];

    // ── Transport ────────────────────────────────────────────────────────────
    for (const t of log.transportation ?? []) {
      const depTime = t.departureTime;
      const arrTime = t.arrivalTime;
      const label   = transportStopLabel(t);
      const color   = stopColor(t.type ?? 'flight');
      const type    = t.type === 'flight' ? 'flight' : 'transport';

      if (depTime) {
        newStops.push({
          date: toDateString(depTime), time: toTimeString(depTime),
          label, type, color, locked: true, source: 'logistics',
          metadata: { transportType: t.type, phase: 'departure' },
        });
      }

      if (arrTime) {
        const arrDate   = toDateString(arrTime);
        const depDate   = depTime ? toDateString(depTime) : null;
        const shortMode = ['taxi', 'car', 'bicycle'].includes(t.type ?? '');
        if (!shortMode || arrDate !== depDate) {
          newStops.push({
            date: arrDate, time: toTimeString(arrTime),
            label: `Arrive: ${t.arrivalLocation ?? t.arrivalAirport ?? label}`,
            type, color, locked: true, source: 'logistics',
            metadata: { transportType: t.type, phase: 'arrival' },
          });
        }
      }
    }

    // ── Accommodation ────────────────────────────────────────────────────────
    for (const a of log.accommodation ?? []) {
      if (a.checkIn) {
        newStops.push({
          date: toDateString(a.checkIn), time: '15:00',
          label: `Check in: ${a.name ?? 'Accommodation'}`,
          type: 'accommodation', color: '#1a3a5c', locked: true, source: 'logistics',
          metadata: { accommodationType: a.type, phase: 'checkin' },
        });
      }
      if (a.checkOut) {
        newStops.push({
          date: toDateString(a.checkOut), time: '11:00',
          label: `Check out: ${a.name ?? 'Accommodation'}`,
          type: 'accommodation', color: '#1a3a5c', locked: true, source: 'logistics',
          metadata: { accommodationType: a.type, phase: 'checkout' },
        });
      }
    }

    // ── Venues ───────────────────────────────────────────────────────────────
    const venueEmoji: Record<string, string> = {
      concert: '🎵', conference: '🏛️', restaurant: '🍽️',
      sports: '🏟️', attraction: '🏛️', business: '💼', other: '📍',
    };

    for (const v of log.venues ?? []) {
      if (!v.name || !v.date) continue;

      let duration = 120;
      if (v.time && v.endTime) {
        const [sh, sm] = v.time.split(':').map(Number);
        const [eh, em] = v.endTime.split(':').map(Number);
        const calc = (eh * 60 + em) - (sh * 60 + sm);
        if (calc > 0) duration = calc;
      }

      newStops.push({
        date: toDateString(v.date), time: v.time ?? '20:00',
        label: `${venueEmoji[v.type] ?? '📍'} ${v.name}`,
        type: 'activity', color: '#55702C', locked: true, source: 'logistics',
        duration,
        notes: [
          v.address,
          v.confirmationNumber ? `Ref: ${v.confirmationNumber}` : null,
          v.website            ? `🔗 ${v.website}`              : null,
          v.status === 'confirmed' ? '✅ Confirmed' : '⏳ Not booked',
        ].filter(Boolean).join(' · '),
        metadata: { venueType: v.type },
      });
    }

    // ── Assign to days ───────────────────────────────────────────────────────
    for (const stop of newStops) {
      let day = itinerary.days.find((d: any) => d.date === stop.date);
      if (!day) {
        itinerary.days.push({ date: stop.date, stops: [] });
        day = itinerary.days[itinerary.days.length - 1];
      }
      const { date, ...stopWithoutDate } = stop;
      day.stops.push(stopWithoutDate);
    }

    itinerary.days.sort((a: any, b: any) => a.date.localeCompare(b.date));
    for (const day of itinerary.days) {
      day.stops.sort((a: any, b: any) => (a.time ?? '').localeCompare(b.time ?? ''));
    }

    await TripItinerary.findOneAndUpdate(
      { _id: itinerary._id },
      { $set: { days: itinerary.days } },
      { returnDocument: 'after' }
    );
  } catch (err) {
    console.error('syncLogisticsToItinerary failed:', err);
  }
}