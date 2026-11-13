'use client';

import { sendOrQueue } from '@/lib/offline/writes';
import { readSaved } from '@/lib/offline/saveErrors';

/**
 * "I've sorted this" on a journey the map asked about (sorted), or asking again.
 * `next` is every sorted journey once this one's changed — shown at once and in
 * the offline copy. Resolves with what the server now has (or `next`, queued
 * offline); rejects when it can't be saved or queued, for the caller to undo.
 */
export async function saveGapSorted(tripId: string, gap: string, sorted: boolean, next: Set<string>): Promise<Set<string>> {
  const res = await sendOrQueue(
    { type: 'DISMISS_GAP', tripId, payload: { gap, dismissed: sorted } },
    () => fetch(`/api/trips/${tripId}/itinerary`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ gap, dismissed: sorted }),
    }),
    { [`/api/trips/${tripId}/itinerary`]: (saved: any) => saved && { ...saved, dismissedGaps: [...next] } },
  );
  if (!res) return next;
  const data = await readSaved(res);
  return new Set(Array.isArray(data.dismissedGaps) ? data.dismissedGaps : [...next]);
}
