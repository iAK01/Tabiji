// src/lib/itinerary/syncLogistics.ts

import mongoose from 'mongoose';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';

function transportStopName(t: any): string {
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
      return from && to ? `${from} → ${to}` : 'Drive';
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

function toScheduledStart(date: string | Date | undefined, time: string): string | undefined {
  if (!date) return undefined;
  return `${toDateString(date)}T${time}:00`;
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
    const log = logistics ?? await TripLogistics.findOne({ tripId });
    if (!log) return;

    const itinerary = await TripItinerary.findOne({ tripId });
    if (!itinerary) return;

    // Normalise all existing day dates to YYYY-MM-DD to prevent duplicate day
    // creation when MongoDB has stored them as full ISO strings (e.g. "2026-03-02T00:00:00.000Z")
    for (const day of itinerary.days) {
      if (day.date) day.date = toDateString(day.date);
    }

    // Strip all existing logistics-sourced stops
    for (const day of itinerary.days) {
      day.stops = (day.stops ?? []).filter((s: any) => s.source !== 'logistics');
    }

    const newStops: any[] = [];

    // ── Transport ─────────────────────────────────────────────────────────────
    for (const t of log.transportation ?? []) {
      const depTime = t.departureTime;
      const arrTime = t.arrivalTime;
      const name    = transportStopName(t);
      const color   = stopColor(t.type ?? 'flight');
      const type    = t.type === 'flight' ? 'flight' : 'transport';

      // Duration from dep→arr if both present on same day
      let duration = 60;
      if (depTime && arrTime) {
        const diff = Math.round(
          (new Date(arrTime).getTime() - new Date(depTime).getTime()) / 60000
        );
        if (diff > 0) duration = diff;
      }

      if (depTime) {
        const time = toTimeString(depTime);
        newStops.push({
          _id:            new mongoose.Types.ObjectId(),
          date:           toDateString(depTime),
          name,
          type,
          color,
          time,
          scheduledStart: toScheduledStart(depTime, time),
          scheduledEnd:   arrTime ? new Date(arrTime).toISOString() : undefined,
          duration,
          locked:         true,
          source:         'logistics',
          address: ['car','taxi','private_transfer','bicycle'].includes(t.type)
  ? (t.arrivalLocation ?? undefined)
  : (t.departureAddress ?? t.departureLocation ?? undefined),
coordinates: ['car','taxi','private_transfer','bicycle'].includes(t.type)
  ? (t.arrivalCoordinates ?? undefined)
  : (t.departureCoordinates ?? undefined),
          metadata: { transportType: t.type, phase: 'departure' },
        });
      }

      // Only add arrival stop if it lands on a different date (long-haul)
      if (arrTime) {
        const arrDate = toDateString(arrTime);
        const depDate = depTime ? toDateString(depTime) : null;
        const shortMode = ['taxi', 'car', 'bicycle'].includes(t.type ?? '');
        if (!shortMode || arrDate !== depDate) {
          const time = toTimeString(arrTime);
          newStops.push({
            _id:            new mongoose.Types.ObjectId(),
            date:           arrDate,
            name:           `Arrive: ${t.arrivalLocation ?? t.arrivalAirport ?? name}`,
            type,
            color,
            time,
            scheduledStart: toScheduledStart(arrTime, time),
            duration:       0,
            locked:         true,
            source:         'logistics',
            address:     t.arrivalAddress ?? t.arrivalLocation ?? undefined,
            coordinates: t.arrivalCoordinates ?? undefined,
            metadata: { transportType: t.type, phase: 'arrival' },
          });
        }
      }
    }

    // ── Accommodation ─────────────────────────────────────────────────────────
    for (const a of log.accommodation ?? []) {
      if (a.checkIn) {
        const time = '15:00';
        newStops.push({
          _id:            new mongoose.Types.ObjectId(),
          date:           toDateString(a.checkIn),
          name:           `Check in: ${a.name ?? 'Accommodation'}`,
          type:           'hotel',
          color:          '#5c35a0',
          time,
          scheduledStart: toScheduledStart(a.checkIn, time),
          duration:       30,
          locked:         true,
          source:         'logistics',
          address:        a.address ?? undefined,
          coordinates:    a.coordinates ?? undefined,
          metadata: { accommodationType: a.type, phase: 'checkin' },
        });
      }
      if (a.checkOut) {
        const time = '11:00';
        newStops.push({
          _id:            new mongoose.Types.ObjectId(),
          date:           toDateString(a.checkOut),
          name:           `Check out: ${a.name ?? 'Accommodation'}`,
          type:           'hotel',
          color:          '#5c35a0',
          time,
          scheduledStart: toScheduledStart(a.checkOut, time),
          duration:       30,
          locked:         true,
          source:         'logistics',
          address:        a.address ?? undefined,
          coordinates:    a.coordinates ?? undefined,
          metadata: { accommodationType: a.type, phase: 'checkout' },
        });
      }
    }

    // ── Venues ────────────────────────────────────────────────────────────────
    const venueEmoji: Record<string, string> = {
      concert: '🎵', conference: '🏛️', restaurant: '🍽️',
      sports: '🏟️', attraction: '🏛️', business: '💼', other: '📍',
    };

    for (const v of log.venues ?? []) {
      if (!v.name || !v.date) continue;

      const time = v.time ?? '20:00';

      let duration = 120;
      if (v.time && v.endTime) {
        const [sh, sm] = v.time.split(':').map(Number);
        const [eh, em] = v.endTime.split(':').map(Number);
        const calc = (eh * 60 + em) - (sh * 60 + sm);
        if (calc > 0) duration = calc;
      }

      const emoji = venueEmoji[v.type] ?? '📍';

      newStops.push({
        _id:            new mongoose.Types.ObjectId(),
        date:           toDateString(v.date),
        name:           `${emoji} ${v.name}`,
        type:           'activity',
        color:          '#55702C',
        time,
        scheduledStart: toScheduledStart(v.date, time),
        duration,
        locked:         true,
        source:         'logistics',
        address:        v.address ?? undefined,
        coordinates:    v.coordinates ?? undefined,
        notes: [
          v.confirmationNumber ? `Ref: ${v.confirmationNumber}` : null,
          v.website            ? `🔗 ${v.website}`              : null,
          v.status === 'confirmed' ? '✅ Confirmed' : '⏳ Not booked',
        ].filter(Boolean).join(' · '),
        metadata: { venueType: v.type },
      });
    }

    // ── Assign stops to days ──────────────────────────────────────────────────
    for (const stop of newStops) {
      let day = itinerary.days.find((d: any) => d.date === stop.date);
      if (!day) {
        itinerary.days.push({ date: stop.date, stops: [] });
        day = itinerary.days[itinerary.days.length - 1];
      }
      const { date, ...stopWithoutDate } = stop;
      day.stops.push(stopWithoutDate);
    }

    itinerary.days = itinerary.days.filter((d: any) => !!d.date);
    itinerary.days.sort((a: any, b: any) => (a.date ?? '').localeCompare(b.date ?? ''));
    for (const day of itinerary.days) {
      day.stops = (day.stops ?? []).filter((s: any) => !!s);
      day.stops.sort((a: any, b: any) =>
        (a.scheduledStart ?? a.time ?? '').localeCompare(b.scheduledStart ?? b.time ?? '')
      );
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