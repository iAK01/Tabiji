import { openDB } from 'idb';

const DB_NAME = 'tabiji-offline';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('trips')) {
        db.createObjectStore('trips', { keyPath: '_id' });
      }

      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { autoIncrement: true });
      }
    },
  });
}

export async function saveTrips(trips: any[]) {
  const db = await getDB();
  const tx = db.transaction('trips', 'readwrite');
  for (const trip of trips) {
    await tx.store.put(trip);
  }
  await tx.done;
}

export async function getTrips() {
  const db = await getDB();
  return db.getAll('trips');
}

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