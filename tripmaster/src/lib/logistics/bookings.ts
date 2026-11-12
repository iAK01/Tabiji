import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import { syncLogisticsToItinerary } from '@/lib/itinerary/syncLogistics';
import { withItemId, LOGISTICS_ARRAYS } from '@/lib/logistics/itemId';
import { relinkAfterRemoval, type BookingKind } from '@/lib/logistics/relink';

// Adding and removing bookings server-side: the logistics routes and the email
// intake go through the same steps (own id, save, mirror onto the itinerary).

export async function addBooking(tripId: string, kind: BookingKind, body: any) {
  let logistics = await TripLogistics.findOne({ tripId });
  if (!logistics) logistics = await TripLogistics.create({ tripId, transportation: [], accommodation: [], venues: [] });
  const key = LOGISTICS_ARRAYS[kind];
  if (!Array.isArray(logistics[key])) logistics[key] = [];
  const item = withItemId(body);
  logistics[key].push(item);
  await logistics.save();
  await syncLogisticsToItinerary(tripId, logistics);
  return { logistics, item, index: logistics[key].length - 1 };
}

/** Where a booking is now, found by its own id (positions shift when one is removed). */
export function bookingIndex(logistics: any, kind: BookingKind, itemId: string): number {
  const list = logistics?.[LOGISTICS_ARRAYS[kind]];
  return Array.isArray(list) ? list.findIndex((x: any) => x?.id === itemId) : -1;
}

/** Removes a booking by its id. Links on the bookings after it move up with them. */
export async function removeBooking(tripId: string, kind: BookingKind, itemId: string): Promise<boolean> {
  const logistics = await TripLogistics.findOne({ tripId });
  const i = bookingIndex(logistics, kind, itemId);
  if (!logistics || i < 0) return false;
  logistics[LOGISTICS_ARRAYS[kind]].splice(i, 1);
  await logistics.save();
  await relinkAfterRemoval(tripId, kind, i);
  await syncLogisticsToItinerary(tripId, logistics);
  return true;
}
