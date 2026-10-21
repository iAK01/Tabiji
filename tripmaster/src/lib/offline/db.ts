import { openDB } from 'idb';
import { isOffline } from './connectivity';
import { reportSyncRejected } from './saveErrors';

const DB_NAME = 'tabiji-offline';
const DB_VERSION = 4;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {

      if (oldVersion < 1) {
        db.createObjectStore('tripList');
        db.createObjectStore('queue', { autoIncrement: true });
      }

      if (oldVersion < 3) {
        db.createObjectStore('tripCache', { keyPath: 'tripId' });
      }

      if (oldVersion < 4) {
        db.createObjectStore('pinnedFiles', { keyPath: 'id' });
      }
    },
  });
}

/* -------- Trip List -------- */

export async function saveTripList(trips: any[]) {
  const db = await getDB();
  await db.put('tripList', trips, 'all');
}

export async function getTripList() {
  const db = await getDB();
  return db.get('tripList', 'all');
}

/* -------- Trip Detail Cache -------- */

export async function saveTripCache(tripId: string, data: any) {
  const db = await getDB();
  await db.put('tripCache', { tripId, data });
}

export async function getTripCache(tripId: string) {
  const db = await getDB();
  const entry = await db.get('tripCache', tripId);
  return entry?.data;
}

/* -------- Queue -------- */

export async function queueAction(action: any) {
  const db = await getDB();
  await db.add('queue', action);
  notifyQueueChanged();
}

export async function getQueueCount(): Promise<number> {
  const db = await getDB();
  return db.count('queue');
}

// Lets the UI show how many changes are still waiting to sync (OfflineIndicator).
const QUEUE_EVENT = 'tabiji:queue-changed';

function notifyQueueChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function subscribeQueue(listener: () => void): () => void {
  window.addEventListener(QUEUE_EVENT, listener);
  return () => window.removeEventListener(QUEUE_EVENT, listener);
}

export async function getQueue() {
  const db = await getDB();
  return db.getAll('queue');
}

export async function clearQueue() {
  const db = await getDB();
  const tx = db.transaction('queue', 'readwrite');
  await tx.store.clear();
  await tx.done;
  notifyQueueChanged();
}

/* -------- Queue replay --------
 * One correct dispatcher for every action type queueAction() can be called with —
 * previously only CREATE_TRIP actually got resent on reconnect; everything else
 * (ADD_STOP, ADD_TRANSPORT, etc.) was silently dropped the next time the queue was
 * cleared. Each action type here mirrors the exact online-path fetch its caller
 * already makes, including any payload reshaping that path does before sending.
 * Returns true/false for whether the action was handled — a network failure or server
 * error returns false so flushQueue() stops and leaves it queued for next time, rather
 * than skipping ahead out of order. A permanent rejection counts as handled (see isDone).
 */
