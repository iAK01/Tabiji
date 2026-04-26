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