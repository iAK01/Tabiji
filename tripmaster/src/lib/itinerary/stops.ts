import mongoose from 'mongoose';
import TripItinerary from '@/lib/mongodb/models/TripItinerary';
import { pinIfFound } from '@/lib/geo/pinAddress';
import { tripAreas } from '@/lib/geo/tripAreas';

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

const hasPin = (c: any) => Number.isFinite(c?.lat) && Number.isFinite(c?.lng);

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
  return { itinerary, stop: created };
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
