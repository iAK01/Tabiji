import { openDB } from 'idb';

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
}

/* -------- Queue replay --------
 * One correct dispatcher for every action type queueAction() can be called with —
 * previously only CREATE_TRIP actually got resent on reconnect; everything else
 * (ADD_STOP, ADD_TRANSPORT, etc.) was silently dropped the next time the queue was
 * cleared. Each action type here mirrors the exact online-path fetch its caller
 * already makes, including any payload reshaping that path does before sending.
 * Returns true/false for whether the action was (successfully) handled — a network
 * failure returns false so flushQueue() stops and leaves it queued for next time,
 * rather than skipping ahead out of order.
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

      default:
        // Unrecognised action type — drop it rather than block the queue forever.
        return true;
    }
    return res.ok;
  } catch {
    return false;
  }
}

let flushInFlight = false;

// Replays every queued action in order, stopping (not skipping) on the first failure
// so nothing is lost or reordered. Safe to call opportunistically and often — on
// mount, on the browser's 'online' event, etc. — it no-ops immediately if offline
// or if a flush is already running.
export async function flushQueue(): Promise<{ processed: number; remaining: number }> {
  if (flushInFlight || typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, remaining: (await getQueue()).length };
  }
  flushInFlight = true;
  try {
    const db      = await getDB();
    const keys    = await db.getAllKeys('queue');
    const actions = await db.getAll('queue');
    let processed = 0;
    for (let i = 0; i < actions.length; i++) {
      const ok = await dispatchQueuedAction(actions[i]);
      if (!ok) break;
      await db.delete('queue', keys[i]);
      processed++;
    }
    const remaining = await db.count('queue');
    return { processed, remaining };
  } finally {
    flushInFlight = false;
  }
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