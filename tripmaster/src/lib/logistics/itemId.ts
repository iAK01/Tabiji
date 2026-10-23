import mongoose from 'mongoose';

// Bookings are stored by position, and positions shift when one is deleted. Each
// gets an id of its own so its itinerary stops keep what was added on them —
// your note, "Not going", a new time — across every logistics sync.
export const LOGISTICS_ARRAYS = { transport: 'transportation', accommodation: 'accommodation', venue: 'venues' } as const;

export function withItemId<T extends Record<string, any>>(item: T, existing?: { id?: string } | null): T & { id: string } {
  return { ...item, id: item?.id ?? existing?.id ?? new mongoose.Types.ObjectId().toString() };
}
