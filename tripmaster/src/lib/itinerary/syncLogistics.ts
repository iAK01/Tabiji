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

    const itineraryDoc = await TripItinerary.findOne({ tripId });
    if (!itineraryDoc) return;

    const itinerary = itineraryDoc.toObject() as { _id: any; days: any[] };

    for (const day of itinerary.days) {
      if (day.date) day.date = toDateString(day.date);
    }

    for (const day of itinerary.days) {
      day.stops = (day.stops ?? []).filter((s: any) => s.source !== 'logistics');
    }

    {
      const dayMap = new Map<string, any>();
      for (const day of itinerary.days) {
        if (!day.date) continue;
        const existing = dayMap.get(day.date);
        if (!existing) {
          dayMap.set(day.date, day);
        } else {
          const keeper = existing.dayNumber != null ? existing : day;
          const other  = existing.dayNumber != null ? day : existing;
          keeper.stops = [
            ...(keeper.stops ?? []),
            ...(other.stops ?? []).filter((s: any) => s.source !== 'logistics'),
          ];
          dayMap.set(day.date, keeper);
        }
      }
      itinerary.days = Array.from(dayMap.values());
    }

    const newStops: any[] = [];

    // ── Transport ─────────────────────────────────────────────────────────────
    for (const [tIdx, t] of (log.transportation ?? []).entries()) {
      const depTime = t.departureTime;
      const arrTime = t.arrivalTime;
      const name    = transportStopName(t);
      const color   = stopColor(t.type ?? 'flight');
      const type    = t.type === 'flight' ? 'flight' : 'transport';

      let duration = 60;
      if (depTime && arrTime) {
        const diff = Math.round(
          (new Date(arrTime).getTime() - new Date(depTime).getTime()) / 60000
        );
        if (diff > 0) duration = diff;
      }

      if (depTime) {
        const time = toTimeString(depTime);

        // Airport check-in stop: 2 hours before every flight departure
        if (t.type === 'flight') {
          const checkInMs      = new Date(depTime).getTime() - 2 * 60 * 60 * 1000;
          const checkInDt      = new Date(checkInMs).toISOString();
          const checkInTime    = toTimeString(checkInDt);
          const checkInDateStr = toDateString(checkInDt);
          newStops.push({
            _id:            new mongoose.Types.ObjectId(),
            date:           checkInDateStr,
            name:           `Airport check-in — ${t.departureLocation ?? 'Airport'}`,
            type:  'checkin',
            color: '#0369a1',
            time:           checkInTime,
            scheduledStart: `${checkInDateStr}T${checkInTime}:00`,
            duration:       120,
            locked:         false,
            source:         'logistics',
            address:        t.departureLocation ?? undefined,
            coordinates:    t.departureCoordinates ?? undefined,
            metadata:       { transportType: 'flight', phase: 'airport_checkin' },
            logisticsRef:   { collection: 'transport', index: tIdx },
          });
        }

        const flightNotes = t.type === 'flight' ? [
          t.confirmationNumber ? `Ref: ${t.confirmationNumber}` : null,
          t.details?.seat ? `Seat: ${t.details.seat}` : null,
          (t.status === 'confirmed' || t.status === 'booked') ? '✅ Confirmed' : '⏳ Not confirmed',
        ].filter(Boolean).join(' · ') || undefined : undefined;

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
          notes:          flightNotes,
          address: ['car','taxi','private_transfer','bicycle'].includes(t.type)
            ? (t.arrivalLocation ?? undefined)
            : (t.departureAddress ?? t.departureLocation ?? undefined),
          coordinates: ['car','taxi','private_transfer','bicycle'].includes(t.type)
            ? (t.arrivalCoordinates ?? undefined)
            : (t.departureCoordinates ?? undefined),
          metadata:     { transportType: t.type, phase: 'departure' },
          logisticsRef: { collection: 'transport', index: tIdx },
        });
      }

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
            metadata:     { transportType: t.type, phase: 'arrival' },
            logisticsRef: { collection: 'transport', index: tIdx },
          });
        }
      }
    }

    // ── Accommodation ─────────────────────────────────────────────────────────
    for (const [aIdx, a] of (log.accommodation ?? []).entries()) {
      const accomNotes = [
        a.confirmationNumber ? `Ref: ${a.confirmationNumber}` : null,
        (a.status === 'confirmed' || a.status === 'booked') ? '✅ Confirmed' : '⏳ Not confirmed',
      ].filter(Boolean).join(' · ') || undefined;

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
          notes:          accomNotes,
          address:        a.address ?? undefined,
          coordinates:    a.coordinates ?? undefined,
          metadata:       { accommodationType: a.type, phase: 'checkin' },
          logisticsRef:   { collection: 'accommodation', index: aIdx },
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
          notes:          accomNotes,
          address:        a.address ?? undefined,
          coordinates:    a.coordinates ?? undefined,
          metadata:       { accommodationType: a.type, phase: 'checkout' },
          logisticsRef:   { collection: 'accommodation', index: aIdx },
        });
      }

      if (a.includesBreakfast && a.checkIn && a.checkOut) {
        const bfTime = a.breakfastTime ?? '08:00';
        const cur = new Date(toDateString(a.checkIn) + 'T12:00:00');
        cur.setDate(cur.getDate() + 1);
        const endDate = new Date(toDateString(a.checkOut) + 'T12:00:00');
        while (cur <= endDate) {
          const date = toDateString(cur);
          newStops.push({
            _id:            new mongoose.Types.ObjectId(),
            date,
            name:           `Breakfast — ${a.name ?? 'Hotel'}`,
            type:           'meal',
            color:          '#b45309',
            time:           bfTime,
            scheduledStart: `${date}T${bfTime}:00`,
            duration:       45,
            locked:         false,
            source:         'logistics',
            address:        a.address ?? undefined,
            coordinates:    a.coordinates ?? undefined,
            metadata:       { accommodationType: a.type, phase: 'breakfast' },
            logisticsRef:   { collection: 'accommodation', index: aIdx },
          });
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    // ── Venues ────────────────────────────────────────────────────────────────
    const venueEmoji: Record<string, string> = {
      concert: '🎵', conference: '🏛️', restaurant: '🍽️',
      sports: '🏟️', attraction: '🏛️', business: '💼', other: '📍',
    };

    for (const [vIdx, v] of (log.venues ?? []).entries()) {
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
          (v.status === 'confirmed' || v.status === 'booked') ? '✅ Confirmed' : '⏳ Not booked',
        ].filter(Boolean).join(' · '),
        metadata:     { venueType: v.type },
        logisticsRef: { collection: 'venue', index: vIdx },
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