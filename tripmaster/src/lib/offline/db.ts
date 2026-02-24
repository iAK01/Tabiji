import { openDB } from 'idb';

const DB_NAME = 'tabiji-offline';
const DB_VERSION = 3;

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