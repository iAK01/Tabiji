import { queueAction } from './db';
import { isOffline, markNetworkDown } from './connectivity';
import { refreshSavedData } from './warm';
import { DATA_CACHE } from './sw';

// GET path → function from the saved response body to its updated body (null/undefined = leave as is).
export type SavedDataUpdates = Record<string, (saved: any) => any>;

/**
 * Sends a write now, or queues it for replay (flushQueue in ./db) when there's no working
 * connection — including wifi that's connected but not getting through, where
 * navigator.onLine stays true and the fetch just fails. Returns the response, or null if
 * the action was queued; callers treat null exactly like their old offline branch.
 *
 * `optimistic` is applied to the saved copies of GET responses when the action is queued,
 * so the change still shows after leaving and reopening a tab offline (every tab reads
 * those copies). A successful send re-saves the trip's data from the server instead.
 */
export async function sendOrQueue(
  action: { type: string; tripId?: string; [key: string]: unknown },
  send: () => Promise<Response>,
  optimistic?: SavedDataUpdates,
): Promise<Response | null> {
  if (!isOffline()) {
    try {
      const res = await send();
      if (res.ok) refreshSavedData(action.tripId);
      return res;
    } catch {
      markNetworkDown();
    }
  }
  await queueAction(action);
  if (optimistic) await patchSavedData(optimistic);
  return null;
}

export async function patchSavedData(updates: SavedDataUpdates) {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(DATA_CACHE);
    for (const [path, update] of Object.entries(updates)) {
      const key   = new URL(path, location.origin).href;
      const saved = await cache.match(key, { ignoreVary: true });
      const next  = update(saved ? await saved.json().catch(() => null) : null);
      if (next == null) continue;
      await cache.put(key, new Response(JSON.stringify(next), { headers: { 'Content-Type': 'application/json' } }));
    }
  } catch {
    // Storage unavailable — the change still shows on screen and is still queued.
  }
}

// A trip-document change, mirrored into both the trip and the trip list.
export function savedTripPatch(tripId: string, patch: object): SavedDataUpdates {
  return {
    [`/api/trips/${tripId}`]: saved => saved?.trip && { ...saved, trip: { ...saved.trip, ...patch } },
    '/api/trips': saved => saved?.trips && {
      ...saved,
      trips: saved.trips.map((t: any) => (t._id === tripId ? { ...t, ...patch } : t)),
    },
  };
}

// Placeholder id for something created offline that the server hasn't assigned an id to yet.
export function pendingId() {
  return `pending-${Date.now()}`;
}

export function isPendingId(id: string | undefined) {
  return !!id?.startsWith('pending-');
}