async function dispatchQueuedAction(action: any): Promise<boolean> {
  try {
    let res: Response;
    switch (action.type) {
      case 'CREATE_TRIP':
        res = await fetch('/api/trips', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.body),
        });
        break;

      case 'UPDATE_TRIP':
        res = await fetch(`/api/trips/${action.tripId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });
        break;

      case 'ADD_STOP': {
        const { dayDate, stop } = action.payload;
        res = await fetch(`/api/trips/${action.tripId}/itinerary/stops`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayDate,
            stop: { ...stop, scheduledStart: `${dayDate.split('T')[0]}T${stop.scheduledStart}:00`, duration: stop.duration ?? 60 },
          }),
        });
        break;
      }

      case 'RESCHEDULE_STOP': {
        const { stopId, ...rest } = action.payload;
        res = await fetch(`/api/trips/${action.tripId}/itinerary/stops/${stopId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rest),
        });
        break;
      }

      case 'DELETE_STOP':
        res = await fetch(`/api/trips/${action.tripId}/itinerary/stops/${action.stopId}`, { method: 'DELETE' });
        break;

      case 'CALCULATE_TRAVEL':
        res = await fetch(`/api/trips/${action.tripId}/itinerary/calculate-travel`, { method: 'POST' });
        break;

      case 'ADD_TRANSPORT':
      case 'EDIT_TRANSPORT': {
        const isEdit = action.type === 'EDIT_TRANSPORT';
        const url = isEdit
          ? `/api/trips/${action.tripId}/logistics/transport/${action.index}`
          : `/api/trips/${action.tripId}/logistics/transport`;
        res = await fetch(url, {
          method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });
        break;
      }

      case 'ADD_ACCOM':
      case 'EDIT_ACCOM': {
        const isEdit = action.type === 'EDIT_ACCOM';
        const url = isEdit
          ? `/api/trips/${action.tripId}/logistics/accommodation/${action.index}`
          : `/api/trips/${action.tripId}/logistics/accommodation`;
        res = await fetch(url, {
          method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });
        break;
      }

      case 'ADD_VENUE':
      case 'EDIT_VENUE': {
        const isEdit = action.type === 'EDIT_VENUE';
        const url = isEdit
          ? `/api/trips/${action.tripId}/logistics/venues/${action.index}`
          : `/api/trips/${action.tripId}/logistics/venues`;
        res = await fetch(url, {
          method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });
        break;
      }

      case 'DELETE_LOGISTICS_ITEM': {
        const { kind, index } = action.payload;
        const segment = kind === 'transport' ? 'transport' : kind === 'accom' ? 'accommodation' : 'venues';
        res = await fetch(`/api/trips/${action.tripId}/logistics/${segment}/${index}`, { method: 'DELETE' });
        break;
      }

      case 'ADD_EXPENSE': {
        // The receipt travels as a real Blob/File through IndexedDB's structured clone
        // (same mechanism the pinned-file cache already relies on), so it survives being
        // queued offline. Rebuilt into multipart form data here, same shape the online
        // POST path sends.
        const fd = new FormData();
        const p  = action.payload ?? {};
        fd.append('date', p.date ?? '');
        fd.append('category', p.category ?? 'other');
        fd.append('amount', String(p.amount ?? ''));
        fd.append('currency', p.currency ?? 'EUR');
        if (p.gratuity) fd.append('gratuity', String(p.gratuity));
        if (p.notes) fd.append('notes', p.notes);
        fd.append('payer', p.payer ?? 'tbc');
        fd.append('status', p.status ?? 'captured');
        if (p.linkedTo) fd.append('linkedTo', JSON.stringify(p.linkedTo));
        if (action.receiptBlob) fd.append('receipt', action.receiptBlob, action.receiptName ?? 'receipt.jpg');
        res = await fetch(`/api/trips/${action.tripId}/expenses`, { method: 'POST', body: fd });
        break;
      }

      case 'TOGGLE_PACKED':
        res = await fetch(`/api/trips/${action.tripId}/packing`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });
        break;

      case 'ADD_PACKING_ITEM':
        res = await fetch(`/api/trips/${action.tripId}/packing`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });
        break;

      case 'COMPLETE_TODO':
        res = await fetch(`/api/trips/${action.tripId}/files/${action.fileId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: true }),
        });
        break;

      case 'SET_NOTIFICATION_PREFS':
        res = await fetch('/api/user/notification-preferences', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });
        break;

      case 'SET_BOOKING_REMINDERS':
        res = await fetch(`/api/trips/${action.tripId}/logistics/reminders`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });
        break;

      case 'MARK_NOTIFICATIONS_READ':
        res = await fetch('/api/user/notifications', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'read' }),
        });
        break;

      case 'DISMISS_PICK':
        res = await fetch(`/api/trips/${action.tripId}/culture`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'dismissPick', ...action.payload }),
        });
        break;

      default:
        // Unrecognised action type — drop it rather than block the queue forever.
        return true;
    }
    return isDone(res, action);
  } catch {
    return false;
  }
}

// What a queued action was, in the user's terms — for the "couldn't be saved" message.
function describeAction(action: any): string {
  const p = action.payload ?? {};
  switch (action.type) {
    case 'CREATE_TRIP':             return `the new trip${action.body?.name ? ` “${action.body.name}”` : ''}`;
    case 'UPDATE_TRIP':             return 'an edit to your trip details';
    case 'ADD_STOP':                return `the itinerary stop${p.stop?.name ? ` “${p.stop.name}”` : ''}`;
    case 'RESCHEDULE_STOP':         return 'a change to an itinerary stop';
    case 'DELETE_STOP':             return 'removing an itinerary stop';
    case 'CALCULATE_TRAVEL':        return 'recalculated travel times';
    case 'ADD_TRANSPORT':
    case 'EDIT_TRANSPORT':          return 'a transport booking';
    case 'ADD_ACCOM':
    case 'EDIT_ACCOM':              return `the stay${p.name ? ` “${p.name}”` : ''}`;
    case 'ADD_VENUE':
    case 'EDIT_VENUE':              return `the venue${p.name ? ` “${p.name}”` : ''}`;
    case 'DELETE_LOGISTICS_ITEM':   return 'removing a booking';
    case 'ADD_EXPENSE':             return 'an expense';
    case 'TOGGLE_PACKED':           return 'a packing-list change';
    case 'ADD_PACKING_ITEM':        return `the packing item${p.name ? ` “${p.name}”` : ''}`;
    case 'COMPLETE_TODO':           return 'a completed to-do';
    case 'SET_NOTIFICATION_PREFS':  return 'your notification settings';
    case 'SET_BOOKING_REMINDERS':   return 'a booking’s reminder setting';
    case 'MARK_NOTIFICATIONS_READ': return 'marking notifications read';
    case 'DISMISS_PICK':            return `hiding${p.name ? ` “${p.name}”` : ' a pick'} in Discover`;
    default:                        return 'a change';
  }
}

// A 4xx the server will give on every retry (deleted trip, invalid data) can never
// succeed — left at the head of the queue it would block every change behind it
// forever, so it's dropped, but never quietly: the user is told which change was lost.
// Expired sessions (401) and rate limits stay queued for a later retry.
function isDone(res: Response, action: any): boolean {
  if (res.ok) return true;
  const permanent = res.status >= 400 && res.status < 500 && ![401, 408, 429].includes(res.status);
  if (permanent) {
    console.warn(`[offline queue] dropped a queued change the server rejected (${res.status})`, action);
    reportSyncRejected(describeAction(action), res.status);
  }
  return permanent;
}

let flushInFlight = false;

type FlushResult = { processed: number; remaining: number; synced: any[] };

// Replays every queued action in order, stopping (not skipping) on the first failure
// so nothing is lost or reordered. Safe to call opportunistically and often — on
// mount, on reconnect, etc. — it no-ops immediately if offline or if a flush is
// already running in this tab or any other.
export async function flushQueue(): Promise<FlushResult> {
  if (flushInFlight || isOffline()) {
    return { processed: 0, remaining: (await getQueue()).length, synced: [] };
  }
  flushInFlight = true;
  try {
    // One flush across every open tab/window, so two can't replay the same action.
    if (navigator.locks) {
      return await navigator.locks.request('tabiji-flush-queue', { ifAvailable: true }, async lock =>
        lock ? replayQueue() : { processed: 0, remaining: (await getQueue()).length, synced: [] });
    }
    return await replayQueue();
  } finally {
    flushInFlight = false;
  }
}

// Takes the oldest action each time round rather than a snapshot, so anything queued
// while the flush is running (sendOrQueue queues behind a non-empty queue) is replayed
// in the same pass, in order.
async function replayQueue(): Promise<FlushResult> {
  const db = await getDB();
  const synced: any[] = [];
  for (;;) {
    const cursor = await db.transaction('queue').store.openCursor();
    if (!cursor) break;
    const { key, value: action } = cursor;
    const ok = await dispatchQueuedAction(action);
    if (!ok) break;
    await db.delete('queue', key);
    synced.push(action);
    notifyQueueChanged();
  }
  const remaining = await db.count('queue');
  return { processed: synced.length, remaining, synced };
}

/* -------- Sign-out --------
 * Drops saved trips and downloaded documents (the service worker clears its own caches
 * when it sees the sign-out request). The queue is kept — those are unsynced edits.
 */
export async function clearOfflineData() {
  const db = await getDB();
  await Promise.all(['tripList', 'tripCache', 'pinnedFiles'].map(store => db.clear(store)));
  try {
    Object.keys(localStorage).filter(k => k.startsWith('tabiji-offline:')).forEach(k => localStorage.removeItem(k));
  } catch { /* storage blocked */ }
}

/* -------- Pinned Files -------- */

export interface PinnedFile {
  id:        string;
  tripId:    string;
  name:      string;
  type:      string;
  mimeType:  string;
  blob:      Blob;
  cachedAt:  number;
}

export async function putPinnedFile(entry: PinnedFile) {
  const db = await getDB();
  await db.put('pinnedFiles', entry);
}

export async function getPinnedFile(id: string): Promise<PinnedFile | undefined> {
  const db = await getDB();
  return db.get('pinnedFiles', id);
}

export async function deletePinnedFile(id: string) {
  const db = await getDB();
  await db.delete('pinnedFiles', id);
}

export async function getPinnedFileIdsByTrip(tripId: string): Promise<Set<string>> {
  const db  = await getDB();
  const all = await db.getAll('pinnedFiles');
  return new Set(all.filter(f => f.tripId === tripId).map(f => f.id));
}