import mongoose from 'mongoose';
import { after } from 'next/server';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import { pinIfFound } from '@/lib/geo/pinAddress';
import { tripAreas } from '@/lib/geo/tripAreas';
import { pinPlace, searchArea } from '@/lib/geo/pinPlace';

// Server-side itinerary writes shared by the routes and the email intake.

export function generateDays(startDate: string | Date, endDate: string | Date) {
  const days = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let current = new Date(start);
  let dayNumber = 1;
  while (current <= end) {
    days.push({ date: current.toISOString().split('T')[0], dayNumber, stops: [] });
    current.setDate(current.getDate() + 1);
    dayNumber++;
  }
  return days;
}

/** The trip's itinerary, created with one day per trip date the first time it's needed. */
export async function ensureItinerary(trip: any) {
  let itinerary = await TripItinerary.findOne({ tripId: trip._id });
  if (!itinerary) {
    itinerary = await TripItinerary.create({ tripId: trip._id, days: generateDays(trip.startDate, trip.endDate) });
  }
  return itinerary;
}

const hasPin = (c: any) => Number.isFinite(c?.lat) && Number.isFinite(c?.lng)
  && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;

/**
 * Where a transport stop goes, as it's stored: { name?, address?, coordinates? },
 * or null when nothing usable was given. A typed address with no pin is pinned
 * the way a stop's own address is.
 */
export async function cleanDestination(raw: unknown, trip: any): Promise<{ name?: string; address?: string; coordinates?: { lat: number; lng: number } } | null> {
  if (!raw || typeof raw !== 'object') return null;
  const r       = raw as Record<string, any>;
  const name    = typeof r.name    === 'string' ? r.name.trim().slice(0, 300)    : '';
  const address = typeof r.address === 'string' ? r.address.trim().slice(0, 500) : '';
  let coordinates = hasPin(r.coordinates) ? { lat: r.coordinates.lat, lng: r.coordinates.lng } : null;
  if (!coordinates && address) coordinates = await pinIfFound(address, tripAreas(trip));
  if (!name && !address && !coordinates) return null;
  return {
    ...(name && { name }),
    ...(address && { address }),
    ...(coordinates && { coordinates: { lat: coordinates.lat, lng: coordinates.lng } }),
  };
}

export type AddStopResult =
  | { itinerary: any; stop: any; error?: undefined }
  | { error: 'Not found' | 'Day not found'; itinerary?: undefined; stop?: undefined };

/** Adds a stop on the trip day matching `dayDate`, pinning a typed address when it can. */
export async function addStop(trip: any, dayDate: string, stop: any): Promise<AddStopResult> {
  // An address with no pin yet (saved before the form's lookup answered, or queued offline)
  if (stop && !hasPin(stop.coordinates)) {
    delete stop.coordinates;
    const pin = typeof stop.address === 'string' && stop.address.trim()
      ? await pinIfFound(stop.address, tripAreas(trip))
      : null;
    if (pin) stop.coordinates = pin;
  }
  if (stop && 'to' in stop) {
    const to = await cleanDestination(stop.to, trip);
    if (to) stop.to = to;
    else delete stop.to;
  }

  const itinerary = await TripItinerary.findOne({ tripId: trip._id });
  if (!itinerary) return { error: 'Not found' };

  const day = itinerary.days.find((d: any) =>
    new Date(d.date).toDateString() === new Date(dayDate).toDateString()
  );
  if (!day) return { error: 'Day not found' };

  const created = { ...stop, _id: new mongoose.Types.ObjectId(), completed: false };
  day.stops.push(created);
  day.stops.sort((a: any, b: any) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  itinerary.markModified('days');
  await itinerary.save();
  // The address didn't pin ("Place Bab El Had, Avenue Hassan II" is a street): try the place's name
  if (!created.coordinates && typeof created.address === 'string' && created.address.trim()) {
    pinStopLater(trip, created._id.toString(), { name: created.name, address: created.address });
  }
  return { itinerary, stop: created };
}

/**
 * After the reply: look the stop's place up by name (pinPlace — certain matches
 * only) and pin it, unless it was pinned or its address changed meanwhile.
 * Name lookups take seconds, too long to hold a save for.
 */
export function pinStopLater(trip: any, stopId: string, place: { name?: string; address?: string }) {
  after(async () => {
    try {
      const areas = tripAreas(trip);
      const area  = searchArea(areas, null, trip.destination?.country);
      if (!area) return;
      const pin = await pinPlace(place, area, areas);
      if (!pin) return;
      const ids = [stopId, ...(mongoose.Types.ObjectId.isValid(stopId) ? [new mongoose.Types.ObjectId(stopId)] : [])];
      await TripItinerary.collection.updateOne(
        { tripId: trip._id },
        { $set: { 'days.$[].stops.$[s].coordinates': { lat: pin.lat, lng: pin.lng } } },
        { arrayFilters: [{ 's._id': { $in: ids }, 's.address': place.address, 's.coordinates': null }] },
      );
    } catch (err) {
      console.error('[pinStopLater]', err);
    }
  });
}

/** The stop with this id and its day, or null. */
export function findStop(itinerary: any, stopId: string): { day: any; stop: any; index: number } | null {
  for (const day of itinerary?.days ?? []) {
    const index = (day.stops ?? []).findIndex((s: any) => s?._id?.toString() === stopId);
    if (index !== -1) return { day, stop: day.stops[index], index };
  }
  return null;
}

export async function removeStop(tripId: string, stopId: string): Promise<boolean> {
  const itinerary = await TripItinerary.findOne({ tripId });
  const found = findStop(itinerary, stopId);
  if (!itinerary || !found) return false;
  found.day.stops.splice(found.index, 1);
  itinerary.markModified('days');
  await itinerary.save();
  return true;
}
